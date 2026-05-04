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
            <div
                class="or3-cc-composer"
                :class="{
                    'or3-cc-composer--focused': isFocused,
                    'or3-cc-composer--dragging': isDragging,
                    'or3-cc-composer--disabled': disabled || submitting,
                }"
                @click="focusEditor"
            >
                <div v-if="isDragging" class="or3-cc-composer__drop">
                    Drop files to attach them
                </div>

                <div
                    v-if="displayedAttachments.length"
                    class="or3-cc-composer__attachments"
                >
                    <button
                        v-for="attachment in displayedAttachments"
                        :key="attachment.id"
                        type="button"
                        class="or3-cc-composer__attachment or3-focus-ring"
                        :disabled="disabled || submitting"
                        @click.stop="removeAttachment(attachment.id)"
                    >
                        <img
                            v-if="attachment.thumbnailUrl"
                            :src="attachment.thumbnailUrl"
                            :alt="attachment.name"
                            class="or3-cc-composer__attachment-thumb"
                        />
                        <Icon
                            v-else
                            :name="
                                attachment.kind === 'text'
                                    ? 'i-pixelarticons-notebook'
                                    : attachment.source === 'workspace'
                                      ? 'i-pixelarticons-file'
                                      : 'i-pixelarticons-paperclip'
                            "
                            class="size-4 shrink-0 text-(--or3-green-dark)"
                        />
                        <span class="min-w-0 flex-1 text-left">
                            <span class="block truncate font-medium">{{
                                attachment.name
                            }}</span>
                            <span
                                v-if="attachment.preview"
                                class="block truncate text-[11px] text-(--or3-text-muted)"
                            >
                                {{ attachment.preview }}
                            </span>
                        </span>
                        <Icon
                            name="i-pixelarticons-close"
                            class="size-3.5 shrink-0 text-(--or3-text-muted)"
                        />
                    </button>
                </div>

                <input
                    ref="fileInput"
                    type="file"
                    multiple
                    class="hidden"
                    accept="image/*,application/pdf,text/plain,.md,.txt,.json,.csv"
                    aria-hidden="true"
                    tabindex="-1"
                    @change="handleFiles"
                />

                <div class="or3-cc-composer__editor-wrap max-h-[300px] overflow-auto">
                    <EditorContent
                        v-if="editor"
                        :editor="editor"
                        class="or3-cc-editor text-base leading-6 text-(--or3-text) sm:text-sm"
                        aria-label="Task for or3-intern"
                    />
                    <span
                        v-if="!formState.task.trim()"
                        class="or3-cc-composer__placeholder"
                    >
                        {{
                            disabled
                                ? 'Connect a computer to delegate work'
                                : 'What should or3-intern do?'
                        }}
                    </span>
                </div>

                <button
                    type="button"
                    class="or3-focus-ring or3-cc-composer__attach"
                    :disabled="disabled || submitting"
                    aria-label="Attach file"
                    @click.stop="fileInput?.click()"
                >
                    <Icon name="i-pixelarticons-paperclip" class="size-4" />
                </button>
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

            <div v-if="mentionMenu.open" class="or3-cc-mention-menu">
                <FileMentionMenu
                    :items="mentionMenu.items"
                    :loading="mentionLoading"
                    :error="mentionError"
                    :selected-index="mentionMenu.selectedIndex"
                    @select="selectMention"
                />
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

            <!-- Runner & mode selection for external CLI -->
            <div
                v-if="runnerOptions && runnerOptions.length > 0"
                class="rounded-2xl border border-(--or3-border) bg-(--or3-surface)/60 p-3 space-y-3"
            >
                <!-- Runner dropdown -->
                <div class="grid grid-cols-2 gap-2">
                    <div class="col-span-2 sm:col-span-1">
                        <label
                            class="block font-mono text-[11px] font-semibold tracking-[0.18em] text-(--or3-text-muted) mb-1.5"
                        >
                            RUNNER
                        </label>
                        <div class="relative">
                            <button
                                type="button"
                                class="or3-focus-ring flex w-full items-center justify-between gap-2 rounded-xl border border-(--or3-border) bg-(--or3-surface) px-3 py-2 text-sm text-(--or3-text) hover:bg-(--or3-surface-soft) disabled:cursor-not-allowed disabled:opacity-60"
                                :disabled="props.disabled || props.loadingRunners"
                                @click="showRunnerExpanded = !showRunnerExpanded"
                            >
                                <span class="truncate">{{
                                    runnerLabel(selectedRunner)
                                }}</span>
                                <Icon
                                    :name="
                                        props.loadingRunners
                                            ? 'i-pixelarticons-loader'
                                            : 'i-pixelarticons-chevron-down'
                                    "
                                    :class="[
                                        'size-3.5 shrink-0 text-(--or3-text-muted)',
                                        props.loadingRunners && 'animate-spin',
                                    ]"
                                />
                            </button>
                            <div
                                v-if="showRunnerExpanded"
                                class="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-(--or3-border) bg-(--or3-surface) shadow-lg"
                            >
                                <button
                                    v-for="runner in availableRunners"
                                    :key="runner.id"
                                    type="button"
                                    class="or3-focus-ring flex w-full items-center gap-2 px-3 py-2 text-sm text-(--or3-text) transition hover:bg-(--or3-surface-soft)"
                                    :class="{
                                        'bg-(--or3-green-soft)/60 text-(--or3-green-dark)':
                                            selectedRunner === runner.id,
                                    }"
                                    @click="
                                        selectedRunner = runner.id;
                                        showRunnerExpanded = false;
                                    "
                                >
                                    <span class="truncate flex-1 text-left">{{
                                        runner.label
                                    }}</span>
                                    <span
                                        v-if="runner.auth_status === 'unknown'"
                                        class="text-[10px] text-(--or3-amber)"
                                        >Auth unverified</span
                                    >
                                </button>
                                <template
                                    v-if="unavailableRunners.length"
                                >
                                    <div
                                        class="border-t border-(--or3-border) px-3 py-1.5 font-mono text-[10px] font-semibold text-(--or3-text-muted) uppercase tracking-wider"
                                    >
                                        Not available
                                    </div>
                                    <button
                                        v-for="runner in unavailableRunners"
                                        :key="runner.id"
                                        type="button"
                                        class="flex w-full items-center gap-2 px-3 py-2 text-sm text-(--or3-text-muted) cursor-not-allowed"
                                        disabled
                                    >
                                        <span class="truncate flex-1 text-left">{{
                                            runner.label
                                        }}</span>
                                        <span class="text-[10px] text-(--or3-text-muted)">{{
                                            runner.disabledReason || runner.status
                                        }}</span>
                                    </button>
                                </template>
                            </div>
                        </div>
                    </div>
                    <!-- Mode selector (external runners only) -->
                    <div
                        v-if="selectedRunner !== 'or3-intern'"
                        class="col-span-2 sm:col-span-1"
                    >
                        <label
                            class="block font-mono text-[11px] font-semibold tracking-[0.18em] text-(--or3-text-muted) mb-1.5"
                        >
                            PERMISSIONS
                        </label>
                        <div class="relative">
                            <button
                                type="button"
                                class="or3-focus-ring flex w-full items-center justify-between gap-2 rounded-xl border border-(--or3-border) bg-(--or3-surface) px-3 py-2 text-sm text-(--or3-text) hover:bg-(--or3-surface-soft) disabled:cursor-not-allowed disabled:opacity-60"
                                :disabled="props.disabled"
                                @click="showModeExpanded = !showModeExpanded"
                            >
                                <span class="truncate">{{
                                    modeLabel(selectedMode)
                                }}</span>
                                <Icon
                                    name="i-pixelarticons-chevron-down"
                                    class="size-3.5 shrink-0 text-(--or3-text-muted)"
                                />
                            </button>
                            <div
                                v-if="showModeExpanded"
                                class="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-(--or3-border) bg-(--or3-surface) shadow-lg"
                            >
                                <button
                                    v-for="mode in modeOptions"
                                    :key="mode.id"
                                    type="button"
                                    class="or3-focus-ring flex w-full items-center gap-2 px-3 py-2 text-sm transition hover:bg-(--or3-surface-soft)"
                                    :class="{
                                        'bg-(--or3-green-soft)/60 text-(--or3-green-dark)':
                                            selectedMode === mode.id,
                                        'cursor-not-allowed opacity-50':
                                            mode.disabled,
                                    }"
                                    :disabled="mode.disabled"
                                    @click="
                                        if (!mode.disabled) {
                                            selectedMode = mode.id;
                                            showModeExpanded = false;
                                        }
                                    "
                                >
                                    <span class="truncate flex-1 text-left">{{
                                        mode.label
                                    }}</span>
                                    <span
                                        v-if="mode.disabled"
                                        class="text-[10px] text-(--or3-text-muted)"
                                        >Requires sandbox</span
                                    >
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Model and max-turns (external runners only, compact row) -->
                <div
                    v-if="
                        selectedRunner !== 'or3-intern' &&
                        activeRunnerSupports?.modelFlag
                    "
                    class="grid grid-cols-2 gap-2"
                >
                    <div class="col-span-2 sm:col-span-1">
                        <label
                            class="block font-mono text-[11px] font-semibold tracking-[0.18em] text-(--or3-text-muted) mb-1.5"
                        >
                            MODEL
                        </label>
                        <input
                            v-model="selectedModel"
                            type="text"
                            class="or3-focus-ring w-full rounded-xl border border-(--or3-border) bg-(--or3-surface) px-3 py-2 text-sm text-(--or3-text) placeholder:text-(--or3-text-muted) disabled:cursor-not-allowed disabled:opacity-60"
                            placeholder="Default model"
                            :disabled="props.disabled"
                        />
                    </div>
                    <div
                        v-if="activeRunnerSupports?.maxTurns"
                        class="col-span-2 sm:col-span-1"
                    >
                        <label
                            class="block font-mono text-[11px] font-semibold tracking-[0.18em] text-(--or3-text-muted) mb-1.5"
                        >
                            MAX TURNS
                        </label>
                        <input
                            v-model.number="selectedMaxTurns"
                            type="number"
                            min="1"
                            class="or3-focus-ring w-full rounded-xl border border-(--or3-border) bg-(--or3-surface) px-3 py-2 text-sm text-(--or3-text) placeholder:text-(--or3-text-muted) disabled:cursor-not-allowed disabled:opacity-60"
                            placeholder="Unlimited"
                            :disabled="props.disabled"
                        />
                    </div>
                </div>

                <!-- Safety copy for external runners -->
                <p
                    v-if="selectedRunner !== 'or3-intern'"
                    class="font-mono text-[10px] text-(--or3-text-muted) leading-relaxed"
                >
                    Runs in the background using non-interactive safe mode. It
                    won't wait for terminal approvals.
                </p>
            </div>
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
import {
    computed,
    onBeforeUnmount,
    onMounted,
    reactive,
    ref,
    shallowRef,
    watch,
} from 'vue';
import { Editor, EditorContent } from '@tiptap/vue-3';
import { mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Mention from '@tiptap/extension-mention';
import {
    useFileMentionSuggestions,
    type FileMentionSuggestionItem,
} from '~/composables/useFileMentionSuggestions';
import type { ChatAttachment } from '~/types/app-state';
import type { AgentRunnerInfo } from '~/types/or3-api';
import { runnerLabel } from '~/utils/or3/jobs';

export interface AgentTaskPayload {
    task: string;
    transportTask: string;
    category: AgentCategory;
    priority: AgentPriority;
    notify: AgentNotify;
    autoApprove: boolean;
    attachments: ChatAttachment[];
    runnerId: string;
    runnerLabel?: string;
    mode?: string;
    isolation?: string;
    model?: string;
    maxTurns?: number;
    cwd?: string;
}

export type AgentCategory =
    | 'research'
    | 'review'
    | 'draft'
    | 'organize'
    | 'general';
export type AgentPriority = 'low' | 'balanced' | 'high';
export type AgentNotify = 'always' | 'complete' | 'never';

export type AgentCommandMode = 'review' | 'safe_edit' | 'sandbox_auto';

export interface AgentCommandDisabledReason {
    title: string;
    description: string;
    actionTo?: string;
    actionLabel?: string;
}

interface RunnerOption {
    id: string;
    label: string;
    status: string;
    disabled?: boolean;
    disabledReason?: string;
    auth_status?: string;
}

const props = defineProps<{
    disabled?: boolean;
    disabledReason?: AgentCommandDisabledReason | null;
    submitting?: boolean;
    submitError?: string | null;
    runnerOptions?: AgentRunnerInfo[];
    selectedRunnerId?: string;
    loadingRunners?: boolean;
    runnerListSupported?: boolean;
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

const selectedRunner = ref(props.selectedRunnerId ?? 'or3-intern');
const selectedMode = ref<AgentCommandMode>('safe_edit');
const selectedModel = ref('');
const selectedMaxTurns = ref<number | undefined>(undefined);
const cwdText = ref('');
const showRunnerExpanded = ref(false);
const showModeExpanded = ref(false);

interface DraftAttachment extends ChatAttachment {
    content?: string;
    thumbnailUrl?: string;
    objectUrl?: string;
}

interface SuggestionLifecycleProps<TItem> {
    editor: any;
    query: string;
    range: { from: number; to: number };
    items: TItem[];
    command: (item: TItem) => void;
}

interface SuggestionKeydownProps {
    event: KeyboardEvent;
}

const fileInput = ref<HTMLInputElement | null>(null);
const editor = shallowRef<Editor>();
const isDragging = ref(false);
const isFocused = ref(false);
const dragDepth = ref(0);
const manualAttachments = ref<DraftAttachment[]>([]);
const workspaceMentionAttachments = ref<DraftAttachment[]>([]);
const mentionMenu = reactive<{
    open: boolean;
    selectedIndex: number;
    items: FileMentionSuggestionItem[];
}>({
    open: false,
    selectedIndex: 0,
    items: [],
});

let selectMentionFromSuggestion:
    | ((item: FileMentionSuggestionItem) => void)
    | null = null;

const TEXT_FILE_CONTENT_LIMIT_BYTES = 200_000;

const {
    loading: mentionLoading,
    error: mentionError,
    search: searchMentionFiles,
    reset: resetMentionSearch,
} = useFileMentionSuggestions();

const displayedAttachments = computed(() => [
    ...workspaceMentionAttachments.value,
    ...manualAttachments.value,
]);

const canSubmit = computed(
    () =>
        !props.disabled &&
        !props.submitting &&
        (formState.task.trim().length > 0 ||
            displayedAttachments.value.length > 0),
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

// ── Runner dropdown helpers ──

const runnerList = computed<RunnerOption[]>(() => {
    const runners = props.runnerOptions ?? [];
    if (!runners.length)
        return [{ id: 'or3-intern', label: 'or3-intern', status: 'available' }];
    return runners.map((r) => ({
        id: r.id,
        label: r.display_name || r.id,
        status: r.status,
        disabled:
            r.status === 'missing' ||
            r.status === 'not_executable' ||
            r.status === 'auth_missing' ||
            r.status === 'error' ||
            r.status === 'disabled_by_config' ||
            r.status === 'unsupported_version',
        disabledReason: r.disabled_reason || r.status,
        auth_status: r.auth_status,
    }));
});

const availableRunners = computed(() =>
    runnerList.value.filter((r) => !r.disabled),
);

const unavailableRunners = computed(() =>
    runnerList.value.filter((r) => r.disabled),
);

const activeRunnerInfo = computed(() =>
    props.runnerOptions?.find((r) => r.id === selectedRunner.value),
);

const activeRunnerSupports = computed(() =>
    activeRunnerInfo.value?.supports,
);

const modeOptions = computed<
    Array<{ id: AgentCommandMode; label: string; disabled?: boolean }>
>(() => [
    { id: 'review', label: 'Review only' },
    { id: 'safe_edit', label: 'Safe workspace edits' },
    {
        id: 'sandbox_auto',
        label: 'Full autonomy in sandbox',
        disabled:
            !activeRunnerSupports.value?.safeSandboxFlag ||
            !activeRunnerSupports.value?.dangerousBypassFlag,
    },
]);

function modeLabel(mode: string): string {
    switch (mode) {
        case 'review':
            return 'Review only';
        case 'safe_edit':
            return 'Safe workspace edits';
        case 'sandbox_auto':
            return 'Full autonomy in sandbox';
        default:
            return 'Safe workspace edits';
    }
}

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
        updateEditorText(tpl);
    }
}

function attachmentId() {
    return `attachment_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function summarizeText(text: string, maxWords = 12) {
    const words = text.trim().split(/\s+/).filter(Boolean);
    return (
        words.slice(0, maxWords).join(' ') +
        (words.length > maxWords ? '...' : '')
    );
}

function updateEditorText(value: string) {
    formState.task = value;
    closeMentionMenu();
    editor.value?.commands.setContent(value || '', false);
}

function focusEditor() {
    if (props.disabled || props.submitting) return;
    editor.value?.commands.focus('end');
}

function revokeAttachmentPreview(attachment: DraftAttachment) {
    if (attachment.objectUrl) URL.revokeObjectURL(attachment.objectUrl);
}

function clearManualAttachments() {
    for (const attachment of manualAttachments.value) {
        revokeAttachmentPreview(attachment);
    }
    manualAttachments.value = [];
}

function closeMentionMenu() {
    mentionMenu.open = false;
    mentionMenu.selectedIndex = 0;
    mentionMenu.items = [];
    selectMentionFromSuggestion = null;
    resetMentionSearch();
}

function syncWorkspaceMentionAttachments(instance?: Editor) {
    if (!instance) {
        workspaceMentionAttachments.value = [];
        return;
    }

    const nextAttachments = new Map<string, DraftAttachment>();
    instance.state.doc.descendants((node) => {
        if (node.type.name !== 'fileMention') return;
        const id = String(
            node.attrs.id ||
                `${node.attrs.rootId || 'workspace'}:${node.attrs.path || node.attrs.name || 'file'}`,
        );
        if (nextAttachments.has(id)) return;
        nextAttachments.set(id, {
            id,
            kind: 'file',
            source: 'workspace',
            name:
                node.attrs.name ||
                node.attrs.label ||
                node.attrs.path ||
                'Workspace file',
            preview: node.attrs.path || undefined,
            mimeType: node.attrs.mimeType || undefined,
            size:
                typeof node.attrs.size === 'number'
                    ? node.attrs.size
                    : undefined,
            path: node.attrs.path || undefined,
            rootId: node.attrs.rootId || undefined,
        });
    });
    workspaceMentionAttachments.value = Array.from(nextAttachments.values());
}

function removeWorkspaceMention(id: string) {
    const instance = editor.value;
    if (!instance) return;

    const ranges: Array<{ from: number; to: number }> = [];
    instance.state.doc.descendants((node, pos) => {
        if (node.type.name !== 'fileMention') return;
        const nodeId = String(
            node.attrs.id ||
                `${node.attrs.rootId || 'workspace'}:${node.attrs.path || node.attrs.name || 'file'}`,
        );
        if (nodeId !== id) return;

        const trailing = instance.state.doc.textBetween(
            pos + node.nodeSize,
            pos + node.nodeSize + 1,
            '',
            '',
        );
        ranges.push({
            from: pos,
            to:
                trailing === ' '
                    ? pos + node.nodeSize + 1
                    : pos + node.nodeSize,
        });
    });

    if (!ranges.length) return;

    let chain = instance.chain().focus();
    for (const range of ranges.reverse()) {
        chain = chain.deleteRange(range);
    }
    chain.run();
    syncWorkspaceMentionAttachments(instance);
}

function removeAttachment(id: string) {
    const workspaceAttachment = workspaceMentionAttachments.value.find(
        (attachment) => attachment.id === id,
    );
    if (workspaceAttachment) {
        removeWorkspaceMention(id);
        return;
    }

    const attachment = manualAttachments.value.find((item) => item.id === id);
    if (attachment) revokeAttachmentPreview(attachment);
    manualAttachments.value = manualAttachments.value.filter(
        (item) => item.id !== id,
    );
}

function buildTransportTask() {
    const sections: string[] = [];
    const promptText = formState.task.trim();
    if (promptText) sections.push(promptText);

    const contentAttachments = manualAttachments.value.filter(
        (attachment) => attachment.content,
    );
    if (contentAttachments.length) {
        sections.push(
            [
                'Additional attached context:',
                ...contentAttachments.map(
                    (attachment, index) =>
                        `Context block ${index + 1} (${attachment.name}):\n${attachment.content}`,
                ),
            ].join('\n\n'),
        );
    }

    if (workspaceMentionAttachments.value.length) {
        sections.push(
            [
                'Workspace files mentioned by the user:',
                ...workspaceMentionAttachments.value.map(
                    (attachment) =>
                        `- ${attachment.rootId || 'workspace'}:${attachment.path || attachment.name}`,
                ),
            ].join('\n'),
        );
    }

    const localFilesWithoutContent = manualAttachments.value.filter(
        (attachment) =>
            attachment.kind === 'file' &&
            attachment.source !== 'workspace' &&
            !attachment.content,
    );
    if (localFilesWithoutContent.length) {
        sections.push(
            `Local files selected in or3-app (names only): ${localFilesWithoutContent.map((attachment) => attachment.name).join(', ')}`,
        );
    }

    return sections.join('\n\n').trim();
}

function visibleTaskText() {
    const promptText = formState.task.trim();
    if (promptText) return promptText;
    if (displayedAttachments.value.length === 1) {
        return `Shared ${displayedAttachments.value[0]?.name || 'an attachment'} for context.`;
    }
    return `Shared ${displayedAttachments.value.length} attachments for context.`;
}

function attachmentPayload() {
    return displayedAttachments.value.map(
        ({
            content: _content,
            thumbnailUrl: _thumbnailUrl,
            objectUrl: _objectUrl,
            ...attachment
        }) => attachment,
    );
}

function isTextLikeFile(file: File) {
    if (file.type.startsWith('text/')) return true;
    if (
        [
            'application/json',
            'application/xml',
            'application/x-yaml',
            'application/yaml',
        ].includes(file.type)
    ) {
        return true;
    }
    return /\.(md|markdown|txt|json|csv|tsv|ya?ml|xml|log)$/i.test(file.name);
}

async function hydrateTextFileAttachment(
    attachment: DraftAttachment,
    file: File,
) {
    if (!isTextLikeFile(file) || file.size > TEXT_FILE_CONTENT_LIMIT_BYTES) {
        return;
    }
    try {
        const content = await file.text();
        const current = manualAttachments.value.find(
            (item) => item.id === attachment.id,
        );
        if (!current) return;
        current.content = content;
        current.preview = `${file.type ? file.type.replace(/\/.+$/, '').toUpperCase() : 'TEXT'} - ${Math.max(1, Math.round(file.size / 1024))} KB`;
    } catch {
        // The filename still travels with the task if the browser cannot read it.
    }
}

function addFiles(files: File[]) {
    for (const file of files) {
        const isImage = file.type.startsWith('image/');
        const objectUrl = isImage ? URL.createObjectURL(file) : undefined;
        const attachment: DraftAttachment = {
            id: attachmentId(),
            kind: 'file',
            name: file.name,
            thumbnailUrl: objectUrl,
            objectUrl,
            preview: file.type
                ? file.type.replace(/\/.+$/, '').toUpperCase()
                : 'FILE',
            mimeType: file.type || undefined,
            size: file.size || undefined,
            source: 'local',
        };
        manualAttachments.value.push(attachment);
        void hydrateTextFileAttachment(attachment, file);
    }
}

function addPastedText(text: string) {
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount < 120) return false;
    manualAttachments.value.push({
        id: attachmentId(),
        kind: 'text',
        name: 'Pasted text',
        preview: summarizeText(text),
        content: text.trim(),
    });
    return true;
}

function handleFiles(event: Event) {
    const input = event.target as HTMLInputElement;
    addFiles(Array.from(input.files ?? []));
    input.value = '';
}

async function handlePaste(event: ClipboardEvent) {
    const items = Array.from(event.clipboardData?.items ?? []);
    const files = items
        .map((item) => (item.kind === 'file' ? item.getAsFile() : null))
        .filter((file): file is File => !!file);

    if (files.length) {
        event.preventDefault();
        addFiles(files);
        return;
    }

    const text = event.clipboardData?.getData('text/plain')?.trim() || '';
    if (text && addPastedText(text)) {
        event.preventDefault();
    }
}

function hasFilePayload(event: DragEvent) {
    return Array.from(event.dataTransfer?.types ?? []).includes('Files');
}

function onDragEnter(event: DragEvent) {
    if (!hasFilePayload(event)) return;
    event.preventDefault();
    dragDepth.value += 1;
    isDragging.value = true;
}

function onDragOver(event: DragEvent) {
    if (!hasFilePayload(event)) return;
    event.preventDefault();
    isDragging.value = true;
}

function onDragLeave(event: DragEvent) {
    if (!hasFilePayload(event)) return;
    event.preventDefault();
    dragDepth.value = Math.max(0, dragDepth.value - 1);
    if (!dragDepth.value) isDragging.value = false;
}

function onDrop(event: DragEvent) {
    if (!hasFilePayload(event)) return;
    event.preventDefault();
    dragDepth.value = 0;
    isDragging.value = false;
    addFiles(Array.from(event.dataTransfer?.files ?? []));
}

function moveSelection(delta: number, length: number, current: number) {
    if (!length) return 0;
    return Math.min(length - 1, Math.max(0, current + delta));
}

function selectMention(item = mentionMenu.items[mentionMenu.selectedIndex]) {
    if (!item || !selectMentionFromSuggestion) return;
    selectMentionFromSuggestion(item);
}

function createMentionRenderHooks() {
    return {
        onStart: (props: SuggestionLifecycleProps<FileMentionSuggestionItem>) => {
            mentionMenu.open = true;
            mentionMenu.items = props.items;
            mentionMenu.selectedIndex = 0;
            selectMentionFromSuggestion = props.command;
        },
        onUpdate: (
            props: SuggestionLifecycleProps<FileMentionSuggestionItem>,
        ) => {
            mentionMenu.open = true;
            mentionMenu.items = props.items;
            mentionMenu.selectedIndex = Math.min(
                mentionMenu.selectedIndex,
                Math.max(0, props.items.length - 1),
            );
            selectMentionFromSuggestion = props.command;
        },
        onKeyDown: ({ event }: SuggestionKeydownProps) => {
            if (!mentionMenu.open) return false;
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                mentionMenu.selectedIndex = moveSelection(
                    1,
                    mentionMenu.items.length,
                    mentionMenu.selectedIndex,
                );
                return true;
            }
            if (event.key === 'ArrowUp') {
                event.preventDefault();
                mentionMenu.selectedIndex = moveSelection(
                    -1,
                    mentionMenu.items.length,
                    mentionMenu.selectedIndex,
                );
                return true;
            }
            if (
                (event.key === 'Enter' || event.key === 'Tab') &&
                mentionMenu.items.length
            ) {
                event.preventDefault();
                selectMention();
                return true;
            }
            if (event.key === 'Escape') {
                event.preventDefault();
                closeMentionMenu();
                return true;
            }
            return false;
        },
        onExit: () => {
            closeMentionMenu();
        },
    };
}

function submit() {
    const value = buildTransportTask();
    if (!value || props.disabled || props.submitting) return;
    emit('submit', {
        task: visibleTaskText(),
        transportTask: value,
        category: formState.category,
        priority: formState.priority,
        notify: formState.notify,
        autoApprove: formState.autoApprove,
        attachments: attachmentPayload(),
        runnerId: selectedRunner.value,
        runnerLabel: runnerLabel(selectedRunner.value),
        mode: selectedRunner.value !== 'or3-intern' ? selectedMode.value : undefined,
        isolation:
            selectedRunner.value !== 'or3-intern'
                ? modeToIsolation(selectedMode.value)
                : undefined,
        model:
            selectedRunner.value !== 'or3-intern' && selectedModel.value
                ? selectedModel.value
                : undefined,
        maxTurns:
            selectedRunner.value !== 'or3-intern' && selectedMaxTurns.value
                ? selectedMaxTurns.value
                : undefined,
        cwd:
            selectedRunner.value !== 'or3-intern' && cwdText.value
                ? cwdText.value
                : undefined,
    });
}

function modeToIsolation(mode: string): string {
    switch (mode) {
        case 'review':
            return 'host_readonly';
        case 'safe_edit':
            return 'host_workspace_write';
        case 'sandbox_auto':
            return 'sandbox_dangerous';
        default:
            return 'host_workspace_write';
    }
}

function resetForm() {
    clearManualAttachments();
    workspaceMentionAttachments.value = [];
    updateEditorText('');
    formState.category = 'general';
}

watch(
    () => props.disabled || props.submitting,
    (isReadonly) => {
        editor.value?.setEditable(!isReadonly);
    },
);

watch(
    availableRunners,
    (runners) => {
        if (!runners.some((runner) => runner.id === selectedRunner.value)) {
            selectedRunner.value = runners[0]?.id ?? 'or3-intern';
        }
    },
    { immediate: true },
);

onMounted(() => {
    const mentionRenderHooks = createMentionRenderHooks();

    const FileMention = Mention.extend({
        name: 'fileMention',
        addAttributes() {
            return {
                id: { default: null },
                label: { default: null },
                name: { default: null },
                path: { default: null },
                rootId: { default: null },
                rootLabel: { default: null },
                mimeType: { default: null },
                size: { default: null },
            };
        },
        renderHTML({ HTMLAttributes, node }) {
            const label =
                node.attrs.path || node.attrs.label || node.attrs.name || 'file';
            return [
                'span',
                mergeAttributes(HTMLAttributes, {
                    class: 'or3-file-mention',
                    'data-file-mention': 'true',
                }),
                `@${label}`,
            ];
        },
        renderText({ node }) {
            const label =
                node.attrs.path || node.attrs.label || node.attrs.name || 'file';
            return `@${label}`;
        },
    }).configure({
        deleteTriggerWithBackspace: true,
        suggestion: {
            char: '@',
            items: async ({ query }: { query: string }) =>
                await searchMentionFiles(query),
            command: ({ editor: instance, range, props: item }: any) => {
                instance
                    .chain()
                    .focus()
                    .insertContentAt(range, [
                        {
                            type: 'fileMention',
                            attrs: {
                                id: item.id,
                                label: item.label,
                                name: item.name,
                                path: item.path,
                                rootId: item.root_id,
                                rootLabel: item.root_label,
                                mimeType: item.mime_type || null,
                                size: item.size ?? null,
                            },
                        },
                        { type: 'text', text: ' ' },
                    ])
                    .run();
            },
            render: () => mentionRenderHooks as any,
        },
    }) as any;

    editor.value = new Editor({
        content: '',
        editable: !(props.disabled || props.submitting),
        extensions: [
            StarterKit.configure({
                heading: false,
                blockquote: false,
                bulletList: false,
                orderedList: false,
                codeBlock: false,
                horizontalRule: false,
            }),
            FileMention as any,
        ],
        autofocus: false,
        editorProps: {
            attributes: {
                class: 'min-h-full outline-none',
            },
            handleKeyDown(_view, event) {
                if (mentionMenu.open && event.key === 'Escape') {
                    event.preventDefault();
                    closeMentionMenu();
                    return true;
                }

                if (
                    event.key === 'Enter' &&
                    !event.isComposing &&
                    (event.metaKey || event.ctrlKey)
                ) {
                    event.preventDefault();
                    submit();
                    return true;
                }

                return false;
            },
            handlePaste(_view, event) {
                void handlePaste(event);
                return false;
            },
        },
        onFocus() {
            isFocused.value = true;
        },
        onBlur() {
            isFocused.value = false;
        },
        onUpdate({ editor: instance }) {
            formState.task = instance.getText({ blockSeparator: '\n\n' });
            syncWorkspaceMentionAttachments(instance as any);
        },
        onSelectionUpdate({ editor: instance }) {
            syncWorkspaceMentionAttachments(instance as any);
        },
    });

    syncWorkspaceMentionAttachments(editor.value);

    const dom = editor.value?.view.dom;
    dom?.addEventListener('dragenter', onDragEnter);
    dom?.addEventListener('dragover', onDragOver);
    dom?.addEventListener('dragleave', onDragLeave);
    dom?.addEventListener('drop', onDrop);
});

onBeforeUnmount(() => {
    closeMentionMenu();
    clearManualAttachments();
    const dom = editor.value?.view.dom;
    dom?.removeEventListener('dragenter', onDragEnter);
    dom?.removeEventListener('dragover', onDragOver);
    dom?.removeEventListener('dragleave', onDragLeave);
    dom?.removeEventListener('drop', onDrop);
    editor.value?.destroy();
});

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

.or3-cc-composer {
    position: relative;
    min-height: 9rem;
    border-radius: 1.45rem;
    border: 1px solid var(--or3-border);
    background: color-mix(in srgb, var(--or3-surface) 94%, white 6%);
    box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.72),
        0 0 0 1px transparent;
    transition:
        border-color 0.16s ease,
        box-shadow 0.16s ease,
        background 0.16s ease;
}

.or3-cc-composer--focused {
    border-color: color-mix(in srgb, var(--or3-green) 58%, var(--or3-border));
    box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.72),
        0 0 0 2px color-mix(in srgb, var(--or3-green) 16%, transparent);
}

.or3-cc-composer--dragging {
    border-color: var(--or3-green);
    background: color-mix(in srgb, var(--or3-green-soft) 34%, var(--or3-surface));
}

.or3-cc-composer--disabled {
    cursor: not-allowed;
    opacity: 0.64;
}

.or3-cc-composer__drop {
    margin: 0.75rem 0.75rem 0;
    border: 1px dashed color-mix(in srgb, var(--or3-green) 64%, var(--or3-border));
    border-radius: 1rem;
    background: color-mix(in srgb, var(--or3-green-soft) 64%, transparent);
    padding: 0.6rem 0.75rem;
    text-align: center;
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--or3-green-dark);
}

.or3-cc-composer__attachments {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
    padding: 0.75rem 0.75rem 0;
}

.or3-cc-composer__attachment {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    max-width: 100%;
    min-height: 2.5rem;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--or3-border) 86%, transparent);
    background: color-mix(in srgb, white 82%, var(--or3-surface-soft) 18%);
    padding: 0.42rem 0.58rem;
    font-size: 0.76rem;
    color: var(--or3-text);
    transition:
        border-color 0.14s ease,
        background 0.14s ease;
}

.or3-cc-composer__attachment:hover {
    border-color: color-mix(in srgb, var(--or3-green) 34%, var(--or3-border));
    background: color-mix(in srgb, var(--or3-green-soft) 28%, white 72%);
}

.or3-cc-composer__attachment-thumb {
    width: 1.8rem;
    height: 1.8rem;
    flex-shrink: 0;
    border-radius: 999px;
    object-fit: cover;
    border: 1px solid color-mix(in srgb, var(--or3-border) 88%, transparent);
    background: color-mix(in srgb, white 70%, var(--or3-surface-soft) 30%);
}

.or3-cc-composer__editor-wrap {
    position: relative;
    min-height: 8.85rem;
    padding: 1rem 3.5rem 3rem 1.1rem;
}

.or3-cc-composer__attachments + .or3-cc-composer__editor-wrap,
.or3-cc-composer__drop + .or3-cc-composer__editor-wrap,
.or3-cc-composer__drop
    + .or3-cc-composer__attachments
    + .or3-cc-composer__editor-wrap {
    min-height: 5.6rem;
    padding-top: 0.75rem;
}

.or3-cc-composer__attach {
    position: absolute;
    left: 0.75rem;
    bottom: 0.75rem;
    display: grid;
    width: 2.35rem;
    height: 2.35rem;
    place-items: center;
    border-radius: 999px;
    color: var(--or3-text-muted);
    transition:
        background 0.15s ease,
        color 0.15s ease;
}

.or3-cc-composer__attach:hover {
    background: color-mix(in srgb, var(--or3-green-soft) 52%, transparent);
    color: var(--or3-green-dark);
}

.or3-cc-composer__attach:disabled {
    cursor: not-allowed;
    opacity: 0.55;
}

.or3-cc-composer__placeholder {
    pointer-events: none;
    position: absolute;
    top: 1rem;
    left: 1.1rem;
    right: 3.5rem;
    color: color-mix(in srgb, var(--or3-text-muted) 78%, transparent);
    font-size: 1rem;
    line-height: 1.5rem;
}

.or3-cc-mention-menu {
    margin-top: 0.55rem;
}

.or3-cc-editor {
    display: block;
    min-height: 100%;
}

:deep(.or3-cc-editor .ProseMirror) {
    min-height: 6.7rem;
    outline: none;
    white-space: pre-wrap;
    word-break: break-word;
}

:deep(.or3-cc-editor .ProseMirror p) {
    margin: 0;
}

:deep(.or3-cc-editor .or3-file-mention) {
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    background: color-mix(in srgb, var(--or3-green) 16%, white 84%);
    color: var(--or3-green-dark);
    padding: 0.05rem 0.45rem;
    font-weight: 700;
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
