<template>
    <section
        v-if="showApprovalActions"
        class="or3-composer-approval"
        aria-live="polite"
    >
        <div class="or3-composer-approval__notice">
            <Icon name="i-pixelarticons-shield" class="size-4 shrink-0" />
            <span>{{ approvalNotice }}</span>
        </div>
        <div
            v-if="moderatorReview"
            class="or3-composer-approval__moderator"
        >
            <span class="or3-composer-approval__moderator-pill">
                Autopilot · {{ moderatorReview.summary }}
            </span>
            <p
                v-if="moderatorReview.reason"
                class="or3-composer-approval__moderator-reason"
            >
                {{ moderatorReview.reason }}
            </p>
            <p
                v-if="moderatorReview.alternative"
                class="or3-composer-approval__moderator-reason"
            >
                Try: {{ moderatorReview.alternative }}
            </p>
        </div>
        <div class="or3-composer-approval__card">
            <div class="or3-composer-approval__head">
                <span class="or3-composer-approval__icon">
                    <Icon :name="approvalDisplay.icon" class="size-4" />
                </span>
                <div class="min-w-0 flex-1">
                    <p class="or3-composer-approval__title">
                        {{ approvalDisplay.title }}
                    </p>
                    <p class="or3-composer-approval__description">
                        {{ approvalDisplay.description }}
                    </p>
                </div>
            </div>
            <p
                v-if="approvalDisplay.preview"
                class="or3-composer-approval__preview"
            >
                {{ approvalDisplay.preview }}
            </p>
            <p
                v-else-if="approvalDetailLoading"
                class="or3-composer-approval__preview or3-composer-approval__preview--muted"
            >
                Loading request details…
            </p>
        </div>
        <div class="or3-composer-approval__actions">
            <button
                type="button"
                class="or3-composer-approval__btn or3-composer-approval__btn--deny"
                :disabled="approvalBusy"
                @click="denyApproval"
            >
                <Icon name="i-pixelarticons-close" class="size-4" />
                <span>Deny</span>
            </button>
            <button
                type="button"
                class="or3-composer-approval__btn or3-composer-approval__btn--approve"
                :disabled="approvalBusy"
                @click="approveApproval(false)"
            >
                <Icon name="i-pixelarticons-check" class="size-4" />
                <span>Approve once</span>
            </button>
            <button
                type="button"
                class="or3-composer-approval__btn or3-composer-approval__btn--remember"
                :disabled="approvalBusy"
                @click="approveApproval(true)"
            >
                <Icon name="i-pixelarticons-bookmark" class="size-4" />
                <span>Approve &amp; remember</span>
            </button>
        </div>
    </section>
</template>

<script setup lang="ts">
import { computed, toRef } from 'vue';
import type { ChatMessage } from '~/types/app-state';
import { useMessageApproval } from '~/composables/useMessageApproval';

const props = defineProps<{
    message: ChatMessage;
}>();

const {
    approvalBusy,
    approvalDetailLoading,
    approvalDisplay,
    approvalNotice,
    moderatorReview,
    showApprovalActions,
    approveApproval,
    denyApproval,
} = useMessageApproval(toRef(() => props.message));
</script>

<style scoped>
.or3-composer-approval__notice {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.45rem 0.55rem;
    border-radius: 0.65rem;
    background: color-mix(in srgb, #f59e0b 14%, white 86%);
    font-size: 0.78rem;
    font-weight: 600;
    line-height: 1.35;
    color: color-mix(in srgb, #92400e 88%, var(--or3-text) 12%);
}

.or3-composer-approval__moderator {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding: 0.55rem 0.65rem;
    border-radius: 0.75rem;
    border: 1px solid color-mix(in srgb, var(--or3-green) 28%, var(--or3-border) 72%);
    background: color-mix(in srgb, var(--or3-green-soft) 72%, white 28%);
}

.or3-composer-approval__moderator-pill {
    display: inline-flex;
    width: fit-content;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--or3-green) 35%, var(--or3-border) 65%);
    background: white/75;
    padding: 0.15rem 0.55rem;
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.01em;
    color: var(--or3-green-dark);
}

.or3-composer-approval__moderator-reason {
    font-size: 0.74rem;
    line-height: 1.45;
    color: var(--or3-text-muted);
}

.or3-composer-approval {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    margin-bottom: 0.65rem;
    padding: 0.75rem;
    border-radius: 1rem;
    border: 1px solid color-mix(in srgb, #f59e0b 32%, var(--or3-border) 68%);
    background: color-mix(in srgb, #fffbeb 82%, var(--or3-surface) 18%);
    box-shadow: var(--or3-shadow-soft);
}

.or3-composer-approval__card {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
}

.or3-composer-approval__head {
    display: flex;
    align-items: flex-start;
    gap: 0.65rem;
}

.or3-composer-approval__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border-radius: 0.65rem;
    background: color-mix(in srgb, #1f1f1d 92%, transparent);
    color: #f1eddf;
    flex-shrink: 0;
}

.or3-composer-approval__title {
    margin: 0;
    font-size: 0.92rem;
    font-weight: 650;
    line-height: 1.35;
    color: var(--or3-text);
}

.or3-composer-approval__description {
    margin: 0.2rem 0 0;
    font-size: 0.8rem;
    line-height: 1.45;
    color: var(--or3-text-muted);
}

.or3-composer-approval__preview {
    margin: 0;
    padding: 0.55rem 0.65rem;
    border-radius: 0.7rem;
    border: 1px solid color-mix(in srgb, var(--or3-border) 85%, white 15%);
    background: color-mix(in srgb, var(--or3-surface) 88%, white 12%);
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.72rem;
    line-height: 1.45;
    color: var(--or3-green-dark);
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-word;
}

.or3-composer-approval__preview--muted {
    font-family: inherit;
    color: var(--or3-text-muted);
    background: transparent;
    border-color: transparent;
    padding-left: 0;
    padding-right: 0;
}

.or3-composer-approval__actions {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.45rem;
}

.or3-composer-approval__btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    min-height: 2.35rem;
    padding: 0.45rem 0.55rem;
    border-radius: 0.75rem;
    border: 1px solid var(--or3-border);
    background: var(--or3-surface);
    font-size: 0.78rem;
    font-weight: 600;
    line-height: 1.2;
    color: var(--or3-text);
    transition:
        background 0.15s ease,
        border-color 0.15s ease,
        color 0.15s ease;
}

.or3-composer-approval__btn:disabled {
    opacity: 0.45;
    cursor: default;
}

.or3-composer-approval__btn--approve {
    color: var(--or3-green-dark);
    border-color: color-mix(in srgb, var(--or3-green) 28%, var(--or3-border) 72%);
    background: color-mix(in srgb, var(--or3-green-soft) 75%, white 25%);
}

.or3-composer-approval__btn--remember {
    color: var(--or3-green-dark);
    border-color: color-mix(in srgb, var(--or3-green) 22%, var(--or3-border) 78%);
}

.or3-composer-approval__btn--deny {
    color: var(--or3-danger);
    border-color: color-mix(in srgb, var(--or3-danger) 18%, var(--or3-border) 82%);
}

@media (max-width: 640px) {
    .or3-composer-approval__actions {
        grid-template-columns: 1fr;
    }
}
</style>
