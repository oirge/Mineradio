import { beforeEach, describe, expect, it } from 'vitest';
import { setStatusMessage, useStatusMessageStore } from '@/stores/useStatusMessageStore';

// test/unit/stores/statusMessageStore.test.ts
// Guards the two properties the toast channel's callers depend on: the updater form still sees
// the previous message, and the module-level emitter keeps one stable identity so it can be used
// outside React without entering dependency arrays.

describe('status message store', () => {
    beforeEach(() => {
        useStatusMessageStore.setState({ message: null });
    });

    it('stores a message set directly', () => {
        setStatusMessage({ type: 'info', text: 'hello' });
        expect(useStatusMessageStore.getState().message).toEqual({ type: 'info', text: 'hello' });
    });

    it('passes the previous message to the updater form', () => {
        setStatusMessage({ type: 'error', text: 'first', persistent: true });
        setStatusMessage(prev => (prev?.persistent ? null : prev));
        expect(useStatusMessageStore.getState().message).toBeNull();

        setStatusMessage({ type: 'info', text: 'second' });
        setStatusMessage(prev => (prev?.persistent ? null : prev));
        expect(useStatusMessageStore.getState().message).toEqual({ type: 'info', text: 'second' });
    });

    it('clears back to null', () => {
        setStatusMessage({ type: 'success', text: 'done' });
        setStatusMessage(null);
        expect(useStatusMessageStore.getState().message).toBeNull();
    });

    it('keeps a stable emitter identity across calls', () => {
        const first = setStatusMessage;
        setStatusMessage({ type: 'info', text: 'x' });
        expect(setStatusMessage).toBe(first);
    });
});
