# Local audio / lyric alignment

The worker aligns supplied lyric text against the exact local playback audio.
Chinese units are individual Han characters; Latin units are words. It does not
split a line's duration evenly between characters. Missing or contradictory
model intervals remain `null` and retain raw predictions for correction.

## Install and invoke

This is an experimental, optional runtime. A standard Mineradio installer
includes the alignment service and worker, but **not** Python, FFmpeg, or the
model. Without them, playback and original lyrics continue normally, and
existing alignment caches can still be used. The model has not passed
singing-accuracy acceptance; do not treat a completed job as proof of correct
character boundaries.

Install Python 3.13 (available as `py -3.13`) and the FFmpeg command-line tool
(available as `ffmpeg` on PATH). From a source checkout, run:

```powershell
& .\lyric-aligner\install.ps1
```

For an installed build, run `install.ps1` from
`<installation directory>\resources\app.asar.unpacked\lyric-aligner`. The
default runtime root is `%LOCALAPPDATA%\Mineradio-oirge\lyric-runtime` for
both installed builds and source checkouts, outside the install directory so
updates cannot remove the model or saved alignments. You can pass
`-RuntimePath` to choose another directory and set `MINERADIO_ALIGN_RUNTIME`
to the same absolute path before launching the player. Installation downloads CPU
PyTorch, pinned dependencies, and the model, requiring several GiB of
disk space and a network connection. The model is stored under the runtime's
`models\Qwen3-ForcedAligner-0.6B` directory. `-SkipModelDownload` leaves
background alignment unavailable until the model is explicitly installed;
playback never downloads it. The desktop service invokes:

```powershell
& <runtime>\venv\Scripts\python.exe `
  <worker>\align.py `
  --request request.json --output result.json `
  --runtime <runtime>
```

Requests contain `audioPath`, optional `audioSha256`, `language`, and `lyrics`.
Each lyric row has `text` and optionally `hintStart`/`hintEnd` in seconds.
Anchors select audio windows, not character durations. Consecutive lines share
up to 24 seconds of audio context. Unanchored audio longer than 180 seconds is
rejected instead of inventing anchors. Input files are only read.

Results use `schemaVersion: 1`, `timeUnit: "seconds"`, and UTF-16 `c0`/`c1`
character ranges compatible with the desktop JavaScript service. Successful
processing does not establish acoustic accuracy. Check `reviewReasons`, missing
times, and `warnings` before accepting an automatically generated timeline.

## Evidence and limitations

The model is `Qwen/Qwen3-ForcedAligner-0.6B`, revision
`c7cbfc2048c462b0d63a45797104fc9db3ad62b7`. Its timestamp classifier uses 80 ms
bins. The SDK's `fix_timestamp` routine interpolates inconsistent predictions;
this worker disables that routine and rejects the inconsistencies instead.
Model raw timestamps remain unchanged for every retained interval. A stack-based
check rejects conflicts with all surviving earlier words, including conflicts
across missing words and line boundaries.

The official model card describes speech alignment; singing, accompaniment,
overlapping vocals, rapid syllables, long notes, and incorrect LRC anchors can
produce unreliable boundaries. Structural coverage is not an accuracy score.
No human-labelled reference boundaries are included in this project.

The local real-song verification fixtures were kept outside the release
checkout under `verification/lyric-alignment`. Each has the original file
SHA-256, embedded lyric request, aligned JSON, summary, and per-word review CSV.
Summaries distinguish valid interval coverage from acoustic accuracy, include
raw prediction diagnostics, and report exact audio/lyric invariants. The source
FLAC/MP3 files are never changed. Full-song tests reuse one model load to avoid
repeated startup cost on CPU.

These fixtures and verification scripts are developer evidence, not bundled
with the Windows installer.

Use `--verify-only` to recheck existing outputs without model inference. That
mode also runs the desktop service's `validateAlignment` against each output.
`verify_music.py --sample` prepares ten lines from the start, middle, and end of
a song; `--create-only` writes the request without running inference.

Primary implementation references:

- https://huggingface.co/Qwen/Qwen3-ForcedAligner-0.6B
- https://github.com/QwenLM/Qwen3-ASR/blob/main/qwen_asr/inference/qwen3_forced_aligner.py
