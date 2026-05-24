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
        <div class="or3-chat-shell__body or3-doctor-body">
            <div
                v-if="!hasChatMessages"
                class="or3-chat-shell__content or3-doctor-empty"
            >
                <section class="or3-doctor-empty__hero">
                    <div class="or3-doctor-empty__avatar">
                        <img
                            src="/computer-icons/doctor-guy.webp"
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
                    <div class="flex flex-wrap items-center justify-between gap-2">
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
                                @fix="
                                    finding.doctorCard &&
                                    askDoctorToFix(finding.doctorCard)
                                "
                            />
                        </li>
                    </ul>

                    <!-- Warnings (collapsed by default — expand to review) -->
                    <details
                        v-if="warningFindings.length"
                        class="rounded-xl border border-amber-200/80 bg-amber-50/40 px-3 py-2 text-sm"
                    >
                        <summary
                            class="cursor-pointer font-mono text-xs uppercase tracking-wide text-amber-900/80"
                        >
                            {{ warningFindings.length }} warning{{
                                warningFindings.length === 1 ? '' : 's'
                            }}
                        </summary>
                        <ul class="mt-2 space-y-2">
                            <li
                                v-for="finding in warningFindings"
                                :key="finding.id"
                            >
                                <FindingCard
                                    :finding="finding"
                                    @ask="askAboutFinding(finding)"
                                    @fix="
                                        finding.doctorCard &&
                                        askDoctorToFix(finding.doctorCard)
                                    "
                                />
                            </li>
                        </ul>
                    </details>

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
                                    @fix="
                                        finding.doctorCard &&
                                        askDoctorToFix(finding.doctorCard)
                                    "
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
                class="or3-doctor-chat-pane w-full or3-chat-shell__content--virtualized"
            >
                <div
                    v-if="planOutcomeStrip"
                    class="or3-doctor-outcome-strip"
                    role="status"
                    aria-live="polite"
                >
                    <div class="or3-doctor-outcome-strip__main">
                        <Icon
                            name="i-pixelarticons-check"
                            class="or3-doctor-outcome-strip__icon"
                            aria-hidden="true"
                        />
                        <p class="or3-doctor-outcome-strip__message">
                            {{ planOutcomeStrip.message }}
                        </p>
                    </div>
                    <div class="or3-doctor-outcome-strip__actions">
                        <button
                            v-if="planOutcomeStrip.rollbackId"
                            type="button"
                            class="or3-doctor-outcome-strip__undo or3-focus-ring"
                            :disabled="planOutcomeUndoing"
                            @click="undoPlanOutcomeStrip"
                        >
                            {{ planOutcomeUndoing ? 'Undoing…' : 'Undo' }}
                        </button>
                        <button
                            type="button"
                            class="or3-doctor-outcome-strip__dismiss or3-focus-ring"
                            aria-label="Dismiss update notice"
                            @click="dismissPlanOutcomeStrip"
                        >
                            <Icon
                                name="i-pixelarticons-close"
                                class="size-4"
                                aria-hidden="true"
                            />
                        </button>
                    </div>
                </div>
                <div ref="messageListRef" class="or3-doctor-message-list">
                    <article
                        v-for="message in doctorChatMessages"
                        :key="message.id"
                        :class="[
                            'or3-doctor-message',
                            message.role === 'user'
                                ? 'or3-doctor-message--user'
                                : 'or3-doctor-message--assistant',
                            message.role === 'assistant' &&
                            message.status === 'attention'
                                ? 'or3-doctor-message--attention'
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
                                            :compact-telemetry="
                                                isDoctorTelemetryToolName(
                                                    part.name,
                                                )
                                            "
                                            class="or3-doctor-message__tool"
                                        />
                                    </template>
                                </div>
                                <StreamingMarkdown
                                    v-if="
                                        message.text &&
                                        !doctorHasOrderedParts(message) &&
                                        !doctorSummaryInParts(
                                            message.text,
                                            message.parts,
                                        )
                                    "
                                    :class="[
                                        'or3-doctor-message__summary',
                                        message.parts.length
                                            ? 'or3-doctor-message__summary--after-tools'
                                            : '',
                                        message.isEmptyFinalSummary
                                            ? 'or3-doctor-message__summary--attention'
                                            : '',
                                    ]"
                                    :content="message.text"
                                />
                                <p
                                    v-else-if="
                                        !message.parts.length &&
                                        message.status === 'streaming'
                                    "
                                    class="or3-doctor-message__thinking"
                                >
                                    <span class="or3-doctor-message__dot" />
                                    <span class="or3-doctor-message__dot" />
                                    <span class="or3-doctor-message__dot" />
                                </p>
                                <p
                                    v-if="
                                        message.error &&
                                        message.errorCode === 'empty_final_text'
                                    "
                                    class="or3-doctor-message__notice"
                                >
                                    {{ message.error }}
                                </p>
                                <AssistantActivityLog
                                    v-if="doctorShowActivityLog(message)"
                                    :items="message.activityLog"
                                />
                                <div
                                    v-if="doctorApprovalIsPending(message)"
                                    class="or3-doctor-approval"
                                >
                                    <div class="or3-doctor-approval__copy">
                                        <p class="or3-doctor-approval__title">
                                            Approval needed
                                        </p>
                                        <p class="or3-doctor-approval__detail">
                                            {{
                                                approvalSummaryFor(
                                                    message.approvalRequestId,
                                                )
                                            }}
                                        </p>
                                        <p
                                            v-if="
                                                approvalSubjectFor(
                                                    message.approvalRequestId,
                                                )
                                            "
                                            class="or3-doctor-approval__subject"
                                        >
                                            {{
                                                approvalSubjectFor(
                                                    message.approvalRequestId,
                                                )
                                            }}
                                        </p>
                                    </div>
                                    <div class="or3-doctor-approval__actions">
                                        <UButton
                                            size="xs"
                                            color="neutral"
                                            variant="ghost"
                                            icon="i-pixelarticons-close"
                                            :disabled="approvalBusy"
                                            label="Deny"
                                            @click="
                                                denyDoctorApproval(message.rawId)
                                            "
                                        />
                                        <UButton
                                            size="xs"
                                            color="neutral"
                                            variant="outline"
                                            icon="i-pixelarticons-check"
                                            :loading="approvalBusy"
                                            label="Approve"
                                            @click="
                                                approveDoctorApproval(
                                                    message.rawId,
                                                )
                                            "
                                        />
                                    </div>
                                </div>
                                <p
                                    v-else-if="message.approvalState === 'denied'"
                                    class="or3-doctor-message__notice"
                                >
                                    Approval denied. The tool call was not run.
                                </p>
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
                                        v-if="
                                            card.type === 'finding' ||
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
                                            :status="card.status"
                                            :error="card.error"
                                            :apply-state="
                                                doctorPlanApplyState(card)
                                            "
                                        >
                                            <template #actions>
                                                <UButton
                                                    size="xs"
                                                    color="neutral"
                                                    variant="ghost"
                                                    icon="i-pixelarticons-close"
                                                    label="Deny"
                                                    @click="
                                                        dismissDoctorPlan(
                                                            card.plan,
                                                        )
                                                    "
                                                />
                                                <UButton
                                                    v-if="card.plan.id"
                                                    size="xs"
                                                    :color="
                                                        doctorPlanApplyButtonColor(
                                                            card,
                                                        )
                                                    "
                                                    :variant="
                                                        doctorPlanApplyButtonVariant(
                                                            card,
                                                        )
                                                    "
                                                    :icon="
                                                        doctorPlanApplyButtonIcon(
                                                            card,
                                                        )
                                                    "
                                                    :disabled="
                                                        doctorPlanApplyDisabled(
                                                            card,
                                                        )
                                                    "
                                                    :loading="
                                                        planApplyingId ===
                                                        card.plan.id
                                                    "
                                                    :label="
                                                        doctorPlanApplyLabel(
                                                            card,
                                                        )
                                                    "
                                                    @click="
                                                        applyDoctorPlan(
                                                            card.plan,
                                                        )
                                                    "
                                                />
                                            </template>
                                        </SettingsChangePreviewCard>
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
                                        :auth-available="doctorAuthAvailable"
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
                    v-if="doctorApprovalHydrationError"
                    class="mb-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs leading-5 text-amber-800"
                >
                    {{ doctorApprovalHydrationError }}
                </p>
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
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
    useSettingsHealth,
    type HealthFinding,
    type HealthStatus,
} from '~/composables/settings/useSettingsHealth';
import { useApprovals } from '~/composables/useApprovals';
import { useAuthSession } from '~/composables/useAuthSession';
import {
    isDoctorEmptyFinalTextWarning,
    isDoctorTelemetryToolName,
    useDoctorAdminChat,
    buildDoctorChatDisplayMessages,
    doctorSummaryInParts,
    resolveDoctorMessageRef,
    type DoctorChatCard,
    type DoctorDisplayMessage,
} from '~/composables/useDoctorAdminChat';
import { useToast } from '@nuxt/ui/composables';
import type { AssistantSendPayload } from '~/types/app-state';
import type {
    ApprovalRequest,
    DoctorPlanApplyResponse,
    DoctorPostCheckResponse,
    DoctorSettingsChangePlan,
} from '~/types/or3-api';
import FindingCard from '~/components/settings/health/FindingCard.vue';
import { formatApprovalSubjectPreview } from '~/utils/or3/approval-display';
import {
    DOCTOR_PLAN_OUTCOME_STRIP_MS,
    formatDoctorPlanOutcomeMessage,
} from '~/utils/or3/doctor-plan-outcome';
import { resolveDoctorRunnerID } from '~/utils/doctorRunnerSelection';
import { scrubDoctorUserMessageContent } from '~/utils/doctor/doctorContent';
import { buildDoctorInvestigationPrompt } from '~/utils/doctor/doctorFixPrompt';
import { useDoctorApprovalHydration } from '~/composables/doctor/useDoctorApprovalHydration';

