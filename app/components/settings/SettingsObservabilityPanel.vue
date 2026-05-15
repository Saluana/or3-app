<template>
    <div class="space-y-4">
        <SurfaceCard class-name="space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-3">
                <div class="min-w-0">
                    <p
                        class="or3-command text-[11px] uppercase tracking-[0.2em] text-(--or3-green-dark)"
                    >
                        Observability
                    </p>
                    <p class="mt-1 text-xs leading-5 text-(--or3-text-muted)">
                        Runtime events, trace IDs, and service logs for the
                        paired computer.
                    </p>
                </div>
                <div class="flex flex-wrap items-center justify-end gap-3">
                    <label
                        class="flex items-center gap-2 font-mono text-xs text-(--or3-text)"
                    >
                        <USwitch
                            :model-value="debugLogging"
                            color="primary"
                            @update:model-value="setDebugLogging"
                        />
                        Debug
                    </label>
                    <UButton
                        label="Export all"
                        icon="i-pixelarticons-download"
                        size="xs"
                        variant="soft"
                        color="neutral"
                        @click="copyAllLogs"
                    />
                </div>
            </div>
        </SurfaceCard>

        <SettingsLogViewer
            title="App Events"
            subtitle="Recent stream, approval, and tool reducer events."
            :entries="latestChatRuntimeEntries"
            empty-text="No app events recorded yet."
            @clear="clearChatRuntimeLog"
        />

        <SettingsLogViewer
            title="Server Events"
            subtitle="Live or3-intern service logs from the paired computer."
            :entries="latestServerLogEntries"
            empty-text="No server events received yet."
            :streaming="serverLogsStreaming"
            :error="serverLogsError"
            connectable
            @connect="connectServerLogStream"
            @disconnect="disconnectServerLogStream"
            @clear="clearServerLogs"
        />
    </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useActiveHost } from '../../composables/useActiveHost';
import { useChatRuntimeLog } from '../../composables/useChatRuntimeLog';
import { useServerLogs } from '../../composables/useServerLogs';
import {
    isDebugLoggingEnabled,
    setDebugLoggingEnabled,
} from '../../utils/logger';

const debugLogging = ref(false);
const { activeHost } = useActiveHost();
const {
    latestEntries: latestChatRuntimeEntries,
    exportText: chatRuntimeExportText,
    clear: clearChatRuntimeLog,
} = useChatRuntimeLog();
const {
    latestEntries: latestServerLogEntries,
    exportText: serverLogExportText,
    isStreaming: serverLogsStreaming,
    error: serverLogsError,
    connect: connectServerLogs,
    disconnect: disconnectServerLogs,
    clear: clearServerLogs,
} = useServerLogs();

function connectServerLogStream() {
    connectServerLogs({ level: debugLogging.value ? 'debug' : 'info' });
}

function disconnectServerLogStream() {
    disconnectServerLogs();
}

function setDebugLogging(value: boolean) {
    debugLogging.value = Boolean(value);
    setDebugLoggingEnabled(debugLogging.value);
    if (serverLogsStreaming.value) connectServerLogStream();
}

async function copyAllLogs() {
    await navigator.clipboard?.writeText(
        JSON.stringify(
            {
                app: JSON.parse(chatRuntimeExportText.value),
                server: JSON.parse(serverLogExportText.value),
            },
            null,
            2,
        ),
    );
}

onMounted(() => {
    debugLogging.value = isDebugLoggingEnabled();
    if (activeHost.value?.token) connectServerLogStream();
});

onBeforeUnmount(() => {
    disconnectServerLogStream();
});
</script>
