<template>
    <AppShell
        desktop-title="Approval autopilot"
        desktop-subtitle="Choose what OR3 can approve by itself."
    >
        <template #sidebar>
            <SettingsSidebar />
        </template>
        <AppHeader subtitle="SETTINGS · APPROVAL AUTOPILOT" />

        <div class="space-y-4 pb-20">
            <SurfaceCard
                v-if="!loading && !available"
                padded
                class-name="space-y-3"
            >
                <p class="font-mono text-base font-semibold text-(--or3-text)">
                    Approval autopilot needs a newer OR3 host
                </p>
                <p class="text-sm leading-6 text-(--or3-text-muted)">
                    Update OR3 Intern on this computer to use automatic approval
                    review settings.
                </p>
                <UButton to="/settings" color="neutral" variant="outline">
                    Back to settings
                </UButton>
            </SurfaceCard>

            <template v-else>
                <SurfaceCard padded class-name="or3-autopilot-hero space-y-4">
                    <button
                        type="button"
                        class="inline-flex items-center gap-1 text-sm font-medium text-(--or3-green)"
                        @click="goBack"
                    >
                        <Icon name="i-pixelarticons-chevron-left" class="size-4" />
                        Safety &amp; Privacy
                    </button>
                    <div class="flex items-start gap-3">
                        <span class="or3-autopilot-hero__icon">
                            <Icon name="i-pixelarticons-shield" class="size-6" />
                        </span>
                        <div class="min-w-0 flex-1">
                            <div class="flex flex-wrap items-center gap-2">
                                <h1 class="font-mono text-xl font-semibold text-(--or3-text)">
                                    Approval autopilot
                                </h1>
                                <StatusPill
                                    :label="draft.enabled ? 'on' : 'off'"
                                    :tone="draft.enabled ? 'green' : 'neutral'"
                                />
                            </div>
                            <p class="mt-2 text-sm leading-6 text-(--or3-text-muted)">
                                {{ statusHeadline(draft.enabled, uiPreset) }}
                            </p>
                        </div>
                        <USwitch
                            :model-value="draft.enabled"
                            color="primary"
                            @update:model-value="setEnabled"
                        />
                    </div>
                </SurfaceCard>

                <SurfaceCard padded class-name="space-y-4">
                    <div>
                        <p class="font-mono text-base font-semibold text-(--or3-text)">
                            How much should OR3 handle?
                        </p>
                        <p class="mt-1 text-sm leading-6 text-(--or3-text-muted)">
                            Pick a preset first. You can add custom rules below.
                        </p>
                    </div>
                    <ModeratorPresetPicker
                        :model-value="uiPreset"
                        @select="onPresetSelected"
                    />
                </SurfaceCard>

                <SurfaceCard padded class-name="space-y-4">
                    <div>
                        <p class="font-mono text-base font-semibold text-(--or3-text)">
                            What each level means
                        </p>
                        <p class="mt-1 text-sm leading-6 text-(--or3-text-muted)">
                            Practical examples for low through extreme risk.
                        </p>
                    </div>
                    <ModeratorRiskMatrix
                        :preset="draft.preset"
                        :actions="draft.actions"
                    />
                </SurfaceCard>

                <SurfaceCard padded class-name="space-y-4">
                    <div>
                        <p class="font-mono text-base font-semibold text-(--or3-text)">
                            Your extra rules
                        </p>
                        <p class="mt-1 text-sm leading-6 text-(--or3-text-muted)">
                            Plain-language rules OR3's reviewer follows. Built-in
                            safety blocks still win.
                        </p>
                    </div>
                    <ModeratorPolicyEditor
                        v-model="draft.userPolicy"
                        :dirty="policyDirty"
                    />
                </SurfaceCard>

                <SurfaceCard padded class-name="space-y-4">
                    <button
                        type="button"
                        class="flex w-full items-center justify-between gap-3 text-left"
                        @click="advancedOpen = !advancedOpen"
                    >
                        <div>
                            <p class="font-mono text-base font-semibold text-(--or3-text)">
                                Advanced
                            </p>
                            <p class="mt-1 text-sm leading-6 text-(--or3-text-muted)">
                                Reviewer model, timeout, failure behavior, and per-risk overrides.
                            </p>
                        </div>
                        <Icon
                            :name="
                                advancedOpen
                                    ? 'i-pixelarticons-chevron-up'
                                    : 'i-pixelarticons-chevron-down'
                            "
                            class="size-5 text-(--or3-text-muted)"
                        />
                    </button>

                    <div v-if="advancedOpen" class="space-y-4 border-t border-(--or3-border) pt-4">
                        <ModeratorReviewerControls
                            :provider="draft.provider"
                            :model="draft.model"
                            @update:provider="draft.provider = $event"
                            @update:model="draft.model = $event"
                        />
                        <label class="block space-y-2">
                            <span class="text-sm font-medium text-(--or3-text)">Review timeout (seconds)</span>
                            <UInput v-model.number="draft.timeoutSeconds" type="number" min="1" />
                        </label>
                        <label class="block space-y-2">
                            <span class="text-sm font-medium text-(--or3-text)">If review fails</span>
                            <USelectMenu
                                v-model="draft.failureAction"
                                :items="failureOptions"
                                value-key="value"
                                :search-input="false"
                            />
                        </label>
                        <div class="space-y-3">
                            <p class="text-sm font-medium text-(--or3-text)">
                                Per-risk overrides
                            </p>
                            <div
                                v-for="row in riskOverrideRows"
                                :key="row.key"
                                class="grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-center"
                            >
                                <span class="text-sm text-(--or3-text-muted)">{{ row.label }}</span>
                                <USelectMenu
                                    :id="`moderator-action-${row.key}`"
                                    :model-value="riskActionMenuValue(row.key)"
                                    :items="actionOptions"
                                    value-key="value"
                                    :search-input="false"
                                    @update:model-value="
                                        (value) => setRiskAction(row.key, value)
                                    "
                                />
                            </div>
                        </div>
                    </div>
                </SurfaceCard>

                <DangerCallout
                    v-if="saveError"
                    tone="caution"
                    title="Could not save approval autopilot"
                >
                    {{ saveError }}
                </DangerCallout>

                <SurfaceCard
                    v-if="pendingChanges.length"
                    tone="tip"
                    class-name="space-y-3 sticky z-30 bottom-[calc(var(--or3-safe-bottom)+5.75rem)]"
                >
                    <p class="font-mono text-sm font-semibold text-(--or3-text)">
                        {{ pendingChanges.length }} pending change{{
                            pendingChanges.length === 1 ? '' : 's'
                        }}
                    </p>
                    <p class="text-xs leading-5 text-(--or3-text-muted)">
                        {{ saveSummary }}
                    </p>
                    <div class="flex items-center justify-end gap-2">
                        <UButton
                            size="sm"
                            color="neutral"
                            variant="outline"
                            label="Discard"
                            @click="discardDraft"
                        />
                        <UButton
                            size="sm"
                            color="primary"
                            label="Review & save"
                            icon="i-pixelarticons-arrow-right"
                            @click="reviewing = true"
                        />
                    </div>
                </SurfaceCard>

                <SettingSaveReview
                    v-if="reviewing"
                    :changes="pendingChanges"
                    :error="saveError"
                    :saving="saving"
                    @cancel="reviewing = false"
                    @confirm="confirmSave"
                />
            </template>
        </div>
    </AppShell>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, shallowRef } from 'vue';
