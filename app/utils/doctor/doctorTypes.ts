import type {
    ChatActivityEntry,
    ChatMessage,
    ChatMessagePart,
    ChatToolCall,
} from '~/types/app-state';
import type { DoctorChatSessionResponse } from '~/types/or3-api';

export type RawDoctorChatMessage = NonNullable<
    DoctorChatSessionResponse['messages']
>[number];

export type DoctorStreamingMessageState = Partial<
    Pick<
        ChatMessage,
        | 'status'
        | 'parts'
        | 'toolCalls'
        | 'activityLog'
        | 'reasoningText'
        | 'error'
        | 'errorCode'
        | 'jobId'
        | 'approvalRequestId'
        | 'approvalState'
        | 'retryPayload'
    >
>;

export type DoctorMessageState = RawDoctorChatMessage &
    DoctorStreamingMessageState;

export type DoctorChatMessage = DoctorMessageState;
