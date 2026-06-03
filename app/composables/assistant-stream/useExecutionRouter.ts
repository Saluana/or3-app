import type { AssistantSendPayload, ChatSession } from '~/types/app-state';
import { isLegacyRunnerId } from '~/utils/runnerIds';
import {
    streamDirectTurn,
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

interface RouteExecutionOptions extends ResolveExecutionRouteResult {
    executionContext: ExecutionContext;
    followJobId: string;
    followRunnerTurnId: string;
    payload: AssistantSendPayload;
    session: ChatSession;
    text: string;
    turnRequest: Record<string, unknown> | null;
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
            useRunnerChat:
                Boolean(selectedRunnerId) && !isLegacyRunnerId(selectedRunnerId),
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
        turnRequest,
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

        if (!selectedRunnerId) {
            throw new Error('Choose an available runner before sending.');
        }

        return streamDirectTurn({
            ...executionContext,
            turnRequest,
        });
    };

    return {
        resolveExecutionRoute,
        routeExecution,
    };
}
