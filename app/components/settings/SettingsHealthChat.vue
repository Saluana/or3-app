<template>
    <div
        class="or3-chat-shell or3-doctor-shell"
        :class="{ 'or3-chat-shell--mobile': !desktop }"
    >
        <!-- Header: title, back, actions -->
        <div class="or3-chat-shell__header bg-transparent!">
            <header class="or3-doctor-header">
                <div class="or3-doctor-header__title">
                    <button
                        type="button"
                        class="or3-focus-ring or3-touch-target inline-flex size-10 items-center justify-center rounded-[1.1rem] border border-(--or3-border) bg-(--or3-surface)"
                        aria-label="Back to settings"
                        @click="goBackToSettings"
                    >
                        <Icon
                            name="i-pixelarticons-chevron-left"
                            class="size-5"
                        />
                    </button>
                    <div class="min-w-0">
                        <p
                            class="font-mono text-[11px] uppercase tracking-wide text-(--or3-text-muted)"
                        >
                            Settings · Health
                        </p>
                        <h1
                            class="truncate font-mono text-base font-semibold text-(--or3-text)"
                        >
                            Admin Assistant
                        </h1>
                    </div>
                </div>
                <div class="or3-doctor-header__actions">
                    <StatusPill
                        :label="adminBrainStatus"
                        :tone="adminBrainTone"
                        class="or3-doctor-header__status"
                    />
                    <UButton
                        v-if="hasChatMessages"
                        size="xs"
                        color="neutral"
                        variant="ghost"
                        icon="i-pixelarticons-trash"
                        aria-label="Clear conversation"
                        @click="clearConversation"
                    >
                        Clear
                    </UButton>
                    <UButton
                        size="xs"
                        color="neutral"
                        variant="outline"
                        icon="i-pixelarticons-reload"
                        :loading="health.loading.value"
                        aria-label="Re-run health checks"
                        @click="runHealthChecks"
                    >
                        Re-check
                    </UButton>
                </div>
            </header>
        </div>

        <!-- Body: empty state OR virtualized chat list -->
        <div class="flex-1 overflow-hidden">
            <div
                v-if="!hasChatMessages"
                class="or3-chat-shell__content or3-doctor-empty"
            >
                <section class="or3-doctor-empty__hero">
                    <div class="or3-doctor-empty__avatar">
                        <img
                            src="/computer-icons/chat-guy.webp"
                            alt="Doctor avatar"
                            class="or3-doctor-empty__avatar-image"
                        />
                    </div>
                    <h2 class="or3-doctor-empty__title">
                        I'm your Admin Assistant.
                    </h2>
                    <p class="or3-doctor-empty__subtitle">
                        Tell me what's broken and I'll help diagnose and fix it.
                        Below is a snapshot of your system's current health.
                    </p>
                    <div class="or3-doctor-empty__pills">
                        <StatusPill
                            v-if="health.findings.value.length"
                            :label="overallLabel"
                            :tone="overallTone"
                        />
                        <StatusPill
                            :label="adminBrainStatus"
                            :tone="adminBrainTone"
                        />
                    </div>
                </section>

                <ManualFallbackCard
                    v-if="health.doctorUnavailable.value"
                    class="mt-4"
                    message="Basic Doctor is not reachable, so the app is showing local health checks and connection recovery actions."
                />

                <!-- Findings summary -->
                <section
                    v-if="health.findings.value.length"
                    class="mt-4 space-y-3"
                >
                    <div class="flex items-center justify-between">
                        <p
                            class="font-mono text-xs uppercase tracking-wide text-(--or3-text-muted)"
                        >
                            Health snapshot
                        </p>
                        <p
                            v-if="health.lastRun.value"
                            class="font-mono text-[11px] text-(--or3-text-muted)"
                        >
                            {{ formattedLastRun }}
                        </p>
                    </div>

                    <!-- Blockers / errors first -->
                    <ul v-if="errorFindings.length" class="space-y-2">
                        <li v-for="finding in errorFindings" :key="finding.id">
                            <FindingCard
                                :finding="finding"
                                @ask="askAboutFinding(finding)"
                            />
                        </li>
                    </ul>

                    <!-- Warnings -->
                    <ul v-if="warningFindings.length" class="space-y-2">
                        <li
                            v-for="finding in warningFindings"
                            :key="finding.id"
                        >
                            <FindingCard
                                :finding="finding"
                                @ask="askAboutFinding(finding)"
                            />
                        </li>
                    </ul>

                    <!-- OK collapsed details -->
                    <details
                        v-if="okFindings.length"
                        class="rounded-xl border border-(--or3-border) bg-white/60 px-3 py-2 text-sm"
                    >
                        <summary
                            class="cursor-pointer font-mono text-xs uppercase tracking-wide text-(--or3-text-muted)"
                        >
                            {{ okFindings.length }} checks passing
                        </summary>
                        <ul class="mt-2 space-y-2">
                            <li v-for="finding in okFindings" :key="finding.id">
                                <FindingCard
                                    :finding="finding"
                                    @ask="askAboutFinding(finding)"
                                />
                            </li>
                        </ul>
                    </details>
                </section>

                <section class="or3-doctor-empty__prompts">
                    <p
                        class="font-mono text-xs uppercase tracking-wide text-(--or3-text-muted)"
                    >
                        Quick prompts
                    </p>
                    <div class="mt-2 flex flex-wrap gap-2">
                        <button
                            v-for="prompt in quickPrompts"
                            :key="prompt"
                            type="button"
                            class="or3-focus-ring rounded-full border border-(--or3-border) bg-white/70 px-3 py-1.5 text-xs text-(--or3-text) transition hover:border-(--or3-green)/40 hover:bg-(--or3-green-soft)"
                            @click="quickAsk(prompt)"
                        >
                            {{ prompt }}
                        </button>
                    </div>
                </section>
            </div>

            <div
                v-else
                class="w-full or3-chat-shell__content--virtualized"
            >
                <div ref="messageListRef" class="or3-doctor-message-list">
                    <article
                        v-for="message in doctorChatMessages"
                        :key="message.id"
                        :class="[
                            'or3-doctor-message',
                            message.role === 'user'
                                ? 'or3-doctor-message--user'
                                : 'or3-doctor-message--assistant',
                            !message.text &&
                            !message.parts.length &&
                            !message.activityLog.length &&
                            message.cards.length
                                ? 'or3-doctor-message--cards-only'
                                : '',
                        ]"
                    >
                        <div class="or3-doctor-message__bubble">
                            <p
                                v-if="message.role === 'user' && message.text"
                                class="or3-doctor-message__user-text"
                            >
                                {{ message.text }}
                            </p>
                            <template v-else>
                                <div
                                    v-if="message.parts.length"
                                    class="or3-doctor-message__parts"
                                >
                                    <template
                                        v-for="part in message.parts"
                                        :key="part.id"
                                    >
                                        <StreamingMarkdown
                                            v-if="
                                                part.type === 'text' &&
                                                part.content
                                            "
                                            :content="part.content"
                                        />
                                        <AssistantInlineToolCall
                                            v-else-if="part.type === 'tool'"
                                            :part="part"
                                        />
                                    </template>
                                </div>
                                <StreamingMarkdown
                                    v-else-if="message.text"
                                    :content="message.text"
                                />
                                <p
                                    v-else-if="message.status === 'streaming'"
                                    class="or3-doctor-message__thinking"
                                >
                                    <span class="or3-doctor-message__dot" />
                                    <span class="or3-doctor-message__dot" />
                                    <span class="or3-doctor-message__dot" />
                                </p>
                                <AssistantActivityLog
                                    v-if="message.activityLog.length"
                                    :items="message.activityLog"
                                />
                            </template>
                            <div
                                v-if="message.cards.length"
                                class="or3-doctor-card-stack"
                            >
                                <div
                                    v-for="(card, cardIndex) in message.cards"
                                    :key="
                                        doctorCardKey(
                                            message.id,
                                            card,
                                            cardIndex,
                                        )
                                    "
                                    class="contents"
                                >
                                    <DoctorDiagnosticResultCard
                                        v-if="card.type === 'finding'"
                                        :card="card.card"
                                    />
                                    <RecommendedFixCard
                                        v-else-if="
                                            card.type === 'recommended_fix'
                                        "
                                        :card="card.card"
                                        @fix="askDoctorToFix(card.card)"
                                    />
                                    <div
                                        v-else-if="card.type === 'plan'"
                                        class="space-y-2"
                                    >
                                        <SettingsChangePreviewCard
                                            :plan="card.plan"
                                        />
                                        <div class="or3-doctor-card-actions">
                                            <StatusPill
                                                v-if="card.status"
                                                :label="card.status"
                                                tone="neutral"
                                            />
                                            <UButton
                                                size="xs"
                                                color="neutral"
                                                variant="ghost"
                                                icon="i-pixelarticons-close"
                                                label="Deny"
                                                @click="
                                                    dismissDoctorPlan(card.plan)
                                                "
                                            />
                                            <UButton
                                                v-if="card.plan.id"
                                                size="xs"
                                                color="neutral"
                                                variant="outline"
                                                icon="i-pixelarticons-check-double"
                                                :loading="chat.applying.value"
                                                label="Apply plan"
                                                @click="
                                                    applyDoctorPlan(card.plan)
                                                "
                                            />
                                        </div>
                                    </div>
                                    <RiskApprovalCard
                                        v-else-if="card.type === 'risk'"
                                        :risk-level="card.plan.risk_level"
                                        :requires-approval="
                                            card.plan.requires_approval
                                        "
                                        :requires-step-up="
                                            card.plan.requires_step_up_auth
                                        "
                                        :remember="
                                            rememberApproval[
                                                doctorPlanKey(card.plan)
                                            ]
                                        "
                                        auth-available
                                        @update:remember="
                                            setRememberApproval(
                                                card.plan,
                                                $event,
                                            )
                                        "
                                    />
                                    <RestartRequiredCard
                                        v-else-if="card.type === 'restart'"
                                        :result="applyResultFor(card.plan)"
                                    />
                                    <PostFixCheckCard
                                        v-else-if="card.type === 'post_check'"
                                        :plan-id="card.planId"
                                        :result="
                                            postCheckResultFor(
                                                card.planId,
                                                card.result,
                                            )
                                        "
                                        @run="runDoctorPostChecks(card.planId)"
                                    />
                                    <UndoFixCard
                                        v-else-if="card.type === 'undo'"
                                        :plan-id="card.planId"
                                        :rollback-id="card.rollbackId"
                                        @undo="undoDoctorPlan(card.planId)"
                                    />
                                    <ManualFallbackCard
                                        v-else-if="
                                            card.type === 'manual_fallback'
                                        "
                                        :message="card.message"
                                    />
                                </div>
                            </div>
                        </div>
                    </article>
                </div>
            </div>
        </div>

        <!-- Composer fixed at bottom -->
        <div class="or3-chat-shell__composer">
            <div class="or3-chat-shell__composer-inner">
                <div class="or3-chat-shell__status flex items-center gap-2 px-1">
                    <AssistantStatusIndicator :active="chat.loading.value" />
                </div>
                <p
                    v-if="chat.error.value"
                    class="mb-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-center text-xs leading-5 text-rose-700"
                >
                    {{ chat.error.value }}
                </p>
                <AssistantComposer
                    v-model="draft"
                    v-model:mode="chatMode"
                    v-model:selected-runner-id="selectedRunnerId"
                    v-model:selected-runner-model="selectedRunnerModel"
                    v-model:selected-runner-thinking-level="
                        selectedRunnerThinkingLevel
                    "
                    pane-id="doctor"
                    :streaming="chat.loading.value"
                    :runners="runners"
                    @send="sendDoctorMessage"
                    @stop="stopDoctorMessage"
                />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
    useSettingsHealth,
    type HealthFinding,
    type HealthStatus,
} from '~/composables/settings/useSettingsHealth';
import {
    doctorCardsForMessage,
    doctorVisibleTextForMessage,
    useDoctorAdminChat,
    type DoctorChatCard,
} from '~/composables/useDoctorAdminChat';
import type { AssistantSendPayload } from '~/types/app-state';
import type {
    DoctorPlanApplyResponse,
    DoctorPostCheckResponse,
    DoctorSettingsChangePlan,
} from '~/types/or3-api';
import FindingCard from '~/components/settings/health/FindingCard.vue';
import { resolveDoctorRunnerID } from '~/utils/doctorRunnerSelection';