import type { ConfigureField } from '~/types/or3-api';
import { useConfigure } from '~/composables/useConfigure';
import {
    MODERATOR_FIELD_KEYS,
    applyModeratorPresetSelection,
    buildModeratorPendingChanges,
    cloneModeratorDraft,
    detectUiPreset,
    hasModeratorConfigureFields,
    shouldApplyModeratorPreset,
    moderatorPresetSummary,
    moderatorConfigureChangesFromPending,
    readConfigureBoolean,
    readConfigureNumber,
    readConfigureString,
    readModeratorActions,
    statusHeadline,
    type ModeratorAction,
    type ModeratorActionMap,
    type ModeratorBackendPreset,
    type ModeratorDraftState,
} from '~/utils/or3/moderator-settings';

const INHERIT_ACTION_MENU_VALUE = 'inherit';

type ModeratorActionKey = keyof ModeratorActionMap;

const router = useRouter();
const { fields, loadFields, applyChanges } = useConfigure();

const loading = ref(true);
const saving = ref(false);
const reviewing = ref(false);
const saveError = ref<string | null>(null);
const advancedOpen = ref(false);
const saved = shallowRef<ModeratorDraftState | null>(null);
const draft = reactive<ModeratorDraftState>({
    enabled: false,
    preset: 'balanced',
    provider: '',
    model: '',
    timeoutSeconds: 8,
    failureAction: 'escalate',
    userPolicy: '',
    actions: { low: '', medium: '', high: '', extreme: '' },
});

const failureOptions = [
    { label: 'Ask me (escalate)', value: 'escalate' },
    { label: 'Block the action (deny)', value: 'deny' },
];

const actionOptions = [
    { label: 'Inherit preset', value: INHERIT_ACTION_MENU_VALUE },
    { label: 'OR3 handles this', value: 'approve' },
    { label: 'OR3 asks you first', value: 'escalate' },
    { label: 'OR3 blocks this', value: 'deny' },
];

function riskActionMenuValue(key: ModeratorActionKey): string {
    return draft.actions[key] || INHERIT_ACTION_MENU_VALUE;
}

