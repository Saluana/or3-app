<template>
    <SurfaceCard :class-name="stats?.length ? 'space-y-4' : 'space-y-3'">
        <div class="flex items-start gap-3">
            <BrandMark size="md" />
            <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                    <p class="font-mono text-base font-semibold text-(--or3-text)">
                        {{ headline }}
                    </p>
                    <StatusPill
                        v-if="isPaired"
                        :label="pillLabel"
                        :tone="pillTone"
                        :pulse="isConnected"
                    />
                </div>
                <p class="mt-1 text-sm leading-6 text-(--or3-text-muted)">
                    {{ description }}
                </p>
            </div>
        </div>

        <div
            v-if="isPaired && stats?.length"
            class="flex overflow-hidden rounded-2xl border border-(--or3-border) bg-white/70"
        >
            <div
                v-for="stat in stats"
                :key="stat.label"
                class="min-w-1/4 border-(--or3-border) px-3 py-3 text-center not-last:border-r sm:border-r"
            >
                <Icon
                    :name="stat.icon"
                    class="mx-auto size-4 text-(--or3-text-muted)"
                />
                <p
                    class="mt-2 font-mono text-[10px] font-light uppercase text-(--or3-text-muted)"
                >
                    {{ stat.label }}
                </p>
                <p
                    :class="[
                        'mt-1 truncate font-mono text-[8px] font-extralight',
                        stat.tone === 'green'
                            ? 'text-(--or3-green-dark)'
                            : 'text-(--or3-text)',
                    ]"
                    :title="stat.value"
                >
                    {{ stat.value }}
                </p>
            </div>
        </div>

        <div v-if="hostMode" class="flex flex-wrap items-center gap-2">
            <code
                v-if="hostBaseUrl"
                class="min-w-0 flex-1 truncate rounded-xl border border-(--or3-border) bg-white/70 px-3 py-2 font-mono text-xs text-(--or3-text)"
                >{{ hostBaseUrl }}</code
            >
            <UButton
                label="Connect devices"
                icon="i-pixelarticons-smartphone"
                color="primary"
                variant="solid"
                size="sm"
                class="shrink-0 rounded-full"
                to="/computer/connect-device"
            />
            <UButton
                label="Trusted devices"
                icon="i-pixelarticons-shield"
                color="neutral"
                variant="soft"
                size="sm"
                class="shrink-0 rounded-full"
                to="/computer/trusted-devices"
            />
        </div>

        <div
            v-else-if="isPaired || unpairedLayout === 'compact'"
            class="flex flex-col w-full flex-wrap items-center gap-2"
        >
            <code
                v-if="activeHost?.baseUrl"
                class="min-w-0 flex-1 truncate rounded-xl border border-(--or3-border) bg-white/70 w-full px-3 py-2 font-mono text-xs text-(--or3-text)"
                >{{ activeHost.baseUrl }}</code
            >
            <UButton
                v-if="isPaired"
                label="Disconnect"
                icon="i-pixelarticons-close"
                color="neutral"
                variant="soft"
                size="sm"
                class="shrink-0 rounded-full w-full"
                @click="$emit('disconnect')"
            />
                <UButton
                v-if="!isPaired"
                label="Pair computer"
                icon="i-pixelarticons-link"
                color="primary"
                variant="solid"
                size="sm"
                class="shrink-0 rounded-full w-full"
                to="/settings/pair"
            />
        </div>

        <div v-else>
            <UButton
                label="Pair new computer"
                icon="i-pixelarticons-link"
                color="primary"
                variant="solid"
                size="xl"
                block
                class="min-h-14 rounded-2xl font-mono text-base shadow-(--or3-shadow-soft)"
                to="/settings/pair"
            />
        </div>
    </SurfaceCard>
</template>

<script setup lang="ts">
import type { Or3HostProfile } from '~/types/app-state';

interface ConnectionStat {
    label: string;
    value: string;
    icon: string;
    tone?: string;
}

defineProps<{
    headline: string;
    description: string;
    activeHost?: Or3HostProfile | null;
    isPaired: boolean;
    isConnected: boolean;
    pillLabel: string;
    pillTone: 'green' | 'amber';
    stats?: ConnectionStat[];
    hostMode?: boolean;
    hostBaseUrl?: string;
    unpairedLayout?: 'compact' | 'large';
}>();

defineEmits<{
    disconnect: [];
}>();
</script>
