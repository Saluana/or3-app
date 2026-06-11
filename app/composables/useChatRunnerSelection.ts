import { ref, type ComputedRef } from 'vue';
import type { ChatSession } from '~/types/app-state';
import type { ChatRunnerInfo } from '~/types/or3-api';
import {
    defaultRunnerModelForSelection,
    resolveSessionRunnerModel,
} from '~/utils/runnerModelPolicy';

type RunnerMetadataPatch = {
    runnerId: string;
    runnerLabel: string;
    runnerModel?: string;
    runnerContinuationMode: string;
};

export function useChatRunnerSelection(options: {
    activeSession: ComputedRef<ChatSession | null>;
    messageCount: (sessionId?: string) => number;
    setSessionRunnerMetadata: (
        sessionId: string,
        metadata: Partial<RunnerMetadataPatch>,
    ) => void;
    ensureSelectable: (id?: string) => ChatRunnerInfo | null;
    getRunner: (id?: string) => ChatRunnerInfo | null;
}) {
    const selectedRunnerId = ref('');
    const selectedRunnerModel = ref('');
    const selectedRunnerThinkingLevel = ref('');

    function continuationModeForRunner(runnerId?: string | null) {
        const runner = options.getRunner(runnerId || undefined);
        const caps = runner?.chat_capabilities || runner?.supports?.chat;
        return caps?.chatNativeSession ? 'native' : 'replay';
    }

    function applyRunnerToActiveSession(
        runnerId: string,
        runner: ChatRunnerInfo,
    ) {
        selectedRunnerModel.value = defaultRunnerModelForSelection(
            runnerId,
            runner.default_model || runner.runtime?.default_model,
        );
        selectedRunnerThinkingLevel.value = '';
        const session = options.activeSession.value;
        if (!session) return;
        options.setSessionRunnerMetadata(session.id, {
            runnerId,
            runnerLabel: runner.display_name || runner.id,
            runnerModel: resolveSessionRunnerModel({
                selected: selectedRunnerModel.value,
                runnerDefault:
                    runner.default_model || runner.runtime?.default_model,
            }),
            runnerContinuationMode: continuationModeForRunner(runnerId),
        });
    }

    function resyncFromSession() {
        const session = options.activeSession.value;
        const requestedId =
            session?.runnerId || selectedRunnerId.value || undefined;
        const runner = options.ensureSelectable(requestedId);
        if (!runner) return;

        const nextId = runner.id;
        if (selectedRunnerId.value !== nextId) {
            selectedRunnerId.value = nextId;
        }

        if (session?.runnerModel) {
            selectedRunnerModel.value = session.runnerModel;
        } else if (!selectedRunnerModel.value) {
            selectedRunnerModel.value = defaultRunnerModelForSelection(
                nextId,
                runner.default_model || runner.runtime?.default_model,
            );
        }

        if (session && session.runnerId !== nextId) {
            options.setSessionRunnerMetadata(session.id, {
                runnerId: nextId,
                runnerLabel: runner.display_name || runner.id,
                runnerModel: resolveSessionRunnerModel({
                    selected: selectedRunnerModel.value,
                    runnerDefault:
                        runner.default_model || runner.runtime?.default_model,
                }),
                runnerContinuationMode: continuationModeForRunner(nextId),
            });
        }
    }

    function resetModelFields() {
        selectedRunnerModel.value = '';
        selectedRunnerThinkingLevel.value = '';
    }

    return {
        selectedRunnerId,
        selectedRunnerModel,
        selectedRunnerThinkingLevel,
        resyncFromSession,
        applyRunnerToActiveSession,
        continuationModeForRunner,
        resetModelFields,
    };
}
