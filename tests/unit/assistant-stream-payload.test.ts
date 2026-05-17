import { describe, expect, it } from 'vitest';
import {
    normalizePayload,
    retryPayloadForStorage,
} from '../../app/utils/assistant-stream/payload';

describe('assistant stream payload', () => {
    it('preserves runner thinking level through normalize and retry payloads', () => {
        const normalized = normalizePayload({
            text: 'hello',
            attachments: [],
            runnerId: 'opencode',
            runnerModel: 'gpt-5',
            runnerThinkingLevel: 'high',
        });

        expect(normalized.runnerThinkingLevel).toBe('high');
        expect(retryPayloadForStorage(normalized).runnerThinkingLevel).toBe(
            'high',
        );
    });
});
