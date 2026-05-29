import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultPasskeyNickname } from '../../app/utils/auth/passkeyDefaults';

describe('defaultPasskeyNickname', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('returns a non-empty fallback label', () => {
        expect(defaultPasskeyNickname().length).toBeGreaterThan(0);
    });

    it('labels Edge before Chrome in the user agent string', () => {
        vi.stubGlobal('navigator', {
            userAgent:
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
        });
        expect(defaultPasskeyNickname()).toBe('Edge on Windows');
    });
});
