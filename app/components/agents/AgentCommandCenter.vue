<template>
    <SurfaceCard class-name="or3-command-center space-y-5" padded>
        <!-- Header: hero with mascot on a podium -->
        <header class="or3-cc-hero">
            <div class="or3-cc-hero__copy">
                <p class="or3-cc-eyebrow">
                    <Icon
                        name="i-pixelarticons-sparkles"
                        class="size-3.5"
                        aria-hidden="true"
                    />
                    <span>COMMAND CENTER</span>
                </p>
                <h2 class="or3-cc-title">
                    Delegate with
                    <span class="or3-cc-title__accent">confidence.</span>
                </h2>
                <p class="or3-cc-sub">
                    or3-intern handles the heavy lifting—research, summarize,
                    draft, and plan—so you can stay in your flow.
                </p>
            </div>
            <div class="or3-cc-stage" aria-hidden="true">
                <span class="or3-cc-stage__sparkle or3-cc-stage__sparkle--a" />
                <span class="or3-cc-stage__sparkle or3-cc-stage__sparkle--b" />
                <span class="or3-cc-stage__sparkle or3-cc-stage__sparkle--c" />
                <div class="or3-cc-stage__podium">
                    <span class="or3-cc-stage__glow" />
                    <RetroComputerMascot
                        :size="132"
                        src="/computer-icons/platform-guy.webp"
                        sparkle
                        class="or3-cc-stage__mascot"
                    />
                </div>
            </div>
        </header>

        <!-- Disabled / setup hint -->
        <div
            v-if="disabledReason"
            class="flex items-start gap-3 rounded-2xl border border-(--or3-amber)/40 bg-(--or3-amber)/10 px-3.5 py-3 text-sm text-(--or3-text)"
            role="status"
        >
            <Icon
                name="i-pixelarticons-alert"
                class="mt-0.5 size-4 shrink-0 text-(--or3-amber)"
            />
            <div class="min-w-0 flex-1 space-y-1">
                <p class="font-mono text-[13px] font-semibold leading-5">
                    {{ disabledReason.title }}
                </p>
                <p class="text-[12px] leading-5 text-(--or3-text-muted)">
                    {{ disabledReason.description }}
                </p>
                <NuxtLink
                    v-if="disabledReason.actionTo"
                    :to="disabledReason.actionTo"
                    class="or3-focus-ring inline-flex items-center gap-1 font-mono text-[12px] font-semibold text-(--or3-green-dark)"
                >
                    {{ disabledReason.actionLabel ?? 'Open settings' }}
                    <Icon
                        name="i-pixelarticons-chevron-right"
                        class="size-3.5"
                    />
                </NuxtLink>
            </div>
        </div>

        <!-- Submit error -->
        <div
            v-if="submitError"
            class="flex items-start gap-3 rounded-2xl border border-(--or3-danger)/40 bg-(--or3-danger)/10 px-3.5 py-3 text-sm text-(--or3-text)"
            role="alert"
        >
            <Icon
                name="i-pixelarticons-close-box"
                class="mt-0.5 size-4 shrink-0 text-(--or3-danger)"
            />
            <div class="min-w-0 flex-1 space-y-1">
                <p class="font-mono text-[13px] font-semibold leading-5">
                    Couldn't hand off that task
                </p>
                <p class="text-[12px] leading-5 text-(--or3-text-muted)">
                    {{ submitError }}
                </p>
            </div>
            <button
                type="button"
                class="or3-focus-ring shrink-0 rounded-full p-1 text-(--or3-text-muted) hover:text-(--or3-text)"
                aria-label="Dismiss error"
                @click="$emit('dismiss-error')"
            >
                <Icon name="i-pixelarticons-close" class="size-3.5" />
            </button>
        </div>

        <!-- Task input -->
        <UForm :state="formState" class="space-y-3" @submit.prevent="submit">
            <div class="relative">
                <UTextarea
                    v-model="formState.task"
                    :rows="3"
                    :disabled="disabled || submitting"
                    class="w-full"
                    :ui="{
                        base: 'rounded-2xl border border-(--or3-border) bg-(--or3-surface) pr-14 text-base leading-6 placeholder:text-(--or3-text-muted)/70 sm:text-sm disabled:cursor-not-allowed disabled:opacity-60',
                    }"
                    :placeholder="
                        disabled
                            ? 'Connect a computer to delegate work'
                            : 'What should or3-intern do?'
                    "
                    aria-label="Task for or3-intern"
                />
                <button
                    type="submit"
                    class="or3-focus-ring absolute bottom-2.5 right-2.5 grid size-10 place-items-center rounded-full bg-(--or3-green-soft) text-(--or3-green-dark) shadow-sm transition hover:bg-(--or3-green)/20 disabled:cursor-not-allowed disabled:opacity-50"
                    :disabled="!canSubmit"
                    :aria-label="
                        submitting
                            ? 'Handing off to or3-intern'
                            : 'Send task to or3-intern'
                    "
                >
                    <Icon
                        v-if="submitting"
                        name="i-pixelarticons-loader"
                        class="size-4 animate-spin"
                    />
                    <Icon
                        v-else
                        name="i-pixelarticons-send"
                        class="size-4 -translate-x-px translate-y-px"
                    />
                </button>
            </div>

            <!-- Category chips -->
            <div class="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                <button
                    v-for="cat in categories"
                    :key="cat.id"
                    type="button"
                    :class="[
                        'inline-flex shrink-0 items-center gap-2 rounded-2xl border px-3.5 py-2 text-sm font-medium transition',
                        'or3-focus-ring or3-touch-target',
                        formState.category === cat.id
                            ? 'border-(--or3-green)/40 bg-(--or3-green-soft) text-(--or3-green-dark)'
                            : 'border-(--or3-border) bg-(--or3-surface) text-(--or3-text) hover:border-(--or3-green)/30',
                    ]"
                    @click="selectCategory(cat.id)"
                >
                    <Icon :name="cat.icon" class="size-4" />
                    <span>{{ cat.label }}</span>
                </button>
            </div>

            <!-- Settings row -->
            <div
                class="grid grid-cols-2 overflow-hidden rounded-2xl border border-(--or3-border) bg-(--or3-surface)/60"
            >
                <!-- Priority -->
                <UDropdownMenu
                    :items="priorityMenuItems"
                    :content="{ align: 'start', sideOffset: 6 }"
                >
                    <button
                        type="button"
                        class="or3-focus-ring flex h-full w-full flex-col items-start gap-1.5 border-r border-b border-(--or3-border) px-3 py-2.5 text-left transition hover:bg-(--or3-green-soft)/40"
                        aria-label="Set task priority"
                    >
                        <span
                            class="flex w-full items-center gap-1.5 text-[12px] font-medium text-(--or3-text-muted)"
                        >
                            <Icon
                                name="i-pixelarticons-flag"
                                class="size-3.5 shrink-0"
                            />
                            <span class="truncate">Priority</span>
                        </span>
                        <span
                            class="flex w-full items-center justify-between gap-1"
                        >
                            <span class="truncate text-sm text-(--or3-text)">{{
                                priorityLabel(formState.priority)
                            }}</span>
                            <Icon
                                name="i-pixelarticons-chevron-down"
                                class="size-3.5 shrink-0 text-(--or3-text-muted)"
                            />
                        </span>
                    </button>
                </UDropdownMenu>

                <!-- Notify -->
                <UDropdownMenu
                    :items="notifyMenuItems"
                    :content="{ align: 'start', sideOffset: 6 }"
                >
                    <button
                        type="button"
                        class="or3-focus-ring flex h-full w-full flex-col items-start gap-1.5 border-b border-(--or3-border) px-3 py-2.5 text-left transition hover:bg-(--or3-green-soft)/40"
                        aria-label="Set notification preference"
                    >
                        <span
                            class="flex w-full items-center gap-1.5 text-[12px] font-medium text-(--or3-text-muted)"
                        >
                            <Icon
                                name="i-pixelarticons-bell"
                                class="size-3.5 shrink-0"
                            />
                            <span class="truncate">Notify me</span>
                        </span>
                        <span
                            class="flex w-full items-center justify-between gap-1"
                        >
                            <span class="truncate text-sm text-(--or3-text)">{{
                                notifyLabel(formState.notify)
                            }}</span>
                            <Icon
                                name="i-pixelarticons-chevron-down"
                                class="size-3.5 shrink-0 text-(--or3-text-muted)"
                            />
                        </span>
                    </button>
                </UDropdownMenu>

                <!-- Auto-approve -->
                <button
                    type="button"
                    class="or3-focus-ring col-span-2 flex h-full w-full flex-col items-start gap-1.5 px-3 py-2.5 text-left transition hover:bg-(--or3-green-soft)/40 sm:flex-row sm:items-center sm:justify-between"
                    @click="formState.autoApprove = !formState.autoApprove"
                    :aria-pressed="formState.autoApprove"
                    aria-label="Toggle auto-approve safe actions"
                >
                    <span
                        class="flex w-full items-center gap-1.5 text-[12px] font-medium text-(--or3-text-muted) sm:w-auto"
                    >
                        <Icon
                            name="i-pixelarticons-shield"
                            class="size-3.5 shrink-0"
                        />
                        <span class="truncate">Auto-approve</span>
                    </span>
                    <span
                        class="flex w-full items-center justify-between gap-2 sm:w-auto sm:min-w-44"
                    >
                        <span class="truncate text-sm text-(--or3-text)"
                            >Safe actions</span
                        >
                        <span
                            :class="[
                                'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition',
                                formState.autoApprove
                                    ? 'bg-(--or3-green)'
                                    : 'bg-stone-300',
                            ]"
                        >
                            <span
                                :class="[
                                    'inline-block size-4 translate-x-0.5 rounded-full bg-white shadow transition',
                                    formState.autoApprove && 'translate-x-4.5',
                                ]"
                            />
                        </span>
                    </span>
                </button>
            </div>
        </UForm>
    </SurfaceCard>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue';

