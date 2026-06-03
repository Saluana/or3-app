import type { AssistantSendPayload } from '~/types/app-state';

export function normalizeRunnerPermissionPayload(
    value: unknown,
): AssistantSendPayload['runnerPermission'] | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined;
    }
    const record = value as Record<string, unknown>;
    const runnerId =
        typeof record.runnerId === 'string'
            ? record.runnerId.trim()
            : typeof record.runner_id === 'string'
              ? record.runner_id.trim()
              : '';
    const kind = typeof record.kind === 'string' ? record.kind.trim() : '';
    const access =
        typeof record.access === 'string' ? record.access.trim() : '';
    const targetPath =
        typeof record.targetPath === 'string'
            ? record.targetPath.trim()
            : typeof record.target_path === 'string'
              ? record.target_path.trim()
              : '';
    if (!targetPath) return undefined;
    return {
        runnerId: runnerId || undefined,
        kind: kind || undefined,
        access: access || undefined,
        targetPath,
    };
}

export function normalizePayload(
    input: string | AssistantSendPayload,
): AssistantSendPayload {
    if (typeof input === 'string')
        return {
            text: input.trim(),
            transportText: input.trim(),
            attachments: [],
        };
    return {
        text: input.text.trim(),
        transportText: (input.transportText || input.text).trim(),
        attachments: input.attachments ?? [],
        mode: input.mode,
        toolPolicy: input.toolPolicy,
        approvalToken: input.approvalToken,
        followJobId: input.followJobId,
        continueMessageId: input.continueMessageId,
        suppressUserEcho: input.suppressUserEcho,
        runnerId: input.runnerId,
        runnerLabel: input.runnerLabel,
        runnerChatSessionId: input.runnerChatSessionId,
        runnerChatTurnId: input.runnerChatTurnId,
        runnerContinuationMode: input.runnerContinuationMode,
        runnerModel: input.runnerModel,
        runnerMode: input.runnerMode,
        runnerIsolation: input.runnerIsolation,
        runnerCwd: input.runnerCwd,
        runnerMaxTurns: input.runnerMaxTurns,
        runnerThinkingLevel: input.runnerThinkingLevel,
        runnerPermission: normalizeRunnerPermissionPayload(
            input.runnerPermission,
        ),
    };
}

export function retryPayloadForStorage(
    payload: AssistantSendPayload,
): AssistantSendPayload {
    return {
        text: payload.text,
        transportText: payload.transportText,
        attachments: payload.attachments ?? [],
        mode: payload.mode,
        toolPolicy: payload.toolPolicy,
        approvalToken: payload.approvalToken,
        continueMessageId: payload.continueMessageId,
        suppressUserEcho: payload.suppressUserEcho,
        runnerId: payload.runnerId,
        runnerLabel: payload.runnerLabel,
        runnerChatSessionId: payload.runnerChatSessionId,
        runnerChatTurnId: payload.runnerChatTurnId,
        runnerContinuationMode: payload.runnerContinuationMode,
        runnerModel: payload.runnerModel,
        runnerMode: payload.runnerMode,
        runnerIsolation: payload.runnerIsolation,
        runnerCwd: payload.runnerCwd,
        runnerMaxTurns: payload.runnerMaxTurns,
        runnerThinkingLevel: payload.runnerThinkingLevel,
        runnerPermission: payload.runnerPermission,
    };
}
