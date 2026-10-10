"use strict";

const { REASONING_SUPPRESSION_ATTEMPTS } = require('../shared/lyricSegmentationPrompt.cjs');

// electron/aiTextClient.cjs
// Provider-agnostic "send a system + user prompt, get JSON back" client for the main process.
//
// Every one of these helpers already existed inline in main.cjs, written for the single AI feature
// the app had (theme generation). Segmentation needs the same plumbing with a different schema, so
// it moves here rather than being copied: main.cjs is ~5400 lines and is explicitly off-limits for
// new feature logic (skills/file-modularization).
//
// The one behavioural rule worth restating: only `openai` itself accepts
// `response_format: json_schema`. DeepSeek and the long tail of OpenAI-compatible endpoints reject
// it, so they get `{ type: 'json_object' }` and the caller validates the shape instead.

const DEFAULT_OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_OPENAI_MODEL = 'gpt-5.6-luna';
const DEEPSEEK_DEFAULT_MODEL = 'deepseek-v4-flash';
const DEFAULT_OPENAI_TEMPERATURE = 0.7;
const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent';

// Nothing on this path had a deadline before. A base URL pointing at something unreachable — a
// local server that is not running, a proxy that black-holes the connection — left the renderer
// spinning forever with no error and no log, which is exactly how it presented in the wild.
const DEFAULT_AI_TIMEOUT_MS = 120_000;

/** AbortSignal that fires after `timeoutMs`, so a stalled request fails instead of hanging. */
const timeoutSignal = (timeoutMs) => {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs).unref?.();
  return controller.signal;
};