export interface AgentTaskPayload {
    task: string;
    category: AgentCategory;
    priority: AgentPriority;
    notify: AgentNotify;
    autoApprove: boolean;
}

export type AgentCategory =
    | 'research'
    | 'review'
    | 'draft'
    | 'organize'
    | 'general';
export type AgentPriority = 'low' | 'balanced' | 'high';
export type AgentNotify = 'always' | 'complete' | 'never';

export interface AgentCommandDisabledReason {
    title: string;
    description: string;
    actionTo?: string;
    actionLabel?: string;
}

const props = defineProps<{
    disabled?: boolean;
    disabledReason?: AgentCommandDisabledReason | null;
    submitting?: boolean;
    submitError?: string | null;
}>();

const emit = defineEmits<{
    submit: [payload: AgentTaskPayload];
    'dismiss-error': [];
}>();

const formState = reactive({
    task: '',
    category: 'general' as AgentCategory,
    priority: 'balanced' as AgentPriority,
    notify: 'complete' as AgentNotify,
    autoApprove: true,
});

const canSubmit = computed(
    () =>
        !props.disabled &&
        !props.submitting &&
        formState.task.trim().length > 0,
);

const categories: Array<{
    id: AgentCategory;
    label: string;
    icon: string;
    template: string;
}> = [
    {
        id: 'research',
        label: 'Research',
        icon: 'i-pixelarticons-search',
        template: 'Research the latest on ',
    },
    {
        id: 'review',
        label: 'Review',
        icon: 'i-pixelarticons-analytics',
        template: 'Look through and summarize ',
    },
    {
        id: 'draft',
        label: 'Draft',
        icon: 'i-pixelarticons-edit',
        template: 'Draft a ',
    },
    {
        id: 'organize',
        label: 'Organize',
        icon: 'i-pixelarticons-folder',
        template: 'Organize and summarize ',
    },
];

