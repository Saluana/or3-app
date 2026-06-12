import { computed, ref } from 'vue';
import type {
    AgentRunnerInfo,
    AgentRunnersResponse,
    ChatRunnerInfo,
    ChatRunnersResponse,
    RunnerNativeHealth,
} from '~/types/or3-api';
import { useActiveHost } from './useActiveHost';
import { canUseHostApi } from './useSecureHostTokens';
import { useOr3Api } from './useOr3Api';
import { createLogger } from '~/utils/logger';
import { pickDefaultRunnerId } from '~/utils/runnerIds';

const runnersByHost = ref<Record<string, ChatRunnerInfo[]>>({});
const defaultRunnerByHost = ref<Record<string, string>>({});
const loadingByHost = ref<Record<string, boolean>>({});
const errorByHost = ref<Record<string, string | null>>({});
const logger = createLogger('chat_runners');
let refreshGeneration = 0;

function runnerLabel(runner: Pick<ChatRunnerInfo, 'display_name' | 'id'>) {
    return runner.display_name || runner.id;
}

function isSelectableRunner(runner: ChatRunnerInfo) {
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

function normalizeRunnerNativeHealth(
    runner: ChatRunnerInfo,
): RunnerNativeHealth | undefined {
    const raw =
        runner.native_health ??
        runner.runtime?.health ??
        runner.runtime?.native_health;
    if (!raw) return undefined;

    const detail =
        typeof raw.detail === 'string'
            ? raw.detail.trim()
            : typeof raw.message === 'string'
              ? raw.message.trim()
              : '';
    const reachable = raw.reachable === true;
    const state =
        raw.state ??
        (reachable
            ? 'ready'
            : raw.reachable === false
              ? 'unavailable'
              : undefined);

    return {
        ...raw,
        detail: detail || undefined,
        message: detail || raw.message,
        state,
    };
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
        const nativeHealth = normalizeRunnerNativeHealth(runner);
        return {
            ...runner,
            models,
            default_model: defaultModel || runner.default_model,
            native_health: nativeHealth ?? runner.native_health,
            runtime: runner.runtime
                ? {
                      ...runner.runtime,
                      models,
                      default_model:
                          runner.runtime.default_model || defaultModel || undefined,
                      native_health:
                          nativeHealth ?? runner.runtime.native_health,
                      health: runner.runtime.health ?? nativeHealth,
                  }
                : runner.runtime,
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
    const serviceDefaultRunnerId = computed(
        () => defaultRunnerByHost.value[hostId.value] ?? '',
    );
    const defaultRunner = computed(() => {
        const id = pickDefaultRunnerId(
            selectableRunners.value,
            serviceDefaultRunnerId.value,
        );
        if (!id) return null;
        return selectableRunners.value.find((r) => r.id === id) ?? null;
    });
    const hasSelectableRunner = computed(
        () => selectableRunners.value.length > 0,
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
        let serviceDefault = '';

        try {
            const response = await api.request<ChatRunnersResponse>(
                '/internal/v1/chat-runners',
            );
            chatRunners = response.runners ?? [];
            serviceDefault = String(response.default_runner ?? '').trim();
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

        if (!pinLocked)
            try {
                const response = await api.request<AgentRunnersResponse>(
                    '/internal/v1/runner-runners',
                );
                agentRunners = response.runners ?? [];
            } catch (err) {
                if (isPinLockedError(err)) {
                    pinLocked = true;
                } else {
                    const msg =
                        err && typeof err === 'object' && 'message' in err
                            ? String((err as { message?: unknown }).message)
                            : 'runner-runners failed';
                    errors.push(msg);
                    logger.warn(
                        'refresh:agent-error',
                        'Runner discovery failed',
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
        const normalized = normalizeChatRunners(merged);
        runnersByHost.value[currentHost] = normalized;
        defaultRunnerByHost.value[currentHost] = serviceDefault;

        if (normalized.filter(isSelectableRunner).length === 0) {
            errorByHost.value[currentHost] =
                errors[0] ||
                'No runner is ready. Install and authenticate OpenCode, Codex, Claude, or Gemini, then refresh.';
            logger.warn('refresh:no-selectable', 'No selectable runners', {
                hostId: currentHost,
            });
        } else if (errors.length > 0) {
            errorByHost.value[currentHost] = errors.join('; ');
        } else {
            errorByHost.value[currentHost] = null;
        }

        logger.info('refresh:complete', 'Chat runner discovery completed', {
            hostId: currentHost,
            runnerCount: normalized.length,
            selectableCount: normalized.filter(isSelectableRunner).length,
            defaultRunner: serviceDefault,
        });

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
                    runner.supports?.chat &&
                    Object.keys(runner.supports.chat).length > 0
                        ? runner.supports.chat
                        : undefined,
            });
        }

        return out;
    }

    function getRunner(id?: string) {
        const normalized = String(id ?? '').trim();
        if (!normalized) return defaultRunner.value;
        return runners.value.find((runner) => runner.id === normalized) ?? null;
    }

    function ensureSelectable(id?: string) {
        const normalized = String(id ?? '').trim();
        const runner = normalized ? getRunner(normalized) : null;
        if (runner && isSelectableRunner(runner)) return runner;
        return defaultRunner.value;
    }

    /**
     * True when `id` refers to a runner that no longer exists in the chat
     * runner set. Used to detect sessions/jobs that were cached against
     * the removed built-in `or3-intern` agent so the UI can fall back to
     * the default runner instead of showing a phantom selection.
     */
    function isStaleRunnerId(id?: string | null): boolean {
        const normalized = String(id ?? '').trim();
        if (!normalized) return false;
        return !runners.value.some((runner) => runner.id === normalized);
    }

    return {
        runners,
        selectableRunners,
        defaultRunner,
        serviceDefaultRunnerId,
        hasSelectableRunner,
        loading,
        error,
        refresh,
        getRunner,
        ensureSelectable,
        isSelectableRunner,
        isStaleRunnerId,
        runnerLabel,
    };
}