const router = useRouter();
defineProps<{ desktop?: boolean }>();
const health = useSettingsHealth();
const chat = useDoctorAdminChat();
const draft = ref('');
const chatMode = ref<'ask' | 'work' | 'admin'>('ask');
const selectedRunnerId = ref('');
const selectedRunnerModel = ref('');
const selectedRunnerThinkingLevel = ref('');
const messageListRef = ref<HTMLElement | null>(null);
const planApplyResults = ref<Record<string, DoctorPlanApplyResponse>>({});
const planPostCheckResults = ref<Record<string, DoctorPostCheckResponse>>({});
const rememberApproval = ref<Record<string, boolean>>({});
const dismissedPlanKeys = ref<Record<string, boolean>>({});
const {
    selectableRunners,
    defaultRunner,
    refresh: refreshRunners,
} = useChatRunners();

const quickPrompts = [
    'Why is OR3 not ready?',
    'Help me fix my provider key',
    'Why is the service unavailable?',
    'Review my safety settings',
];

const hasChatMessages = computed(() => doctorChatMessages.value.length > 0);

const errorFindings = computed(() =>
    health.findings.value.filter((finding) => finding.status === 'error'),
);
const warningFindings = computed(() =>
    health.findings.value.filter((finding) => finding.status === 'warning'),
);
const okFindings = computed(() =>
    health.findings.value.filter(
        (finding) => finding.status === 'ok' || finding.status === 'unknown',
    ),
);

