// shared/lyricSegmentationPrompt.mjs
// Lyric word-segmentation prompt and response parser, shared by the ESM runtimes:
// the browser client (which shows the prompt for the copy-and-paste path), the Vercel
// handler, and the Cloudflare Worker. Mirrored verbatim in the .cjs file for Electron's
// main process; test/unit/lyrics/lyricSegmentationPrompt.test.ts asserts the two agree.

// The word boundary marker in the plain-text exchange format. Kept in sync with
// SEGMENTATION_DELIMITER in src/utils/lyrics/lyricSegmentationRecord.ts.
const SEGMENTATION_DELIMITER = '/';

const SEGMENTATION_SCHEMA_NAME = 'lyric_word_segmentation';

// Structured-output schema for the OpenAI path. Only `openai` itself accepts json_schema; every
// other OpenAI-compatible provider gets `{ type: 'json_object' }` and is held to the same shape by
// parseSegmentationResponse instead.
const SEGMENTATION_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    lines: {
      type: 'array',
      items: { type: 'array', items: { type: 'string' } },
    },
  },
  required: ['lines'],
};

// Gemini's schema dialect, which is not JSON Schema: uppercase type names, no additionalProperties.
// The theme path has always sent one (getGeminiResponseSchema in main.cjs); segmentation shipped
// without, on the assumption that responseMimeType alone was enough. It is not — with nothing
// constraining the shape, the model repeats itself, and the same 12-line request was measured
// returning 7KB, 14KB and 37KB on consecutive runs, with latency tracking output size (8s/16s/42s).
const SEGMENTATION_GEMINI_SCHEMA = {
  type: 'OBJECT',
  properties: {
    lines: {
      type: 'ARRAY',
      description: 'One entry per input line, in order; each is that line split into words.',
      items: {
        type: 'ARRAY',
        description: 'The segments of one lyric line, which concatenate back to it exactly.',
        items: { type: 'STRING' },
      },
    },
  },
  required: ['lines'],
};

// Backstop for the same failure, and the ceiling the batch size is chosen against. Output runs at
// roughly 18 tokens per line (measured: 150 lines -> 2707 tokens), so a 100-line batch lands near
// 1800 and even a batch of unusually long lines stays well inside this.
const SEGMENTATION_MAX_OUTPUT_TOKENS = 8192;

/**
 * The complete Gemini generationConfig for segmentation.
 *
 * `thinkingBudget: 0` is the load-bearing part. gemini-3-flash-preview is a thinking model, and on
 * this task it spent ~1600 thinking tokens to produce a ~160 token answer — measured at 9.0s with
 * thinking on versus 1.6s with it off, for byte-identical output. Splitting text at word
 * boundaries is mechanical; there is nothing to reason about. This is scoped to segmentation and
 * deliberately not applied to theme generation, which is a creative task.
 *
 * Valid because the endpoint pins a flash model; the pro models reject a zero budget.
 */
const SEGMENTATION_GEMINI_GENERATION_CONFIG = {
  responseMimeType: 'application/json',
  responseSchema: SEGMENTATION_GEMINI_SCHEMA,
  maxOutputTokens: SEGMENTATION_MAX_OUTPUT_TOKENS,
  thinkingConfig: { thinkingBudget: 0 },
};

/**
 * How to ask an OpenAI-compatible endpoint not to think, in the order to try.
 *
 * There is no way to know what a user configured — the URL and model are free text, and they may
 * point at OpenAI, DeepSeek, OpenRouter, Ollama, vLLM or anything else. So this is not a lookup
 * table of providers; it is a ladder the client walks until something works, then remembers.
 *
 * Measured on deepseek-v4-flash: without any of this the model spent its entire token budget on
 * reasoning and returned an empty answer after 52s; with `reasoning_effort: 'none'` it answers in
 * ~1s. `reasoning_effort: 'minimal'` does not help — it still burns the whole budget.
 *
 * The last rung sends nothing and is the correct answer for a model that has no reasoning to
 * disable, which is why the ladder always terminates.
 */
const REASONING_SUPPRESSION_ATTEMPTS = [
  // OpenAI's own spelling, accepted by DeepSeek and a growing number of compatible servers.
  { params: { reasoning_effort: 'none' } },
  // vLLM / SGLang pass this through to the chat template; it is how Qwen3 turns thinking off.
  { params: { chat_template_kwargs: { enable_thinking: false } } },
  // Nothing to disable, or nothing we know how to disable.
  { params: {} },
];

