<template>
    <div
        v-if="card.recommended_fix"
        class="rounded-xl border border-(--or3-border) bg-white/70 px-3 py-2 text-sm"
    >
        <div class="flex items-start gap-2">
            <Icon
                name="i-pixelarticons-tool-case"
                class="mt-0.5 size-4 shrink-0 text-(--or3-green)"
            />
            <div class="min-w-0 flex-1">
                <p class="font-mono font-semibold text-(--or3-text)">
                    Recommended fix
                </p>
                <p class="mt-0.5 text-xs leading-5 text-(--or3-text-muted)">
                    {{ card.recommended_fix }}
                </p>
                <div class="mt-2 flex justify-end">
                    <button
                        type="button"
                        class="or3-focus-ring inline-flex items-center gap-1 rounded-full border border-(--or3-green)/30 bg-(--or3-green-soft) px-2 py-1 font-mono text-[11px] uppercase tracking-wide text-(--or3-green-dark) transition hover:border-(--or3-green)/60 hover:bg-white"
                        @click="$emit('fix')"
                    >
                        <Icon name="i-pixelarticons-tool-case" class="size-3" />
                        Fix it
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { DoctorFindingCard } from '~/types/or3-api';

defineProps<{ card: DoctorFindingCard }>();
defineEmits<{ (e: 'fix'): void }>();
</script>
