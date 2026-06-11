import { ref } from 'vue';
import { createGlobalState } from '@vueuse/core';
import type {
    DoctorAdminBrainProvider,
    DoctorPlanApplyResponse,
    DoctorPlanResponse,
    DoctorPostCheckResponse,
    DoctorStatusResponse,
} from '~/types/or3-api';
import type { DoctorMessageState } from '../../utils/doctor';

export type DoctorChatStore = ReturnType<typeof useDoctorChatStore>;

export const useDoctorChatStore = createGlobalState(() => {
    const sessionKey = ref<string | null>(null);
    const messages = ref<DoctorMessageState[]>([]);
    const adminBrain = ref<DoctorAdminBrainProvider | null>(null);
    const status = ref<DoctorStatusResponse | null>(null);
    const activePlan = ref<DoctorPlanResponse | null>(null);
    const applyResult = ref<DoctorPlanApplyResponse | null>(null);
    const postCheckResult = ref<DoctorPostCheckResponse | null>(null);
    const planApplyResults = ref<Record<string, DoctorPlanApplyResponse>>({});
    const planApplyFailures = ref<Record<string, string>>({});
    const planPostCheckResults = ref<Record<string, DoctorPostCheckResponse>>({});
    const loading = ref(false);
    const applying = ref(false);
    const error = ref<string | null>(null);
    const activeRequestController = ref<AbortController | null>(null);
    const activeStreamController = ref<AbortController | null>(null);
    const activeRunnerTurn = ref<{ sessionID: string; turnID: string } | null>(
        null,
    );
    const activeJobID = ref<string | null>(null);
    const activeOptimisticTurn = ref<{
        userID: number;
        placeholderID: number;
    } | null>(null);
    let activeSendPromise: Promise<import('~/types/or3-api').DoctorChatSessionResponse> | null =
        null;
    let optimisticMessageID = -1;
    let messageGeneration = 0;
    return {
        sessionKey,
        messages,
        adminBrain,
        status,
        activePlan,
        applyResult,
        postCheckResult,
        planApplyResults,
        planApplyFailures,
        planPostCheckResults,
        loading,
        applying,
        error,
        activeRequestController,
        activeStreamController,
        activeRunnerTurn,
        activeJobID,
        activeOptimisticTurn,
        get activeSendPromise() {
            return activeSendPromise;
        },
        set activeSendPromise(value) {
            activeSendPromise = value;
        },
        nextOptimisticMessageID() {
            optimisticMessageID -= 1;
            return optimisticMessageID;
        },
        bumpMessageGeneration() {
            messageGeneration += 1;
        },
        get messageGeneration() {
            return messageGeneration;
        },
    };
});
