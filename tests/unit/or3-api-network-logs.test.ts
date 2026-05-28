import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    resetHostNetworkErrorLogSuppressionForTests,
    shouldLogHostNetworkError,
    suppressOr3ApiNetworkErrorLogsFor,
} from '../../app/utils/or3ApiNetworkLogs';

describe('or3ApiNetworkLogs', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        resetHostNetworkErrorLogSuppressionForTests();
    });

    afterEach(() => {
        vi.useRealTimers();
        resetHostNetworkErrorLogSuppressionForTests();
    });

    it('does not suppress when restart scope has no base URL', () => {
        suppressOr3ApiNetworkErrorLogsFor(65000, { baseUrl: '' });
        expect(shouldLogHostNetworkError('https://host-a.example')).toBe(true);
    });

    it('suppresses only matching host base URLs during the window', () => {
        suppressOr3ApiNetworkErrorLogsFor(65000, {
            baseUrl: 'https://host-a.example/',
        });

        expect(shouldLogHostNetworkError('https://host-a.example')).toBe(false);
        expect(shouldLogHostNetworkError('https://host-b.example')).toBe(true);
        expect(shouldLogHostNetworkError()).toBe(true);
    });

    it('clears suppression after the window expires', () => {
        suppressOr3ApiNetworkErrorLogsFor(1000, {
            baseUrl: 'https://host-a.example',
        });

        vi.advanceTimersByTime(1001);

        expect(shouldLogHostNetworkError('https://host-a.example')).toBe(true);
    });
});
