import { computed, ref } from 'vue';
import type {
    AgentRunnerId,
    AgentRunnerInfo,
    AgentRunnersResponse,
    ChatRunnerInfo,
    ChatRunnersResponse,
} from '~/types/or3-api';
import { useActiveHost } from './useActiveHost';
import { canUseHostApi } from './useSecureHostTokens';
import { useOr3Api } from './useOr3Api';
import { createLogger } from '~/utils/logger';

const runnersByHost = ref<Record<string, ChatRunnerInfo[]>>({});
const loadingByHost = ref<Record<string, boolean>>({});
const errorByHost = ref<Record<string, string | null>>({});
const logger = createLogger('chat_runners');
let refreshGeneration = 0;

function runnerLabel(runner: Pick<ChatRunnerInfo, 'display_name' | 'id'>) {
    return runner.display_name || runner.id;
}

function isSelectableRunner(runner: ChatRunnerInfo) {
    if (runner.id === 'or3-intern') return true;
    if (runner.status !== 'available') return false;
    if (
        runner.auth_status &&
        runner.auth_status !== 'ready' &&
        runner.auth_status !== 'unknown'
    ) {
        return false;
    }
    const caps = runner.chat_capabilities || runner.supports?.chat;
    return caps?.chatSelectable !== false && caps?.chatReplay !== false;
}

function isPinLockedError(err: unknown) {
    return (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code?: unknown }).code === 'pin_locked'
    );
}

function normalizeChatRunners(runners: ChatRunnerInfo[]): ChatRunnerInfo[] {
    return runners.map((runner) => {
        const models = runner.models?.length
            ? runner.models
            : runner.runtime?.models || [];
        const defaultModel =
            runner.default_model ||
            runner.runtime?.default_model ||
            models.find((model) => model.default)?.id ||
            '';
        return {
            ...runner,
            models,
            default_model: defaultModel || runner.default_model,
            auth_status:
                runner.status === 'available' && runner.auth_status === 'unknown'
                    ? 'ready'
                    : runner.auth_status,
        };
    });
}

export function useChatRunners() {
    const api = useOr3Api();
    const { activeHost } = useActiveHost();
    const hostId = computed(() => activeHost.value?.id || 'local');
    const runners = computed(() => runnersByHost.value[hostId.value] ?? []);
    const selectableRunners = computed(() =>
        runners.value.filter(isSelectableRunner),
    );
    const loading = computed(() => Boolean(loadingByHost.value[hostId.value]));
    const error = computed(() => errorByHost.value[hostId.value] ?? null);
    const defaultRunner = computed(
        () =>
            selectableRunners.value.find(
                (runner) => runner.id === 'or3-intern',
            ) ??
            selectableRunners.value[0] ??
            runners.value.find((runner) => runner.id === 'or3-intern') ??
            null,
    );

    async function refresh() {
        if (!canUseHostApi(activeHost.value)) {
            errorByHost.value[hostId.value] = null;
            return;
        }

        const currentHost = hostId.value;
        const generation = ++refreshGeneration;
        loadingByHost.value[currentHost] = true;
        errorByHost.value[currentHost] = null;
        logger.info('refresh:start', 'Chat runner discovery started', {
            hostId: currentHost,
        });

        let chatRunners: ChatRunnerInfo[] | null = null;
        let agentRunners: AgentRunnerInfo[] | null = null;
        let errors: string[] = [];
        let pinLocked = false;

        try {
            const response = await api.request<ChatRunnersResponse>(
                '/internal/v1/chat-runners',
            );
            chatRunners = response.runners ?? [];
        } catch (err) {
            if (isPinLockedError(err)) {
                pinLocked = true;
            } else {
            const msg =
                err && typeof err === 'object' && 'message' in err
                    ? String((err as { message?: unknown }).message)
                    : 'chat-runners failed';
            errors.push(msg);
            logger.warn('refresh:chat-error', 'Chat runner discovery failed', {
                hostId: currentHost,
                error: msg,
            });
            }
        }

        if (!pinLocked) try {
            const response = await api.request<AgentRunnersResponse>(
                '/internal/v1/agent-runners',
            );
            agentRunners = response.runners ?? [];
        } catch (err) {
            if (isPinLockedError(err)) {
                pinLocked = true;
            } else {
            const msg =
                err && typeof err === 'object' && 'message' in err
                    ? String((err as { message?: unknown }).message)
                    : 'agent-runners failed';
            errors.push(msg);
            logger.warn(
                'refresh:agent-error',
                'Agent runner discovery failed',
                { hostId: currentHost, error: msg },
            );
            }
        }

        if (pinLocked) {
            if (generation === refreshGeneration) {
                loadingByHost.value[currentHost] = false;
            }
            return;
        }

        const merged = mergeRunnerResults(chatRunners, agentRunners);
        if (merged.length > 0) {
            const normalized = normalizeChatRunners(merged);
            runnersByHost.value[currentHost] = normalized;
            logger.info('refresh:complete', 'Chat runner discovery completed', {
                hostId: currentHost,
                runnerCount: normalized.length,
                selectableCount: normalized.filter(isSelectableRunner).length,
            });
        } else {
            errorByHost.value[currentHost] = null;
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
                    chat_capabilities: {
                        chatSelectable: true,
                        chatReplay: true,
                    },
                },
            ];
            logger.info(
                'refresh:fallback',
                'Fell back to the built-in OR3 runner',
                { hostId: currentHost },
            );
        }

        if (generation === refreshGeneration) {
            loadingByHost.value[currentHost] = false;
        }
    }

    function mergeRunnerResults(
        chatRunners: ChatRunnerInfo[] | null,
        agentRunners: AgentRunnerInfo[] | null,
    ): ChatRunnerInfo[] {
        const seen = new Set<string>();
        const out: ChatRunnerInfo[] = [];

        for (const runner of chatRunners ?? []) {
            seen.add(runner.id);
            out.push(runner);
        }

        for (const runner of agentRunners ?? []) {
            if (seen.has(runner.id)) continue;
            seen.add(runner.id);
            out.push({
                ...runner,
                chat_capabilities:
                    runner.supports?.chat && Object.keys(runner.supports.chat).length > 0
                        ? runner.supports.chat
                        : undefined,
            });
        }

        return out;
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
