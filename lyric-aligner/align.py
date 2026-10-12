"""Known-text audio alignment. No timestamps are synthesized for missing units."""

import argparse
import contextlib
import hashlib
import json
import math
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time
import unicodedata


MODEL_ID = "Qwen/Qwen3-ForcedAligner-0.6B"
MODEL_REVISION = "c7cbfc2048c462b0d63a45797104fc9db3ad62b7"
SAMPLE_RATE = 16000
MAX_CHUNK_SECONDS = 24.0
CONTEXT_SECONDS = 0.65
METADATA_PATTERN = re.compile(
    r"^(?:词|曲|作词|作曲|编曲|制作人|制作|监制|混音|录音|母带|和声|合声|"
    r"吉他|贝斯|鼓|出品|发行|版权|OP|SP|Producer|Composer|Lyrics?|"
    r"录音助理|录音工程|混音工程|合声编写)\s*[:：]",
    re.IGNORECASE,
)


def default_runtime():
    override = os.environ.get("MINERADIO_ALIGN_RUNTIME")
    if override:
        return Path(override).expanduser()
    if sys.platform == "win32":
        data_root = os.environ.get("LOCALAPPDATA") or Path.home() / "AppData" / "Local"
    else:
        data_root = os.environ.get("XDG_DATA_HOME") or Path.home() / ".local" / "share"
    return Path(data_root) / "Mineradio-oirge" / "lyric-runtime"


def emit_progress(stage, **fields):
    print(json.dumps({"stage": stage, **fields}, ensure_ascii=True), flush=True)