/** Turns an abort into a message that names the deadline rather than a bare "aborted". */
const describeFetchFailure = (error, timeoutMs, label) => {
  const name = error && error.name;
  if (name === 'TimeoutError' || name === 'AbortError') {
    return new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s`);
  }
  return error instanceof Error ? error : new Error(String(error));
};

function normalizeOpenAIChatCompletionsUrl(rawUrl) {
  const trimmedUrl = typeof rawUrl === 'string' ? rawUrl.trim() : '';
  if (!trimmedUrl) {
    return DEFAULT_OPENAI_CHAT_COMPLETIONS_URL;
  }

  try {
    const parsed = new URL(trimmedUrl);
    const normalizedPath = parsed.pathname.replace(/\/+$/, '');

    if (!normalizedPath || normalizedPath === '/') {
      parsed.pathname = '/v1/chat/completions';
      return parsed.toString();
    }

    if (/\/v\d+$/.test(normalizedPath)) {
      parsed.pathname = `${normalizedPath}/chat/completions`;
      return parsed.toString();
    }

    parsed.pathname = normalizedPath;
    return parsed.toString();
  } catch {
    return trimmedUrl.replace(/\/+$/, '');
  }
}

function resolveOpenAICompatibleModel(apiUrl, configuredModel) {
  const trimmedModel = typeof configuredModel === 'string' ? configuredModel.trim() : '';
  if (trimmedModel) {
    return trimmedModel;
  }

  try {
    const hostname = new URL(apiUrl).hostname.toLowerCase();
    if (hostname === 'api.deepseek.com' || hostname.endsWith('.deepseek.com')) {
      return DEEPSEEK_DEFAULT_MODEL;
    }
  } catch {
    // Fall back to the generic OpenAI default when URL parsing fails.
  }

  return DEFAULT_OPENAI_MODEL;
}

function detectOpenAICompatibleProvider(apiUrl) {
  try {
    const hostname = new URL(apiUrl).hostname.toLowerCase();
    if (hostname === 'api.deepseek.com' || hostname.endsWith('.deepseek.com')) {
      return 'deepseek';
    }
    if (hostname === 'api.openai.com' || hostname.endsWith('.openai.com')) {
      return 'openai';
    }
  } catch {
    // Fall through to generic provider handling.
  }
  return 'generic';
}

function providerSupportsStructuredOutputs(provider) {
  return provider === 'openai';
}

/**
 * Remembers which rung of REASONING_SUPPRESSION_ATTEMPTS worked for an endpoint+model, so the
 * probing is paid once per process rather than on every batch. Keyed by both because one base URL
 * can serve models with completely different capabilities.
 */
const reasoningAttemptCache = new Map();

/**
 * True when the model answered nothing because reasoning consumed the whole budget. This is the
 * failure that looks like success: HTTP 200, tokens billed, `content` empty.
 */
const exhaustedByReasoning = (choice, usage) => {
  const reasoningTokens = usage
    && usage.completion_tokens_details
    && usage.completion_tokens_details.reasoning_tokens;
  const hasReasoning = Boolean(
    reasoningTokens || (choice && choice.message && choice.message.reasoning_content),
  );
  return hasReasoning && choice && choice.finish_reason === 'length';
};


function resolveOpenAICompatibleTemperature(value) {
  const temperature = typeof value === 'number' ? value : Number.parseFloat(String(value ?? '').trim());
  return Number.isFinite(temperature) && temperature >= 0 && temperature <= 2
    ? temperature
    : DEFAULT_OPENAI_TEMPERATURE;
}

function extractProviderErrorMessage(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const error = payload.error;
  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object' && typeof error.message === 'string') {
    return error.message;
  }

  return typeof payload.message === 'string' ? payload.message : null;
}

async function formatOpenAICompatibleError(response) {
  const rawText = await response.text();
  let detail = rawText.trim();

  try {
    const parsed = JSON.parse(rawText);
    detail = extractProviderErrorMessage(parsed) || detail;
  } catch {
    // Leave non-JSON responses as-is.
  }

  return detail
    ? `OpenAI compatible API error (${response.status}): ${detail}`
    : `OpenAI compatible API error (${response.status}): ${response.statusText}`;
}

/**
 * Explains an empty completion instead of just reporting one.
 *
 * "Model returned an empty response" is true and useless. The case that actually happens is a
 * reasoning model spending its whole output budget on `reasoning_content` and never reaching the
 * answer, which looks identical from the outside — so say so, and name the parameter that fixes it.
 */
function describeEmptyCompletion(choice, usage, model) {
  const reasoningTokens = usage
    && usage.completion_tokens_details
    && usage.completion_tokens_details.reasoning_tokens;
  const finishReason = choice && choice.finish_reason;
  const hasReasoning = Boolean(
    reasoningTokens || (choice && choice.message && choice.message.reasoning_content),
  );

  if (hasReasoning && finishReason === 'length') {
    return `Model "${model}" used its entire output budget on reasoning`
      + `${reasoningTokens ? ` (${reasoningTokens} reasoning tokens)` : ''} and returned no answer.`
      + ' This is a reasoning model doing a mechanical task. Point the app at a non-reasoning model,'
      + ' or raise the token limit if the provider ignores reasoning_effort.';
  }
  if (finishReason === 'length') {
    return `Model "${model}" hit the output token limit before finishing its answer.`;
  }
  return `Model "${model}" returned an empty response`
    + `${finishReason ? ` (finish_reason: ${finishReason})` : ''}.`;
}

function extractResponseContentText(message) {
  if (!message) {
    return null;
  }

  if (typeof message.refusal === 'string' && message.refusal.trim()) {
    throw new Error(`Model refused request: ${message.refusal}`);
  }

  if (typeof message.content === 'string') {
    return message.content;
  }

  if (Array.isArray(message.content)) {
    const text = message.content
      .filter((part) => part && typeof part === 'object')
      .filter((part) => part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join('');
    return text || null;
  }

  return null;
}

/**
 * Chat-completions body for any OpenAI-compatible endpoint. `schema` and `schemaName` are only
 * used on providers that support structured outputs; everywhere else they are ignored and the
 * request falls back to plain JSON mode.
 */
function buildOpenAICompatibleRequestBody(model, provider, systemPrompt, sourcePrompt, temperature, schema, schemaName, maxTokens, extraParams, stream) {
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: sourcePrompt },
  ];

  // Bounds the worst case. In plain JSON mode some providers (DeepSeek notably) can emit a long
  // run of whitespace before any content and keep going until the cap; with no cap set that is an
  // unbounded body read, which presents as a request that never finishes. A caller that knows how
  // big its answer should be passes a ceiling; truncation then fails as a JSON parse error with
  // the raw response logged, which is diagnosable, unlike a hang.
  const limit = maxTokens
    ? { [provider === 'openai' ? 'max_completion_tokens' : 'max_tokens']: maxTokens }
    : {};
  const reasoning = extraParams || {};
  // Only the bare flag; no stream_options, to keep the surface other providers must accept minimal.
  const streaming = stream === true ? { stream: true } : {};

  if (schema && schemaName && providerSupportsStructuredOutputs(provider)) {
    return {
      model,
      messages,
      temperature,
      ...limit,
      ...reasoning,
      ...streaming,
      response_format: {
        type: 'json_schema',
        json_schema: { name: schemaName, strict: true, schema },
      },
    };
  }

  return {
    model,
    messages,
    temperature,
    ...limit,
    ...reasoning,
    ...streaming,
    response_format: { type: 'json_object' },
  };
}

/**
 * Incremental reader for an OpenAI-style SSE chat-completions stream (pure, no I/O).
 *
 * The result must still be structured JSON, so nothing is surfaced until the stream ends: this only
 * stitches `choices[0].delta.content` back into the same `{ choice, content }` shape a non-streamed
 * response produces, and the caller feeds that through the identical validation path. `push` takes
 * decoded text chunks of any size (lines may be split across chunks, line endings may be \n, \r\n or
 * \r); `finish` flushes the tail and returns the outcome. A mid-stream `{"error":...}` event throws.
 * `reasoning_content` is deliberately not appended to the answer, only remembered so an
 * "all budget spent on reasoning" completion is diagnosed the same way as in the non-streamed case.
 */
function createOpenAIStreamAccumulator() {
  let buffer = '';
  let content = '';
  let refusal = '';
  let reasoning = '';
  let finishReason = null;
  let usage;
  let model;
  let sawData = false;
  let done = false;
  // Lines that are not SSE fields at all. Some proxies ignore `stream: true` and answer with one
  // plain JSON body; this keeps that body so it can still be understood at the end.
  let foreign = '';

  const handleData = (payloadText) => {
    sawData = true;
    // Nothing after [DONE] belongs to the answer (some relays append usage or junk frames).
    if (done) {
      return;
    }
    if (payloadText === '[DONE]') {
      done = true;
      return;
    }
    let payload;
    try {
      payload = JSON.parse(payloadText);
    } catch {
      return;
    }
    if (!payload || typeof payload !== 'object') {
      return;
    }
    if (payload.error) {
      throw new Error(`OpenAI compatible API error (stream): ${extractProviderErrorMessage(payload) || JSON.stringify(payload.error)}`);
    }
    if (payload.usage && typeof payload.usage === 'object') {
      usage = payload.usage;
    }
    if (typeof payload.model === 'string' && payload.model) {
      model = payload.model;
    }
    const choice = Array.isArray(payload.choices) ? payload.choices[0] : null;
    if (!choice) {
      return;
    }
    const delta = choice.delta;
    if (delta && typeof delta === 'object') {
      if (typeof delta.content === 'string') {
        content += delta.content;
      }
      if (typeof delta.refusal === 'string') {
        refusal += delta.refusal;
      }
      if (typeof delta.reasoning_content === 'string') {
        reasoning += delta.reasoning_content;
      }
    }
    if (typeof choice.finish_reason === 'string' && choice.finish_reason) {
      finishReason = choice.finish_reason;
    }
  };

  const handleLine = (line) => {
    if (!line || line.startsWith(':')) {
      return;
    }
    if (line.startsWith('data:')) {
      handleData(line.slice(5).replace(/^ /, '').trim());
      return;
    }
    if (/^(event|id|retry)(:|$)/.test(line)) {
      return;
    }
    if (!sawData) {
      foreign += `${line}\n`;
    }
  };

  const drain = (final) => {
    const lines = buffer.split(/\r\n|\n|\r/);
    buffer = final ? '' : lines.pop();
    for (const line of lines) {
      handleLine(line);
    }
    if (final && buffer) {
      handleLine(buffer);
    }
  };

  return {
    push(text) {
      buffer += text;
      drain(false);
    },
    finish() {
      drain(true);

      if (!sawData && foreign.trim().startsWith('{')) {
        let parsed = null;
        try {
          parsed = JSON.parse(foreign);
        } catch {
          // Not JSON either; fall through to the empty-completion diagnosis.
        }
        if (parsed && parsed.error) {
          throw new Error(`OpenAI compatible API error (stream): ${extractProviderErrorMessage(parsed) || JSON.stringify(parsed.error)}`);
        }
        const choice = parsed && Array.isArray(parsed.choices) ? parsed.choices[0] : null;
        if (choice) {
          return { choice, usage: parsed.usage, model: typeof parsed.model === 'string' ? parsed.model : undefined, content: extractResponseContentText(choice.message), done: true };
        }
      }

      const message = { content };
      if (refusal) {
        message.refusal = refusal;
      }
      if (reasoning) {
        message.reasoning_content = reasoning;
      }
      const choice = { finish_reason: finishReason, message };
      return { choice, usage, model, content: extractResponseContentText(message), done };
    },
  };
}

/** Reads a fetch Response body through the accumulator above and returns the assembled outcome. */
async function readOpenAIStreamResponse(response) {
  const accumulator = createOpenAIStreamAccumulator();
  if (!response.body || typeof response.body.getReader !== 'function') {
    accumulator.push(await response.text());
    return accumulator.finish();
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      accumulator.push(decoder.decode(value, { stream: true }));
    }
    accumulator.push(decoder.decode());
    return accumulator.finish();
  } catch (error) {
    // Stop pulling bytes from the connection once the outcome is already an error.
    reader.cancel().catch(() => {});
    throw error;
  }
}

/** One request. Returns the outcome instead of throwing, so the ladder above can decide. */
async function sendOpenAICompatible({ apiUrl, apiKey, body, customFetch, timeoutMs }) {
  let response;
  try {
    const { sendOpenAICompatibleRequest } = await import('../shared/openAICompatibleRequest.mjs');
    response = await sendOpenAICompatibleRequest({
      apiUrl,
      provider: detectOpenAICompatibleProvider(apiUrl),
      body,
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        signal: timeoutSignal(timeoutMs),
      },
      fetchImpl: customFetch,
    });
  } catch (error) {
    throw describeFetchFailure(error, timeoutMs, `Request to ${apiUrl}`);
  }

  if (!response.ok) {
    return { ok: false, status: response.status, errorText: await formatOpenAICompatibleError(response) };
  }

  if (body && body.stream === true) {
    try {
      return { ok: true, status: response.status, ...(await readOpenAIStreamResponse(response)) };
    } catch (error) {
      throw describeFetchFailure(error, timeoutMs, `Reading the response from ${apiUrl}`);
    }
  }

  let data;
  try {
    data = await response.json();
  } catch (error) {
    throw describeFetchFailure(error, timeoutMs, `Reading the response from ${apiUrl}`);
  }

  const choice = data.choices && data.choices[0];
  return {
    ok: true,
    status: response.status,
    choice,
    usage: data.usage,
    model: typeof data.model === 'string' ? data.model : undefined,
    content: extractResponseContentText(choice && choice.message),
  };
}

/**
 * Raw JSON text from an OpenAI-compatible endpoint, using the user's configured connection.
 *
 * When `disableReasoning` is set this walks REASONING_SUPPRESSION_ATTEMPTS rather than assuming
 * anything about the provider, advancing on the two failures that mean "that rung does not apply
 * here": the server rejecting the parameter, and the model answering nothing because reasoning ate
 * the budget. Any other error is real and is reported immediately, so a bad key or a wrong model
 * name still fails on the first request instead of being retried three times.
 */
async function runOpenAICompatibleCompletion({ store, systemPrompt, sourcePrompt, schema, schemaName, customFetch, timeoutMs = DEFAULT_AI_TIMEOUT_MS, maxTokens, disableReasoning }) {
  const apiKey = store.get('OPENAI_API_KEY');
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured in settings');
  }

  const apiUrl = normalizeOpenAIChatCompletionsUrl(store.get('OPENAI_API_URL'));
  const model = resolveOpenAICompatibleModel(apiUrl, store.get('OPENAI_API_MODEL'));
  const temperature = resolveOpenAICompatibleTemperature(store.get('OPENAI_API_TEMPERATURE'));
  const provider = detectOpenAICompatibleProvider(apiUrl);
  const stream = store.get('OPENAI_API_STREAM') === true;

  const attempts = disableReasoning ? REASONING_SUPPRESSION_ATTEMPTS : [{ params: {} }];
  const cacheKey = `${apiUrl}|${model}`;
  const learned = disableReasoning ? reasoningAttemptCache.get(cacheKey) : 0;
  const firstIndex = typeof learned === 'number' ? learned : 0;

  const { rejectsOpenAICompatibleParameter } = await import('../shared/openAICompatibleRequest.mjs');

  let lastEmpty = null;
  for (let index = firstIndex; index < attempts.length; index += 1) {
    const { params } = attempts[index];
    const isLastAttempt = index === attempts.length - 1;
    // The final rung is for models whose reasoning cannot be turned off, so it needs room for the
    // reasoning AND the answer; the earlier rungs expect no reasoning at all.
    const budget = isLastAttempt && disableReasoning && maxTokens ? maxTokens * 4 : maxTokens;
    const reasoningParams = disableReasoning && provider === 'deepseek'
      ? { thinking: { type: 'disabled' }, ...params }
      : params;
    const body = buildOpenAICompatibleRequestBody(
      model, provider, systemPrompt, sourcePrompt, temperature, schema, schemaName, budget, reasoningParams, stream,
    );

    const described = Object.keys(params).length ? Object.keys(params).join('+') : 'plain';
    console.log(`[ai] POST ${apiUrl} model=${model} provider=${provider} reasoning=${described}${stream ? ' stream=on' : ''}`);
    const startedAt = Date.now();
    const result = await sendOpenAICompatible({ apiUrl, apiKey, body, customFetch, timeoutMs });

    if (!result.ok) {
      // A rejected parameter is information, not a failure: this endpoint does not speak that
      // dialect, so move down the ladder. Everything else is the user's problem to see.
      if (!isLastAttempt
        && Object.keys(params).some((key) => rejectsOpenAICompatibleParameter(result.status, result.errorText, key))) {
        console.log(`[ai] ${described} rejected by the endpoint, trying the next option`);
        continue;
      }
      throw new Error(result.errorText);
    }

    console.log(`[ai] ${apiUrl} answered in ${Date.now() - startedAt}ms`);

    if (result.content) {
      reasoningAttemptCache.set(cacheKey, index);
      return result.content;
    }

    lastEmpty = result;
    if (!isLastAttempt && exhaustedByReasoning(result.choice, result.usage)) {
      console.log(`[ai] ${described} did not stop the model reasoning, trying the next option`);
      continue;
    }
    break;
  }

  throw new Error(describeEmptyCompletion(
    lastEmpty && lastEmpty.choice,
    lastEmpty && lastEmpty.usage,
    model,
  ));
}

/**
 * Raw JSON text from Gemini. The model name is fixed here, matching the existing theme path: the
 * settings UI only exposes an API key for this provider, not a model field.
 */
async function runGeminiCompletion({ store, systemPrompt, sourcePrompt, responseSchema, generationConfig, customFetch, timeoutMs = DEFAULT_AI_TIMEOUT_MS, maxTokens }) {
  const apiKey = store.get('GEMINI_API_KEY');
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in settings');
  }

  console.log('[ai] POST gemini-3-flash-preview');
  const startedAt = Date.now();

  let response;
  try {
    response = await customFetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: sourcePrompt }] }],
        // A caller with tuned settings (a thinking budget, a schema) passes the whole config;
        // otherwise it is assembled from the individual options.
        generationConfig: generationConfig ?? {
          responseMimeType: 'application/json',
          ...(responseSchema ? { responseSchema } : {}),
          ...(maxTokens ? { maxOutputTokens: maxTokens } : {}),
        },
      }),
      signal: timeoutSignal(timeoutMs),
    });
  } catch (error) {
    throw describeFetchFailure(error, timeoutMs, 'Request to Gemini');
  }
  console.log(`[ai] gemini headers ${response.status} in ${Date.now() - startedAt}ms, reading body…`);

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${response.statusText}${errText ? ` - ${errText}` : ''}`);
  }

  let data;
  try {
    data = await response.json();
  } catch (error) {
    throw describeFetchFailure(error, timeoutMs, 'Reading the response from Gemini');
  }
  console.log(`[ai] gemini body complete in ${Date.now() - startedAt}ms total`);

  const parts = data && data.candidates && data.candidates[0] && data.candidates[0].content
    ? data.candidates[0].content.parts
    : null;
  const jsonText = Array.isArray(parts)
    ? (parts.find((part) => part && typeof part.text === 'string') || {}).text
    : null;
  if (!jsonText) {
    throw new Error('Model returned an empty response');
  }

  return jsonText;
}

