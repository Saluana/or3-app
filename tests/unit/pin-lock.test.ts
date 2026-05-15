import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    PIN_LOCKOUT_MS,
    PIN_MAX_ATTEMPTS,
    PIN_UNLOCK_DEFAULT_MS,
    changePin,
    disable,
    enable,
    getAttemptsRemaining,
    isLockedOut,
    isUnlocked,
    lock,
    needsUnlock,
    resetPinLock,
    unlock,
} from '../../app/composables/usePinLock';

function makeStorage(): Storage {
    const store = new Map<string, string>();
    return {
        get length() {
            return store.size;
        },
        key(index: number) {
            return Array.from(store.keys())[index] ?? null;
        },
        getItem(key: string) {
            return store.get(key) ?? null;
        },
        setItem(key: string, value: string) {
            store.set(key, String(value));
        },
        removeItem(key: string) {
            store.delete(key);
        },
        clear() {
            store.clear();
        },
    };
}

describe('usePinLock', () => {
    beforeEach(() => {
        (globalThis as { localStorage?: Storage }).localStorage = makeStorage();
        (globalThis as { sessionStorage?: Storage }).sessionStorage =
            makeStorage();
    });

    afterEach(() => {
        vi.useRealTimers();
        resetPinLock();
        globalThis.sessionStorage?.clear();
        globalThis.localStorage?.clear();
    });

    it('encrypts legacy plaintext session tokens when enabling the pin lock', async () => {
        globalThis.sessionStorage.setItem(
            'or3-app:v1:secure-host-tokens',
            JSON.stringify({
                'host-1': {
                    pairedToken: 'paired-token',
                    sessionToken: 'session-token',
                    origin: 'http://127.0.0.1:9100',
                },
            }),
        );

        await expect(enable('1234')).resolves.toMatchObject({ success: true });

        const encrypted = globalThis.localStorage.getItem(
            'or3-app:v1:secure-host-tokens',
        );
        expect(encrypted).toContain('"iv"');
        expect(encrypted).not.toContain('paired-token');
        expect(
            globalThis.sessionStorage.getItem('or3-app:v1:secure-host-tokens'),
        ).toBeNull();

        lock();
        await expect(unlock('1234')).resolves.toMatchObject({ success: true });
    });

    it('requires the entered current pin to change or disable the pin lock', async () => {
        await expect(enable('1234')).resolves.toMatchObject({ success: true });

        await expect(changePin('0000', '5678')).resolves.toMatchObject({
            success: false,
            error: expect.stringContaining('Current PIN is incorrect.'),
        });
        await expect(disable('0000')).resolves.toMatchObject({
            success: false,
            error: expect.stringContaining('Incorrect PIN.'),
        });
        await expect(disable('1234')).resolves.toMatchObject({ success: true });
    });

    it('restores attempts after the lockout window expires', async () => {
        vi.useFakeTimers();
        await expect(enable('1234')).resolves.toMatchObject({ success: true });

        lock();

        for (let attempt = 0; attempt < PIN_MAX_ATTEMPTS; attempt += 1) {
            await unlock('0000');
        }

        expect(isLockedOut()).toBe(true);
        vi.advanceTimersByTime(PIN_LOCKOUT_MS + 1);
        expect(isLockedOut()).toBe(false);
        expect(getAttemptsRemaining()).toBe(PIN_MAX_ATTEMPTS);
    });

    it('persists failed attempts across reloads before lockout kicks in', async () => {
        await expect(enable('1234')).resolves.toMatchObject({ success: true });

        lock();
        await unlock('0000');
        await unlock('0000');

        expect(
            globalThis.localStorage.getItem('or3-app:v1:pin-lockout'),
        ).toContain('"failedAttempts":2');

        const freshPinLock = await import(
            `../../app/composables/usePinLock?reload=attempts`
        );

        expect(freshPinLock.getAttemptsRemaining()).toBe(PIN_MAX_ATTEMPTS - 2);
    });

    it('restores the unlocked session across a reload within the grace window', async () => {
        vi.useFakeTimers();

        await expect(
            enable('1234', PIN_UNLOCK_DEFAULT_MS),
        ).resolves.toMatchObject({ success: true });

        expect(isUnlocked()).toBe(true);
        const freshPinLock = await import(
            `../../app/composables/usePinLock?reload=grace-active`
        );

        expect(freshPinLock.isUnlocked()).toBe(true);
        expect(freshPinLock.needsUnlock()).toBe(false);
    });

    it('requires the pin again after the unlock grace window expires', async () => {
        vi.useFakeTimers();
        const unlockDurationMs = 5 * 60 * 1000;

        await expect(enable('1234', unlockDurationMs)).resolves.toMatchObject({
            success: true,
        });

        expect(needsUnlock()).toBe(false);
        vi.advanceTimersByTime(unlockDurationMs + 1);
        const freshPinLock = await import(
            `../../app/composables/usePinLock?reload=grace-expired`
        );

        expect(freshPinLock.isUnlocked()).toBe(false);
        expect(freshPinLock.needsUnlock()).toBe(true);
    });
});
