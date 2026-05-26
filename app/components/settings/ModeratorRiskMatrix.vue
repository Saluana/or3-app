<template>
    <div class="overflow-hidden rounded-2xl border border-(--or3-border)">
        <div
            class="grid grid-cols-[5.5rem_minmax(0,1fr)_7.5rem] gap-3 border-b border-(--or3-border) bg-white/80 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-(--or3-text-muted)"
        >
            <span>Level</span>
            <span>Examples</span>
            <span>What OR3 does</span>
        </div>
        <div
            v-for="row in rows"
            :key="row.level"
            class="grid grid-cols-[5.5rem_minmax(0,1fr)_7.5rem] items-center gap-3 border-b border-(--or3-border) px-4 py-3 last:border-b-0"
        >
            <p class="font-mono text-sm font-semibold text-(--or3-text)">
                {{ row.label }}
            </p>
            <p class="text-sm leading-6 text-(--or3-text-muted)">
                {{ row.examples }}
            </p>
            <UBadge
                :color="badgeColor(row.action)"
                variant="subtle"
                class="justify-center"
            >
                {{ formatModeratorMatrixBadge(row.action) }}
            </UBadge>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
    MODERATOR_RISK_ROWS,
    effectiveActions,
    type ModeratorActionMap,
} from '~/utils/or3/moderator-settings';
import { formatModeratorMatrixBadge } from '~/utils/or3/moderator-display';

const props = defineProps<{
    preset: string;
    actions: ModeratorActionMap;
}>();

const rows = computed(() => {
    const resolved = effectiveActions({
        preset: props.preset,
        actions: props.actions,
    });
    return MODERATOR_RISK_ROWS.map((row) => ({
        ...row,
        action: resolved[row.level],
    }));
});

function badgeColor(action: string) {
    switch (action) {
        case 'approve':
            return 'success';
        case 'deny':
            return 'error';
        case 'escalate':
            return 'warning';
        default:
            return 'neutral';
    }
}
</script>