// Rules 4 and 5 and the Japanese half of the example block are load-bearing for weaker models. With
// only the Chinese and English example, a model reads the English row as "split at spaces" and
// applies that to everything: measured on deepseek-v4-flash over 19 Japanese lines, 5 to 10 of them
// came back as a single segment, at 1.6-2.4 segments per line, where Intl.Segmenter gives 7 for the
// same text. An abstract "never return a whole clause" rule on its own changed nothing (still 9
// lines unsplit); it is the Japanese rule together with the two Japanese example rows that moved it
// to 1 unsplit line at 3.8 segments. Not a Japanese-only patch: with them Chinese stopped being
// over-split (摘不下 and 盒子里 survive as one segment, which rule 3 already asked for) and English
// output was byte-identical. Gemini gains the same way, 2.8 segments per line to 3.4.
//
// The bracket clause in rule 7 pays for itself: without it the added rules pull (拼图女孩) apart
// into three segments.
const SEGMENTATION_SYSTEM_PROMPT = [
  'You segment song lyrics into words for a typography engine.',
  '',
  'You receive numbered lyric lines. For each line, split it into the units a human reader would',
  'treat as single words, and return them in order.',
  '',
  'Hard rules, in priority order:',
  '1. Lossless. Concatenating one line’s segments must reproduce that line character for character,',
  '   including every space, punctuation mark and symbol. Never add, drop, reorder or normalise a',
  '   character. Never translate, romanise, or correct spelling.',
  '2. Same count. Return exactly one segment array per input line, in the same order.',
  '3. Split at meaning, not at characters. For Chinese, Japanese and Korean, group characters into',
  '   real words and set phrases (不知道 / 孤独的 / キラキラ), not one character per segment.',
  '   Keep verb–complement and noun–suffix pairs together when they read as one word.',
  '4. One word per segment. A segment carries a single content word plus the grammatical tail glued',
  '   to it. If a segment still holds a second noun, verb or adjective, split it again. Spaces are',
  '   not the only split points: a Japanese or Chinese line usually has none and still needs one',
  '   segment per word. Returning a whole clause, or a whole line, as one segment is a failure.',
  '5. Japanese specifically: split before every content word, and keep each content word together',
  '   with the okurigana, auxiliaries and particles that follow it (見えない / ように / 集めたい /',
  '   けど). Sentence-final particles (よ / ね / さ) attach to what precedes them.',
  '6. Keep space-delimited words whole for Latin scripts, and keep contractions such as it’s or',
  '   don’t in one segment.',
  '7. Attach trailing punctuation to the segment it follows (世界。 not 世界 + 。). A bracket or quote',
  '   stays in one segment with the text it wraps ((拼图女孩) not ( + 拼图女孩 + )). A space belongs',
  '   to the segment that precedes it.',
  '8. The "N. " prefix on each input line is numbering added by this request. It is NOT part of the',
  '   lyric. Never include it in a segment.',
  '',
  'Examples. Given:',
  '  1. 把回忆拼好给你',
  '  2. It\u2019s unbelievable, isn\u2019t it?',
  '  3. いっぱいあるんだよ欲しいもの',
  '  4. 見えないようにさ 隠しても',
  'answer exactly:',
  '  {"lines": [["把", "回忆", "拼好", "给", "你"], ["It\u2019s ", "unbelievable, ", "isn\u2019t ", "it?"],'
  + ' ["いっぱい", "あるんだよ", "欲しい", "もの"], ["見えない", "ように", "さ ", "隠しても"]]}',
  '',
  'Respond with JSON only: {"lines": [["seg", "seg"], ["seg"]]}. No prose, no code fence.',
].join('\n');

/** The exact instructions shown to the user for the copy-and-paste path. */
const buildSegmentationSystemPrompt = () => SEGMENTATION_SYSTEM_PROMPT;

/** The numbered lyric block. Numbering makes a dropped line visible in the model's own output. */
const buildSegmentationSourcePrompt = (lines) => {
  const numbered = lines
    .map((text, index) => `${index + 1}. ${text}`)
    .join('\n');
  return `Segment these ${lines.length} lyric lines.\n\n${numbered}`;
};

/** What the user copies to a model site: the rules, the lines, and the fallback text format. */
const buildSegmentationManualPrompt = (lines) => [
  SEGMENTATION_SYSTEM_PROMPT,
  '',
  `If you cannot produce JSON, answer with ${lines.length} plain lines instead, separating words`,
  `with "${SEGMENTATION_DELIMITER}" and nothing else.`,
  '',
  buildSegmentationSourcePrompt(lines),
].join('\n');

