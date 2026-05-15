<template>
    <SurfaceCard class-name="space-y-4">
        <div class="flex items-start gap-3">
            <div
                class="grid size-10 shrink-0 place-items-center rounded-xl border border-(--or3-border) bg-white/70"
            >
                <Icon
                    name="i-pixelarticons-lock"
                    class="size-5"
                    :class="
                        isEnabled
                            ? 'text-(--or3-green)'
                            : 'text-(--or3-text-muted)'
                    "
                />
            </div>
            <div class="min-w-0 flex-1">
                <p class="font-mono text-sm font-semibold text-(--or3-text)">
                    PIN Lock
                </p>
                <p class="mt-0.5 text-xs leading-5 text-(--or3-text-muted)">
                    Encrypt your paired computer tokens with a PIN. Keeps your
                    connection secure even if someone gets access to this
                    browser.
                </p>
            </div>
            <USwitch
                :model-value="isEnabled"
                class="shrink-0 mt-0.5"
                @update:model-value="toggle"
            />
        </div>

        <div
            v-if="showSetup"
            class="space-y-3 rounded-xl border border-(--or3-border) bg-white/70 p-4"
        >
            <p class="font-mono text-xs font-semibold text-(--or3-text)">
                {{
                    isEnabled && !changing
                        ? 'Disable PIN Lock'
                        : changing
                          ? 'Change PIN'
                          : 'Set PIN'
                }}
            </p>

            <div v-if="!isEnabled || changing" class="space-y-3">
                <div v-if="changing">
                    <label
                        class="mb-1 block font-mono text-[10px] uppercase tracking-wide text-(--or3-text-muted)"
                    >
                        Current PIN
                    </label>
                    <UInput
                        ref="currentPinInput"
                        v-model="currentPin"
                        type="password"
                        inputmode="numeric"
                        maxlength="6"
                        placeholder="Enter current PIN"
                        class="font-mono"
                        @keyup.enter="isEnabled ? changePinAction() : undefined"
                    />
                </div>
                <div>
                    <label
                        class="mb-1 block font-mono text-[10px] uppercase tracking-wide text-(--or3-text-muted)"
                    >
                        {{ changing ? 'New PIN' : 'PIN (4-6 digits)' }}
                    </label>
                    <UInput
                        ref="newPinInput"
                        v-model="newPin"
                        type="password"
                        inputmode="numeric"
                        maxlength="6"
                        placeholder="Enter a PIN"
                        class="font-mono"
                        @keyup.enter="
                            isEnabled ? changePinAction() : enablePinLock()
                        "
                    />
                </div>
                <div>
                    <label
                        class="mb-1 block font-mono text-[10px] uppercase tracking-wide text-(--or3-text-muted)"
                    >
                        Confirm PIN
                    </label>
                    <UInput
                        v-model="confirmPin"
                        type="password"
                        inputmode="numeric"
                        maxlength="6"
                        placeholder="Re-enter PIN"
                        class="font-mono"
                        @keyup.enter="
                            isEnabled ? changePinAction() : enablePinLock()
                        "
                    />
                </div>
            </div>

            <div v-else class="space-y-3">
                <div>
                    <label
                        class="mb-1 block font-mono text-[10px] uppercase tracking-wide text-(--or3-text-muted)"
                    >
                        Enter PIN to disable
                    </label>
                    <UInput
                        ref="currentPinInput"
                        v-model="currentPin"
                        type="password"
                        inputmode="numeric"
                        maxlength="6"
                        placeholder="Enter your PIN"
                        class="font-mono"
                        @keyup.enter="disablePinLock()"
                    />
                </div>
            </div>

            <p v-if="setupError" class="font-mono text-xs text-rose-700">
                {{ setupError }}
            </p>

            <div class="flex items-center justify-end gap-2">
                <UButton
                    size="sm"
                    color="neutral"
                    variant="outline"
                    label="Cancel"
                    @click="cancel"
                />
                <UButton
                    v-if="!isEnabled"
                    size="sm"
                    color="primary"
                    label="Enable"
                    :loading="working"
                    :disabled="!canSubmit"
                    @click="enablePinLock()"
                />
                <UButton
                    v-else-if="changing"
                    size="sm"
                    color="primary"
                    label="Change PIN"
                    :loading="working"
                    :disabled="!canChangePin"
                    @click="changePinAction()"
                />
                <UButton
                    v-else
                    size="sm"
                    color="primary"
                    variant="outline"
                    label="Disable"
                    :loading="working"
                    :disabled="!currentPin"
                    @click="disablePinLock()"
                />
            </div>
        </div>

        <div
            class="space-y-3 rounded-xl border border-(--or3-border) bg-white/70 p-4"
        >
            <div>
                <p class="font-mono text-xs font-semibold text-(--or3-text)">
                    Unlock grace period
                </p>
                <p class="mt-1 text-xs leading-5 text-(--or3-text-muted)">
                    Keep OR3 unlocked for a short time after you leave the app
                    so quick app switches do not prompt for your PIN again.
                </p>
            </div>

            <USelectMenu
                value-key="value"
                class="w-full"
                :items="unlockDurationOptions"
                :model-value="selectedUnlockDuration"
                @update:model-value="onUnlockDurationChange"
            />

            <p class="font-mono text-[11px] leading-5 text-(--or3-text-muted)">
                {{
                    isEnabled
                        ? 'Changes apply immediately for future app switches.'
                        : 'This will be used the next time you enable PIN lock.'
                }}
            </p>
        </div>

        <div
            v-if="isEnabled && !showSetup"
            class="rounded-xl border border-(--or3-green) bg-(--or3-green-soft) px-4 py-3"
        >
            <p class="font-mono text-xs text-(--or3-green-dark)">
                {{ unlockStatusMessage }}
            </p>
        </div>

        <div class="flex items-center justify-end gap-2">
            <UButton
                v-if="isEnabled && !showSetup"
                size="xs"
                color="neutral"
                variant="outline"
                label="Change PIN"
                icon="i-pixelarticons-edit"
                @click="startChange"
            />
            <UButton
                v-if="isEnabled"
                size="xs"
                color="neutral"
                variant="outline"
                :label="showSetup ? 'Cancel' : 'Disable'"
                icon="i-pixelarticons-lock-off"
                @click="showSetup ? cancel() : startDisable()"
            />
            <UButton
                v-if="!isEnabled"
                size="xs"
                color="neutral"
                variant="outline"
                :label="showSetup ? 'Cancel' : 'Set up PIN'"
                icon="i-pixelarticons-lock"
                @click="showSetup ? cancel() : startEnable()"
            />
        </div>
    </SurfaceCard>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import {
    PIN_UNLOCK_DEFAULT_MS,
    PIN_UNLOCK_IMMEDIATE_MS,
    changePin,
    disable,
    enable,
    setUnlockDuration,
    usePinLockState,
} from '../../composables/usePinLock';

