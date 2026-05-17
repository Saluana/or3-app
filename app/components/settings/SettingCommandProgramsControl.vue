<template>
    <div class="space-y-2">
        <div
            v-if="selectedPrograms.length"
            class="flex flex-wrap gap-1.5"
            aria-label="Allowed command programs"
        >
            <button
                v-for="program in selectedPrograms"
                :key="program"
                type="button"
                class="inline-flex max-w-full items-center gap-1 rounded-full border border-(--or3-green) bg-(--or3-green-soft) px-2 py-1 font-mono text-[11px] text-(--or3-text) transition hover:border-(--or3-red)"
                :title="`Remove ${program}`"
                @click="removeProgram(program)"
            >
                <span class="truncate">{{ program }}</span>
                <Icon
                    name="i-pixelarticons-close"
                    class="size-3 shrink-0 text-(--or3-text-muted)"
                />
            </button>
        </div>
        <p v-else class="text-xs text-(--or3-text-muted)">
            No command programs are allowed yet.
        </p>

        <UPopover
            :content="{ align: 'start', sideOffset: 8 }"
            :ui="{ content: 'w-[min(30rem,calc(100vw-2rem))] p-0' }"
            @update:open="onPopoverOpenChange"
        >
            <UButton
                color="neutral"
                variant="soft"
                icon="i-pixelarticons-plus"
                label="Add command"
            />

            <template #content>
                <div class="max-h-96 overflow-y-auto p-2">
                    <form
                        class="mb-2 flex gap-2 rounded-lg border border-(--or3-border) bg-white/70 p-2"
                        @submit.prevent="addCustomProgram"
                    >
                        <UInput
                            v-model="customProgram"
                            class="min-w-0 flex-1"
                            size="sm"
                            icon="i-pixelarticons-terminal"
                            placeholder="Custom command"
                            :tabindex="customInputTabIndex"
                            :ui="{ base: 'font-mono text-xs' }"
                            @pointerdown="customInputArmed = true"
                            @focusin="onCustomInputFocus"
                        />
                        <UButton
                            type="submit"
                            color="primary"
                            variant="soft"
                            size="sm"
                            icon="i-pixelarticons-plus"
                            label="Add"
                            :disabled="!canAddCustom"
                        />
                    </form>
                    <button
                        v-for="option in options"
                        :key="option.value"
                        type="button"
                        class="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-(--or3-green-soft)"
                        :class="{
                            'opacity-55': selectedSet.has(option.value),
                        }"
                        :disabled="selectedSet.has(option.value)"
                        @click="addProgram(option.value)"
                    >
                        <span
                            class="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border border-(--or3-border) bg-white/75"
                        >
                            <Icon
                                :name="
                                    selectedSet.has(option.value)
                                        ? 'i-pixelarticons-check'
                                        : 'i-pixelarticons-terminal'
                                "
                                class="size-3.5 text-(--or3-green-dark)"
                            />
                        </span>
                        <span class="min-w-0 flex-1">
                            <span
                                class="block font-mono text-xs font-semibold text-(--or3-text)"
                            >
                                {{ option.title }}
                                <code
                                    class="ml-1 rounded bg-white/70 px-1 py-0.5 text-[10px] text-(--or3-text-muted)"
                                >
                                    {{ option.value }}
                                </code>
                            </span>
                            <span
                                class="mt-0.5 block text-[11px] leading-4 text-(--or3-text-muted)"
                            >
                                {{ option.description }}
                            </span>
                        </span>
                    </button>
                </div>
            </template>
        </UPopover>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { SimpleSettingCommandOption } from '~/settings/simpleSettings';
import { useIsDesktop } from '~/composables/useViewport';

const props = defineProps<{
    modelValue: string;
    options: SimpleSettingCommandOption[];
}>();

const emit = defineEmits<{
    'update:modelValue': [value: string];
}>();

const selectedPrograms = computed(() =>
    props.modelValue
        .split(',')
        .map((program) => program.trim())
        .filter(Boolean),
);

const selectedSet = computed(() => new Set(selectedPrograms.value));
const customProgram = ref('');
const customInputArmed = ref(false);
const isDesktop = useIsDesktop();
const normalizedCustomProgram = computed(() => customProgram.value.trim());
const canAddCustom = computed(
    () =>
        Boolean(normalizedCustomProgram.value) &&
        !normalizedCustomProgram.value.includes(',') &&
        !selectedSet.value.has(normalizedCustomProgram.value),
);
const customInputTabIndex = computed(() =>
    !isDesktop.value && !customInputArmed.value ? -1 : undefined,
);

function commit(programs: string[]) {
    emit('update:modelValue', programs.join(','));
}

function addProgram(program: string) {
    if (selectedSet.value.has(program)) return;
    commit([...selectedPrograms.value, program]);
}

function addCustomProgram() {
    if (!canAddCustom.value) return;
    addProgram(normalizedCustomProgram.value);
    customProgram.value = '';
}

function onPopoverOpenChange(open: boolean) {
    if (!open || !isDesktop.value) customInputArmed.value = false;
}

function onCustomInputFocus(event: FocusEvent) {
    if (isDesktop.value || customInputArmed.value) return;
    if (event.target instanceof HTMLElement) event.target.blur();
}

function removeProgram(program: string) {
    commit(selectedPrograms.value.filter((item) => item !== program));
}
</script>