def write_json(path, data):
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    temp = target.with_name(target.name + ".tmp")
    temp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(temp, target)


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def sha256_file(path):
    digest = hashlib.sha256()
    with open(path, "rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def utf16_offset(text, index):
    return len(text[:index].encode("utf-16-le")) // 2


def is_cjk(char):
    code = ord(char)
    return (
        0x3400 <= code <= 0x4DBF
        or 0x4E00 <= code <= 0x9FFF
        or 0xF900 <= code <= 0xFAFF
        or 0x20000 <= code <= 0x2EBEF
    )


def is_sung_character(char):
    return char == "'" or unicodedata.category(char).startswith(("L", "N"))


def text_units(text):
    """Match Qwen's CJK-character / Latin-word units with original UTF-16 ranges."""
    result = []
    latin_indexes = []

    def flush_latin():
        if latin_indexes:
            part = unit(text, latin_indexes[0], latin_indexes[-1] + 1)
            part["modelText"] = "".join(text[index] for index in latin_indexes)
            result.append(part)
            latin_indexes.clear()

    for index, char in enumerate(text):
        if is_cjk(char):
            flush_latin()
            result.append(unit(text, index, index + 1))
        elif is_sung_character(char):
            latin_indexes.append(index)
        elif char.isspace():
            flush_latin()
    flush_latin()
    return result


def unit(text, start, end):
    return {
        "text": text[start:end],
        "c0": utf16_offset(text, start),
        "c1": utf16_offset(text, end),
    }


def classify_line(row):
    text = str(row.get("text", ""))
    stripped = text.strip()
    if not stripped:
        return "empty"
    if row.get("metadata") is True or METADATA_PATTERN.match(stripped):
        return "metadata"
    if (
        finite(row.get("hintStart"))
        and row["hintStart"] < 8
        and re.search(r"\s[-–]\s", stripped)
    ):
        return "track-credit"
    return ""


def download_model(runtime):
    os.environ.setdefault("HF_HUB_DISABLE_XET", "1")
    os.environ.setdefault("HF_HUB_DOWNLOAD_TIMEOUT", "120")
    from huggingface_hub import snapshot_download

    location = runtime / "models" / "Qwen3-ForcedAligner-0.6B"
    emit_progress("model-download", model=MODEL_ID, revision=MODEL_REVISION)
    snapshot_download(
        MODEL_ID,
        revision=MODEL_REVISION,
        local_dir=str(location),
        allow_patterns=[
            "*.json", "*.txt", "*.safetensors",
        ],
        max_workers=2,
    )
    return location


def load_aligner(runtime, options):
    model_path = runtime / "models" / "Qwen3-ForcedAligner-0.6B"
    if not (model_path / "model.safetensors").is_file():
        raise FileNotFoundError(
            "Local alignment model is missing. Run install.ps1 or use "
            "--download-model explicitly before playback."
        )

    import torch
    from qwen_asr import Qwen3ForcedAligner

    torch.set_num_threads(max(1, min(4, int(options.get("threads", 4)))))
    torch.set_num_interop_threads(1)
    requested = str(options.get("dtype", "float32"))
    dtype = {"float32": torch.float32, "bfloat16": torch.bfloat16}.get(requested)
    if dtype is None:
        raise ValueError("Only CPU float32 and bfloat16 alignment are supported.")
    emit_progress("model-load", device="cpu", dtype=requested)
    aligner = Qwen3ForcedAligner.from_pretrained(
        str(model_path),
        dtype=dtype,
        device_map="cpu",
        attn_implementation="sdpa",
        local_files_only=True,
    )
    # The SDK normally interpolates non-monotonic predictions. Preserve evidence
    # instead; invalid model intervals are flagged for correction below.
    aligner.aligner_processor.fix_timestamp = lambda data: data.tolist()
    return aligner


def decode_audio(path, ffmpeg):
    import numpy as np

    command = [
        ffmpeg, "-nostdin", "-v", "error", "-i", str(path),
        "-map", "0:a:0", "-vn", "-ac", "1", "-ar", str(SAMPLE_RATE),
        "-f", "f32le", "pipe:1",
    ]
    process = subprocess.run(command, capture_output=True, check=False)
    if process.returncode:
        raise RuntimeError(
            "Audio decode failed: "
            + process.stderr.decode("utf-8", errors="replace")[:400]
        )
    audio = np.frombuffer(process.stdout, dtype="<f4").copy()
    if not len(audio):
        raise ValueError("Audio contains no decoded samples.")
    return audio


def prepare_rows(lyrics, duration):
    if not isinstance(lyrics, list) or not lyrics:
        raise ValueError("lyrics must contain non-empty accurate text rows.")
    if len(lyrics) > 2000:
        raise ValueError("Too many lyric rows.")
    rows = []
    excluded = []
    for index, incoming in enumerate(lyrics):
        if not isinstance(incoming, dict):
            raise ValueError("Each lyric row must be an object.")
        row = dict(incoming)
        row["text"] = str(incoming.get("text", ""))
        row["sourceIndex"] = incoming.get("sourceIndex", index)
        if len(row["text"]) > 4000:
            raise ValueError("Lyric row exceeds 4000 characters.")
        kind = classify_line(row)
        if kind:
            excluded.append({
                "sourceIndex": row["sourceIndex"], "text": row["text"], "reason": kind,
            })
        elif text_units(row["text"]):
            rows.append(row)
    if not rows:
        raise ValueError("No singable lyric text remains after filtering metadata.")
    hinted = [finite(row.get("hintStart")) for row in rows]
    if any(hinted) and not all(hinted):
        raise ValueError("Mixed anchored/unanchored rows require corrected line anchors.")
    if all(hinted):
        previous = -1
        for index, row in enumerate(rows):
            start = float(row["hintStart"])
            if start < 0 or start >= duration or start <= previous:
                raise ValueError("Line anchors must increase within the actual audio duration.")
            previous = start
            hinted_end = row.get("hintEnd")
            next_start = rows[index + 1].get("hintStart") if index + 1 < len(rows) else duration
            end = float(hinted_end) if finite(hinted_end) and hinted_end > start else float(next_start)
            row["cropStart"] = max(0.0, start - CONTEXT_SECONDS)
            row["cropEnd"] = min(duration, end + CONTEXT_SECONDS)
            if row["cropEnd"] - row["cropStart"] > MAX_CHUNK_SECONDS:
                row["cropEnd"] = min(duration, start + MAX_CHUNK_SECONDS - CONTEXT_SECONDS)
                row["cropTruncated"] = True
        return rows, excluded, True
    if duration > 180.0:
        raise ValueError(
            "Unanchored audio over 180 seconds requires line anchors. "
            "Do not estimate anchors by distributing total duration."
        )
    return rows, excluded, False


def phrase_groups(rows):
    groups = []
    for row in rows:
        previous = groups[-1][-1] if groups else None
        gap = row["cropStart"] - previous["cropEnd"] if previous else math.inf
        fits = bool(groups) and row["cropEnd"] - groups[-1][0]["cropStart"] <= MAX_CHUNK_SECONDS
        if not groups or gap > 0.5 or not fits:
            groups.append([row])
        else:
            groups[-1].append(row)
    return groups


def discard_conflicting_spans(words, reason):
    """Reject conflicting model evidence without moving/interpolating boundaries.

    Keep a stack of surviving intervals: a reversed prediction can conflict with
    more than its immediate neighbour, including across an already rejected word.
    """
    surviving = []
    for word in words:
        if not finite(word.get("start")) or not finite(word.get("end")):
            continue
        start = word["start"]
        conflict = False
        while surviving and start < surviving[-1]["end"] - 0.000001:
            previous = surviving.pop()
            if reason not in previous["reviewReasons"]:
                previous["reviewReasons"].append(reason)
            previous["start"] = previous["end"] = None
            conflict = True
        if conflict:
            if reason not in word["reviewReasons"]:
                word["reviewReasons"].append(reason)
            word["start"] = word["end"] = None
        else:
            surviving.append(word)


def build_line(row, predicted, offset, crop_end, duration, anchored):
    expected = text_units(row["text"])
    words = []
    line_reasons = []
    count_matches = len(expected) == len(predicted)
    if not count_matches:
        line_reasons.append("token-count-mismatch")
    for index, original in enumerate(expected):
        word = {key: value for key, value in original.items() if key != "modelText"}
        word["start"] = None
        word["end"] = None
        reasons = []
        item = predicted[index] if index < len(predicted) else None
        if not count_matches or item is None or str(item.text) != original.get("modelText", original["text"]):
            reasons.append("missing-or-mismatched-token")
        else:
            start = float(item.start_time) + offset
            end = float(item.end_time) + offset
            word["rawStart"] = round(start, 6)
            word["rawEnd"] = round(end, 6)
            if not math.isfinite(start) or not math.isfinite(end):
                reasons.append("non-finite-span")
            elif start < offset - 0.001 or end > crop_end + 0.001 or end > duration + 0.001:
                reasons.append("out-of-audio-range")
            elif end <= start:
                reasons.append("zero-or-reversed-span")
            else:
                word["start"] = round(start, 6)
                word["end"] = round(end, 6)
                if end - start < 0.035:
                    reasons.append("very-short-span")
                if end - start > 3.0:
                    reasons.append("long-note-check")
                if abs(start - offset) < 0.04 or abs(end - crop_end) < 0.04:
                    reasons.append("crop-boundary-check")
                if (
                    anchored
                    and finite(row.get("hintStart"))
                    and index == 0
                    and abs(start - float(row["hintStart"])) > 1.25
                ):
                    reasons.append("line-anchor-disagreement")
        word["reviewReasons"] = reasons
        words.append(word)
    discard_conflicting_spans(words, "overlapping-or-non-monotonic-span")
    for word in words:
        if any(reason in word["reviewReasons"] for reason in (
            "very-short-span", "crop-boundary-check",
            "overlapping-or-non-monotonic-span",
        )):
            word["start"] = None
            word["end"] = None
    if row.get("cropTruncated"):
        line_reasons.append("long-window-truncated-check")
    if any(word["reviewReasons"] for word in words):
        line_reasons.append("character-correction-required")
    usable = [word for word in words if finite(word["start"]) and finite(word["end"])]
    start = min(word["start"] for word in usable) if usable else None
    end = max(word["end"] for word in usable) if usable else None
    return {
        "text": row["text"],
        "sourceIndex": row["sourceIndex"],
        "start": start,
        "end": end,
        "words": words,
        "reviewReasons": line_reasons,
        "hintStart": row.get("hintStart"),
        "cropStart": offset,
        "cropEnd": crop_end,
    }


def align_request(request, runtime, aligner=None):
    audio_path = Path(str(request.get("audioPath", "")))
    if not audio_path.is_file():
        raise ValueError("audioPath must name an existing local audio file.")
    ffmpeg = request.get("ffmpegPath") or shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("ffmpeg is required to decode the exact playback audio.")
    started = time.monotonic()
    actual_hash = sha256_file(audio_path)
    expected_hash = request.get("audioSha256")
    if expected_hash and actual_hash != str(expected_hash).lower():
        raise ValueError("Audio SHA-256 changed. Refusing mismatched-version alignment.")
    emit_progress("decode-audio")
    audio = decode_audio(audio_path, ffmpeg)
    duration = len(audio) / SAMPLE_RATE
    rows, excluded, anchored = prepare_rows(request.get("lyrics"), duration)
    language = str(request.get("language", "Chinese"))
    if language not in ("Chinese", "English", "Cantonese", "French", "German",
                        "Italian", "Japanese", "Korean", "Portuguese", "Russian", "Spanish"):
        raise ValueError("Language is not supported by the forced aligner.")
    if aligner is None:
        with contextlib.redirect_stdout(sys.stderr):
            aligner = load_aligner(runtime, request.get("options") or {})
    lines = []
    window_count = 0
    alignment_audio_seconds = 0.0
    if anchored:
        groups = [[row] for row in rows] if request.get("options", {}).get("strategy") == "line" else phrase_groups(rows)
        completed = 0
        for group in groups:
            begin = int(group[0]["cropStart"] * SAMPLE_RATE)
            end = int(group[-1]["cropEnd"] * SAMPLE_RATE)
            offset = begin / SAMPLE_RATE
            crop_end = end / SAMPLE_RATE
            window_count += 1
            alignment_audio_seconds += crop_end - offset
            transcript = "\n".join(row["text"] for row in group)
            emit_progress("align", completed=completed, total=len(rows))
            with contextlib.redirect_stdout(sys.stderr):
                predicted = list(aligner.align(
                    audio=(audio[begin:end], SAMPLE_RATE), text=transcript, language=language,
                )[0])
            cursor = 0
            for row in group:
                count = len(text_units(row["text"]))
                lines.append(build_line(
                    row, predicted[cursor:cursor + count], offset, crop_end, duration, True,
                ))
                cursor += count
                completed += 1
    else:
        window_count = 1
        alignment_audio_seconds = duration
        transcript = "\n".join(row["text"] for row in rows)
        emit_progress("align", completed=0, total=1)
        with contextlib.redirect_stdout(sys.stderr):
            predicted = list(aligner.align(
                audio=(audio, SAMPLE_RATE), text=transcript, language=language,
            )[0])
        cursor = 0
        for row in rows:
            count = len(text_units(row["text"]))
            lines.append(build_line(row, predicted[cursor:cursor + count], 0, duration, duration, False))
            cursor += count
    # Cross-line context overlap is possible; do not let it cause double highlights.
    discard_conflicting_spans(
        [word for line in lines for word in line["words"]], "cross-line-overlap",
    )
    for line in lines:
        usable = [word for word in line["words"] if finite(word["start"]) and finite(word["end"])]
        line["start"] = min(word["start"] for word in usable) if usable else None
        line["end"] = max(word["end"] for word in usable) if usable else None
        if any(word["reviewReasons"] for word in line["words"]):
            if "character-correction-required" not in line["reviewReasons"]:
                line["reviewReasons"].append("character-correction-required")
    reviewed = sum(bool(word["reviewReasons"]) for line in lines for word in line["words"])
    return {
        "schemaVersion": 1,
        "timeUnit": "seconds",
        "engine": "qwen3-forced-aligner-0.6b-raw",
        "model": MODEL_ID,
        "modelRevision": MODEL_REVISION,
        "language": language,
        "audioSha256": actual_hash,
        "audioDuration": duration,
        "inferenceWindowCount": window_count,
        "alignmentAudioSeconds": round(alignment_audio_seconds, 6),
        "timestampResolutionSeconds": 0.08,
        "timestampInterpolation": False,
        "lines": lines,
        "excludedLines": excluded,
        "warnings": [
            "Singing/BGM is outside the forced aligner's documented speech domain. "
            "Model intervals require listening review.",
            "Line anchors select audio windows only; no character duration is "
            "inferred from line length.",
            "The model predicts 80 ms timestamp bins. These are automatically "
            "predicted boundaries, not sample-accurate human annotations.",
        ],
        "reviewCharacterCount": reviewed,
        "elapsedSeconds": round(time.monotonic() - started, 3),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--request")
    parser.add_argument("--output")
    parser.add_argument("--runtime", default=str(default_runtime()))
    parser.add_argument("--download-model", action="store_true")
    args = parser.parse_args()
    runtime = Path(args.runtime).resolve()
    if args.download_model:
        download_model(runtime)
        return 0
    if not args.request or not args.output:
        parser.error("--request and --output are required for alignment.")
    try:
        request = json.loads(Path(args.request).read_text(encoding="utf-8-sig"))
        result = align_request(request, runtime)
        write_json(args.output, result)
        emit_progress("complete", lines=len(result["lines"]),
                      reviewCharacters=result["reviewCharacterCount"])
        return 0
    except Exception as error:
        write_json(args.output, {
            "schemaVersion": 1, "timeUnit": "seconds", "error": type(error).__name__,
            "message": str(error)[:1000],
        })
        print(str(error), file=sys.stderr, flush=True)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
