import { describe, expect, it, vi } from 'vitest';
import {
    extractErrorCode,
    showFailureToast,
} from '../../app/utils/assistant-stream/errors';

describe('assistant-stream errors', () => {
    it('classifies stream_idle_timeout from custom stream errors', () => {
        expect(
            extractErrorCode({
                code: 'stream_idle_timeout',
                message: 'The live stream stopped sending updates.',
            }),
        ).toBe('stream_idle_timeout');
    });

    it('shows consumer-friendly toast copy without HTTP diagnostics', () => {
        const toast = { add: vi.fn() };
        showFailureToast(toast, 'Fallback title', {
            code: 'host_unreachable',
            message: 'dial tcp 127.0.0.1:9100: connection refused',
            status: 503,
            request_id: 'req_secret_123',
        });

        expect(toast.add).toHaveBeenCalledTimes(1);
        const payload = toast.add.mock.calls[0]?.[0] as {
            title?: string;
            description?: string;
        };
        expect(payload.title).toBe("Can't reach your computer");
        expect(payload.description).toMatch(/computer is running/i);
        expect(payload.description).not.toMatch(/HTTP:/);
        expect(payload.description).not.toMatch(/req_secret_123/);
    });
});
