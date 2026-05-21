<template>
    <div
        class="or3-desktop-primary__status"
        data-testid="electron-host-status-card"
    >
        <div class="or3-desktop-primary__status-mascot" aria-hidden="true">
            <Icon name="i-pixelarticons-monitor" class="size-5" />
        </div>
        <div class="or3-desktop-primary__status-text">
            <p class="or3-desktop-primary__status-name">This computer</p>
            <p class="or3-desktop-primary__status-state">
                <span
                    class="or3-desktop-primary__status-dot"
                    :data-tone="status.state === 'online' ? 'green' : status.state === 'starting' ? 'amber' : 'muted'"
                />
                {{ label }}
            </p>
            <p v-if="status.baseUrl" class="mt-1 truncate text-[10px] text-(--or3-text-muted)" :title="status.baseUrl">
                {{ status.baseUrl }}
            </p>
            <div class="electron-host-status-actions mt-2">
                <UButton
                    v-if="status.state === 'online'"
                    label="Connect device"
                    icon="i-pixelarticons-link"
                    size="xs"
                    color="primary"
                    variant="soft"
                    block
                    to="/computer/connect-device"
                />
                <UButton
                    v-else-if="status.state === 'stopped' || status.state === 'not-installed'"
                    :label="status.state === 'not-installed' ? 'Fix setup' : 'Start'"
                    size="xs"
                    color="neutral"
                    variant="soft"
                    block
                    :loading="busy"
                    @click="start"
                />
                <UButton
                    v-else
                    label="Restart"
                    size="xs"
                    color="neutral"
                    variant="soft"
                    block
                    :loading="busy"
                    @click="restart"
                />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { hostStatusLabel } from '~/utils/electron-host';
import { useElectronHostSetup } from '~/composables/useElectronHostSetup';

const host = useElectronHostSetup();
const { serviceStatus: status, refreshStatus, startService, restartService } = host;
const busy = ref(false);
const label = computed(() => hostStatusLabel(status.value));

onMounted(() => {
    void refreshStatus();
});

async function start() {
    busy.value = true;
    try {
        await startService();
    } finally {
        busy.value = false;
    }
}

async function restart() {
    busy.value = true;
    try {
        await restartService();
    } finally {
        busy.value = false;
    }
}
</script>
