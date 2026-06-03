import { vi } from 'vitest';

export type RunnerChatApiMockOptions = {
    sessionId?: string;
    turnId?: string;
    jobId?: string;
    runnerId?: string;
    turnSnapshot?: Record<string, unknown>;
    getTurnSnapshot?: () => Record<string, unknown>;
};

export function installRunnerChatRequestMock(
    requestMock: ReturnType<typeof vi.fn>,
    options: RunnerChatApiMockOptions = {},
) {
    const sessionId = options.sessionId ?? 'rcs_test';
    const turnId = options.turnId ?? 'rct_test';
    const jobId = options.jobId ?? 'job_test';
    const runnerId = options.runnerId ?? 'opencode';

    requestMock.mockImplementation(async (path: string) => {
        if (path === '/internal/v1/runner-chat/sessions') {
            return {
                id: sessionId,
                app_session_key: 'or3-app:test-host:session_1',
                runner_id: runnerId,
                continuation_mode: 'replay',
            };
        }
        if (path === `/internal/v1/runner-chat/sessions/${sessionId}`) {
            return {
                id: sessionId,
                app_session_key: 'or3-app:test-host:session_1',
                runner_id: runnerId,
                continuation_mode: 'replay',
            };
        }
        if (path === `/internal/v1/runner-chat/sessions/${sessionId}/turns`) {
            return {
                session_id: sessionId,
                turn_id: turnId,
                job_id: jobId,
                status: 'running',
            };
        }
        if (
            path ===
            `/internal/v1/runner-chat/sessions/${sessionId}/turns/${turnId}`
        ) {
            const snapshot =
                options.getTurnSnapshot?.() ?? options.turnSnapshot ?? {};
            return {
                id: turnId,
                session_id: sessionId,
                status: 'succeeded',
                final_text: '',
                agent_cli_job_id: jobId,
                ...snapshot,
            };
        }
        if (path === `/internal/v1/jobs/${jobId}`) {
            const snapshot =
                options.getTurnSnapshot?.() ?? options.turnSnapshot ?? {};
            return {
                job_id: jobId,
                status: 'completed',
                events: [],
                ...snapshot,
            };
        }
        throw new Error(`Unexpected request path: ${path}`);
    });
}

export const defaultRunnerSendPayload = {
    runnerId: 'opencode',
    runnerLabel: 'OpenCode',
    runnerContinuationMode: 'replay' as const,
};
