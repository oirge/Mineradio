import { describe, expect, it } from 'vitest';
import { isConnectionResetMessage, isNetworkFailureMessage } from '../../../shared/networkErrorText.mjs';

// test/unit/shared/networkErrorText.test.ts

const cjs = require('../../../shared/networkErrorText.cjs') as {
    isConnectionResetMessage: (text: unknown) => boolean;
    isNetworkFailureMessage: (text: unknown) => boolean;
};

const SAMPLES: Array<[unknown, { reset: boolean; network: boolean }]> = [
    ['read ECONNRESET', { reset: true, network: true }],
    ['socket hang up', { reset: true, network: true }],
    ['Client network socket disconnected before secure TLS connection was established', { reset: true, network: true }],
    ['connect ECONNREFUSED 127.0.0.1:7890', { reset: false, network: true }],
    ['connect ETIMEDOUT 59.111.181.35:443', { reset: false, network: true }],
    ['getaddrinfo ENOTFOUND interfacepc.music.163.com', { reset: false, network: true }],
    ['getaddrinfo EAI_AGAIN interfacepc.music.163.com', { reset: false, network: true }],
    ['connect EHOSTUNREACH 2001:0:2851:782c:1c2a:3a7d:a2b0:e4f6:443', { reset: false, network: true }],
    ['timeout of 25000ms exceeded', { reset: false, network: true }],
    ['code 802: 授权中', { reset: false, network: false }],
    ['Request failed with status code 404', { reset: false, network: false }],
    [undefined, { reset: false, network: false }],
];

describe('network error text', () => {
    it.each(SAMPLES)('classifies %s', (input, expected) => {
        expect(isConnectionResetMessage(input)).toBe(expected.reset);
        expect(isNetworkFailureMessage(input)).toBe(expected.network);
    });

    // 主进程用 .cjs、渲染进程用 .mjs，两份必须给出同样的结果。
    it('keeps the CommonJS twin identical', () => {
        for (const [input] of SAMPLES) {
            expect(cjs.isConnectionResetMessage(input)).toBe(isConnectionResetMessage(input));
            expect(cjs.isNetworkFailureMessage(input)).toBe(isNetworkFailureMessage(input));
        }
    });
});
