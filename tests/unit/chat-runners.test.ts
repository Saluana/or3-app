import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextTick, ref } from 'vue';

type ActiveHostRef = ReturnType<typeof ref<{ id: string } | null>>;

function makeRunner(id: string, status = 'available', authStatus = 'ready') {
    return {
        id,
        display_name: id === 'or3-intern' ? 'OR3 Intern' : id,
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
    const activeHost: ActiveHostRef = ref({ id: initialHost });
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
            'host-a': { runners: [makeRunner('or3-intern'), makeRunner('opencode')] },
            'host-b': { runners: [makeRunner('or3-intern'), makeRunner('claude', 'missing', 'missing')] },
        };
        const { chatRunners, activeHost, request } = await loadComposable(async () => byHost[activeHost.value?.id || 'host-a']);

        await chatRunners.refresh();

        expect(chatRunners.runners.value.map((runner) => runner.id)).toEqual(['or3-intern', 'opencode']);
        expect(request).toHaveBeenCalledTimes(1);

        activeHost.value = { id: 'host-b' };
        await nextTick();
        await chatRunners.refresh();

        expect(chatRunners.runners.value.map((runner) => runner.id)).toEqual(['or3-intern', 'claude']);
        expect(request).toHaveBeenCalledTimes(2);

        activeHost.value = { id: 'host-a' };
        await nextTick();
        await chatRunners.refresh();

        expect(chatRunners.runners.value.map((runner) => runner.id)).toEqual(['or3-intern', 'opencode']);
        expect(request).toHaveBeenCalledTimes(3);
    });

    it('falls back to OR3 when discovery fails and exposes an error', async () => {
        const { chatRunners, request } = await loadComposable(async () => {
            throw new Error('runner discovery offline');
        });

        await chatRunners.refresh();

        expect(request).toHaveBeenCalledTimes(1);
        expect(chatRunners.error.value).toBe('runner discovery offline');
        expect(chatRunners.runners.value).toHaveLength(1);
        expect(chatRunners.runners.value[0]?.id).toBe('or3-intern');
        expect(chatRunners.defaultRunner.value?.id).toBe('or3-intern');
    });

    it('prefers OR3 as default and falls back when a selected runner is unavailable', async () => {
        const { chatRunners } = await loadComposable(async () => ({
            runners: [
                makeRunner('opencode', 'auth_missing', 'missing'),
                makeRunner('or3-intern'),
                makeRunner('claude'),
            ],
        }));

        await chatRunners.refresh();

        expect(chatRunners.defaultRunner.value?.id).toBe('or3-intern');
        expect(chatRunners.ensureSelectable('claude')?.id).toBe('claude');
        expect(chatRunners.ensureSelectable('opencode')?.id).toBe('or3-intern');
        expect(chatRunners.ensureSelectable('missing-runner')?.id).toBe('or3-intern');
        expect(chatRunners.selectableRunners.value.map((runner) => runner.id)).toEqual(['or3-intern', 'claude']);
    });

    it('keeps Gemini selectable when auth readiness is unknown but the runner is available', async () => {
        const { chatRunners } = await loadComposable(async () => ({
            runners: [
                makeRunner('or3-intern'),
                makeRunner('gemini', 'available', 'unknown'),
            ],
        }));

        await chatRunners.refresh();

        expect(chatRunners.selectableRunners.value.map((runner) => runner.id)).toEqual(['or3-intern', 'gemini']);
        expect(chatRunners.getRunner('gemini')?.auth_status).toBe('ready');
    });
});