const overallLabel = computed(() => {
    switch (health.overall.value) {
        case 'ok':
            return 'All checks pass';
        case 'warning':
            return `${warningFindings.value.length} warning${warningFindings.value.length === 1 ? '' : 's'}`;
        case 'error':
            return `${errorFindings.value.length} need${errorFindings.value.length === 1 ? 's' : ''} attention`;
        default:
            return 'Checking…';
    }
});

const overallTone = computed<'green' | 'amber' | 'danger' | 'neutral'>(() => {
    switch (health.overall.value) {
        case 'ok':
            return 'green';
        case 'warning':
            return 'amber';
        case 'error':
            return 'danger';
        default:
            return 'neutral';
    }
});

const adminBrainStatus = computed(() =>
    chat.adminBrain.value?.available
        ? 'Admin Brain ready'
        : 'Basic Doctor only',
);
const adminBrainTone = computed<'green' | 'amber'>(() =>
    chat.adminBrain.value?.available ? 'green' : 'amber',
);

const formattedLastRun = computed(() => {
    if (!health.lastRun.value) return '';
    try {
        return `Last checked ${new Date(health.lastRun.value).toLocaleTimeString()}`;
    } catch {
        return health.lastRun.value;
    }
});

const doctorUsesExternalRunner = computed(
    () => chat.adminBrain.value?.kind === 'runner',
);
const runners = computed(() =>
    doctorUsesExternalRunner.value
        ? selectableRunners.value
        : selectableRunners.value.filter(
              (runner) => runner.id === 'or3-intern',
          ),
);
const preferredDoctorRunner = computed(() => {
    if (doctorUsesExternalRunner.value) {
        return (
            selectableRunners.value.find(
                (runner) => runner.id === chat.adminBrain.value?.runner_id,
            ) ??
            selectableRunners.value.find(
                (runner) => runner.id !== 'or3-intern',
            ) ??
            defaultRunner.value
        );
    }
    return (
        runners.value.find((runner) => runner.id === 'or3-intern') ??
        defaultRunner.value
    );
});
const selectableRunnerIDs = computed(() =>
    runners.value.map((runner) => runner.id),
);

