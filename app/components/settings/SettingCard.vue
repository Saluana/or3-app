<template>
    <SurfaceCard
        v-if="framed"
        :id="`setting-${control.key}`"
        :class-name="cardClass"
    >
        <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
                <p class="font-mono text-sm font-semibold text-(--or3-text)">
                    {{ control.label }}
                </p>
                <p class="mt-1 text-xs leading-5 text-(--or3-text-muted)">
                    {{ control.description }}
                </p>
            </div>
            <!--
              Toggle controls render their switch in the header so the
              affordance is always visible next to the label, instead of
              hiding it down below where users miss it.
            -->
            <USwitch
                v-if="isToggleControl"
                :model-value="toggleValue"
                class="shrink-0 mt-0.5"
                @update:model-value="onToggle"
            />
            <span
                v-else-if="control.kind === 'secret'"
                class="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800"
                >secret</span
            >
        </div>

        <SettingImpactLabels :impacts="control.impacts" />

        <p
            v-if="control.recommended"
            class="inline-flex w-fit items-center gap-1 rounded-full border border-(--or3-green) bg-(--or3-green-soft) px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-(--or3-green-dark)"
        >
            <Icon name="i-pixelarticons-check" class="size-3" />
            Recommended:
            {{ control.recommended.label ?? String(control.recommended.value) }}
        </p>

        <!-- Body (toggle is rendered in the header above) -->
        <div v-if="!isToggleControl">
            <PresetSlider
                v-if="control.kind === 'preset-slider'"
                :label="control.label"
                :presets="control.presets ?? []"
                :active-id="activePresetId"
                @select="onPresetSelect"
                @custom="onCustom"
            />

            <UInput
                v-else-if="control.kind === 'secret'"
                type="password"
                :model-value="String(currentValue ?? '')"
                placeholder="Paste your key here"
                @update:model-value="onTextInput"
            />

            <UInput
                v-else-if="control.kind === 'path'"
                :model-value="String(currentValue ?? '')"
                placeholder="/path/to/folder"
                @update:model-value="onTextInput"
            />

            <USelectMenu
                v-else-if="control.kind === 'choice'"
                value-key="value"
                :items="choiceItems"
                :model-value="selectedChoiceValue"
                @update:model-value="onChoice"
            />

            <UInput
                v-else-if="control.kind === 'text'"
                :model-value="String(currentValue ?? '')"
                @update:model-value="onTextInput"
            />

            <ConnectionCard
                v-else-if="control.kind === 'connection-card'"
                :control="control"
                :current-value="currentValue"
                :value-index="valueIndex"
                @change="onChange"
            />

            <ProviderManagerControl
                v-else-if="control.kind === 'provider-manager'"
            />

            <ModelPickerControl
                v-else-if="control.kind === 'model-picker'"
                :control="control"
                :current-value="currentValue"
                :value-index="valueIndex"
                :pending-changes="pendingChanges ?? []"
                @change="onChange"
            />
        </div>

        <!-- Custom raw value editor for preset-sliders when in Custom mode. -->
        <div
            v-if="control.kind === 'preset-slider' && activePresetId === null"
            class="rounded-xl border border-dashed border-(--or3-border) bg-white/60 p-3"
        >
            <p
                class="mb-2 font-mono text-[11px] uppercase tracking-wide text-(--or3-text-muted)"
            >
                Custom values
            </p>
            <div class="space-y-2">
                <div
                    v-for="ref in control.fieldRefs"
                    :key="`${ref.section}-${ref.field}-${ref.channel ?? ''}`"
                    class="flex items-center justify-between gap-3"
                >
                    <code class="font-mono text-xs text-(--or3-text-muted)"
                        >{{ ref.section }}.{{ ref.field }}</code
                    >
                    <UInput
                        :model-value="String(rawValueAt(ref) ?? '')"
                        size="md"
                        class="w-32"
                        @update:model-value="
                            (value) => onRawFieldInput(ref, value)
                        "
                    />
                </div>
            </div>
        </div>

        <SettingAdvancedDetails
            :advanced-keys="control.advancedKeys"
            :value-index="valueIndex"
        />
    </SurfaceCard>
    <div v-else :id="`setting-${control.key}`" :class="inlineClass">
        <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
                <p class="font-mono text-sm font-semibold text-(--or3-text)">
                    {{ control.label }}
                </p>
                <p class="mt-1 text-xs leading-5 text-(--or3-text-muted)">
                    {{ control.description }}
                </p>
            </div>
            <USwitch
                v-if="isToggleControl"
                :model-value="toggleValue"
                class="shrink-0 mt-0.5"
                @update:model-value="onToggle"
            />
            <span
                v-else-if="control.kind === 'secret'"
                class="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800"
                >secret</span
            >
        </div>

        <SettingImpactLabels :impacts="control.impacts" />

        <p
            v-if="control.recommended"
            class="inline-flex w-fit items-center gap-1 rounded-full border border-(--or3-green) bg-(--or3-green-soft) px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-(--or3-green-dark)"
        >
            <Icon name="i-pixelarticons-check" class="size-3" />
            Recommended:
            {{ control.recommended.label ?? String(control.recommended.value) }}
        </p>

        <div v-if="!isToggleControl">
            <PresetSlider
                v-if="control.kind === 'preset-slider'"
                :label="control.label"
                :presets="control.presets ?? []"
                :active-id="activePresetId"
                @select="onPresetSelect"
                @custom="onCustom"
            />

            <UInput
                v-else-if="control.kind === 'secret'"
                type="password"
                :model-value="String(currentValue ?? '')"
                placeholder="Paste your key here"
                @update:model-value="onTextInput"
            />

            <UInput
                v-else-if="control.kind === 'path'"
                :model-value="String(currentValue ?? '')"
                placeholder="/path/to/folder"
                @update:model-value="onTextInput"
            />

            <USelectMenu
                v-else-if="control.kind === 'choice'"
                value-key="value"
                :items="choiceItems"
                :model-value="selectedChoiceValue"
                @update:model-value="onChoice"
            />

            <UInput
                v-else-if="control.kind === 'text'"
                :model-value="String(currentValue ?? '')"
                @update:model-value="onTextInput"
            />

            <ConnectionCard
                v-else-if="control.kind === 'connection-card'"
                :control="control"
                :current-value="currentValue"
                :value-index="valueIndex"
                @change="onChange"
            />

            <ProviderManagerControl
                v-else-if="control.kind === 'provider-manager'"
            />

            <ModelPickerControl
                v-else-if="control.kind === 'model-picker'"
                :control="control"
                :current-value="currentValue"
                :value-index="valueIndex"
                :pending-changes="pendingChanges ?? []"
                @change="onChange"
            />
        </div>

        <div
            v-if="control.kind === 'preset-slider' && activePresetId === null"
            class="rounded-xl border border-dashed border-(--or3-border) bg-white/60 p-3"
        >
            <p
                class="mb-2 font-mono text-[11px] uppercase tracking-wide text-(--or3-text-muted)"
            >
                Custom values
            </p>
            <div class="space-y-2">
                <div
                    v-for="ref in control.fieldRefs"
                    :key="`${ref.section}-${ref.field}-${ref.channel ?? ''}`"
                    class="flex items-center justify-between gap-3"
                >
                    <code class="font-mono text-xs text-(--or3-text-muted)"
                        >{{ ref.section }}.{{ ref.field }}</code
                    >
                    <UInput
                        :model-value="String(rawValueAt(ref) ?? '')"
                        size="md"
                        class="w-32"
                        @update:model-value="
                            (value) => onRawFieldInput(ref, value)
                        "
                    />
                </div>
            </div>
        </div>

        <SettingAdvancedDetails
            :advanced-keys="control.advancedKeys"
            :value-index="valueIndex"
        />
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import type {
    SimpleSettingChange,
    SimpleSettingControl,
    SimpleSettingPreset,
} from '../../settings/simpleSettings';
import { useSimpleSettings } from '../../composables/settings/useSimpleSettings';
import SurfaceCard from '../ui/SurfaceCard.vue';

