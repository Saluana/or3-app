import { beforeEach, describe, expect, it } from 'vitest';
import { useChatRuntimeLog } from '../../app/composables/useChatRuntimeLog';
import { createLogger, setDebugLoggingEnabled } from '../../app/utils/logger';
import { clearActiveTraceId, setActiveTraceId } from '../../app/utils/logTrace';

describe('createLogger', () => {
    beforeEach(() => {
        window.localStorage.clear();
        clearActiveTraceId();
        useChatRuntimeLog().clear();
    });

    it('records info logs with active trace metadata and redacted data', () => {
        setActiveTraceId('trace-a');
        createLogger('unit').info('event:start', 'started', {
            token: 'secret-token',
            count: 1,
        });

        const [entry] = useChatRuntimeLog().entries.value;
        expect(entry).toMatchObject({
            level: 'info',
            area: 'unit',
            event: 'event:start',
            detail: 'started',
            traceId: 'trace-a',
        });
        expect(entry.data).toMatchObject({
            token: '[redacted]',
            count: 1,
            traceId: 'trace-a',
        });
    });

    it('gates debug logs behind the debug logging setting', () => {
        const logger = createLogger('unit');
        logger.debug('event:debug');
        expect(useChatRuntimeLog().entries.value).toHaveLength(0);

        setDebugLoggingEnabled(true);
        logger.debug('event:debug');

        expect(useChatRuntimeLog().entries.value).toHaveLength(1);
        expect(useChatRuntimeLog().entries.value[0]).toMatchObject({
            level: 'debug',
            event: 'event:debug',
        });
    });
});