const doctorChatMessages = computed(() =>
    chat.messages.value
        .map((message, index) => {
            const role = message.role === 'user' ? 'user' : 'assistant';
            const cards = doctorCardsForMessage(message).filter(
                (card) => !isDoctorCardDismissed(card),
            );
            const text =
                message.role === 'user'
                    ? stripLeakedDoctorPrompt(String(message.content ?? ''))
                    : doctorVisibleTextForMessage(message);
            return {
                id: String(message.id ?? `doctor-${index}`),
                role,
                text: text.trim(),
                status: message.status ?? 'complete',
                parts: (message.parts ?? []).filter((part) => {
                    if (part.type === 'text')
                        return Boolean(part.content?.trim());
                    return Boolean(part.name || part.toolCallId);
                }),
                activityLog: message.activityLog ?? [],
                cards,
            };
        })
        .filter(
            (message) =>
                message.text.length > 0 ||
                message.parts.length > 0 ||
                message.activityLog.length > 0 ||
                message.cards.length > 0,
        ),
);

function goBackToSettings() {
    router.push('/settings');
}

function runHealthChecks() {
    chat.clearError();
    void health.run();
    void chat.loadAdminBrain().catch(() => undefined);
    void refreshRunners().catch(() => undefined);
}

function clearConversation() {
    chat.clearMessages();
    planApplyResults.value = {};
    planPostCheckResults.value = {};
    rememberApproval.value = {};
    dismissedPlanKeys.value = {};
}

