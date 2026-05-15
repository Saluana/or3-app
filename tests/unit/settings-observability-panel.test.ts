import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsObservabilityPanel from '../../app/components/settings/SettingsObservabilityPanel.vue';

const mockState = vi.hoisted(() => ({
    activeHost: {
        value: { id: 'host-1', token: 'paired-token' },
        __v_isRef: true,
    },
    latestChatRuntimeEntries: {
        value: [{ id: 'app-1' }],
        __v_isRef: true,
    },
    latestServerLogEntries: {
        value: [{ id: 'server-1' }],
        __v_isRef: true,
    },
    chatRuntimeExportText: {
        value: '[{"id":"app-1"}]',
        __v_isRef: true,
    },
    serverLogExportText: {
        value: '[{"id":"server-1"}]',
        __v_isRef: true,
    },
    serverLogsStreaming: {
        value: false,
        __v_isRef: true,
    },
    serverLogsError: {
        value: null as string | null,
        __v_isRef: true,
    },
    connectServerLogs: vi.fn(),
    disconnectServerLogs: vi.fn(),
    clearChatRuntimeLog: vi.fn(),
    clearServerLogs: vi.fn(),
    setDebugLoggingEnabled: vi.fn(),
    isDebugLoggingEnabled: vi.fn(() => false),
    writeText: vi.fn(),
}));

vi.mock('../../app/composables/useActiveHost', () => ({
    useActiveHost: () => ({ activeHost: mockState.activeHost }),
}));

vi.mock('../../app/composables/useChatRuntimeLog', () => ({
    useChatRuntimeLog: () => ({
        latestEntries: mockState.latestChatRuntimeEntries,
        exportText: mockState.chatRuntimeExportText,
        clear: mockState.clearChatRuntimeLog,
    }),
}));

vi.mock('../../app/composables/useServerLogs', () => ({
    useServerLogs: () => ({
        latestEntries: mockState.latestServerLogEntries,
        exportText: mockState.serverLogExportText,
        isStreaming: mockState.serverLogsStreaming,
        error: mockState.serverLogsError,
        connect: mockState.connectServerLogs,
        disconnect: mockState.disconnectServerLogs,
        clear: mockState.clearServerLogs,
    }),
}));

vi.mock('../../app/utils/logger', () => ({
    isDebugLoggingEnabled: mockState.isDebugLoggingEnabled,
    setDebugLoggingEnabled: mockState.setDebugLoggingEnabled,
}));

function mountPanel() {
    return mount(SettingsObservabilityPanel, {
        global: {
            stubs: {
                SurfaceCard: { template: '<section><slot /></section>' },
                UButton: {
                    template:
                        '<button type="button" :data-label="label" @click="$emit(\'click\')">{{ label }}</button>',
                    props: ['label'],
                },
                USwitch: {
                    template:
                        '<button type="button" data-test="debug-toggle" @click="$emit(\'update:model-value\', !modelValue)">{{ modelValue }}</button>',
                    props: ['modelValue'],
                },
                SettingsLogViewer: {
                    template:
                        '<div data-test="viewer">{{ title }}<button type="button" @click="$emit(\'connect\')">connect</button><button type="button" @click="$emit(\'disconnect\')">disconnect</button><button type="button" @click="$emit(\'clear\')">clear</button></div>',
                    props: ['title'],
                },
            },
        },
    });
}

describe('SettingsObservabilityPanel', () => {
    beforeEach(() => {
        mockState.activeHost.value = { id: 'host-1', token: 'paired-token' };
        mockState.serverLogsStreaming.value = false;
        mockState.serverLogsError.value = null;
        mockState.chatRuntimeExportText.value = '[{"id":"app-1"}]';
        mockState.serverLogExportText.value = '[{"id":"server-1"}]';
        mockState.isDebugLoggingEnabled.mockReturnValue(false);
        Object.defineProperty(globalThis.navigator, 'clipboard', {
            value: { writeText: mockState.writeText },
            configurable: true,
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('connects on mount and disconnects on unmount', async () => {
        const wrapper = mountPanel();
        await wrapper.vm.$nextTick();

        expect(mockState.isDebugLoggingEnabled).toHaveBeenCalled();
        expect(mockState.connectServerLogs).toHaveBeenCalledWith({
            level: 'info',
        });

        wrapper.unmount();

        expect(mockState.disconnectServerLogs).toHaveBeenCalledTimes(1);
    });

    it('reconnects at debug level and exports combined logs', async () => {
        mockState.serverLogsStreaming.value = true;
        const wrapper = mountPanel();
        await wrapper.vm.$nextTick();
        mockState.connectServerLogs.mockClear();

        await wrapper.get('[data-test="debug-toggle"]').trigger('click');

        expect(mockState.setDebugLoggingEnabled).toHaveBeenCalledWith(true);
        expect(mockState.connectServerLogs).toHaveBeenCalledWith({
            level: 'debug',
        });

        await wrapper.get('[data-label="Export all"]').trigger('click');

        expect(mockState.writeText).toHaveBeenCalledWith(
            JSON.stringify(
                {
                    app: [{ id: 'app-1' }],
                    server: [{ id: 'server-1' }],
                },
                null,
                2,
            ),
        );
    });
});