/**
 * Runs one prompt through whichever provider the user configured and returns the raw JSON text.
 * Parsing is left to the caller so each feature can validate against its own contract.
 */
async function runAiJsonCompletion({ store, systemPrompt, sourcePrompt, schema, schemaName, geminiResponseSchema, geminiGenerationConfig, customFetch, timeoutMs, maxTokens, disableReasoning }) {
  const provider = store.get('AI_PROVIDER') || 'gemini';

  return provider === 'openai'
    ? runOpenAICompatibleCompletion({ store, systemPrompt, sourcePrompt, schema, schemaName, customFetch, timeoutMs, maxTokens, disableReasoning })
    : runGeminiCompletion({ store, systemPrompt, sourcePrompt, responseSchema: geminiResponseSchema, generationConfig: geminiGenerationConfig, customFetch, timeoutMs, maxTokens });
}

// ---------------------------------------------------------------------------------------------
// Connection test ("send hello, show the reply").
//
// Runs with the values currently in the settings form, not the saved ones, so none of this reads
// or writes the store. It goes through the same request senders as the real features
// (sendOpenAICompatible / customFetch), which is what makes a pass here mean the real calls work.
// ---------------------------------------------------------------------------------------------

const AI_TEST_TIMEOUT_MS = 30_000;
// Roomy enough that a model which still reasons a little can get to its reply; the reply itself is
// cut for display (AI_TEST_MAX_REPLY_CHARS), so a large budget costs nothing visible.
const AI_TEST_MAX_TOKENS = 512;
const AI_TEST_PROMPT = 'hello';
const AI_TEST_MAX_REPLY_CHARS = 500;
const AI_TEST_MAX_ERROR_CHARS = 500;
const AI_TEST_MAX_FIELD_CHARS = { apiKey: 1024, apiUrl: 2048, model: 256 };

