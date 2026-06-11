import { describe, expect, it } from 'vitest';
import {
    canUseDoctorRunnerID,
    resolveDoctorRunnerID,
} from '../../app/utils/doctorRunnerSelection';

describe('doctorRunnerSelection', () => {
    it('drops stale runner ids before Admin Brain or runner discovery is ready', () => {
        expect(
            resolveDoctorRunnerID({
                currentRunnerID: 'unknown-runner',
                selectableRunnerIDs: [],
            }),
        ).toBe('');
    });

    it('accepts the Admin Brain runner even before selectable runners refresh', () => {
        expect(
            resolveDoctorRunnerID({
                currentRunnerID: '',
                adminBrainRunnerID: 'opencode',
                selectableRunnerIDs: [],
            }),
        ).toBe('opencode');
    });

    it('keeps a valid user selection when it stays selectable', () => {
        expect(
            resolveDoctorRunnerID({
                currentRunnerID: 'claude',
                adminBrainRunnerID: 'opencode',
                defaultRunnerID: 'opencode',
                selectableRunnerIDs: ['opencode', 'claude'],
            }),
        ).toBe('claude');
    });

    it('falls back to the default selectable runner when the current value is invalid', () => {
        expect(
            resolveDoctorRunnerID({
                currentRunnerID: 'missing-runner',
                defaultRunnerID: 'opencode',
                selectableRunnerIDs: ['opencode', 'claude'],
            }),
        ).toBe('opencode');
    });

    it('only allows selectable or Admin Brain runner ids', () => {
        expect(
            canUseDoctorRunnerID('claude', {
                adminBrainRunnerID: 'opencode',
                selectableRunnerIDs: ['opencode'],
            }),
        ).toBe(false);
        expect(
            canUseDoctorRunnerID('opencode', {
                adminBrainRunnerID: 'opencode',
                selectableRunnerIDs: [],
            }),
        ).toBe(true);
    });
});