const priorityItems: Array<{ label: string; value: AgentPriority }> = [
    { label: 'Low', value: 'low' },
    { label: 'Balanced', value: 'balanced' },
    { label: 'High', value: 'high' },
];

const notifyItems: Array<{ label: string; value: AgentNotify }> = [
    { label: 'Always', value: 'always' },
    { label: 'When complete', value: 'complete' },
    { label: 'Never', value: 'never' },
];

const priorityMenuItems = computed(() =>
    priorityItems.map((item) => ({
        label: item.label,
        icon:
            formState.priority === item.value
                ? 'i-pixelarticons-check'
                : undefined,
        onSelect: () => {
            formState.priority = item.value;
        },
    })),
);

const notifyMenuItems = computed(() =>
    notifyItems.map((item) => ({
        label: item.label,
        icon:
            formState.notify === item.value
                ? 'i-pixelarticons-check'
                : undefined,
        onSelect: () => {
            formState.notify = item.value;
        },
    })),
);

function priorityLabel(value: AgentPriority) {
    return priorityItems.find((p) => p.value === value)?.label ?? 'Balanced';
}
function notifyLabel(value: AgentNotify) {
    return notifyItems.find((p) => p.value === value)?.label ?? 'When complete';
}

function selectCategory(id: AgentCategory) {
    formState.category = formState.category === id ? 'general' : id;
    if (formState.category !== 'general' && !formState.task.trim()) {
        const tpl = categories.find((c) => c.id === id)?.template ?? '';
        formState.task = tpl;
    }
}

