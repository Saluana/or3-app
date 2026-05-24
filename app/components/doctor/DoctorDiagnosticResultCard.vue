<template>
    <div class="or3-doctor-finding" :class="toneClass">
        <div class="or3-doctor-finding__header">
            <span class="or3-doctor-finding__icon-wrap" aria-hidden="true">
                <Icon :name="iconName" class="size-4" />
            </span>
            <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                    <span
                        v-if="riskBadge"
                        class="or3-doctor-finding__badge"
                    >
                        {{ riskBadge }}
                    </span>
                    <p class="or3-doctor-finding__title">
                        {{ card.what_i_found }}
                    </p>
                </div>
                <p v-if="detailText" class="or3-doctor-finding__summary">
                    {{ detailText }}
                </p>
            </div>
        </div>

        <details
            v-if="hasAdvancedDetails"
            class="or3-doctor-finding__details"
        >
            <summary class="or3-doctor-finding__details-summary">
                <Icon
                    name="i-pixelarticons-chevron-down"
                    class="or3-doctor-finding__details-chevron size-3.5"
                />
                Advanced details
            </summary>
            <pre class="or3-doctor-finding__details-body">{{ formattedDetails }}</pre>
        </details>

        <div
            v-if="card.recommended_fix && showFix"
            class="or3-doctor-finding__fix"
        >
            <div class="or3-doctor-finding__fix-top">
                <div class="or3-doctor-finding__fix-label">
                    <Icon
                        name="i-pixelarticons-tool-case"
                        class="size-4 text-(--or3-green-dark)"
                    />
                    <span>Recommended fix</span>
                </div>
                <button
                    type="button"
                    class="or3-doctor-finding__fix-button or3-focus-ring"
                    @click="$emit('fix')"
                >
                    <Icon name="i-pixelarticons-tool-case" class="size-3.5" />
                    Fix it
                </button>
            </div>
            <p class="or3-doctor-finding__fix-copy">
                {{ card.recommended_fix }}
            </p>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { DoctorFindingCard } from '~/types/or3-api';

const props = withDefaults(
    defineProps<{
        card: DoctorFindingCard;
        showFix?: boolean;
    }>(),
    { showFix: true },
);

defineEmits<{ (e: 'fix'): void }>();

function normalizeFindingText(value?: string) {
    return String(value ?? '')
        .trim()
        .replace(/\s+/g, ' ');
}

const detailText = computed(() => {
    const summary = normalizeFindingText(props.card.what_i_found);
    const detail = normalizeFindingText(
        props.card.what_this_means || 'Doctor reported this finding.',
    );
    if (!summary || detail === summary) return '';
    return props.card.what_this_means || 'Doctor reported this finding.';
});

const risk = computed(() => props.card.risk_level ?? 'notice');

const riskBadge = computed(() => {
    switch (risk.value) {
        case 'safe':
            return 'Low risk';
        case 'warning':
            return 'Warning';
        case 'danger':
            return 'High risk';
        case 'notice':
        default:
            return 'Notice';
    }
});

const toneClass = computed(() => {
    switch (risk.value) {
        case 'safe':
            return 'or3-doctor-finding--safe';
        case 'warning':
        case 'danger':
            return 'or3-doctor-finding--danger';
        case 'notice':
        default:
            return 'or3-doctor-finding--notice';
    }
});

const iconName = computed(() =>
    risk.value === 'safe'
        ? 'i-pixelarticons-check'
        : risk.value === 'warning' || risk.value === 'danger'
          ? 'i-pixelarticons-warning-box'
          : 'i-pixelarticons-alert',
);

const hasAdvancedDetails = computed(
    () => props.card.advanced_details !== undefined && props.card.advanced_details !== null,
);

const formattedDetails = computed(() => {
    try {
        return JSON.stringify(props.card.advanced_details, null, 2);
    } catch {
        return String(props.card.advanced_details ?? '');
    }
});
</script>

