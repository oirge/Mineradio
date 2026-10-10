import { describe, expect, it } from 'vitest';
import { effectiveKeyCode } from '../../../src/utils/keyboardTargets';

// effectiveKeyCode 是 #489 修复的核心：在软件注入按键（event.code 为空）时用 event.key
// 反推回等价的 code token，让统一走 event.code 的快捷键照常命中。物理键盘 event.code 非空，
// 这里必须原样返回、不做任何改写。

const ev = (init: { code: string; key: string }) => init as KeyboardEvent;

describe('effectiveKeyCode', () => {
    // 一、物理键盘：event.code 非空 -> 原样返回（行为零变化）。
    it('returns event.code unchanged when present', () => {
        expect(effectiveKeyCode(ev({ code: 'Escape', key: 'Escape' }))).toBe('Escape');
        expect(effectiveKeyCode(ev({ code: 'Space', key: ' ' }))).toBe('Space');
        expect(effectiveKeyCode(ev({ code: 'KeyH', key: 'h' }))).toBe('KeyH');
        expect(effectiveKeyCode(ev({ code: 'ArrowLeft', key: 'ArrowLeft' }))).toBe('ArrowLeft');
    });

    // 二、模拟软件注入：event.code 为空，只剩 event.key。

    it('maps an empty-code letter key to its Key* token', () => {
        expect(effectiveKeyCode(ev({ code: '', key: 'h' }))).toBe('KeyH');
        expect(effectiveKeyCode(ev({ code: '', key: 'p' }))).toBe('KeyP');
        expect(effectiveKeyCode(ev({ code: '', key: 's' }))).toBe('KeyS');
        expect(effectiveKeyCode(ev({ code: '', key: 'g' }))).toBe('KeyG');
    });

    it('maps an empty-code named key to the same token', () => {
        expect(effectiveKeyCode(ev({ code: '', key: 'Escape' }))).toBe('Escape');
        expect(effectiveKeyCode(ev({ code: '', key: 'ArrowLeft' }))).toBe('ArrowLeft');
        expect(effectiveKeyCode(ev({ code: '', key: 'ArrowRight' }))).toBe('ArrowRight');
        expect(effectiveKeyCode(ev({ code: '', key: 'Tab' }))).toBe('Tab');
    });

    it('maps space and bracket keys to their code token', () => {
        expect(effectiveKeyCode(ev({ code: '', key: ' ' }))).toBe('Space');
        expect(effectiveKeyCode(ev({ code: '', key: '[' }))).toBe('BracketLeft');
        expect(effectiveKeyCode(ev({ code: '', key: ']' }))).toBe('BracketRight');
    });

    it('does not fabricate a token for a letter-less 1-char symbol it cannot map', () => {
        // '/' 有 KeySlash 之类的 code，但 key 上认不出 -> 不应伪造出一个错误 token。
        expect(effectiveKeyCode(ev({ code: '', key: '/' }))).toBe('');
    });

    it('leaves unknown named keys as-is', () => {
        expect(effectiveKeyCode(ev({ code: '', key: 'F13' }))).toBe('F13');
    });
});