function submit() {
    const value = formState.task.trim();
    if (!value || props.disabled || props.submitting) return;
    emit('submit', {
        task: value,
        category: formState.category,
        priority: formState.priority,
        notify: formState.notify,
        autoApprove: formState.autoApprove,
    });
}

function resetForm() {
    formState.task = '';
    formState.category = 'general';
}

defineExpose({ resetForm });
</script>

<style scoped>
.or3-command-center {
    position: relative;
    overflow: hidden;
    background:
        radial-gradient(
            120% 90% at 100% 0%,
            color-mix(in srgb, var(--or3-green) 18%, transparent) 0%,
            transparent 55%
        ),
        radial-gradient(
            90% 70% at 0% 0%,
            color-mix(in srgb, var(--or3-green) 8%, transparent) 0%,
            transparent 60%
        ),
        var(--or3-surface);
}

.or3-command-center::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image:
        radial-gradient(
            color-mix(in srgb, var(--or3-green) 22%, transparent) 1px,
            transparent 1px
        );
    background-size: 14px 14px;
    background-position: top right;
    mask-image: radial-gradient(
        70% 60% at 100% 0%,
        rgba(0, 0, 0, 0.55),
        transparent 70%
    );
    opacity: 0.55;
}

.or3-command-center > * {
    position: relative;
}

.or3-cc-hero {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
}

.or3-cc-hero__copy {
    min-width: 0;
}

.or3-cc-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family:
        'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.18em;
    color: var(--or3-green-dark);
    text-transform: uppercase;
}

.or3-cc-title {
    margin-top: 6px;
    font-family: 'IBM Plex Serif', 'Georgia', ui-serif, serif;
    font-size: clamp(1.65rem, 5vw, 2.15rem);
    font-weight: 600;
    line-height: 1.05;
    letter-spacing: -0.01em;
    color: var(--or3-text);
}

.or3-cc-title__accent {
    display: inline;
    color: var(--or3-green-dark);
    font-style: italic;
}

.or3-cc-sub {
    margin-top: 10px;
    max-width: 32ch;
    font-size: 13.5px;
    line-height: 1.55;
    color: var(--or3-text-muted);
}

/* Mascot stage — podium + glow + floating UI tiles + sparkles */
.or3-cc-stage {
    position: relative;
    width: 168px;
    height: 168px;
    flex-shrink: 0;
}

.or3-cc-stage__podium {
    position: absolute;
    inset: 14px 8px 0 8px;
    display: flex;
    align-items: flex-end;
    justify-content: center;
}

.or3-cc-stage__glow {
    position: absolute;
    bottom: 10px;
    left: 50%;
    width: 120px;
    height: 26px;
    transform: translateX(-50%);
    border-radius: 999px;
    background: radial-gradient(
        ellipse at center,
        color-mix(in srgb, var(--or3-green) 55%, transparent) 0%,
        transparent 70%
    );
    filter: blur(2px);
}

.or3-cc-stage__mascot {
    position: relative;
    z-index: 1;
}

.or3-cc-stage__tile {
    position: absolute;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--or3-surface) 85%, white);
    border: 1px solid color-mix(in srgb, var(--or3-green) 22%, var(--or3-border));
    color: var(--or3-green-dark);
    box-shadow: 0 6px 14px color-mix(in srgb, var(--or3-green) 14%, transparent);
}

.or3-cc-stage__tile--chart {
    top: 18px;
    left: 4px;
    transform: rotate(-6deg);
}

.or3-cc-stage__tile--doc {
    top: 38px;
    right: 0px;
    transform: rotate(8deg);
}

.or3-cc-stage__tile--search {
    bottom: 44px;
    left: -2px;
    transform: rotate(4deg);
}

.or3-cc-stage__sparkle {
    position: absolute;
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: var(--or3-green);
    opacity: 0.7;
    box-shadow: 0 0 8px color-mix(in srgb, var(--or3-green) 60%, transparent);
}

.or3-cc-stage__sparkle--a {
    top: 6px;
    right: 22px;
}
.or3-cc-stage__sparkle--b {
    top: 70px;
    right: -2px;
    width: 4px;
    height: 4px;
}
.or3-cc-stage__sparkle--c {
    top: 4px;
    left: 38px;
    width: 4px;
    height: 4px;
}

@media (max-width: 480px) {
    .or3-cc-stage {
        width: 132px;
        height: 132px;
    }
    .or3-cc-stage__tile {
        width: 26px;
        height: 26px;
    }
    .or3-cc-title {
        font-size: 1.55rem;
    }
}
</style>