function doctorPlanKey(plan: DoctorSettingsChangePlan) {
    return plan.id || `${plan.title}:${plan.changes.length}`;
}

function doctorCardKey(messageID: string, card: DoctorChatCard, index: number) {
    if (
        card.type === 'plan' ||
        card.type === 'risk' ||
        card.type === 'restart'
    ) {
        return `${messageID}:${card.type}:${doctorPlanKey(card.plan)}:${index}`;
    }
    if (card.type === 'post_check') {
        return `${messageID}:post_check:${card.planId ?? 'unknown'}:${index}`;
    }
    if (card.type === 'undo') {
        return `${messageID}:undo:${card.planId ?? 'unknown'}:${card.rollbackId ?? ''}:${index}`;
    }
    if (card.type === 'finding' || card.type === 'recommended_fix') {
        return `${messageID}:${card.type}:${card.card.id}:${index}`;
    }
    return `${messageID}:${card.type}:${index}`;
}

function doctorPlanDismissKey(plan: DoctorSettingsChangePlan) {
    return plan.id || doctorPlanKey(plan);
}

function isDoctorCardDismissed(card: DoctorChatCard) {
    if (
        card.type === 'plan' ||
        card.type === 'risk' ||
        card.type === 'restart'
    ) {
        return Boolean(
            dismissedPlanKeys.value[doctorPlanDismissKey(card.plan)],
        );
    }
    return false;
}

function dismissDoctorPlan(plan: DoctorSettingsChangePlan) {
    dismissedPlanKeys.value = {
        ...dismissedPlanKeys.value,
        [doctorPlanDismissKey(plan)]: true,
    };
}

function stripLeakedDoctorPrompt(content: string) {
    if (
        !content.includes('Current doctor summary:') ||
        !content.includes('User message:')
    ) {
        return content.trim();
    }
    return content.split('User message:').pop()?.trim() || content.trim();
}

function setRememberApproval(plan: DoctorSettingsChangePlan, value: boolean) {
    rememberApproval.value = {
        ...rememberApproval.value,
        [doctorPlanKey(plan)]: value,
    };
}

function applyResultFor(plan: DoctorSettingsChangePlan) {
    const id = plan.id;
    return id ? (planApplyResults.value[id] ?? null) : null;
}

function postCheckResultFor(
    planId: string | undefined,
    fallback?: DoctorPostCheckResponse,
) {
    return planId
        ? (planPostCheckResults.value[planId] ?? fallback ?? null)
        : (fallback ?? null);
}

function scrollDoctorMessagesToBottom() {
    const element = messageListRef.value;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
}

async function applyDoctorPlan(plan: DoctorSettingsChangePlan) {
    if (!plan.id) return;
    const result = await chat.applyPlan(plan, {
        rememberForMinutes: rememberApproval.value[doctorPlanKey(plan)] ? 5 : 0,
    });
    planApplyResults.value = { ...planApplyResults.value, [plan.id]: result };
    await chat.loadSession().catch(() => undefined);
    await nextTick();
    scrollDoctorMessagesToBottom();
}

