// .github/scripts/triage/io/deepseek.mjs
// DeepSeek chat/completions 调用（OpenAI 兼容接口，JSON 输出模式）。
// 每次运行共享一个调用预算，重试也计入预算；余额不足单独抛出，调用方据此全局降级并通知维护者。

export class LlmBudgetExceeded extends Error {}
export class LlmInsufficientBalance extends Error {}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const RETRY_DELAYS_MS = [2000, 5000];

export function createDeepSeek({ apiKey, config, fetchImpl = fetch }) {
    const settings = config.llm;
    let callsUsed = 0;
    const usage = { promptTokens: 0, completionTokens: 0 };

    async function once(messages) {
        if (callsUsed >= settings.maxCallsPerRun) throw new LlmBudgetExceeded(`本次运行的 ${settings.maxCallsPerRun} 次 LLM 调用已用完`);
        callsUsed += 1;
        const response = await fetchImpl(`${settings.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: settings.model,
                messages,
                temperature: 0,
                max_tokens: settings.maxTokens,
                response_format: { type: 'json_object' },
            }),
            signal: AbortSignal.timeout(settings.timeoutMs),
        });
        if (response.status === 402) throw new LlmInsufficientBalance('DeepSeek 账户余额不足');
        if (response.status === 429 || response.status >= 500) return { retry: true, error: `HTTP ${response.status}` };
        if (!response.ok) throw new Error(`DeepSeek HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`);
        const data = await response.json();
        usage.promptTokens += data.usage?.prompt_tokens ?? 0;
        usage.completionTokens += data.usage?.completion_tokens ?? 0;
        const content = data.choices?.[0]?.message?.content;
        // JSON 模式偶尔返回空 content，按可重试处理。
        if (!content || !content.trim()) return { retry: true, error: '空响应' };
        try {
            return { value: JSON.parse(content) };
        } catch {
            return { retry: true, error: '响应不是合法 JSON' };
        }
    }

    // 发送一次对话并解析 JSON；可重试错误按退避重试，直到预算耗尽。
    async function completeJson(messages) {
        let lastError = null;
        for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
            if (attempt > 0) await sleep(RETRY_DELAYS_MS[attempt - 1]);
            let result;
            try {
                result = await once(messages);
            } catch (error) {
                if (error.name === 'TimeoutError') { lastError = '请求超时'; continue; }
                throw error;
            }
            if (!result.retry) return result.value;
            lastError = result.error;
        }
        throw new Error(`DeepSeek 调用失败：${lastError}`);
    }

    return { completeJson, usage, get callsUsed() { return callsUsed; } };
}
