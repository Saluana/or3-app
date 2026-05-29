import { describe, expect, it } from 'vitest';
import {
    defaultRunnerModelForSelection,
    internTurnModelRequestField,
    isInternChatModelRunner,
    resolveRunnerModelForSend,
    resolveSessionRunnerModel,
    shouldApplyRunnerDefaultModel,
} from '../../app/utils/runnerModelPolicy';

describe('runnerModelPolicy', () => {
    it('identifies intern runner', () => {
        expect(isInternChatModelRunner('or3-intern')).toBe(true);
        expect(isInternChatModelRunner('claude')).toBe(false);
    });

    it('does not apply agent defaults for intern', () => {
        expect(shouldApplyRunnerDefaultModel('or3-intern')).toBe(false);
        expect(defaultRunnerModelForSelection('or3-intern', 'gpt-4')).toBe('');
    });

    it('resolves session metadata for intern vs agent', () => {
        expect(
            resolveSessionRunnerModel({
                runnerId: 'or3-intern',
                selected: '',
                runnerDefault: 'agent-model',
            }),
        ).toBeUndefined();
        expect(
            resolveSessionRunnerModel({
                runnerId: 'or3-intern',
                selected: 'anthropic/claude',
                runnerDefault: 'agent-model',
            }),
        ).toBe('anthropic/claude');
        expect(
            resolveSessionRunnerModel({
                runnerId: 'claude',
                selected: '',
                runnerDefault: 'agent-model',
            }),
        ).toBe('agent-model');
    });

    it('resolves send model for intern vs agent', () => {
        expect(
            resolveRunnerModelForSend({
                runnerId: 'or3-intern',
                selected: '',
                runnerDefault: 'agent-model',
            }),
        ).toBeUndefined();
        expect(
            resolveRunnerModelForSend({
                runnerId: 'claude',
                selected: '',
                runnerDefault: 'agent-model',
            }),
        ).toBe('agent-model');
        expect(
            resolveRunnerModelForSend({
                runnerId: 'claude',
                selected: 'override',
                runnerDefault: 'agent-model',
                payloadModel: 'payload',
            }),
        ).toBe('payload');
    });

    it('builds intern turn model field only when set', () => {
        expect(
            internTurnModelRequestField({
                runnerId: 'claude',
                sessionModel: 'x',
            }),
        ).toEqual({});
        expect(
            internTurnModelRequestField({
                runnerId: 'or3-intern',
                sessionModel: 'anthropic/claude',
            }),
        ).toEqual({ model: 'anthropic/claude' });
    });
});