const router = useRouter();
defineProps<{ desktop?: boolean }>();
const toast = useToast();
const health = useSettingsHealth();
const chat = useDoctorAdminChat();
const approvals = useApprovals();
const {
    doctorApprovalHydrationError,
    hydratePendingDoctorApprovals,
    installDoctorApprovalHydrationWatcher,
} = useDoctorApprovalHydration();
const authSession = useAuthSession();
const draft = ref('');
const chatMode = ref<'ask' | 'work' | 'admin'>('admin');
const selectedRunnerId = ref('');
const selectedRunnerModel = ref('');
const selectedRunnerThinkingLevel = ref('');
const messageListRef = ref<HTMLElement | null>(null);
const planApplyResults = chat.planApplyResults;
const planApplyFailures = chat.planApplyFailures;
const planApplyingId = ref<string | null>(null);
const planOutcomeStrip = ref<{
    planId: string;
    message: string;
    rollbackId?: string;
} | null>(null);
const planOutcomeUndoing = ref(false);
let planOutcomeDismissTimer: ReturnType<typeof setTimeout> | null = null;
const planPostCheckResults = chat.planPostCheckResults;
const rememberApproval = ref<Record<string, boolean>>({});
const dismissedPlanKeys = ref<Record<string, boolean>>({});
const approvalBusy = ref(false);
const approvalDetails = ref<Record<string, ApprovalRequest>>({});
const approvalDetailLoading = new Set<string>();
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
const doctorSessionLocked = computed(() => Boolean(chat.sessionKey.value));

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