<style scoped>
.or3-doctor-finding {
    overflow: hidden;
    border-radius: 1rem;
    border: 1px solid color-mix(in srgb, var(--or3-amber) 28%, var(--or3-border));
    background: linear-gradient(
        180deg,
        color-mix(in srgb, #fff8e8 88%, white 12%) 0%,
        color-mix(in srgb, #fffdf7 92%, white 8%) 100%
    );
    padding: 0.85rem 0.95rem;
    color: #6b4b1d;
    box-shadow: 0 1px 0 rgba(255, 255, 255, 0.65) inset;
}

.or3-doctor-finding--safe {
    border-color: color-mix(in srgb, var(--or3-green) 24%, var(--or3-border));
    background: linear-gradient(
        180deg,
        color-mix(in srgb, var(--or3-green-soft) 70%, white 30%) 0%,
        rgba(255, 255, 255, 0.92) 100%
    );
    color: var(--or3-green-dark);
}

.or3-doctor-finding--danger {
    border-color: color-mix(in srgb, var(--or3-danger) 24%, var(--or3-border));
    background: linear-gradient(
        180deg,
        color-mix(in srgb, var(--or3-danger-soft) 55%, white 45%) 0%,
        rgba(255, 255, 255, 0.94) 100%
    );
    color: #7a2430;
}

.or3-doctor-finding__header {
    display: flex;
    align-items: flex-start;
    gap: 0.7rem;
}

.or3-doctor-finding__icon-wrap {
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    flex-shrink: 0;
    border-radius: 0.7rem;
    background: rgba(255, 255, 255, 0.72);
    border: 1px solid color-mix(in srgb, currentColor 12%, transparent);
    color: inherit;
}

.or3-doctor-finding__badge {
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
    background: rgba(255, 255, 255, 0.62);
    padding: 0.12rem 0.45rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
}

.or3-doctor-finding__title {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.92rem;
    font-weight: 700;
    line-height: 1.35;
}

.or3-doctor-finding__summary {
    margin-top: 0.35rem;
    font-size: 0.8rem;
    line-height: 1.45;
    color: color-mix(in srgb, currentColor 78%, var(--or3-text-muted));
}

.or3-doctor-finding__details {
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px dashed color-mix(in srgb, currentColor 18%, transparent);
}

.or3-doctor-finding__details-summary {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    cursor: pointer;
    list-style: none;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: color-mix(in srgb, currentColor 84%, var(--or3-text-muted));
}

.or3-doctor-finding__details-summary::-webkit-details-marker {
    display: none;
}

.or3-doctor-finding__details-chevron {
    transition: transform 0.15s ease;
}

.or3-doctor-finding__details[open] .or3-doctor-finding__details-chevron {
    transform: rotate(180deg);
}

.or3-doctor-finding__details-body {
    margin-top: 0.55rem;
    max-height: 12rem;
    overflow: auto;
    border-radius: 0.75rem;
    border: 1px solid color-mix(in srgb, currentColor 10%, var(--or3-border));
    background: rgba(255, 255, 255, 0.78);
    padding: 0.65rem 0.75rem;
    font-size: 0.68rem;
    line-height: 1.45;
    white-space: pre-wrap;
    color: var(--or3-text);
}

.or3-doctor-finding__fix {
    margin-top: 0.8rem;
    border-radius: 0.85rem;
    border: 1px solid color-mix(in srgb, var(--or3-green) 22%, var(--or3-border));
    background: color-mix(in srgb, var(--or3-green-soft) 72%, white 28%);
    padding: 0.7rem 0.8rem;
}

.or3-doctor-finding__fix-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
}

.or3-doctor-finding__fix-label {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--or3-green-dark);
}

.or3-doctor-finding__fix-button {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--or3-green) 34%, transparent);
    background: rgba(255, 255, 255, 0.82);
    padding: 0.32rem 0.7rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--or3-green-dark);
    transition:
        background 0.15s ease,
        border-color 0.15s ease,
        transform 0.12s ease;
}

.or3-doctor-finding__fix-button:hover {
    background: white;
    border-color: color-mix(in srgb, var(--or3-green) 52%, transparent);
    transform: translateY(-1px);
}

.or3-doctor-finding__fix-copy {
    margin-top: 0.45rem;
    font-size: 0.78rem;
    line-height: 1.5;
    color: color-mix(in srgb, var(--or3-green-dark) 82%, var(--or3-text-muted));
}
</style>
