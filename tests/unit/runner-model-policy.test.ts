import { describe, expect, it } from 'vitest';
import {
    defaultRunnerModelForSelection,
    resolveRunnerModelForSend,
    resolveSessionRunnerModel,
} from '../../app/utils/runnerModelPolicy';

describe('runnerModelPolicy', () => {
    it('returns the runner default when no selection is set', () => {
        expect(defaultRunnerModelForSelection('claude', 'gpt-4')).toBe('gpt-4');
    });

    it('resolves session metadata for a runner selection', () => {
        expect(
            resolveSessionRunnerModel({
                selected: '',
                runnerDefault: 'agent-model',
            }),
        ).toBe('agent-model');
        expect(
            resolveSessionRunnerModel({
                selected: 'anthropic/claude',
                runnerDefault: 'agent-model',
            }),
        ).toBe('anthropic/claude');
    });

    it('resolves the model sent with the next message', () => {
        expect(
            resolveRunnerModelForSend({
                selected: '',
                runnerDefault: 'agent-model',
            }),
        ).toBe('agent-model');
        expect(
            resolveRunnerModelForSend({
                selected: 'override',
                runnerDefault: 'agent-model',
                payloadModel: 'payload',
            }),
        ).toBe('payload');
    });
});