const doctorAuthAvailable = computed(() => {
    const capabilities = authSession.capabilities.value;
    if (!capabilities?.passkeysEnabled) return false;
    if (capabilities.webauthnAvailable === false) return false;
    return authSession.isAuthenticated.value;
});

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

type DoctorPlanApplyState =
    | 'ready'
    | 'needs_fix'
    | 'applied'
    | 'rolled_back'
    | 'failed';

const doctorChatMessages = computed(() =>
    buildDoctorChatDisplayMessages(chat.messages.value, {
        isCardDismissed: isDoctorCardDismissed,
        stripUserPrompt: scrubDoctorUserMessageContent,
    }).map((message) => ({
        ...message,
        activityLog: doctorShowActivityLog(message) ? message.activityLog : [],
    })),
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

function clearPlanOutcomeDismissTimer() {
    if (planOutcomeDismissTimer) {
        clearTimeout(planOutcomeDismissTimer);
        planOutcomeDismissTimer = null;
    }
}

function dismissPlanOutcomeStrip() {
    clearPlanOutcomeDismissTimer();
    planOutcomeStrip.value = null;
}

function showPlanOutcomeStrip(
    plan: DoctorSettingsChangePlan,
    result?: DoctorPlanApplyResponse | null,
) {
    if (!plan.id) return;
    clearPlanOutcomeDismissTimer();
    const rollbackId = String(result?.rollback_id ?? '').trim();
    planOutcomeStrip.value = {
        planId: plan.id,
        message: formatDoctorPlanOutcomeMessage(plan),
        rollbackId: rollbackId || undefined,
    };
    planOutcomeDismissTimer = setTimeout(() => {
        planOutcomeStrip.value = null;
        planOutcomeDismissTimer = null;
    }, DOCTOR_PLAN_OUTCOME_STRIP_MS);
}

function clearConversation() {
    chat.clearMessages();
    dismissPlanOutcomeStrip();
    planApplyResults.value = {};
    planApplyFailures.value = {};
    planPostCheckResults.value = {};
    rememberApproval.value = {};
    dismissedPlanKeys.value = {};
}

function doctorHasOrderedParts(message: Pick<DoctorDisplayMessage, 'parts'>) {
    return message.parts.some((part) => {
        if (part.type === 'text') {
            return Boolean(String(part.content ?? '').trim());
        }
        return Boolean(part.name || part.toolCallId);
    });
}

function doctorMessageHasToolParts(message: Pick<DoctorDisplayMessage, 'parts'>) {
    return message.parts.some((part) => part.type === 'tool');
}

function doctorShowActivityLog(message: Pick<DoctorDisplayMessage, 'parts' | 'activityLog'>) {
    if (!message.activityLog.length) return false;
    return !doctorMessageHasToolParts(message);
}

function doctorPlanApplyState(card: DoctorChatCard): DoctorPlanApplyState {
    if (card.type !== 'plan' || !card.plan.id) return 'needs_fix';
    const planID = card.plan.id;
    const failure = planApplyFailures.value[planID];
    if (failure) return 'failed';
    const applied = planApplyResults.value[planID];
    if (applied) {
        if (applied.rolled_back) return 'rolled_back';
        return applied.ok === false ? 'failed' : 'applied';
    }
    if (!isDoctorPlanApplyable(card)) return 'needs_fix';
    return 'ready';
}

function doctorPlanApplyLabel(card: DoctorChatCard) {
    switch (doctorPlanApplyState(card)) {
        case 'ready':
            return 'Ready to apply';
        case 'needs_fix':
            return 'Needs fix';
        case 'applied':
            return 'Applied';
        case 'rolled_back':
            return 'Reverted';
        case 'failed':
            return 'Failed';
    }
}

function doctorApprovalIsPending(
    message: Pick<DoctorDisplayMessage, 'approvalRequestId' | 'approvalState'>,
) {
    if (!message.approvalRequestId) return false;
    const state = String(message.approvalState ?? 'pending');
    return state === 'pending' || state === 'retrying';
}

function doctorPlanApplyDisabled(card: DoctorChatCard) {
    const state = doctorPlanApplyState(card);
    return state === 'needs_fix' || state === 'applied';
}

function doctorPlanApplyButtonColor(card: DoctorChatCard) {
    switch (doctorPlanApplyState(card)) {
        case 'ready':
            return 'primary';
        case 'applied':
            return 'success';
        case 'rolled_back':
            return 'neutral';
        case 'failed':
            return 'error';
        default:
            return 'neutral';
    }
}

function doctorPlanApplyButtonVariant(card: DoctorChatCard) {
    switch (doctorPlanApplyState(card)) {
        case 'ready':
            return 'solid';
        case 'applied':
            return 'soft';
        case 'failed':
            return 'outline';
        default:
            return 'outline';
    }
}

function doctorPlanApplyButtonIcon(card: DoctorChatCard) {
    switch (doctorPlanApplyState(card)) {
        case 'ready':
            return 'i-pixelarticons-check-double';
        case 'applied':
            return 'i-pixelarticons-check';
        case 'failed':
            return 'i-pixelarticons-alert';
        default:
            return 'i-pixelarticons-edit';
    }
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

function isDoctorPlanApplyable(card: DoctorChatCard) {
    if (card.type !== 'plan') return false;
    if (!card.plan.id || card.ok === false || card.error) return false;
    return !(card.plan.validation_results ?? []).some(
        (result) => result.status === 'fail' || result.status === 'error',
    );
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
    planApplyingId.value = plan.id;
    try {
        const result = await chat.applyPlan(plan, {
            rememberForMinutes: rememberApproval.value[doctorPlanKey(plan)]
                ? 5
                : 0,
        });
        if (!result) return;
        const nextFailures = { ...planApplyFailures.value };
        delete nextFailures[plan.id];
        planApplyFailures.value = nextFailures;
        planApplyResults.value = {
            ...planApplyResults.value,
            [plan.id]: result,
        };
        if (result.ok === false) {
            planApplyFailures.value = {
                ...planApplyFailures.value,
                [plan.id]:
                    chat.error.value ||
                    'Doctor could not apply this settings plan.',
            };
            toast.add({
                title: 'Plan not applied',
                description:
                    planApplyFailures.value[plan.id] ||
                    'Doctor could not apply this settings plan.',
                color: 'error',
                icon: 'i-pixelarticons-alert',
            });
        } else {
            showPlanOutcomeStrip(plan, result);
        }
    } catch {
        planApplyFailures.value = {
            ...planApplyFailures.value,
            [plan.id]:
                chat.error.value ||
                'Doctor could not apply this settings plan.',
        };
        toast.add({
            title: 'Plan not applied',
            description: planApplyFailures.value[plan.id],
            color: 'error',
            icon: 'i-pixelarticons-alert',
        });
    } finally {
        planApplyingId.value = null;
    }
    await chat.loadSession().catch(() => undefined);
}

async function runDoctorPostChecks(planId?: string) {
    if (!planId) return;
    const result = await chat.runPostChecks(planId);
    if (!result) return;
    planPostCheckResults.value = {
        ...planPostCheckResults.value,
        [planId]: result,
    };
    await chat.loadSession().catch(() => undefined);
}

async function undoDoctorPlan(planId?: string) {
    if (!planId) return;
    const result = await chat.rollbackPlan(planId);
    planApplyResults.value = {
        ...planApplyResults.value,
        [planId]: { ...result, rolled_back: true },
    };
    if (planOutcomeStrip.value?.planId === planId) {
        dismissPlanOutcomeStrip();
    }
    await chat.loadSession().catch(() => undefined);
}

async function undoPlanOutcomeStrip() {
    if (!planOutcomeStrip.value || planOutcomeUndoing.value) return;
    const planId = planOutcomeStrip.value.planId;
    planOutcomeUndoing.value = true;
    try {
        await undoDoctorPlan(planId);
        toast.add({
            title: 'Changes reverted',
            description: 'The last settings update was rolled back.',
            color: 'success',
            icon: 'i-pixelarticons-check',
        });
    } catch {
        toast.add({
            title: 'Could not undo',
            description:
                chat.error.value || 'Doctor could not roll back this plan.',
            color: 'error',
            icon: 'i-pixelarticons-alert',
        });
    } finally {
        planOutcomeUndoing.value = false;
    }
}

async function approveDoctorApproval(messageID: number | string) {
    if (approvalBusy.value) return;
    approvalBusy.value = true;
    try {
        await chat.approvePendingApproval(messageID);
    } finally {
        approvalBusy.value = false;
        await nextTick();
        scrollDoctorMessagesToBottom();
    }
}

async function denyDoctorApproval(messageID: number | string) {
    if (approvalBusy.value) return;
    approvalBusy.value = true;
    try {
        await chat.denyPendingApproval(messageID);
    } finally {
        approvalBusy.value = false;
    }
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
    void sendDoctorMessage({
        text: card.what_i_found || 'Doctor finding',
        transportText: buildDoctorInvestigationPrompt(card),
    });
}

function stopDoctorMessage() {
    chat.stopStreaming();
}

function approvalKey(id: number | string | undefined) {
    return String(id ?? '').trim();
}

function approvalDetailFor(id: number | string | undefined) {
    const key = approvalKey(id);
    return key ? approvalDetails.value[key] : undefined;
}

function approvalSubjectFor(id: number | string | undefined) {
    const approval = approvalDetailFor(id);
    if (!approval) return '';
    return formatApprovalSubjectPreview({
        type: approval.type,
        domain: approval.domain,
        subject: approval.subject,
    });
}

function approvalSummaryFor(id: number | string | undefined) {
    const key = approvalKey(id);
    const approval = approvalDetailFor(id);
    const type = String(approval?.type || approval?.domain || '').trim();
    const label =
        type === 'exec'
            ? 'Run a local command'
            : type === 'skill_exec' || type === 'skill_execution'
              ? 'Run a skill script'
              : type === 'tool_quota'
                ? 'Continue after a tool-call limit'
                : type
                  ? `Approve ${type}`
                  : 'Continue this doctor turn';
    return key ? `${label} (request #${key}).` : `${label}.`;
}

async function loadApprovalDetail(id: number | string | undefined) {
    const key = approvalKey(id);
    if (!key || approvalDetails.value[key] || approvalDetailLoading.has(key))
        return;
    approvalDetailLoading.add(key);
    try {
        const approval = await approvals.fetchApproval(key);
        approvalDetails.value = {
            ...approvalDetails.value,
            [key]: approval,
        };
    } catch {
        /* The card can still approve/deny by id; details are best-effort. */
    } finally {
        approvalDetailLoading.delete(key);
    }
}

// Type guard helper for HealthStatus consumer (silences unused warning).
function _typeKeep(_value: HealthStatus) {
    return _value;
}
void _typeKeep;

onMounted(() => {
    chat.clearError();
    installDoctorApprovalHydrationWatcher();
    void health.run();
    void chat.loadAdminBrain().catch(() => undefined);
    void refreshRunners().catch(() => undefined);
    void chat.hydratePersistedSession().catch(() => undefined);
});

watch(
    () => chat.loading.value,
    (loading, wasLoading) => {
        if (wasLoading && !loading) {
            void hydratePendingDoctorApprovals();
        }
    },
);

onUnmounted(() => {
    clearPlanOutcomeDismissTimer();
    chat.stopStreaming();
});

watch(
    [doctorChatMessages, () => chat.loading.value],
    async () => {
        await nextTick();
        scrollDoctorMessagesToBottom();
    },
);

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

watch(
    doctorChatMessages,
    (items) => {
        for (const message of items) {
            if (message.approvalRequestId) {
                void loadApprovalDetail(message.approvalRequestId);
            }
        }
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
    box-sizing: border-box;
    padding-top: 0.5rem;
    padding-bottom: calc(6.5rem + env(safe-area-inset-bottom, 0px));
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
    width: 10rem;
    height: 10rem;
    border-radius: 1.25rem;
    overflow: hidden;
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
    position: relative;
    z-index: 2;
    padding-top: 0.5rem;
    padding-bottom: 0.25rem;
}

.or3-doctor-chat-pane {
    display: flex;
    flex-direction: column;
    width: 100%;
    min-height: 100%;
    max-height: 100%;
}

.or3-doctor-outcome-strip {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    width: min(48rem, 100%);
    max-width: calc(100% - 2rem);
    margin: 0 auto 0.75rem;
    padding: 0.7rem 0.85rem;
    border-radius: 0.9rem;
    border: 1px solid color-mix(in srgb, var(--or3-green) 38%, var(--or3-border));
    background: color-mix(in srgb, var(--or3-green-soft) 88%, white);
    box-shadow: 0 6px 18px rgba(16, 24, 16, 0.08);
    animation: or3-doctor-outcome-enter 0.22s ease-out;
}

.or3-doctor-outcome-strip__main {
    display: flex;
    align-items: flex-start;
    gap: 0.55rem;
    min-width: 0;
}

.or3-doctor-outcome-strip__icon {
    width: 1rem;
    height: 1rem;
    margin-top: 0.1rem;
    flex-shrink: 0;
    color: var(--or3-green-dark);
}

.or3-doctor-outcome-strip__message {
    margin: 0;
    font-size: 0.8125rem;
    line-height: 1.45;
    color: var(--or3-text);
}

.or3-doctor-outcome-strip__actions {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex-shrink: 0;
}

.or3-doctor-outcome-strip__undo {
    border: 0;
    background: transparent;
    padding: 0.2rem 0.35rem;
    font-family:
        ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
        'Liberation Mono', 'Courier New', monospace;
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--or3-green-dark);
    cursor: pointer;
}

.or3-doctor-outcome-strip__undo:disabled {
    opacity: 0.55;
    cursor: default;
}

.or3-doctor-outcome-strip__dismiss {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border: 0;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.55);
    color: var(--or3-text-muted);
    cursor: pointer;
}

.or3-doctor-outcome-strip__dismiss:hover {
    color: var(--or3-text);
    background: rgba(255, 255, 255, 0.85);
}

@keyframes or3-doctor-outcome-enter {
    from {
        opacity: 0;
        transform: translateY(-0.35rem);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.or3-doctor-message-list {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    flex: 1;
    min-height: 0;
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

@media (max-width: 767px) {
    .or3-doctor-body {
        padding-right: max(calc(var(--or3-safe-right) + 1rem), 1rem);
        padding-left: max(calc(var(--or3-safe-left) + 1rem), 1rem);
    }

    .or3-doctor-empty {
        max-width: none;
        padding-top: 0.75rem;
    }

    .or3-doctor-empty__hero {
        padding-top: 0.5rem;
    }

    .or3-doctor-message {
        max-width: 100%;
    }
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

.or3-doctor-message--attention .or3-doctor-message__bubble {
    border-color: color-mix(in srgb, var(--or3-amber) 38%, var(--or3-border));
    background: color-mix(in srgb, var(--or3-amber-soft) 24%, white 76%);
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

.or3-doctor-message__tool {
    width: 100%;
}

.or3-doctor-message__summary {
    font-size: 0.9375rem;
    line-height: 1.55;
    color: var(--or3-text);
}

.or3-doctor-message__summary--after-tools {
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid color-mix(in srgb, var(--or3-border) 82%, transparent);
}

.or3-doctor-message__summary--attention {
    padding: 0.65rem 0.75rem;
    border-radius: 0.8rem;
    border: 1px solid color-mix(in srgb, var(--or3-amber) 35%, var(--or3-border));
    background: color-mix(in srgb, var(--or3-amber-soft) 55%, white);
}

.or3-doctor-message__notice {
    margin-top: 0.55rem;
    font-size: 0.78rem;
    line-height: 1.4;
    color: var(--or3-text-muted);
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

.or3-doctor-approval {
    margin-top: 0.65rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    border: 1px solid color-mix(in srgb, var(--or3-amber) 35%, var(--or3-border));
    border-radius: 0.8rem;
    background: color-mix(in srgb, var(--or3-amber-soft) 70%, white);
    padding: 0.7rem 0.8rem;
}

.or3-doctor-approval__copy {
    min-width: 0;
}

.or3-doctor-approval__title {
    font-family: var(--or3-font-mono);
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--or3-text);
}

.or3-doctor-approval__detail {
    margin-top: 0.15rem;
    font-size: 0.78rem;
    line-height: 1.35;
    color: var(--or3-text-muted);
}

.or3-doctor-approval__subject {
    margin-top: 0.35rem;
    overflow-wrap: anywhere;
    font-family: var(--or3-font-mono);
    font-size: 0.78rem;
    line-height: 1.35;
    color: var(--or3-text);
}

.or3-doctor-approval__actions {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 0.4rem;
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
