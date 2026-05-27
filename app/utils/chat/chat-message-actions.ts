import type { ComputedRef, InjectionKey, Ref } from 'vue';
import type {
    ApprovalActionResponse,
    ApprovalRequest,
} from '~/types/or3-api';
import type { AssistantSendPayload, ChatMessage, ChatSession } from '~/types/app-state';

export interface ChatMessageActionsContext {
    activeSession: ComputedRef<ChatSession | null>;
    isStreaming: Ref<boolean>;
    findMessageById: (id: string) => ChatMessage | null;
    markApprovalResolved: (
        approvalRequestId: number | string | undefined,
        state: NonNullable<ChatMessage['approvalState']>,
        sessionKey?: string,
        error?: string,
    ) => void;
    updateMessage: (
        id: string,
        patch: Partial<ChatMessage>,
        options?: {
            persist?: boolean;
            touch?: boolean;
            syncSummary?: boolean;
            replace?: boolean;
        },
    ) => ChatMessage | undefined;
    toggleMessagePin: (id: string) => boolean;
    send: (message: string | AssistantSendPayload) => Promise<void>;
    forkSession: (options: {
        sourceSessionKey: string;
        anchorMessageId: number;
        targetRunnerId?: string;
        title?: string;
        allowIncompleteAnchor?: boolean;
    }) => Promise<unknown>;
    approve: (
        approvalRequestId: number | string,
        remember?: boolean,
        note?: string,
    ) => Promise<ApprovalActionResponse>;
    deny: (
        approvalRequestId: number | string,
        note?: string,
    ) => Promise<ApprovalActionResponse>;
    fetchApproval: (
        approvalRequestId: number | string,
    ) => Promise<ApprovalRequest>;
    consumeIssuedApprovalToken: (
        approvalRequestId: number | string,
    ) => string | undefined;
}

export const CHAT_MESSAGE_ACTIONS_KEY: InjectionKey<ChatMessageActionsContext> =
    Symbol('chat-message-actions');
