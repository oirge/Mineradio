// Shared OpenAI-compatible endpoint detection and bounded request-shape negotiation.

const capabilityCache = new Map();

const getCapabilities = (apiUrl, model) => {
  const key = JSON.stringify([apiUrl, model]);
  let capabilities = capabilityCache.get(key);
  if (!capabilities) {
    capabilities = {};
    capabilityCache.set(key, capabilities);
  }
  return capabilities;
};

export const resetOpenAICompatibleCapabilities = () => capabilityCache.clear();

export const detectOpenAICompatibleProvider = (apiUrl) => {
  try {
    const hostname = new URL(apiUrl).hostname.toLowerCase();
    if (hostname === 'api.deepseek.com' || hostname.endsWith('.deepseek.com')) return 'deepseek';
    if (hostname === 'api.openai.com' || hostname.endsWith('.openai.com')) return 'openai';
  } catch {
    // Invalid and relative URLs use the conservative generic request shape.
  }
  return 'generic';
};

const parseErrorPayload = (text) => {
  try {
    return JSON.parse(text.replace(/^OpenAI compatible API error \(\d+\):\s*/, ''));
  } catch {
    return null;
  }
};

const rejectionPattern = (parameter) => {
  const escaped = parameter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `(?:unsupported|invalid|unknown|unrecognized|not allowed)\\s+(?:(?:parameter|argument|field)\\s*)?[:=]?\\s*["']?${escaped}\\b`
      + `|\\b${escaped}\\b\\s+(?:is\\s+)?(?:unsupported|not supported|not allowed|unrecognized)`
      + `|extra_forbidden[^\\r\\n]*\\bloc(?:ation)?\\s*[:=]\\s*["']?${escaped}\\b`
      + `|\\bloc(?:ation)?\\s*[:=]\\s*["']?${escaped}\\b[^\\r\\n]*extra_forbidden`,
    'i',
  );
};

/** True only when a 400/422 explicitly identifies the rejected request field. */
export const rejectsOpenAICompatibleParameter = (status, text, parameter) => {
  if ((status !== 400 && status !== 422) || /rate.?limit|concurrency|quota/i.test(text)) return false;

  const payload = parseErrorPayload(text);
  if (payload && typeof payload === 'object') {
    const error = payload.error && typeof payload.error === 'object' ? payload.error : null;
    const exactParameter = error?.param ?? payload.param;
    if (exactParameter === parameter) {
      const detail = `${error?.code ?? payload.code ?? ''} ${error?.message ?? payload.message ?? ''}`;
      return /unsupported|invalid|unknown|unrecognized|not allowed|extra_forbidden/i.test(detail);
    }

    if (Array.isArray(payload.detail)) {
      return payload.detail.some((issue) => Array.isArray(issue?.loc)
        && issue.loc.includes(parameter)
        && (issue.type === 'extra_forbidden' || /extra inputs are not permitted/i.test(issue.msg || '')));
    }

    const message = error?.message ?? payload.message;
    return typeof message === 'string' && rejectionPattern(parameter).test(message);
  }

  return rejectionPattern(parameter).test(text);
};

/**
 * Sends one OpenAI-compatible request and retries only explicit request-field rejections.
 * Feature policy stays in `body`: this layer never adds reasoning or thinking controls itself.
 */
export const sendOpenAICompatibleRequest = async ({
  apiUrl,
  provider,
  body,
  init,
  fetchImpl = fetch,
}) => {
  const requestBody = { ...body };
  const capabilities = getCapabilities(apiUrl, requestBody.model);

  if (provider !== 'openai' && capabilities.responseFormat === false) delete requestBody.response_format;
  if (capabilities.thinking === false) delete requestBody.thinking;
  if (capabilities.tokenField === 'max_completion_tokens' && requestBody.max_tokens !== undefined) {
    requestBody.max_completion_tokens = requestBody.max_tokens;
    delete requestBody.max_tokens;
  }

  for (;;) {
    const response = await fetchImpl(apiUrl, { ...init, body: JSON.stringify(requestBody) });
    if (response.ok) {
      if (provider !== 'openai') {
        if (requestBody.max_completion_tokens !== undefined) capabilities.tokenField = 'max_completion_tokens';
        else if (requestBody.max_tokens !== undefined) capabilities.tokenField = 'max_tokens';
      }
      return response;
    }
    if (provider === 'openai' || (response.status !== 400 && response.status !== 422)) return response;

    const text = await response.clone().text();
    if (requestBody.response_format
      && (rejectsOpenAICompatibleParameter(response.status, text, 'response_format')
        || rejectsOpenAICompatibleParameter(response.status, text, 'json_schema'))) {
      delete requestBody.response_format;
      capabilities.responseFormat = false;
      console.info('[ai] endpoint rejected response_format; retrying without it');
      continue;
    }
    if (requestBody.thinking
      && rejectsOpenAICompatibleParameter(response.status, text, 'thinking')) {
      delete requestBody.thinking;
      capabilities.thinking = false;
      console.info('[ai] endpoint rejected thinking; retrying without it');
      continue;
    }
    if (requestBody.max_tokens !== undefined
      && rejectsOpenAICompatibleParameter(response.status, text, 'max_tokens')) {
      requestBody.max_completion_tokens = requestBody.max_tokens;
      delete requestBody.max_tokens;
      console.info('[ai] endpoint rejected max_tokens; retrying with max_completion_tokens');
      continue;
    }
    return response;
  }
};
