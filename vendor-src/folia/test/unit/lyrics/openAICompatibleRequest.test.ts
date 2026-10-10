import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    detectOpenAICompatibleProvider,
    rejectsOpenAICompatibleParameter,
    resetOpenAICompatibleCapabilities,
    sendOpenAICompatibleRequest,
} from '../../../shared/openAICompatibleRequest.mjs';
import { segmentLyricLines } from '../../../shared/lyricSegmentationService.mjs';
import { handleGenerateOpenAITheme } from '../../../worker/generate-theme_openai';

// Compatibility negotiation is transport-only; feature-specific reasoning policy stays at callers.

const send = (body: Record<string, unknown>, fetchImpl: typeof fetch, provider = 'generic') => (
    sendOpenAICompatibleRequest({
        apiUrl: 'https://endpoint.example.test/v1',
        provider,
        body,
        init: { method: 'POST' },
        fetchImpl,
    })
);

beforeEach(() => resetOpenAICompatibleCapabilities());
afterEach(() => vi.unstubAllGlobals());

describe('provider detection', () => {
    it('uses the endpoint hostname rather than the configured model name', () => {
        expect(detectOpenAICompatibleProvider('https://proxy.example.test/v1')).toBe('generic');
        expect(detectOpenAICompatibleProvider('https://api.openai.com/v1')).toBe('openai');
        expect(detectOpenAICompatibleProvider('https://api.deepseek.com/v1')).toBe('deepseek');
    });
});

describe('parameter rejection evidence', () => {
    it('accepts structured OpenAI and Pydantic parameter locations', () => {
        expect(rejectsOpenAICompatibleParameter(400, JSON.stringify({
            error: { message: 'Unsupported parameter', param: 'response_format', code: 'unsupported_parameter' },
        }), 'response_format')).toBe(true);
        expect(rejectsOpenAICompatibleParameter(422, JSON.stringify({ detail: [{
            type: 'extra_forbidden', loc: ['body', 'thinking'], msg: 'Extra inputs are not permitted',
        }] }), 'thinking')).toBe(true);
        expect(rejectsOpenAICompatibleParameter(
            422, 'type=extra_forbidden loc=response_format', 'response_format',
        )).toBe(true);
    });

    it('does not mistake an echoed request body for the rejected parameter', () => {
        const text = 'Invalid parameter: temperature. Request body: '
            + '{"response_format":{"type":"json_object"},"max_tokens":8192}';
        expect(rejectsOpenAICompatibleParameter(400, text, 'response_format')).toBe(false);
        expect(rejectsOpenAICompatibleParameter(400, text, 'max_tokens')).toBe(false);
    });
});

describe('bounded capability negotiation', () => {
    it('remembers the successful token field after one explicit fallback', async () => {
        const bodies: any[] = [];
        const fetchImpl = vi.fn(async (_url, init) => {
            const body = JSON.parse(String(init?.body));
            bodies.push(body);
            return body.max_tokens !== undefined
                ? Response.json({ error: { message: 'Unsupported parameter', param: 'max_tokens', code: 'unsupported_parameter' } }, { status: 400 })
                : Response.json({ choices: [] });
        });
        const body = { model: 'model', max_tokens: 8192 };

        await send(body, fetchImpl as typeof fetch);
        await send(body, fetchImpl as typeof fetch);

        expect(bodies.map((item) => item.max_tokens !== undefined ? 'max_tokens' : 'max_completion_tokens'))
            .toEqual(['max_tokens', 'max_completion_tokens', 'max_completion_tokens']);
    });

    it('caches explicit response-format rejection but never retries rate limits', async () => {
        const bodies: any[] = [];
        const fetchImpl = vi.fn(async (_url, init) => {
            const body = JSON.parse(String(init?.body));
            bodies.push(body);
            return body.response_format
                ? Response.json({ error: { message: 'response_format is not supported' } }, { status: 400 })
                : Response.json({ choices: [] });
        });
        const body = { model: 'model', response_format: { type: 'json_object' } };
        await send(body, fetchImpl as typeof fetch);
        await send(body, fetchImpl as typeof fetch);
        expect(bodies.map((item) => Boolean(item.response_format))).toEqual([true, false, false]);

        resetOpenAICompatibleCapabilities();
        const limited = vi.fn(async () => Response.json({
            error: { message: 'Concurrency limit exceeded: response_format not supported' },
        }, { status: 429 }));
        const response = await send(body, limited as typeof fetch);
        expect(response.status).toBe(429);
        expect(limited).toHaveBeenCalledTimes(1);
    });
});

describe('feature reasoning policy', () => {
    const theme = {
        name: 'test', description: 'test', backgroundColor: '#ffffff', primaryColor: '#111111',
        accentColor: '#ff0000', secondaryColor: '#555555', wordColors: [], lyricsIcons: [],
    };

    it('leaves DeepSeek theme reasoning at its default', async () => {
        const bodies: any[] = [];
        const fetchImpl = vi.fn(async (_url, init) => {
            bodies.push(JSON.parse(String(init?.body)));
            return Response.json({ choices: [{ message: { content: JSON.stringify({ light: theme, dark: theme }) } }] });
        });
        vi.stubGlobal('fetch', fetchImpl);
        const response = await handleGenerateOpenAITheme(new Request('https://app.test', {
            method: 'POST', body: JSON.stringify({ lyricsText: 'hello' }),
        }), {
            OPENAI_API_KEY: 'key', OPENAI_API_URL: 'https://api.deepseek.com/v1',
            OPENAI_API_MODEL: 'deepseek-v4-flash',
        });
        expect(response.status).toBe(200);
        expect(bodies[0].thinking).toBeUndefined();
    });

    it('asks DeepSeek to disable reasoning for lyric segmentation', async () => {
        const bodies: any[] = [];
        const fetchImpl = vi.fn(async (_url, init) => {
            bodies.push(JSON.parse(String(init?.body)));
            return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"lines":[["hello"]]}' } }] });
        });
        await segmentLyricLines(['hello'], {
            AI_PROVIDER: 'openai', OPENAI_API_KEY: 'key', OPENAI_API_URL: 'https://api.deepseek.com/v1',
            OPENAI_API_MODEL: 'deepseek-v4-flash',
        }, fetchImpl);

        expect(bodies[0].thinking).toEqual({ type: 'disabled' });
    });
});