const props = defineProps<{
    control: SimpleSettingControl;
    valueIndex: Record<string, unknown>;
    pendingChanges?: SimpleSettingChange[];
    /** Control key currently focused via deep link. */
    focusKey?: string | null;
    framed?: boolean;
}>();

const emit = defineEmits<{
    change: [changes: SimpleSettingChange[]];
}>();

const simple = useSimpleSettings();
const focused = ref(false);
const framed = computed(() => props.framed ?? true);

function focusIfMatch() {
    if (!props.focusKey || props.focusKey !== props.control.key) return;
    focused.value = true;
    if (typeof window !== 'undefined') {
        const el = document.getElementById(`setting-${props.control.key}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.setTimeout(() => {
            focused.value = false;
        }, 2400);
    }
}

onMounted(focusIfMatch);
watch(() => props.focusKey, focusIfMatch);

const cardClass = computed(() =>
    focused.value
        ? 'space-y-3 transition-shadow ring-2 ring-(--or3-green) ring-offset-2 ring-offset-(--or3-bg)'
        : 'space-y-3 transition-shadow',
);

const inlineClass = computed(() =>
    focused.value
        ? 'space-y-3 py-4 transition-shadow ring-2 ring-(--or3-green) ring-offset-2 ring-offset-(--or3-bg)'
        : 'space-y-3 py-4 transition-shadow',
);

const currentValue = computed(() =>
    simple.readPrimaryValue(props.control, props.pendingChanges ?? []),
);

const primaryBackendField = computed(() => {
    const ref = simple.availableFieldRef(props.control);
    if (!ref) return undefined;
    return simple.findField(ref.section, ref.field, ref.channel);
});

const isToggleControl = computed(() => {
    const kind = String(primaryBackendField.value?.kind ?? '').toLowerCase();
    return (
        props.control.kind === 'toggle' ||
        Boolean(props.control.toggle) ||
        ['toggle', 'boolean', 'bool', 'switch', 'checkbox'].includes(kind) ||
        typeof currentValue.value === 'boolean'
    );
});

// Coerce booleans, on/off strings, "true"/"false", and 1/0 into a clean
// boolean so the header USwitch always reflects the underlying value
// instead of getting stuck "on" via Boolean('off') === true.
const toggleValue = computed(() => {
    const raw = currentValue.value;
    if (typeof raw === 'boolean') return raw;
    if (typeof raw === 'number') return raw !== 0;
    if (typeof raw === 'string') {
        const n = raw.trim().toLowerCase();
        return n === 'true' || n === 'on' || n === '1' || n === 'yes';
    }
    return Boolean(raw);
});
const activePreset = computed<SimpleSettingPreset | null>(() =>
    simple.detectPreset(props.control, props.pendingChanges ?? []),
);
const activePresetId = computed<string | null>(
    () => activePreset.value?.id ?? null,
);

function rawValueAt(ref: {
    section: string;
    field: string;
    channel?: string;
}): unknown {
    return simple.readFieldValue(
        ref.section,
        ref.field,
        ref.channel,
        props.pendingChanges ?? [],
    );
}

function coerceNumberLike(v: string): unknown {
    if (v.trim() === '') return v;
    const n = Number(v);
    return Number.isFinite(n) ? n : v;
}

const choiceItems = computed(() => {
    const ref = simple.availableFieldRef(props.control);
    if (!ref) return [] as { label: string; value: string }[];
    const f = simple.findField(ref.section, ref.field, ref.channel);
    return (f?.choices ?? []).map((c) =>
        typeof c === 'string'
            ? { label: c, value: c }
            : { label: c.label ?? c.value, value: c.value },
    );
}) as unknown as import('vue').ComputedRef<{ label: string; value: string }[]>;

const selectedChoiceValue = computed(() => String(currentValue.value ?? ''));

function onPresetSelect(preset: SimpleSettingPreset) {
    emit('change', preset.changes);
}

function onCustom() {
    // No-op: stays in custom; user edits the raw fields below.
}

function onToggle(value: boolean) {
    if (!props.control.toggle) {
        const ref = simple.availableFieldRef(props.control);
        if (!ref) return;
        emit('change', [
            { section: ref.section, field: ref.field, channel: ref.channel, value },
        ]);
        return;
    }
    emit('change', [
        value ? props.control.toggle.on : props.control.toggle.off,
    ]);
}

function onTextInput(value: string) {
    const ref = simple.availableFieldRef(props.control);
    if (!ref) return;
    emit('change', [
        { section: ref.section, field: ref.field, channel: ref.channel, value },
    ]);
}

function onChoice(value: { value: string } | string | null) {
    const ref = simple.availableFieldRef(props.control);
    if (!ref) return;
    const v = typeof value === 'string' ? value : (value?.value ?? '');
    if (!v) return;
    emit('change', [
        {
            section: ref.section,
            field: ref.field,
            channel: ref.channel,
            value: v,
        },
    ]);
}

function onChange(change: SimpleSettingChange) {
    emit('change', [change]);
}

function onRawFieldInput(
    fieldRef: { section: string; field: string; channel?: string },
    value: string | number,
) {
    onChange({
        section: fieldRef.section,
        field: fieldRef.field,
        channel: fieldRef.channel,
        value: coerceNumberLike(String(value)),
    });
}
</script>
