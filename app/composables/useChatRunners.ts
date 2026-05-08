import { computed, ref, watch } from 'vue';
import type { AgentRunnerId, ChatRunnerInfo, ChatRunnersResponse } from '~/types/or3-api';
import { useActiveHost } from './useActiveHost';
import { useOr3Api } from './useOr3Api';

const runnersByHost = ref<Record<string, ChatRunnerInfo[]>>({});
const loadingByHost = ref<Record<string, boolean>>({});
const errorByHost = ref<Record<string, string | null>>({});

function runnerLabel(runner: Pick<ChatRunnerInfo, 'display_name' | 'id'>) {
    return runner.display_name || runner.id;
}

function isSelectableRunner(runner: ChatRunnerInfo) {
    if (runner.id === 'or3-intern') return true;
    if (runner.status !== 'available') return false;
    if (runner.auth_status && runner.auth_status !== 'ready') return false;
    const caps = runner.chat_capabilities || runner.supports?.chat;
    return caps?.chatSelectable !== false && caps?.chatReplay !== false;
}

export function useChatRunners() {
    const api = useOr3Api();
    const { activeHost } = useActiveHost();
    const hostId = computed(() => activeHost.value?.id || 'local');
    const runners = computed(() => runnersByHost.value[hostId.value] ?? []);
    const selectableRunners = computed(() => runners.value.filter(isSelectableRunner));
    const loading = computed(() => Boolean(loadingByHost.value[hostId.value]));
    const error = computed(() => errorByHost.value[hostId.value] ?? null);
    const defaultRunner = computed(
        () =>
            selectableRunners.value.find((runner) => runner.id === 'or3-intern') ??
            selectableRunners.value[0] ??
            runners.value.find((runner) => runner.id === 'or3-intern') ??
            null,
    );

    async function refresh() {
        const currentHost = hostId.value;
        loadingByHost.value[currentHost] = true;
        errorByHost.value[currentHost] = null;
        try {
            const response = await api.request<ChatRunnersResponse>('/internal/v1/chat-runners');
            runnersByHost.value[currentHost] = response.runners ?? [];
        } catch (err) {
            errorByHost.value[currentHost] =
                err && typeof err === 'object' && 'message' in err
                    ? String((err as { message?: unknown }).message || 'Runner discovery failed')
                    : 'Runner discovery failed';
            if (!runnersByHost.value[currentHost]?.length) {
                runnersByHost.value[currentHost] = [
                    {
                        id: 'or3-intern',
                        display_name: 'OR3 Intern',
                        status: 'available',
                        auth_status: 'ready',
                        supports: {
                            structuredOutput: false,
                            streamingJson: false,
                            modelFlag: true,
                            permissionsMode: false,
                            safeSandboxFlag: false,
                            dangerousBypassFlag: false,
                            stdinPrompt: false,
                            chat: { chatSelectable: true, chatReplay: true },
                        },
                        chat_capabilities: { chatSelectable: true, chatReplay: true },
                    },
                ];
            }
        } finally {
            loadingByHost.value[currentHost] = false;
        }
    }

    function getRunner(id?: AgentRunnerId | string) {
        const normalized = id?.trim() || 'or3-intern';
        return runners.value.find((runner) => runner.id === normalized) ?? null;
    }

    function ensureSelectable(id?: AgentRunnerId | string) {
        const runner = getRunner(id) ?? defaultRunner.value;
        if (!runner) return null;
        return isSelectableRunner(runner) ? runner : defaultRunner.value;
    }

    watch(
        () => activeHost.value?.id,
        () => {
            if (import.meta.client) void refresh();
        },
        { immediate: true },
    );

    return {
        runners,
        selectableRunners,
        defaultRunner,
        loading,
        error,
        refresh,
        getRunner,
        ensureSelectable,
        isSelectableRunner,
        runnerLabel,
    };
}
