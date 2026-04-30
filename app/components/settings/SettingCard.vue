<template>
    <SurfaceCard :id="`setting-${control.key}`" :class-name="cardClass">
        <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
                <p class="font-mono text-sm font-semibold text-(--or3-text)">
                    {{ control.label }}
                </p>
                <p class="mt-1 text-xs leading-5 text-(--or3-text-muted)">
                    {{ control.description }}
                </p>
            </div>
            <span
                v-if="control.kind === 'secret'"
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

        <!-- Body -->
        <div>
            <PresetSlider
                v-if="control.kind === 'preset-slider'"
                :label="control.label"
                :presets="control.presets ?? []"
                :active-id="activePresetId"
                @select="onPresetSelect"
                @custom="onCustom"
            />

            <USwitch
                v-else-if="control.kind === 'toggle'"
                :model-value="Boolean(currentValue)"
                @update:model-value="onToggle"
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
                :items="choiceItems"
                :model-value="selectedChoice"
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
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import type {
    SimpleSettingChange,
    SimpleSettingControl,
    SimpleSettingPreset,
} from '../../settings/simpleSettings';
import { useSimpleSettings } from '../../composables/settings/useSimpleSettings';

const props = defineProps<{
    control: SimpleSettingControl;
    valueIndex: Record<string, unknown>;
    /** Control key currently focused via deep link. */
    focusKey?: string | null;
}>();

const emit = defineEmits<{
    change: [changes: SimpleSettingChange[]];
}>();

const simple = useSimpleSettings();
const focused = ref(false);

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

const currentValue = computed(() => simple.readPrimaryValue(props.control));
const activePreset = computed<SimpleSettingPreset | null>(() =>
    simple.detectPreset(props.control),
);
const activePresetId = computed<string | null>(
    () => activePreset.value?.id ?? null,
);

function rawValueAt(ref: {
    section: string;
    field: string;
    channel?: string;
}): unknown {
    return simple.findField(ref.section, ref.field, ref.channel)?.value;
}

function coerceNumberLike(v: string): unknown {
    if (v.trim() === '') return v;
    const n = Number(v);
    return Number.isFinite(n) ? n : v;
}

const choiceItems = computed(() => {
    const ref = props.control.fieldRefs[0];
    if (!ref) return [] as { label: string; value: string }[];
    const f = simple.findField(ref.section, ref.field, ref.channel);
    return (f?.choices ?? []).map((c) =>
        typeof c === 'string'
            ? { label: c, value: c }
            : { label: c.label ?? c.value, value: c.value },
    );
}) as unknown as import('vue').ComputedRef<{ label: string; value: string }[]>;

const selectedChoice = computed(() =>
    choiceItems.value.find((c) => c.value === String(currentValue.value ?? '')),
);

function onPresetSelect(preset: SimpleSettingPreset) {
    emit('change', preset.changes);
}

function onCustom() {
    // No-op: stays in custom; user edits the raw fields below.
}

function onToggle(value: boolean) {
    if (!props.control.toggle) return;
    emit('change', [
        value ? props.control.toggle.on : props.control.toggle.off,
    ]);
}

function onTextInput(value: string) {
    const ref = props.control.fieldRefs[0];
    if (!ref) return;
    emit('change', [
        { section: ref.section, field: ref.field, channel: ref.channel, value },
    ]);
}

function onChoice(value: { value: string } | string | null) {
    const ref = props.control.fieldRefs[0];
    if (!ref) return;
    const v = typeof value === 'string' ? value : (value?.value ?? '');
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