async function runDoctorPostChecks(planId?: string) {
    if (!planId) return;
    const result = await chat.runPostChecks(planId);
    planPostCheckResults.value = {
        ...planPostCheckResults.value,
        [planId]: result,
    };
    await chat.loadSession().catch(() => undefined);
}

async function undoDoctorPlan(planId?: string) {
    if (!planId) return;
    const result = await chat.rollbackPlan(planId);
    planApplyResults.value = { ...planApplyResults.value, [planId]: result };
    await chat.loadSession().catch(() => undefined);
}

async function sendDoctorMessage(payload?: AssistantSendPayload) {
    const content = (
        payload?.transportText ||
        payload?.text ||
        draft.value
    ).trim();
    if (!content || chat.loading.value) return;
    draft.value = '';
    try {
        const runnerId = resolveDoctorRunnerID({
            currentRunnerID: payload?.runnerId || selectedRunnerId.value,
            adminBrainRunnerID: doctorUsesExternalRunner.value
                ? chat.adminBrain.value?.runner_id
                : '',
            defaultRunnerID: preferredDoctorRunner.value?.id,
            selectableRunnerIDs: selectableRunnerIDs.value,
        });
        await chat.sendMessage(content, {
            runnerId,
            runnerModel: payload?.runnerModel || selectedRunnerModel.value,
            runnerThinkingLevel:
                payload?.runnerThinkingLevel ||
                selectedRunnerThinkingLevel.value,
        });
    } catch {
        // chat.error is already populated
    } finally {
        await nextTick();
        scrollDoctorMessagesToBottom();
    }
}

function quickAsk(prompt: string) {
    void sendDoctorMessage({ text: prompt, transportText: prompt });
}

function askAboutFinding(finding: HealthFinding) {
    const lead = finding.label || finding.id;
    draft.value = `${lead}: ${finding.detail || 'please explain and help me fix this.'}`;
}

function askDoctorToFix(card: NonNullable<HealthFinding['doctorCard']>) {
    const visible = card.what_i_found || 'Recommended fix';
    const prompt = [
        'Please prepare an Apply button for this recommended fix if OR3 can safely change the setting.',
        `Problem: ${card.what_i_found}`,
        `Meaning: ${card.what_this_means}`,
        `Recommended fix: ${card.recommended_fix}`,
    ].join('\n');
    void sendDoctorMessage({ text: visible, transportText: prompt });
}

function stopDoctorMessage() {
    chat.stopStreaming();
}

// Type guard helper for HealthStatus consumer (silences unused warning).
function _typeKeep(_value: HealthStatus) {
    return _value;
}
void _typeKeep;

onMounted(() => {
    chat.clearError();
    void health.run();
    void chat.loadAdminBrain().catch(() => undefined);
    void refreshRunners().catch(() => undefined);
});

watch(
    [
        () => chat.adminBrain.value?.runner_id ?? '',
        () => chat.adminBrain.value?.kind ?? '',
        () => preferredDoctorRunner.value?.id ?? '',
        selectableRunnerIDs,
    ],
    ([adminBrainRunnerID, adminBrainKind, defaultRunnerID, runnerIDs]) => {
        selectedRunnerId.value = resolveDoctorRunnerID({
            currentRunnerID: selectedRunnerId.value,
            adminBrainRunnerID:
                adminBrainKind === 'runner' ? adminBrainRunnerID : '',
            defaultRunnerID,
            selectableRunnerIDs: runnerIDs,
        });
    },
    { immediate: true },
);
</script>

<style>
.or3-doctor-shell {
    background: var(--or3-background);
}

.or3-doctor-header {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 0.65rem;
    padding-bottom: 0.75rem;
}

.or3-doctor-header__title {
    min-width: 0;
    flex: 1 1 12rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.or3-doctor-header__actions {
    margin-left: auto;
    display: flex;
    flex: 0 1 auto;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem;
}

@media (max-width: 420px) {
    .or3-doctor-header__status {
        display: none;
    }
}

.or3-doctor-empty {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding-top: 0.5rem;
}

.or3-doctor-empty__hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    text-align: center;
    padding: 1rem 0 0.25rem;
}