const stripCodeFence = (text) => {
  const trimmed = String(text == null ? '' : text).trim();
  if (!trimmed.startsWith('```')) {
    return trimmed;
  }
  return trimmed.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```$/, '');
};

const WHITESPACE = /\s/;

const MAX_DIAGNOSTIC_CHARS = 160;

const clip = (text) => (
  text.length > MAX_DIAGNOSTIC_CHARS ? `${text.slice(0, MAX_DIAGNOSTIC_CHARS)}…` : text
);

/** First index where two strings diverge, or -1 when they are equal. */
const firstDifference = (expected, got) => {
  const limit = Math.min(expected.length, got.length);
  for (let index = 0; index < limit; index += 1) {
    if (expected[index] !== got[index]) {
      return index;
    }
  }
  return expected.length === got.length ? -1 : limit;
};

/**
 * Rebuilds the model's split points as slices of the original line.
 *
 * Models reliably get the *split points* right and just as reliably normalise whitespace on the
 * way back — a trailing space dropped, a full-width space folded to an ASCII one, a double space
 * collapsed. Comparing the joined string to the line rejected all of that, which meant one
 * cosmetic difference on one line threw away the whole song.
 *
 * So instead of trusting the returned text, only its boundaries are trusted: walk the original,
 * consume each segment's non-whitespace characters from it, and let the original's own whitespace
 * fall wherever it actually is. Every emitted segment is therefore a slice of `text`, and their
 * concatenation is `text` by construction rather than by the model's good behaviour.
 *
 * Returns null when the non-whitespace content genuinely differs — a rewritten, translated or
 * dropped word — which is the case that must still fail.
 */
const realignSegmentsToText = (boundaries, text) => {
  if (boundaries.join('') === text) {
    return boundaries;
  }

  const slices = [];
  let cursor = 0;

  for (const boundary of boundaries) {
    const wanted = boundary.replace(/\s+/gu, '');
    // A whitespace-only segment carries no content of its own; the surrounding slices pick up
    // whatever whitespace the original actually has at that position.
    if (!wanted) {
      continue;
    }

    const start = cursor;
    let matched = 0;
    while (cursor < text.length && matched < wanted.length) {
      const char = text[cursor];
      if (WHITESPACE.test(char)) {
        cursor += 1;
        continue;
      }
      if (char !== wanted[matched]) {
        return null;
      }
      matched += 1;
      cursor += 1;
    }

    if (matched < wanted.length) {
      return null;
    }
    slices.push(text.slice(start, cursor));
  }

  if (slices.length === 0) {
    return null;
  }

  // Whatever is left must be whitespace; it belongs to the final segment.
  const tail = text.slice(cursor);
  if (tail.trim()) {
    return null;
  }
  slices[slices.length - 1] += tail;

  return slices;
};

/**
 * Turns a model response into boundary rows, one per input line.
 *
 * Rows the model got wrong come back as `null` rather than throwing. Whose model this is cannot be
 * known — the URL and model name are free text — so some rate of imperfect lines has to be assumed,
 * and one mangled line out of forty-three killing the whole song is the wrong trade: a null keeps
 * that line on the default split, which is correct output, while the rest still improve.
 *
 * What still throws is anything structural — not JSON, no `lines` array, the wrong number of rows —
 * because then the mapping from row to lyric line is unknown and nothing can be trusted.
 */
const parseSegmentationResponse = (raw, lines) => {
  const text = stripCodeFence(raw);
  if (!text) {
    throw new Error('Empty segmentation response');
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Segmentation response was not valid JSON: ${clip(text)}`);
  }

  const rows = Array.isArray(parsed) ? parsed : parsed && parsed.lines;
  if (!Array.isArray(rows)) {
    throw new Error('Segmentation response had no "lines" array');
  }
  if (rows.length !== lines.length) {
    throw new Error(`Segmentation response had ${rows.length} lines, expected ${lines.length}`);
  }

  const boundaries = [];
  const rejections = [];

  rows.forEach((row, index) => {
    if (!Array.isArray(row)) {
      boundaries.push(null);
      rejections.push(`line ${index + 1} was not an array`);
      return;
    }

    const realigned = realignSegmentsToText(row.map((segment) => String(segment)), lines[index]);
    if (realigned) {
      boundaries.push(realigned);
      return;
    }

    const got = row.join('');
    const at = firstDifference(lines[index], got);
    boundaries.push(null);
    rejections.push(
      `line ${index + 1} does not reproduce the original text (first difference at character ${at + 1});`
      + ` expected ${JSON.stringify(clip(lines[index]))} got ${JSON.stringify(clip(got))}`,
    );
  });

  if (rejections.length === rows.length) {
    throw new Error(`Segmentation reproduced none of the lines. First problem: ${rejections[0]}`);
  }

  return { boundaries, rejections };
};

export {
  REASONING_SUPPRESSION_ATTEMPTS,
  SEGMENTATION_DELIMITER,
  SEGMENTATION_GEMINI_GENERATION_CONFIG,
  SEGMENTATION_GEMINI_SCHEMA,
  SEGMENTATION_MAX_OUTPUT_TOKENS,
  realignSegmentsToText,
  SEGMENTATION_JSON_SCHEMA,
  SEGMENTATION_SCHEMA_NAME,
  buildSegmentationManualPrompt,
  buildSegmentationSourcePrompt,
  buildSegmentationSystemPrompt,
  parseSegmentationResponse,
};