const truncateText = (text, limit) => (text.length > limit ? `${text.slice(0, limit)}…` : text);

/** URL with credentials and query dropped, safe to put in a message even if the user pasted a key into it. */
const redactUrl = (rawUrl) => {
  try {
    const parsed = new URL(rawUrl);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return '[invalid url]';
  }
};

/**
 * Validates and normalises the renderer-supplied payload. Returns `{ config }` or `{ error }`; it
 * never throws, since the IPC handler must hand a displayable result back either way.
 */
function validateAiConnectionTestInput(raw) {
  if (!raw || typeof raw !== 'object') {
    return { error: 'Invalid request.' };
  }
  const provider = raw.provider;
  if (provider !== 'gemini' && provider !== 'openai') {
    return { error: 'Unknown AI provider.' };
  }
  const readString = (name) => {
    const value = raw[name];
    if (value === undefined || value === null) {
      return '';
    }
    if (typeof value !== 'string' || value.length > AI_TEST_MAX_FIELD_CHARS[name]) {
      return null;
    }
    return value.trim();
  };
  const apiKey = readString('apiKey');
  const apiUrl = provider === 'openai' ? readString('apiUrl') : '';
  const model = provider === 'openai' ? readString('model') : '';
  if (apiKey === null || apiUrl === null || model === null) {
    return { error: 'A setting value is too long or has the wrong type.' };
  }
  if (apiUrl) {
    let parsed;
    try {
      parsed = new URL(apiUrl);
    } catch {
      return { error: 'API URL is not a valid URL.' };
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { error: 'API URL must start with http:// or https://.' };
    }
  }
  return {
    config: {
      provider,
      apiKey,
      apiUrl,
      model,
      stream: provider === 'openai' && raw.stream === true,
    },
  };
}

