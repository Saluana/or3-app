import type { AssistantSendPayload, ChatSession } from '~/types/app-state';
import {
    streamFollowJob,
    streamFollowRunnerTurn,
    streamRunnerChat,
} from '~/utils/assistant-stream/execution';
import type { useChatSessions } from '../useChatSessions';

type ChatStore = ReturnType<typeof useChatSessions>;
type ExecutionContext = Omit<
    Parameters<typeof streamRunnerChat>[0],
    'chat' | 'session' | 'payload' | 'text' | 'selectedRunnerId'
>;

interface ResolveExecutionRouteResult {
    selectedRunnerId: string;
    useRunnerChat: boolean;
}

export type AssistantExecutionPath =
    | 'job-follow'
    | 'runner-follow'
    | 'runner-chat';

export function resolveExecutionPath(options: {
    followJobId: string;
    followRunnerTurnId: string;
    runnerChatSessionId?: string;
    useRunnerChat: boolean;
}): AssistantExecutionPath {
    if (
        options.followRunnerTurnId.trim() &&
        options.runnerChatSessionId?.trim()
    ) {
        return 'runner-follow';
    }
    if (options.followJobId.trim()) {
        return 'job-follow';
    }
    if (options.useRunnerChat) {
        return 'runner-chat';
    }
    return 'runner-chat';
}

interface RouteExecutionOptions extends ResolveExecutionRouteResult {
    executionContext: ExecutionContext;
    followJobId: string;
    followRunnerTurnId: string;
    payload: AssistantSendPayload;
    session: ChatSession;
    text: string;
}

export function useExecutionRouter(options: { chat: ChatStore }) {
    const resolveExecutionRoute = (
        payload: AssistantSendPayload,
        session: ChatSession,
    ): ResolveExecutionRouteResult => {
        const selectedRunnerId =
            payload.runnerId || session.runnerId || '';
        return {
            selectedRunnerId,
            useRunnerChat: Boolean(selectedRunnerId),
        };
    };

    const routeExecution = async ({
        executionContext,
        followJobId,
        followRunnerTurnId,
        payload,
        selectedRunnerId,
        session,
        text,
        useRunnerChat,
    }: RouteExecutionOptions) => {
        if (followRunnerTurnId && payload.runnerChatSessionId) {
            return streamFollowRunnerTurn({
                ...executionContext,
                runnerChatSessionId: payload.runnerChatSessionId,
                runnerChatTurnId: followRunnerTurnId,
            });
        }

        if (followJobId) {
            return streamFollowJob({
                ...executionContext,
                followJobId,
            });
        }

        if (useRunnerChat) {
            return streamRunnerChat({
                ...executionContext,
                chat: options.chat,
                session,
                payload,
                text,
                selectedRunnerId,
            });
        }

        throw new Error('Choose an available runner before sending.');
    };

    return {
        resolveExecutionRoute,
        routeExecution,
    };
}
