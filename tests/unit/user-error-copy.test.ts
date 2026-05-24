import { describe, expect, it } from 'vitest';
import {
    EMPTY_FINAL_USER_MESSAGE,
    formatUserFacingErrorInline,
    userFacingErrorCopy,
    userFacingErrorToastDescription,
} from '../../app/utils/assistant-stream/userErrorCopy';

describe('userErrorCopy', () => {
    it('maps known error codes to plain language', () => {
        const copy = userFacingErrorCopy(null, 'auth_required');
        expect(copy.title).toBe('Sign-in needed');
        expect(copy.suggestion).toMatch(/Settings/i);
    });

    it('maps stream idle timeout for consumers', () => {
        const copy = userFacingErrorCopy(
            { code: 'stream_idle_timeout', message: 'idle' },
            'stream_idle_timeout',
        );
        expect(copy.title).toBe('Catching up');
        expect(copy.message).toMatch(/paused/i);
    });

    it('uses friendly empty-final copy', () => {
        const copy = userFacingErrorCopy(null, 'empty_final_text');
        expect(copy.message).toBe(EMPTY_FINAL_USER_MESSAGE);
    });

    it('returns a short toast description', () => {
        const description = userFacingErrorToastDescription(null, 'rate_limited');
        expect(description.length).toBeGreaterThan(0);
        expect(description).not.toMatch(/HTTP:/);
    });

    it('maps service capability ceiling messages without leaking internals', () => {
        const copy = userFacingErrorCopy(
            new Error(
                'requested tools exceed service capability ceiling for this host',
            ),
        );
        expect(copy.title).toBe('Safer mode required');
        expect(copy.suggestion).toMatch(/Ask mode/i);
    });

    it('does not surface [object Object] for structured API errors', () => {
        const copy = userFacingErrorCopy({
            code: 'validation_failed',
            status: 400,
            message: { field: 'message', reason: 'required' },
        });
        expect(copy.message).not.toBe('[object Object]');
        expect(copy.message.length).toBeGreaterThan(0);
    });

    it('formats inline errors as plain language without request ids', () => {
        const inline = formatUserFacingErrorInline(
            {
                code: 'auth_required',
                message: 'missing bearer token',
                request_id: 'req_123',
                status: 401,
            },
            'auth_required',
        );
        expect(inline).toMatch(/sign in again/i);
        expect(inline).not.toMatch(/HTTP:/);
        expect(inline).not.toMatch(/req_123/);
    });
});