function setRiskAction(key: ModeratorActionKey, value: string) {
    draft.actions[key] =
        value === INHERIT_ACTION_MENU_VALUE
            ? ''
            : (value as ModeratorAction);
}

function setDraftActions(actions: ModeratorActionMap) {
    draft.actions.low = actions.low;
    draft.actions.medium = actions.medium;
    draft.actions.high = actions.high;
    draft.actions.extreme = actions.extreme;
}

const riskOverrideRows = [
    { key: 'low' as const, label: 'Low risk' },
    { key: 'medium' as const, label: 'Medium risk' },
    { key: 'high' as const, label: 'High risk' },
    { key: 'extreme' as const, label: 'Extreme risk' },
];

const available = computed(() => hasModeratorConfigureFields(fields.value));

const uiPreset = computed(() =>
    detectUiPreset({
        preset: draft.preset,
        actions: draft.actions,
    }),
);

const policyDirty = computed(
    () => (saved.value?.userPolicy ?? '') !== draft.userPolicy,
);

const pendingChanges = computed(() => {
    if (!saved.value) return [];
    return buildModeratorPendingChanges(
        saved.value,
        draft,
        fields.value,
    );
});

const saveSummary = computed(() => {
    if (!pendingChanges.value.length) return '';
    const presetChange = pendingChanges.value.find(
        (change) => change.field === MODERATOR_FIELD_KEYS.preset,
    );
    if (presetChange) {
        return moderatorPresetSummary(String(presetChange.value));
    }
    if (
        pendingChanges.value.some(
            (change) => change.field === MODERATOR_FIELD_KEYS.userPolicy,
        )
    ) {
        return 'Custom approval rules updated.';
    }
    return 'Review the plain-language summary before saving.';
});

function draftFromFields(source: readonly ConfigureField[]): ModeratorDraftState {
    return {
        enabled: readConfigureBoolean(source, MODERATOR_FIELD_KEYS.enabled),
        preset:
            readConfigureString(source, MODERATOR_FIELD_KEYS.preset, 'balanced') ||
            'balanced',
        provider: readConfigureString(source, MODERATOR_FIELD_KEYS.provider),
        model: readConfigureString(source, MODERATOR_FIELD_KEYS.model),
        timeoutSeconds: readConfigureNumber(
            source,
            MODERATOR_FIELD_KEYS.timeout,
            8,
        ),
        failureAction: readConfigureString(
            source,
            MODERATOR_FIELD_KEYS.failureAction,
            'escalate',
        ),
        userPolicy: readConfigureString(source, MODERATOR_FIELD_KEYS.userPolicy),
        actions: readModeratorActions(source),
    };
}

function applyDraft(next: ModeratorDraftState) {
    draft.enabled = next.enabled;
    draft.preset = next.preset;
    draft.provider = next.provider;
    draft.model = next.model;
    draft.timeoutSeconds = next.timeoutSeconds;
    draft.failureAction = next.failureAction;
    draft.userPolicy = next.userPolicy;
    setDraftActions(next.actions);
}

function discardDraft() {
    if (saved.value) applyDraft(cloneModeratorDraft(saved.value));
    saveError.value = null;
    reviewing.value = false;
}

function setEnabled(value: boolean) {
    draft.enabled = value;
}

function onPresetSelected(value: ModeratorBackendPreset | 'custom') {
    if (value === 'custom') return;
    if (!shouldApplyModeratorPreset(value, (message) => window.confirm(message))) {
        return;
    }
    applyModeratorPresetSelection(draft, value);
}

function goBack() {
    router.push('/settings/section/safety');
}

async function loadModeratorSettings() {
    loading.value = true;
    saveError.value = null;
    try {
        await loadFields('security');
        const next = draftFromFields(fields.value);
        saved.value = cloneModeratorDraft(next);
        applyDraft(next);
    } catch (error: any) {
        saveError.value = error?.message ?? 'Unable to load approval autopilot.';
    } finally {
        loading.value = false;
    }
}

async function confirmSave() {
    if (!pendingChanges.value.length) {
        reviewing.value = false;
        return;
    }
    saving.value = true;
    saveError.value = null;
    try {
        await applyChanges(
            moderatorConfigureChangesFromPending(pendingChanges.value, fields.value),
        );
        await loadFields('security');
        const next = draftFromFields(fields.value);
        saved.value = cloneModeratorDraft(next);
        applyDraft(next);
        reviewing.value = false;
    } catch (error: any) {
        saveError.value =
            error?.message ?? 'Unable to save approval autopilot settings.';
    } finally {
        saving.value = false;
    }
}

onMounted(loadModeratorSettings);
</script>

<style scoped>
.or3-autopilot-hero__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 14px;
    background: var(--or3-green-soft);
    color: var(--or3-green-dark);
    flex-shrink: 0;
}
</style>