const pinLock = usePinLockState();
const isEnabled = computed(() => pinLock.isEnabled.value);
const showSetup = ref(false);
const changing = ref(false);
const currentPin = ref('');
const newPin = ref('');
const confirmPin = ref('');
const setupError = ref<string | null>(null);
const working = ref(false);
const selectedUnlockDuration = ref(PIN_UNLOCK_DEFAULT_MS);
const currentPinInput = ref<any>(null);
const newPinInput = ref<any>(null);

const unlockDurationOptions = [
    { label: 'Ask every time', value: PIN_UNLOCK_IMMEDIATE_MS },
    { label: '5 minutes', value: 5 * 60 * 1000 },
    { label: '10 minutes', value: 10 * 60 * 1000 },
    { label: '30 minutes', value: 30 * 60 * 1000 },
    { label: '1 hour', value: 60 * 60 * 1000 },
];

onMounted(() => {
    pinLock.refresh();
});

watch(
    () => pinLock.unlockDurationMs.value,
    (value) => {
        selectedUnlockDuration.value = value ?? PIN_UNLOCK_DEFAULT_MS;
    },
    { immediate: true },
);

watch(
    () => showSetup.value,
    async (open) => {
        if (!open) return;
        await nextTick();
        focusInput(isEnabled.value ? currentPinInput.value : newPinInput.value);
    },
);

