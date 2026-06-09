import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextTick, ref } from 'vue';

vi.mock('../../app/composables/usePinLock', () => ({
    needsUnlock: () => false,
    usePinLockState: () => ({ needsUnlock: ref(false) }),
}));
vi.mock('../../app/composables/useSecureHostTokens', () => ({
    canUseHostApi: () => true,
}));

type ActiveHostRef = ReturnType<typeof ref<{ id: string } | null>>;

function makeRunner(id: string, status = 'available', authStatus = 'ready') {
    return {
        id,
        display_name: id,
        status,
        auth_status: authStatus,
        supports: {
            structuredOutput: true,
            streamingJson: true,
            modelFlag: true,
            permissionsMode: true,
            safeSandboxFlag: true,
            dangerousBypassFlag: true,
            stdinPrompt: false,
            chat: {
                chatSelectable: true,
                chatReplay: true,
                chatNativeSession: false,
                chatResume: false,
                chatSessionRefExtractable: false,
            },
        },
        chat_capabilities: {
            chatSelectable: true,
            chatReplay: true,
        },
    };
}

async function loadComposable(requestImpl: (path: string) => Promise<any>, initialHost = 'host-a') {
    vi.resetModules();
    const activeHost: ActiveHostRef = ref({
        id: initialHost,
        baseUrl: 'http://127.0.0.1:9100',
        pairedToken: 'paired-token',
    });
    const request = vi.fn(requestImpl);

    vi.doMock('../../app/composables/useActiveHost', () => ({
        useActiveHost: () => ({ activeHost }),
    }));
    vi.doMock('../../app/composables/useOr3Api', () => ({
        useOr3Api: () => ({ request }),
    }));
    const mod = await import('../../app/composables/useChatRunners');
    const chatRunners = mod.useChatRunners();
    return { chatRunners, activeHost, request };
}

describe('useChatRunners', () => {
    afterEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    it('keeps runner state scoped by host and refreshes per host', async () => {
        const byHost: Record<string, any> = {
            'host-a': {
                runners: [makeRunner('opencode'), makeRunner('claude')],
                default_runner: 'opencode',
            },
            'host-b': {
                runners: [makeRunner('claude', 'missing', 'missing')],
                default_runner: 'claude',
            },
        };
        const { chatRunners, activeHost, request } = await loadComposable(async () => byHost[activeHost.value?.id || 'host-a']);

        await chatRunners.refresh();

        expect(chatRunners.selectableRunners.value.map((runner) => runner.id)).toEqual(['opencode', 'claude']);
        expect(request).toHaveBeenCalledTimes(2);

        activeHost.value = { id: 'host-b' };
        await nextTick();
        await chatRunners.refresh();

        expect(chatRunners.selectableRunners.value.map((runner) => runner.id)).toEqual([]);
        expect(request).toHaveBeenCalledTimes(4);
    });

    it('surfaces setup error when discovery fails', async () => {
        const { chatRunners, request } = await loadComposable(async () => {
            throw new Error('runner discovery offline');
        });

        await chatRunners.refresh();

        expect(request).toHaveBeenCalledTimes(2);
        expect(chatRunners.error.value).toContain('runner');
        expect(chatRunners.runners.value).toHaveLength(0);
        expect(chatRunners.defaultRunner.value).toBeNull();
    });

    it('prefers service default_runner and falls back to OpenCode', async () => {
        const { chatRunners } = await loadComposable(async () => ({
            runners: [
                makeRunner('opencode', 'auth_missing', 'missing'),
                makeRunner('claude'),
            ],
            default_runner: 'claude',
        }));

        await chatRunners.refresh();

        expect(chatRunners.defaultRunner.value?.id).toBe('claude');
        expect(chatRunners.ensureSelectable('claude')?.id).toBe('claude');
        expect(chatRunners.ensureSelectable('opencode')?.id).toBe('claude');
        expect(chatRunners.ensureSelectable('missing-runner')?.id).toBe('claude');
    });

    it('excludes legacy or3-intern from selectable runners', async () => {
        const { chatRunners } = await loadComposable(async () => ({
            runners: [makeRunner('or3-intern'), makeRunner('gemini')],
            default_runner: 'gemini',
        }));

        await chatRunners.refresh();

        expect(chatRunners.selectableRunners.value.map((runner) => runner.id)).toEqual(['gemini']);
        expect(chatRunners.defaultRunner.value?.id).toBe('gemini');
    });

    it('normalizes runtime model metadata for native runners', async () => {
        const opencode = makeRunner('opencode');
        const { chatRunners } = await loadComposable(async () => ({
            runners: [
                {
                    ...opencode,
                    default_model: '',
                    models: [],
                    runtime: {
                        kind: 'native',
                        mode: 'auto',
                        state: 'ready',
                        ownership: 'external',
                        endpoint: 'http://127.0.0.1:4096',
                        default_model: 'gpt-5',
                        models: [
                            {
                                id: 'gpt-5',
                                display_name: 'GPT-5',
                                default: true,
                                reasoning: ['low', 'medium', 'high'],
                                reasoning_default: 'medium',
                                capabilities: { fast_mode: true },
                                options: [
                                    {
                                        id: 'thinking_level',
                                        label: 'Thinking',
                                        kind: 'thinking_level',
                                        default: 'medium',
                                        values: [
                                            { id: 'medium', label: 'Medium' },
                                        ],
                                    },
                                ],
                            },
                            { id: 'gpt-5-mini', display_name: 'GPT-5 Mini' },
                        ],
                        runtime_message: 'Native runtime ready',
                        health: {
                            reachable: true,
                            endpoint: 'http://127.0.0.1:4096',
                            detail: 'OpenCode server is reachable',
                            last_checked_at: 1700000000000,
                        },
                    },
                },
            ],
            default_runner: 'opencode',
        }));

        await chatRunners.refresh();

        const runner = chatRunners.getRunner('opencode');
        expect(runner?.default_model).toBe('gpt-5');
        expect(runner?.models.map((model) => model.id)).toEqual(['gpt-5', 'gpt-5-mini']);
        expect(runner?.runtime?.models.map((model) => model.id)).toEqual(['gpt-5', 'gpt-5-mini']);
        expect(runner?.runtime?.default_model).toBe('gpt-5');
        expect(runner?.native_health?.message).toBe('OpenCode server is reachable');
        expect(runner?.runtime?.native_health?.message).toBe('OpenCode server is reachable');
        expect(runner?.runtime?.health?.detail).toBe('OpenCode server is reachable');
        expect(runner?.models[0]?.options?.[0]?.default).toBe('medium');
        expect(runner?.models[0]?.capabilities?.fast_mode).toBe(true);
    });

    it('clears stale errors after a later successful refresh', async () => {
        let failChat = true;
        const { chatRunners } = await loadComposable(async (path: string) => {
            if (path.includes('chat-runners') && failChat) {
                throw new Error('chat-runners unavailable');
            }
            return {
                runners: [makeRunner('opencode')],
                default_runner: 'opencode',
            };
        });

        await chatRunners.refresh();
        expect(chatRunners.error.value).toMatch(/chat-runners unavailable/);

        failChat = false;
        await chatRunners.refresh();
        expect(chatRunners.error.value).toBeNull();
        expect(chatRunners.defaultRunner.value?.id).toBe('opencode');
    });
});
