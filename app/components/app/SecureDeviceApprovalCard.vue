<template>
    <SurfaceCard class-name="space-y-4">
        <div class="flex items-start gap-3">
            <RetroIcon name="i-pixelarticons-shield" />
            <div class="min-w-0 flex-1">
                <p class="font-mono text-base font-semibold text-(--or3-text)">
                    Secure devices
                </p>
                <p class="mt-1 text-sm leading-6 text-(--or3-text-muted)">
                    Review secure device certificates that are already enrolled
                    for this computer.
                </p>
            </div>
            <UButton
                icon="i-pixelarticons-reload"
                color="neutral"
                variant="ghost"
                aria-label="Refresh secure devices"
                @click="refresh"
            />
        </div>

        <div
            v-if="!devices.length"
            class="rounded-xl border border-dashed border-(--or3-border) bg-white/60 p-4 text-center text-sm text-(--or3-text-muted)"
        >
            No secure devices are enrolled yet.
        </div>
        <div v-else class="space-y-2">
            <div
                v-for="device in devices"
                :key="device.device_id || device.DeviceID"
                class="rounded-xl border border-(--or3-border) bg-white/70 p-3"
            >
                <div class="flex items-start justify-between gap-3">
                    <div>
                        <p class="font-mono text-sm font-semibold">
                            {{
                                device.display_name ||
                                device.DisplayName ||
                                device.device_id ||
                                device.DeviceID
                            }}
                        </p>
                        <p class="mt-1 text-xs text-(--or3-text-muted)">
                            {{
                                device.platform || device.Platform || 'device'
                            }}
                            ·
                            {{ device.role || device.Role || 'operator' }}
                        </p>
                    </div>
                    <UBadge color="neutral" variant="soft">
                        {{ device.status || device.Status || 'active' }}
                    </UBadge>
                </div>
                <div class="mt-3 flex justify-end">
                    <UButton
                        label="Revoke"
                        icon="i-pixelarticons-close"
                        size="sm"
                        color="error"
                        variant="soft"
                        @click="deny(device)"
                    />
                </div>
            </div>
        </div>
    </SurfaceCard>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useToast } from '@nuxt/ui/composables';
import { useOr3Api } from '../../composables/useOr3Api';

const devices = ref<Array<Record<string, any>>>([]);
const api = useOr3Api();
const toast = useToast();

async function refresh() {
    const response = await api
        .request<{
            items?: Array<Record<string, unknown>>;
        }>('/internal/v1/secure-connections/devices')
        .catch(() => ({ items: [] }));
    devices.value = (response.items || []).filter(
        (item) =>
            String(item.status || item.Status || '').toLowerCase() !==
            'revoked',
    );
}

async function deny(device: Record<string, any>) {
    const id = String(device.device_id || device.DeviceID || '');
    if (!id) return;
    try {
        await api.request(
            `/internal/v1/secure-connections/devices/${encodeURIComponent(id)}/revoke`,
            {
                method: 'POST',
                body: {},
            },
        );
    } catch (error) {
        toast.add({
            title: 'Could not revoke secure device',
            description:
                error instanceof Error
                    ? error.message
                    : 'Try again from this computer.',
            color: 'error',
        });
    }
    await refresh();
}

onMounted(refresh);
</script>