function focusInput(el: any) {
    const target = el?.$el?.querySelector?.('input') ?? el?.inputRef ?? el;
    target?.focus?.();
}

const canSubmit = computed(() => {
    return (
        newPin.value.length >= 4 &&
        newPin.value.length <= 6 &&
        /^\d+$/.test(newPin.value) &&
        newPin.value === confirmPin.value
    );
});

const canChangePin = computed(() => {
    return currentPin.value.length >= 4 && canSubmit.value;
});

const unlockDurationLabel = computed(() => {
    const match = unlockDurationOptions.find(
        (option) => option.value === selectedUnlockDuration.value,
    );
    if (match) return match.label;
    if (selectedUnlockDuration.value <= PIN_UNLOCK_IMMEDIATE_MS)
        return 'Ask every time';

    const totalMinutes = Math.round(selectedUnlockDuration.value / 60_000);
    if (totalMinutes < 60) {
        return `${totalMinutes} minute${totalMinutes === 1 ? '' : 's'}`;
    }

    const totalHours = Math.round(totalMinutes / 60);
    return `${totalHours} hour${totalHours === 1 ? '' : 's'}`;
});

const unlockStatusMessage = computed(() => {
    if (selectedUnlockDuration.value <= PIN_UNLOCK_IMMEDIATE_MS) {
        return 'PIN lock is active. Your tokens are encrypted and OR3 will ask for your PIN again whenever the app is reopened.';
    }

    return `PIN lock is active. Your tokens are encrypted and OR3 will stay unlocked for ${unlockDurationLabel.value.toLowerCase()} after you leave the app.`;
});

function cancel() {
    showSetup.value = false;
    changing.value = false;
    currentPin.value = '';
    newPin.value = '';
    confirmPin.value = '';
    setupError.value = null;
}

function startEnable() {
    showSetup.value = true;
    changing.value = false;
    currentPin.value = '';
    newPin.value = '';
    confirmPin.value = '';
    setupError.value = null;
}

function startChange() {
    showSetup.value = true;
    changing.value = true;
    currentPin.value = '';
    newPin.value = '';
    confirmPin.value = '';
    setupError.value = null;
}

function startDisable() {
    showSetup.value = true;
    changing.value = false;
    currentPin.value = '';
    newPin.value = '';
    confirmPin.value = '';
    setupError.value = null;
}

async function toggle(value: boolean) {
    if (value) {
        startEnable();
    } else {
        startDisable();
    }
}

async function enablePinLock() {
    if (!canSubmit.value || working.value) return;
    working.value = true;
    setupError.value = null;
    try {
        const result = await enable(newPin.value, selectedUnlockDuration.value);
        if (result.success) {
            cancel();
        } else {
            setupError.value = result.error ?? 'Failed to enable PIN lock.';
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setupError.value = `Failed to enable PIN lock. ${message || 'Please try again.'}`;
    } finally {
        working.value = false;
    }
}

async function disablePinLock() {
    if (!currentPin.value || working.value) return;
    working.value = true;
    setupError.value = null;
    try {
        const result = await disable(currentPin.value);
        if (result.success) {
            cancel();
        } else {
            setupError.value = result.error ?? 'Failed to disable PIN lock.';
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setupError.value = `Failed to disable PIN lock. ${message || 'Please try again.'}`;
    } finally {
        working.value = false;
    }
}

function onUnlockDurationChange(value: any) {
    const nextValue = Number(value?.value ?? value);
    selectedUnlockDuration.value = Number.isFinite(nextValue)
        ? nextValue
        : PIN_UNLOCK_DEFAULT_MS;

    if (isEnabled.value) {
        setUnlockDuration(selectedUnlockDuration.value);
        pinLock.refresh();
    }
}

async function changePinAction() {
    if (!canChangePin.value || working.value) return;
    working.value = true;
    setupError.value = null;
    try {
        const result = await changePin(currentPin.value, newPin.value);
        if (result.success) {
            cancel();
        } else {
            setupError.value = result.error ?? 'Failed to change PIN.';
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setupError.value = `Failed to change PIN. ${message || 'Please try again.'}`;
    } finally {
        working.value = false;
    }
}
</script>
