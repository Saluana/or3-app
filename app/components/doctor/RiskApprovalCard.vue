<template>
    <div class="space-y-3 rounded-xl border px-3 py-3 text-sm" :class="toneClass">
        <div class="flex items-start gap-2">
            <Icon name="i-pixelarticons-shield" class="mt-0.5 size-4 shrink-0" />
            <div class="min-w-0 flex-1">
                <p class="font-mono font-semibold">{{ title }}</p>
                <p class="mt-0.5 text-xs leading-5">{{ message }}</p>
            </div>
        </div>
        <label v-if="allowRemember" class="flex items-start gap-2 text-xs leading-5">
            <input
                :checked="remember"
                type="checkbox"
                class="mt-1"
                @change="onRememberChange"
            />
            <span>Yes, and don't ask again for 5 minutes on this device for matching {{ scopeLabel }} changes.</span>
        </label>
        <NuxtLink
            v-if="requiresSetup"
            to="/settings/passkeys"
            class="inline-flex rounded-full border border-current px-2 py-1 font-mono text-[11px] uppercase tracking-wide"
        >
            Set up passkey or PIN
        </NuxtLink>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
    riskLevel?: string;
    requiresApproval?: boolean;
    requiresStepUp?: boolean;
    remember?: boolean;
    authAvailable?: boolean;
    scopeLabel?: string;
}>();

const emit = defineEmits<{ 'update:remember': [value: boolean] }>();

const risk = computed(() => props.riskLevel ?? 'notice');
const title = computed(() =>
    props.requiresApproval || risk.value === 'danger' || risk.value === 'warning'
        ? 'Approval required'
        : 'Review before applying',
);
const message = computed(() => {
    if (requiresSetup.value) {
        return 'This change cannot be applied until passkey or PIN verification is set up.';
    }
    if (props.requiresStepUp) {
        return 'OR3 will ask for a recent passkey or PIN verification before applying this change.';
    }
    return 'Review the risk and exact diff before applying this Doctor plan.';
});
const requiresSetup = computed(() => props.authAvailable === false && Boolean(props.requiresApproval || props.requiresStepUp));
const allowRemember = computed(() => !requiresSetup.value && Boolean(props.requiresApproval || props.requiresStepUp));
const scopeLabel = computed(() => props.scopeLabel || risk.value);
const toneClass = computed(() =>
    risk.value === 'danger' || risk.value === 'warning'
        ? 'border-rose-200 bg-rose-50 text-rose-800'
        : 'border-amber-200 bg-amber-50 text-amber-800',
);

function onRememberChange(event: Event) {
    emit('update:remember', Boolean((event.target as HTMLInputElement | null)?.checked));
}
</script>