.or3-doctor-empty__avatar {
    width: 5.5rem;
    height: 5.5rem;
    border-radius: 1.25rem;
    overflow: hidden;
    border: 1px solid var(--or3-border);
    background: var(--or3-surface);
    display: grid;
    place-items: center;
}

.or3-doctor-empty__avatar-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.or3-doctor-empty__title {
    font-family:
        ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
        'Liberation Mono', 'Courier New', monospace;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--or3-text);
}

.or3-doctor-empty__subtitle {
    max-width: 28rem;
    font-size: 0.9rem;
    line-height: 1.55;
    color: var(--or3-text-muted);
}

.or3-doctor-empty__pills {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.5rem;
}

.or3-doctor-empty__prompts {
    padding-top: 0.5rem;
}

.or3-doctor-message-list {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    min-height: 100%;
    max-height: 100%;
    overflow-y: auto;
    padding: 0.5rem 0 15rem;
    margin: 0 auto;
    box-sizing: border-box;
    scrollbar-gutter: stable;
}

.or3-doctor-message {
    display: flex;
    width: min(48rem, 100%);
    max-width: calc(100% - 2rem);
    box-sizing: border-box;
}

.or3-doctor-message--user {
    justify-content: flex-end;
}

.or3-doctor-message--assistant {
    justify-content: flex-start;
}

.or3-doctor-message__bubble {
    width: 100%;
    border: 1px solid var(--or3-border);
    background: rgb(255 255 255 / 0.78);
    border-radius: 1rem;
    padding: 0.75rem;
    box-shadow: 0 10px 28px rgb(15 23 42 / 0.06);
    box-sizing: border-box;
}

.or3-doctor-message--cards-only .or3-doctor-message__bubble {
    width: 100%;
    max-width: 42rem;
    border: 0;
    background: transparent;
    border-radius: 0;
    padding: 0;
    box-shadow: none;
}

.or3-doctor-message--user .or3-doctor-message__bubble {
    width: auto;
    max-width: min(42rem, 100%);
    background: var(--or3-green-soft);
    border-color: rgb(30 126 85 / 0.18);
}

.or3-doctor-message__user-text {
    font-size: 0.9375rem;
    line-height: 1.55;
    color: var(--or3-text);
    white-space: pre-wrap;
}

.or3-doctor-message__parts {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
}

.or3-doctor-message__thinking {
    display: inline-flex;
    align-items: center;
    gap: 0.28rem;
    min-height: 1.5rem;
}

.or3-doctor-message__dot {
    width: 0.36rem;
    height: 0.36rem;
    border-radius: 999px;
    background: var(--or3-text-muted);
    animation: or3-doctor-thinking 1s infinite ease-in-out;
}

.or3-doctor-message__dot:nth-child(2) {
    animation-delay: 0.12s;
}

.or3-doctor-message__dot:nth-child(3) {
    animation-delay: 0.24s;
}

@keyframes or3-doctor-thinking {
    0%,
    80%,
    100% {
        opacity: 0.35;
        transform: translateY(0);
    }
    40% {
        opacity: 1;
        transform: translateY(-2px);
    }
}

.or3-doctor-card-stack {
    margin-top: 0.65rem;
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
}

.or3-doctor-card-stack:first-child {
    margin-top: 0;
}

.or3-doctor-card-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem;
}

.or3-doctor-composer {
    display: flex;
    align-items: flex-end;
    gap: 0.5rem;
    background: var(--or3-surface);
    border: 1px solid var(--or3-border);
    border-radius: 1.5rem;
    padding: 0.5rem 0.5rem 0.5rem 1rem;
    box-shadow: var(--or3-shadow);
    backdrop-filter: blur(8px);
}

.or3-doctor-composer__input {
    flex: 1 1 auto;
    min-width: 0;
    resize: none;
    background: transparent;
    border: none;
    outline: none;
    font: inherit;
    line-height: 1.4;
    padding: 0.5rem 0;
    color: var(--or3-text);
    max-height: 200px;
}

.or3-doctor-composer__input::placeholder {
    color: var(--or3-text-muted);
}

.or3-doctor-composer__send {
    align-self: flex-end;
    border-radius: 9999px !important;
}
</style>