/**
 * Minimal chat body for the test: one user message, no system prompt, no JSON mode or schema.
 * The token cap key follows the same openai-vs-others rule as buildOpenAICompatibleRequestBody.
 */
function buildOpenAICompatibleTestBody(model, provider, stream) {
  return {
    model,
    messages: [{ role: 'user', content: AI_TEST_PROMPT }],
    [provider === 'openai' ? 'max_completion_tokens' : 'max_tokens']: AI_TEST_MAX_TOKENS,
    ...(stream ? { stream: true } : {}),
  };
}

/**
 * Sends "hello" with the given (unsaved) settings and reports what came back.
 *
 * Resolves to `{ ok, status?, durationMs, model?, text?, emptyReason?, error?, errorKind? }` and
 * does not throw: a failed connection is the expected output of this function. `emptyReason` marks
 * a connection that worked but produced no text ('reasoning' = the budget went on reasoning,
 * 'empty' = anything else), so the UI can report it as a success with a caveat, not a failure.
 */
async function runAiConnectionTest(rawInput, { customFetch, timeoutMs = AI_TEST_TIMEOUT_MS, now = Date.now } = {}) {
  const validated = validateAiConnectionTestInput(rawInput);
  if (validated.error) {
    return { ok: false, durationMs: 0, errorKind: 'invalid', error: validated.error };
  }
  const { provider, apiKey, apiUrl: rawApiUrl, model: rawModel, stream } = validated.config;
  const startedAt = now();
  const finish = (result) => ({ durationMs: now() - startedAt, ...result });
  const scrub = (message) => {
    let text = String(message);
    if (apiKey) {
      text = text.split(apiKey).join('***');
    }
    // Servers sometimes echo the request back: Authorization header, Gemini key header, ?key=.
    text = text
      .replace(/(bearer\s+)[^\s"',;]+/gi, '$1***')
      .replace(/(x-goog-api-key["']?\s*[:=]\s*["']?)[^\s"',;]+/gi, '$1***')
      .replace(/([?&](?:key|api[_-]?key|token|access_token)=)[^&\s"']+/gi, '$1***');
    return truncateText(text, AI_TEST_MAX_ERROR_CHARS);
  };
  const failure = (error, extra = {}) => finish({
    ok: false,
    error: scrub(error instanceof Error ? error.message : error),
    ...extra,
  });

  if (!apiKey) {
    return finish({
      ok: false,
      errorKind: 'config',
      error: provider === 'gemini' ? 'GEMINI_API_KEY is not configured in settings' : 'OPENAI_API_KEY is not configured in settings',
    });
  }

  if (provider === 'gemini') {
    console.log('[ai-test] POST gemini-3-flash-preview');
    let response;
    try {
      response = await customFetch(GEMINI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: AI_TEST_PROMPT }] }],
          // thinkingBudget 0 as in SEGMENTATION_GEMINI_GENERATION_CONFIG: gemini-3-flash-preview
          // thinks by default and would spend the budget before answering "hello".
          generationConfig: { maxOutputTokens: AI_TEST_MAX_TOKENS, thinkingConfig: { thinkingBudget: 0 } },
        }),
        signal: timeoutSignal(timeoutMs),
      });
    } catch (error) {
      const failed = describeFetchFailure(error, timeoutMs, 'Request to Gemini');
      return failure(failed, { errorKind: /timed out/.test(failed.message) ? 'timeout' : 'network' });
    }
    if (!response.ok) {
      let errText = '';
      try {
        errText = await response.text();
      } catch {
        // Status alone is still informative.
      }
      return failure(`Gemini API error: ${response.status} ${response.statusText}${errText ? ` - ${errText}` : ''}`, {
        status: response.status,
        errorKind: 'http',
      });
    }
    let data;
    try {
      data = await response.json();
    } catch (error) {
      const failed = describeFetchFailure(error, timeoutMs, 'Reading the response from Gemini');
      return failure(failed, { status: response.status, errorKind: /timed out/.test(failed.message) ? 'timeout' : 'network' });
    }
    const candidate = data && data.candidates && data.candidates[0];
    const parts = candidate && candidate.content ? candidate.content.parts : null;
    const text = Array.isArray(parts)
      ? parts.filter((part) => part && typeof part.text === 'string').map((part) => part.text).join('')
      : '';
    const modelName = data && typeof data.modelVersion === 'string' ? data.modelVersion : 'gemini-3-flash-preview';
    if (!text.trim()) {
      const reason = candidate && candidate.finishReason === 'MAX_TOKENS' ? 'reasoning' : 'empty';
      return finish({ ok: true, status: response.status, model: modelName, text: '', emptyReason: reason });
    }
    return finish({ ok: true, status: response.status, model: modelName, text: truncateText(text, AI_TEST_MAX_REPLY_CHARS) });
  }

  const apiUrl = normalizeOpenAIChatCompletionsUrl(rawApiUrl);
  const model = resolveOpenAICompatibleModel(apiUrl, rawModel);
  const compatProvider = detectOpenAICompatibleProvider(apiUrl);
  console.log(`[ai-test] POST ${redactUrl(apiUrl)} model=${model} provider=${compatProvider}${stream ? ' stream=on' : ''}`);

  // Connectivity does not require reasoning suppression: always-thinking models reject it.
  // A successful response with no answer is still reported below with an emptyReason.
  let result;
  try {
    result = await sendOpenAICompatible({
      apiUrl,
      apiKey,
      body: buildOpenAICompatibleTestBody(model, compatProvider, stream),
      customFetch,
      timeoutMs,
    });
  } catch (error) {
    const message = (error instanceof Error ? error.message : String(error)).split(apiUrl).join(redactUrl(apiUrl));
    return failure(message, { errorKind: /timed out/.test(message) ? 'timeout' : 'network' });
  }
  if (!result.ok) {
    return failure(result.errorText.split(apiUrl).join(redactUrl(apiUrl)), { status: result.status, errorKind: 'http' });
  }

  const shownModel = result.model || model;
  const text = typeof result.content === 'string' ? result.content : '';
  if (!text.trim()) {
    return finish({
      ok: true,
      status: result.status,
      model: shownModel,
      text: '',
      emptyReason: exhaustedByReasoning(result.choice, result.usage) ? 'reasoning' : 'empty',
    });
  }
  return finish({ ok: true, status: result.status, model: shownModel, text: truncateText(text, AI_TEST_MAX_REPLY_CHARS) });
}

module.exports = {
  DEFAULT_AI_TIMEOUT_MS,
  DEEPSEEK_DEFAULT_MODEL,
  DEFAULT_OPENAI_CHAT_COMPLETIONS_URL,
  DEFAULT_OPENAI_MODEL,
  DEFAULT_OPENAI_TEMPERATURE,
  buildOpenAICompatibleRequestBody,
  createOpenAIStreamAccumulator,
  describeEmptyCompletion,
  detectOpenAICompatibleProvider,
  extractResponseContentText,
  formatOpenAICompatibleError,
  normalizeOpenAIChatCompletionsUrl,
  providerSupportsStructuredOutputs,
  resolveOpenAICompatibleModel,
  resolveOpenAICompatibleTemperature,
  runAiConnectionTest,
  runAiJsonCompletion,
  validateAiConnectionTestInput,
};
