<template>
    <UForm
        :state="formState"
        class="or3-composer border border-(--or3-border) bg-(--or3-surface)/95 shadow-(--or3-shadow) backdrop-blur"
        :class="isFocused ? 'or3-composer--focused' : ''"
        @submit.prevent="submit"
    >
        <div
            v-if="isDragging"
            class="mx-3 mt-3 rounded-2xl border border-dashed border-(--or3-green) bg-(--or3-green-soft) p-3 text-center text-sm text-(--or3-green-dark)"
        >
            Drop files to attach them
        </div>

        <div
            v-if="displayedAttachments.length"
            class="or3-composer__attachments"
        >
            <button
                v-for="attachment in displayedAttachments"
                :key="attachment.id"
                type="button"
                class="or3-composer__attachment"
                @click="removeAttachment(attachment.id)"
            >
                <img
                    v-if="attachment.thumbnailUrl"
                    :src="attachment.thumbnailUrl"
                    :alt="attachment.name"
                    class="or3-composer__attachment-thumb"
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
                    <span
                        class="block truncate font-medium text-(--or3-text)"
                        >{{ attachment.name }}</span
                    >
                    <span
                        v-if="attachment.preview"
                        class="block truncate text-[0.75rem] text-(--or3-text-muted)"
                    >
                        {{ attachment.preview }}
                    </span>
                </span>
                <Icon
                    name="i-pixelarticons-close"
                    class="size-4 shrink-0 text-(--or3-text-muted)"
                />
            </button>
        </div>

        <div class="or3-composer__row">
            <UPopover
                v-model:open="actionMenuOpen"
                :content="{ align: 'start', side: 'top', sideOffset: 12 }"
            >
                <button
                    type="button"
                    class="or3-composer__icon or3-composer__plus or3-touch-target"
                    aria-label="Open composer actions"
                    :aria-expanded="actionMenuOpen"
                >
                    <Icon name="i-pixelarticons-plus" class="size-5" />
                </button>
                <template #content>
                    <div class="or3-composer-menu">
                        <button
                            type="button"
                            class="or3-composer-menu__item"
                            @click="triggerFilePicker"
                        >
                            <Icon
                                name="i-pixelarticons-paperclip"
                                class="size-5"
                            />
                            <span>Add photos & files</span>
                        </button>
                        <button
                            type="button"
                            class="or3-composer-menu__item"
                            @click="openWorkspaceFilePicker"
                        >
                            <Icon name="i-pixelarticons-file" class="size-5" />
                            <span>Mention workspace file</span>
                        </button>

                        <div class="or3-composer-menu__divider" />
                        <p class="or3-composer-menu__eyebrow">Runner</p>
                        <div
                            class="or3-composer-menu__modes"
                            role="radiogroup"
                            aria-label="Chat runner"
                        >
                            <button
                                v-for="runner in runnerOptions"
                                :key="runner.id"
                                type="button"
                                class="or3-composer-menu__mode"
                                :class="{
                                    'is-active': selectedRunnerId === runner.id,
                                    'is-disabled': !runner.selectable,
                                }"
                                :aria-checked="selectedRunnerId === runner.id"
                                :disabled="!runner.selectable"
                                role="radio"
                                @click="selectRunner(runner.id)"
                            >
                                <Icon :name="runner.icon" class="size-4" />
                                <span class="or3-composer-menu__mode-copy">
                                    <span>{{ runner.label }}</span>
                                    <small>{{ runner.description }}</small>
                                </span>
                                <Icon
                                    v-if="selectedRunnerId === runner.id"
                                    name="i-pixelarticons-check"
                                    class="ml-auto size-4"
                                />
                            </button>
                        </div>

                        <div class="or3-composer-menu__divider" />
                        <!-- Per-run agent model override; sent as runnerModel on send, not global configure roles. -->
                        <p class="or3-composer-menu__eyebrow">Agent model</p>
                        <div class="or3-composer-menu__picker">
                            <button
                                type="button"
                                class="or3-composer-menu__picker-trigger"
                                @click="modelPickerOpen = !modelPickerOpen"
                            >
                                <span>
                                    {{ selectedRunnerModelLabel }}
                                </span>
                                <Icon
                                    name="i-pixelarticons-chevron-down"
                                    class="size-4"
                                />
                            </button>
                                <div
                                    v-if="modelPickerOpen"
                                    class="or3-composer-menu__picker-panel"
                                >
                                    <input
                                        v-model="modelSearch"
                                        class="or3-composer-menu__input"
                                        type="text"
                                        :placeholder="
                                            activeRunnerModels.length
                                                ? 'Search models…'
                                                : 'Custom model id…'
                                        "
                                        @keydown.enter.prevent="
                                            selectRunnerModel(modelSearch)
                                        "
                                    />
                                    <div
                                        v-if="filteredRunnerModels.length"
                                        class="or3-composer-menu__model-list"
                                    >
                                        <button
                                            v-for="model in filteredRunnerModels"
                                            :key="runnerModelKey(model)"
                                            type="button"
                                            class="or3-composer-menu__model-option"
                                            :class="{
                                                'is-active':
                                                    selectedRunnerModel ===
                                                    runnerModelValue(model),
                                            }"
                                            @click="
                                                selectRunnerModel(
                                                    runnerModelValue(model),
                                                )
                                            "
                                        >
                                            <span>
                                                <span>{{
                                                    model.display_name ||
                                                    model.id
                                                }}</span>
                                                <small>{{
                                                    runnerModelProviderLabel(
                                                        model,
                                                    )
                                                }}</small>
                                                <small
                                                    v-if="
                                                        runnerModelOptionSummary(
                                                            model,
                                                        )
                                                    "
                                                    >{{
                                                        runnerModelOptionSummary(
                                                            model,
                                                        )
                                                    }}</small
                                                >
                                            </span>
                                            <Icon
                                                v-if="
                                                    selectedRunnerModel ===
                                                    runnerModelValue(model)
                                                "
                                                name="i-pixelarticons-check"
                                                class="size-4"
                                            />
                                        </button>
                                    </div>
                                    <button
                                        v-if="customModelCandidate"
                                        type="button"
                                        class="or3-composer-menu__model-option"
                                        @click="
                                            selectRunnerModel(
                                                customModelCandidate,
                                            )
                                        "
                                    >
                                        <span>
                                            <span
                                                >Use “{{
                                                    customModelCandidate
                                                }}”</span
                                            >
                                            <small>Custom model id</small>
                                        </span>
                                    </button>
                                    <button
                                        v-if="selectedRunnerModel"
                                        type="button"
                                        class="or3-composer-menu__model-option"
                                        @click="selectRunnerModel('')"
                                    >
                                        <span>
                                            <span>Use runner default</span>
                                            <small>{{
                                                activeRunnerDefaultModel ||
                                                'No model override'
                                            }}</small>
                                        </span>
                                    </button>
                                </div>
                            </div>
                            <template v-if="activeModelReasoningOptions.length">
                                <p
                                    class="or3-composer-menu__eyebrow or3-composer-menu__eyebrow--sub"
                                >
                                    Thinking
                                </p>
                                <div
                                    class="or3-composer-menu__chips"
                                    role="radiogroup"
                                    aria-label="Thinking level"
                                >
                                    <button
                                        type="button"
                                        class="or3-composer-menu__chip"
                                        :class="{
                                            'is-active':
                                                !selectedRunnerThinkingLevel,
                                        }"
                                        @click="selectRunnerThinkingLevel('')"
                                    >
                                        Auto
                                    </button>
                                    <button
                                        v-for="option in activeModelReasoningOptions"
                                        :key="option"
                                        type="button"
                                        class="or3-composer-menu__chip"
                                        :class="{
                                            'is-active':
                                                selectedRunnerThinkingLevel ===
                                                option,
                                        }"
                                         @click="
                                            selectRunnerThinkingLevel(option)
                                        "
                                    >
                                        {{ option }}
                                    </button>
                                </div>
                            </template>
                            <small class="or3-composer-menu__hint">
                                {{
                                    activeRunnerModels.length
                                        ? 'Pick a discovered model or type a custom id.'
                                        : 'No model list yet; type a custom id if needed.'
                                }}
                            </small>

                        <div class="or3-composer-menu__divider" />
                        <p class="or3-composer-menu__eyebrow">Mode</p>
                        <div
                            class="or3-composer-menu__modes"
                            role="radiogroup"
                            aria-label="Tool mode"
                        >
                            <button
                                v-for="option in modeOptions"
                                :key="option.id"
                                type="button"
                                class="or3-composer-menu__mode"
                                :class="{
                                    'is-active': selectedMode === option.id,
                                }"
                                :aria-checked="selectedMode === option.id"
                                role="radio"
                                @click="selectMode(option.id)"
                            >
                                <Icon :name="option.icon" class="size-4" />
                                <span class="or3-composer-menu__mode-copy">
                                    <span>{{ option.label }}</span>
                                    <small>{{ option.description }}</small>
                                </span>
                                <Icon
                                    v-if="selectedMode === option.id"
                                    name="i-pixelarticons-check"
                                    class="ml-auto size-4"
                                />
                            </button>
                        </div>
                    </div>
                </template>
            </UPopover>
            <input
                ref="fileInput"
                type="file"
                multiple
                class="hidden"
                accept="image/*,application/pdf,text/plain,.md,.txt,.json"
                aria-hidden="true"
                tabindex="-1"
                @change="handleFiles"
            />

            <div class="or3-composer__editor-wrap" @click.self="focusEditorAtEnd">
                <EditorContent
                    v-if="editor"
                    :editor="editor"
                    class="assistant-composer-editor min-h-6 max-h-40 overflow-y-auto text-base leading-6 text-(--or3-text) sm:text-[0.9375rem]"
                    aria-label="Message"
                />
            </div>

            <UButton
                v-if="!streaming"
                icon="i-pixelarticons-send"
                class="or3-composer__send or3-touch-target flex items-center justify-center bg-(--or3-green) text-white hover:bg-(--or3-green-dark)"
                aria-label="Send message"
                type="submit"
                :disabled="!canSend"
            />
            <UButton
                v-else
                icon="i-pixelarticons-square"
                color="error"
                variant="soft"
                class="or3-composer__send or3-touch-target flex items-center justify-center"
                aria-label="Stop generation"
                type="button"
                @click="emit('stop')"
            />
        </div>

        <div v-if="mentionMenu.open || slashMenu.open" class="mx-3 mb-3">
            <FileMentionMenu
                v-if="mentionMenu.open"
                :items="mentionMenu.items"
                :loading="mentionLoading"
                :error="mentionError"
                :selected-index="mentionMenu.selectedIndex"
                @select="selectMention"
            />
            <SlashCommandMenu
                v-else-if="slashMenu.open"
                :items="slashMenu.items"
                :selected-index="slashMenu.selectedIndex"
                @select="selectSlashCommand"
            />
        </div>
    </UForm>
    <CwdPickerSheet
        v-model:open="workspaceFilePickerOpen"
        purpose="file"
        @select-file="addWorkspacePickedFile"
    />
</template>

<script setup lang="ts">
import {
    computed,
    nextTick,
    onBeforeUnmount,
    onMounted,
    reactive,
    ref,
    shallowRef,
    watch,
} from 'vue';
import { Editor, EditorContent } from '@tiptap/vue-3';
import { Extension, mergeAttributes } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import HardBreak from '@tiptap/extension-hard-break';
import Placeholder from '@tiptap/extension-placeholder';
import Mention from '@tiptap/extension-mention';
import Suggestion from '@tiptap/suggestion';
import {
    registerPaneInput,
    unregisterPaneInput,
} from '../../composables/useChatInputBridge';
import {
    useChatCommands,
    type ChatCommandDefinition,
} from '../../composables/useChatCommands';
import {
    useFileMentionSuggestions,
    type FileMentionSuggestionItem,
} from '../../composables/useFileMentionSuggestions';
import { useComputerFiles } from '../../composables/useComputerFiles';
import type {
    AssistantSendPayload,
    ChatAttachment,
} from '../../types/app-state';
import type { ChatRunnerInfo } from '../../types/or3-api';
import { defaultRunnerModelForSelection } from '../../utils/runnerModelPolicy';

const props = withDefaults(
    defineProps<{
        modelValue?: string;
        streaming?: boolean;
        paneId?: string;
        mode?: 'ask' | 'work' | 'admin';
        selectedRunnerId?: string;
        selectedRunnerModel?: string;
        selectedRunnerThinkingLevel?: string;
        runners?: ChatRunnerInfo[];
    }>(),
    {
        modelValue: '',
        streaming: false,
        paneId: 'main',
        mode: 'work',
        selectedRunnerId: '',
        selectedRunnerModel: '',
        selectedRunnerThinkingLevel: '',
        runners: () => [],
    },
);

const emit = defineEmits<{
    'update:modelValue': [value: string];
    'update:mode': [value: 'ask' | 'work' | 'admin'];
    'update:selectedRunnerId': [value: string];
    'update:selectedRunnerModel': [value: string];
    'update:selectedRunnerThinkingLevel': [value: string];
    send: [value: AssistantSendPayload];
    stop: [];
}>();

interface DraftAttachment extends ChatAttachment {
    content?: string;
    file?: File;
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
const actionMenuOpen = ref(false);
const workspaceFilePickerOpen = ref(false);
const dragDepth = ref(0);
const submitLocked = ref(false);
const enterCreatesNewLine = ref(false);
const formState = reactive({
    text: props.modelValue,
});
const manualAttachments = ref<DraftAttachment[]>([]);
const workspaceMentionAttachments = ref<DraftAttachment[]>([]);
const workspacePickedAttachments = ref<DraftAttachment[]>([]);
const mentionMenu = reactive<{
    open: boolean;
    selectedIndex: number;
    items: FileMentionSuggestionItem[];
}>({
    open: false,
    selectedIndex: 0,
    items: [],
});
const slashMenu = reactive<{
    open: boolean;
    selectedIndex: number;
    items: ChatCommandDefinition[];
}>({
    open: false,
    selectedIndex: 0,
    items: [],
});

let viewportChangeCleanup: (() => void) | null = null;
let selectMentionFromSuggestion:
    | ((item: FileMentionSuggestionItem) => void)
    | null = null;
let selectSlashFromSuggestion: ((item: ChatCommandDefinition) => void) | null =
    null;

const {
    loading: mentionLoading,
    error: mentionError,
    search: searchMentionFiles,
    reset: resetMentionSearch,
} = useFileMentionSuggestions();
const { filterCommands, findCommand, runCommand } = useChatCommands();
const { fetchRoots, ensureDirectoryPath, uploadFilesToPath } =
    useComputerFiles();
const chat = useChatSessions();
const toast = useToast();

const displayedAttachments = computed(() => [
    ...workspaceMentionAttachments.value,
    ...workspacePickedAttachments.value,
    ...manualAttachments.value,
]);

const allModeOptions = [
    {
        id: 'ask' as const,
        label: 'Ask',
        icon: 'i-pixelarticons-message',
        description: 'Answer, read, and look things up.',
    },
    {
        id: 'work' as const,
        label: 'Work',
        icon: 'i-pixelarticons-edit-box',
        description: 'Use normal guarded work tools.',
    },
    {
        id: 'admin' as const,
        label: 'Admin',
        icon: 'i-pixelarticons-shield',
        description: 'Expose powerful tools when allowed.',
    },
] as const;

const { activeHost } = useActiveHost();
const modeOptions = computed(() => {
    if (activeHost.value?.role === 'admin') return [...allModeOptions];
    return allModeOptions.filter((option) => option.id !== 'admin');
});

const selectedMode = computed(() => props.mode ?? 'work');
const selectedRunnerId = computed(() => props.selectedRunnerId || '');
const selectedRunnerModel = computed(() => props.selectedRunnerModel || '');
const selectedRunnerThinkingLevel = computed(
    () => props.selectedRunnerThinkingLevel || '',
);
const modelPickerOpen = ref(false);
const modelSearch = ref('');

const runnerOptions = computed(() => {
    return props.runners.map((runner) => {
        const caps = runner.chat_capabilities || runner.supports.chat;
        const selectable =
            runner.status === 'available' &&
            (!runner.auth_status ||
                runner.auth_status === 'ready' ||
                runner.auth_status === 'unknown') &&
            caps?.chatSelectable !== false &&
            caps?.chatReplay !== false;
        const runtimeDetail = runnerRuntimeDetail(runner);
        const reason = runtimeDetail
            ? runtimeDetail
            : runner.status === 'missing'
              ? 'Binary missing'
              : runner.status === 'disabled_by_config'
                ? 'Disabled in config'
                : runner.auth_status === 'missing'
                  ? 'Auth required'
                  : !selectable
                    ? runner.disabled_reason || 'Unavailable'
                    : caps?.chatNativeSession
                      ? 'Replay and native session capable.'
                      : 'External runner (replay mode).';
        return {
            id: runner.id,
            label: runner.display_name || runner.id,
            description: reason,
            selectable,
            icon: 'i-pixelarticons-terminal',
        };
    });
});

const hasSelectableRunner = computed(() =>
    runnerOptions.value.some((runner) => runner.selectable),
);
const selectedRunnerIsSelectable = computed(() =>
    runnerOptions.value.some(
        (runner) => runner.id === selectedRunnerId.value && runner.selectable,
    ),
);
const activeRunner = computed(() =>
    props.runners.find((runner) => runner.id === selectedRunnerId.value),
);
const composerPlaceholder = computed(() => {
    const label =
        activeRunner.value?.display_name?.trim() ||
        activeRunner.value?.id?.trim();
    if (label) return `Ask ${label} for help…`;
    return 'Ask your runner for help…';
});
watch(composerPlaceholder, (text) => {
    editor.value?.view.dom.setAttribute('data-placeholder', text);
});
const activeRunnerModels = computed(() =>
    dedupeRunnerModelsForPicker(
        activeRunner.value?.models?.length
            ? activeRunner.value.models
            : activeRunner.value?.runtime?.models || [],
    ),
);
const activeRunnerDefaultModel = computed(
    () =>
        activeRunner.value?.default_model ||
        activeRunner.value?.runtime?.default_model ||
        activeRunnerModels.value.find((model) => model.default)?.id ||
        '',
);
const activeRunnerSelectedModel = computed(() => {
    const selected =
        selectedRunnerModel.value || activeRunnerDefaultModel.value;
    return activeRunnerModels.value.find(
        (model) =>
            model.id === selected || runnerModelValue(model) === selected,
    );
});
const activeModelReasoningOptions = computed(() =>
    (activeRunnerSelectedModel.value?.reasoning || [])
        .map((option) => String(option).trim())
        .filter(Boolean),
);
const selectedRunnerModelLabel = computed(() => {
    if (!selectedRunnerModel.value) {
        return activeRunnerDefaultModel.value
            ? `Default · ${activeRunnerDefaultModel.value}`
            : 'Runner default';
    }
    const model = activeRunnerModels.value.find(
        (item) =>
            item.id === selectedRunnerModel.value ||
            runnerModelValue(item) === selectedRunnerModel.value,
    );
    if (!model) return selectedRunnerModel.value;
    return model.display_name || model.id || selectedRunnerModel.value;
});
const filteredRunnerModels = computed(() => {
    const query = modelSearch.value.trim().toLowerCase();
    if (!query) return activeRunnerModels.value.slice(0, 80);
    return activeRunnerModels.value
        .filter((model) => {
            const haystack = [model.id, model.display_name, model.provider]
                .concat(model.provider_name ? [model.provider_name] : [])
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return haystack.includes(query);
        })
        .slice(0, 80);
});
const customModelCandidate = computed(() => {
    const value = modelSearch.value.trim();
    if (!value) return '';
    if (
        activeRunnerModels.value.some(
            (model) => model.id === value || runnerModelValue(model) === value,
        )
    ) {
        return '';
    }
    return value;
});

const hasSendableContent = computed(
    () => !!formState.text.trim() || displayedAttachments.value.length > 0,
);
const canSend = computed(
    () =>
        !props.streaming &&
        !submitLocked.value &&
        hasSendableContent.value &&
        selectedRunnerIsSelectable.value,
);

function editorPlainText() {
    return editor.value?.getText({ blockSeparator: '\n\n' }) ?? '';
}

watch(
    () => props.modelValue,
    (value) => {
        const normalized = value ?? '';
        if (formState.text === normalized) return;
        formState.text = normalized;
        const instance = editor.value;
        if (!instance || editorPlainText() === normalized) return;

        const selection = instance.state.selection;
        instance.commands.setContent(normalized, { emitUpdate: false });
        if (instance.isFocused) {
            const end = instance.state.doc.content.size;
            const from = Math.min(selection.from, end);
            const to = Math.min(selection.to, end);
            instance.commands.setTextSelection({ from, to });
        }
    },
);

watch(
    () => formState.text,
    (value) => {
        if (props.modelValue !== value) emit('update:modelValue', value);
    },
);

function attachmentId() {
    return `attachment_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function summarizeText(text: string, maxWords = 12) {
    const words = text.trim().split(/\s+/).filter(Boolean);
    return (
        words.slice(0, maxWords).join(' ') +
        (words.length > maxWords ? '…' : '')
    );
}

function updateEditorText(value: string) {
    formState.text = value;
    closeSuggestionMenus();
    editor.value?.commands.setContent(value || '', { emitUpdate: false });
}

function focusEditorAtEnd() {
    editor.value?.commands.focus('end');
}

function triggerFilePicker() {
    actionMenuOpen.value = false;
    fileInput.value?.click();
}

function openWorkspaceFilePicker() {
    actionMenuOpen.value = false;
    workspaceFilePickerOpen.value = true;
}

function selectMode(mode: 'ask' | 'work' | 'admin') {
    emit('update:mode', mode);
}

function selectRunner(runnerId: string) {
    emit('update:selectedRunnerId', runnerId);
    modelPickerOpen.value = false;
    modelSearch.value = '';
    const runner = props.runners.find((item) => item.id === runnerId);
    emit(
        'update:selectedRunnerModel',
        defaultRunnerModelForSelection(
            runnerId,
            runner?.default_model || runner?.runtime?.default_model,
        ),
    );
    emit('update:selectedRunnerThinkingLevel', '');
}

function selectRunnerModel(model: string) {
    const trimmed = model.trim();
    emit('update:selectedRunnerModel', trimmed);
    modelSearch.value = '';
    modelPickerOpen.value = false;
    const selected = activeRunnerModels.value.find(
        (item) => item.id === trimmed || runnerModelValue(item) === trimmed,
    );
    const options = selected?.reasoning || [];
    if (!options.includes(selectedRunnerThinkingLevel.value)) {
        emit(
            'update:selectedRunnerThinkingLevel',
            selected?.reasoning_default || '',
        );
    }
}

function selectRunnerThinkingLevel(level: string) {
    emit('update:selectedRunnerThinkingLevel', level.trim());
}

function runnerModelKey(model: { id: string; provider?: string }) {
    const id = model.id.trim();
    const provider = (model.provider || '').trim();
    return provider ? `${provider}/${id}` : id;
}

function runnerModelValue(model: { id: string; provider?: string }) {
    // OpenCode catalog IDs are authoritative. Prefixing provider/id here produced
    // invalid requests such as xiaomi/mimo-v2.5 when the catalog entry is
    // providerID=openrouter, modelID=mimo-v2.5.
    return model.id;
}

type RunnerPickerModel = {
    id: string;
    provider?: string;
    default?: boolean;
    display_name?: string;
    provider_name?: string;
    reasoning?: string[];
    reasoning_default?: string;
    options?: { id: string; label?: string; default?: string }[];
    capabilities?: { fast_mode?: boolean; reasoning?: boolean };
};

/** One row per model id; backend may list the same id under multiple providers. */
function dedupeRunnerModelsForPicker(models: RunnerPickerModel[]) {
    const byID = new Map<string, RunnerPickerModel>();
    for (const model of models) {
        const id = model.id?.trim();
        if (!id) continue;
        const existing = byID.get(id);
        if (!existing) {
            byID.set(id, model);
            continue;
        }
        if (model.default && !existing.default) {
            byID.set(id, model);
            continue;
        }
        if (!existing.provider?.trim() && model.provider?.trim()) {
            byID.set(id, model);
        }
    }
    return Array.from(byID.values());
}

function runnerModelProviderLabel(model: {
    id: string;
    provider?: string;
    provider_name?: string;
    default?: boolean;
}) {
    if (model.default) {
        const provider = model.provider_name || model.provider;
        return provider ? `Default · ${provider}` : 'Default';
    }
    if (model.provider_name && model.provider) {
        return `${model.provider_name} · ${model.provider}`;
    }
    return model.provider_name || model.provider || model.id;
}

function runnerModelOptionSummary(model: RunnerPickerModel) {
    const parts: string[] = [];
    const reasoning = (model.reasoning || []).filter(Boolean);
    if (reasoning.length) {
        parts.push(
            `Thinking: ${model.reasoning_default || reasoning[0] || 'auto'}`,
        );
    }
    if (model.capabilities?.fast_mode) parts.push('Fast mode');
    for (const option of model.options || []) {
        const label = option.label || option.id;
        const value = option.default;
        if (label && value) parts.push(`${label}: ${value}`);
    }
    return parts.slice(0, 3).join(' · ');
}

function runnerRuntimeDetail(runner: ChatRunnerInfo) {
    const runtime = runner.runtime;
    if (!runtime) return '';
    if (runtime.runtime_message) return runtime.runtime_message;
    if (runtime.fallback && runtime.fallback_reason) {
        return `Fallback: ${runtime.fallback_reason}`;
    }
    if (runtime.next_action) return runtime.next_action;
    const health = runtime.native_health ?? runtime.health;
    if (health?.message) return health.message;
    if (health?.detail) return health.detail;
    const state = runtime.state || runner.status;
    const kind = runtime.kind === 'native' ? 'Native' : 'CLI';
    if (state === 'ready') return `${kind} runtime ready`;
    if (state === 'starting') return `${kind} runtime starting`;
    if (state === 'fallback') return `${kind} fallback available`;
    if (state === 'error') return runtime.message || `${kind} runtime error`;
    return '';
}

watch(activeModelReasoningOptions, (options) => {
    if (!options.length && selectedRunnerThinkingLevel.value) {
        emit('update:selectedRunnerThinkingLevel', '');
        return;
    }
    if (
        selectedRunnerThinkingLevel.value &&
        !options.includes(selectedRunnerThinkingLevel.value)
    ) {
        emit('update:selectedRunnerThinkingLevel', '');
    }
});

function revokeAttachmentPreview(attachment: DraftAttachment) {
    if (attachment.objectUrl) URL.revokeObjectURL(attachment.objectUrl);
}

function clearManualAttachments() {
    for (const attachment of manualAttachments.value) {
        revokeAttachmentPreview(attachment);
    }
    manualAttachments.value = [];
}

function clearWorkspacePickedAttachments() {
    workspacePickedAttachments.value = [];
}

function closeMentionMenu() {
    mentionMenu.open = false;
    mentionMenu.selectedIndex = 0;
    mentionMenu.items = [];
    selectMentionFromSuggestion = null;
    resetMentionSearch();
}

function closeSlashMenu() {
    slashMenu.open = false;
    slashMenu.selectedIndex = 0;
    slashMenu.items = [];
    selectSlashFromSuggestion = null;
}

function closeSuggestionMenus() {
    closeMentionMenu();
    closeSlashMenu();
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

    if (
        workspacePickedAttachments.value.some(
            (attachment) => attachment.id === id,
        )
    ) {
        workspacePickedAttachments.value =
            workspacePickedAttachments.value.filter((item) => item.id !== id);
        return;
    }

    const attachment = manualAttachments.value.find((item) => item.id === id);
    if (attachment) revokeAttachmentPreview(attachment);
    manualAttachments.value = manualAttachments.value.filter(
        (item) => item.id !== id,
    );
}

function buildTransportText() {
    return buildTransportTextForAttachments();
}

function localFileAttachments() {
    return manualAttachments.value.filter(
        (attachment) =>
            attachment.kind === 'file' && attachment.source !== 'workspace',
    );
}

function localTextAttachments() {
    return manualAttachments.value.filter(
        (attachment) => attachment.kind === 'text',
    );
}

function workspaceFileAttachments(extraFiles: DraftAttachment[] = []) {
    return [
        ...workspaceMentionAttachments.value,
        ...workspacePickedAttachments.value,
        ...extraFiles,
    ];
}

function payloadAttachments(extraWorkspaceFiles: DraftAttachment[] = []) {
    return [
        ...workspaceFileAttachments(extraWorkspaceFiles),
        ...localTextAttachments(),
        ...(extraWorkspaceFiles.length ? [] : localFileAttachments()),
    ];
}

function buildTransportTextForAttachments(
    extraWorkspaceFiles: DraftAttachment[] = [],
) {
    const sections: string[] = [];
    const promptText = formState.text.trim();
    if (promptText) sections.push(promptText);

    const textAttachments = localTextAttachments().filter(
        (attachment) => attachment.content,
    );
    if (textAttachments.length) {
        sections.push(
            [
                'Additional pasted context:',
                ...textAttachments.map(
                    (attachment, index) =>
                        `Context block ${index + 1} (${attachment.name}):\n${attachment.content}`,
                ),
            ].join('\n\n'),
        );
    }

    const workspaceAttachments = workspaceFileAttachments(extraWorkspaceFiles);
    if (workspaceAttachments.length) {
        sections.push(
            [
                'Workspace files mentioned by the user:',
                ...workspaceAttachments.map(
                    (attachment) =>
                        `- ${attachment.rootId || 'workspace'}:${attachment.path || attachment.name}`,
                ),
            ].join('\n'),
        );
    }

    const localFiles = extraWorkspaceFiles.length ? [] : localFileAttachments();
    if (localFiles.length) {
        sections.push(
            `Local files selected in or3-app (names only, contents not uploaded): ${localFiles.map((attachment) => attachment.name).join(', ')}`,
        );
    }

    return sections.join('\n\n').trim();
}

function visiblePayloadText() {
    const promptText = formState.text.trim();
    if (promptText) return promptText;
    if (displayedAttachments.value.length === 1) {
        return `Shared ${displayedAttachments.value[0]?.name || 'an attachment'} for context.`;
    }
    return `Shared ${displayedAttachments.value.length} attachments for context.`;
}

function createUploadBatchPath() {
    const stamp = new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .replace('T', '_')
        .replace('Z', '');
    const suffix = Math.random().toString(36).slice(2, 8);
    return `.uploads/${stamp}-${suffix}`;
}

function toPayloadAttachment(attachment: DraftAttachment): ChatAttachment {
    const {
        content,
        file: _file,
        thumbnailUrl: _thumbnailUrl,
        objectUrl: _objectUrl,
        ...rest
    } = attachment;
    const payload: ChatAttachment = { ...rest };
    if (payload.path || payload.rootId || payload.root_id) {
        payload.source = 'workspace_ref';
    } else if (payload.kind === 'text' && content) {
        payload.source = 'text_block';
        payload.content_excerpt = content.slice(0, 1200);
    } else if (!payload.source) {
        payload.source = 'local_artifact';
    }
    return payload;
}

async function stageLocalFilesForExternalRunner() {
    const attachments = localFileAttachments().filter(
        (attachment): attachment is DraftAttachment & { file: File } =>
            attachment.file instanceof File,
    );
    if (!attachments.length) {
        return [] as DraftAttachment[];
    }

    const rootResponse = await fetchRoots();
    const roots = Array.isArray(rootResponse)
        ? rootResponse
        : (rootResponse.items ?? []);
    const workspaceRoot = roots.find((root) => root.id === 'workspace');
    if (!workspaceRoot) {
        throw new Error(
            'This computer does not expose a writable workspace root for staging runner attachments.',
        );
    }
    if (workspaceRoot.writable === false) {
        throw new Error(
            'The workspace root is read-only, so external runners cannot access uploaded attachments.',
        );
    }

    const batchPath = createUploadBatchPath();
    await ensureDirectoryPath(batchPath, workspaceRoot.id);
    const uploads = await uploadFilesToPath(
        attachments.map((attachment) => attachment.file),
        workspaceRoot.id,
        batchPath,
    );

    return attachments.map((attachment, index) => {
        const uploaded = uploads[index];
        const uploadedPath =
            uploaded?.path || `${batchPath}/${attachment.name}`;
        return {
            id: `${workspaceRoot.id}:${uploadedPath}`,
            kind: 'file' as const,
            source: 'workspace' as const,
            name: attachment.name,
            preview: uploadedPath,
            mimeType: attachment.mimeType,
            size: attachment.size,
            path: uploadedPath,
            rootId: workspaceRoot.id,
        };
    });
}

async function maybeRunSlashCommandFromInput() {
    if (displayedAttachments.value.length > 0) return false;
    const match = formState.text.trim().match(/^\/([a-z0-9_-]+)$/i);
    if (!match) return false;
    const command = findCommand(match[1] || '');
    if (!command) return false;
    const result = await runCommand(command);
    if (!result.handled) return false;
    updateEditorText('');
    return true;
}

async function submit() {
    if (props.streaming || submitLocked.value) return;
    submitLocked.value = true;
    if (await maybeRunSlashCommandFromInput()) {
        window.setTimeout(() => {
            submitLocked.value = false;
        }, 350);
        return;
    }
    if (!hasSendableContent.value) {
        submitLocked.value = false;
        return;
    }
    if (!selectedRunnerIsSelectable.value) {
        toast.add({
            title: hasSelectableRunner.value
                ? 'Choose an available runner'
                : 'No runner available',
            description: hasSelectableRunner.value
                ? 'Select an authenticated runner before sending.'
                : 'Install or authenticate a runner, then retry.',
            color: 'warning',
            icon: 'i-pixelarticons-warning-box',
        });
        submitLocked.value = false;
        return;
    }

    let stagedWorkspaceAttachments: DraftAttachment[] = [];
    try {
        stagedWorkspaceAttachments = await stageLocalFilesForExternalRunner();
    } catch (error: any) {
        toast.add({
            title: 'Could not stage attachments',
            description:
                error?.message ||
                'OR3 could not upload those files into the workspace for the external runner.',
            color: 'error',
            icon: 'i-pixelarticons-warning-box',
        });
        submitLocked.value = false;
        return;
    }

    const draftAttachments = payloadAttachments(stagedWorkspaceAttachments);
    const attachments: ChatAttachment[] =
        draftAttachments.map(toPayloadAttachment);

    const payload: AssistantSendPayload = {
        text: visiblePayloadText(),
        transportText: buildTransportTextForAttachments(
            stagedWorkspaceAttachments,
        ),
        attachments,
        runnerId: selectedRunnerId.value,
        runnerModel: selectedRunnerModel.value || undefined,
        runnerThinkingLevel: activeModelReasoningOptions.value.includes(
            selectedRunnerThinkingLevel.value,
        )
            ? selectedRunnerThinkingLevel.value
            : undefined,
        runnerLabel: runnerOptions.value.find(
            (runner) => runner.id === selectedRunnerId.value,
        )?.label,
    };

    emit('send', payload);
    clearManualAttachments();
    clearWorkspacePickedAttachments();
    updateEditorText('');
    window.setTimeout(() => {
        submitLocked.value = false;
    }, 350);
}

function addFiles(files: File[]) {
    for (const file of files) {
        const isImage = file.type.startsWith('image/');
        const objectUrl = isImage ? URL.createObjectURL(file) : undefined;
        manualAttachments.value.push({
            id: attachmentId(),
            kind: 'file',
            name: file.name,
            file,
            thumbnailUrl: objectUrl,
            objectUrl,
            preview: file.type
                ? file.type.replace(/\/.+$/, '').toUpperCase()
                : 'FILE',
            mimeType: file.type || undefined,
            size: file.size || undefined,
            source: 'local',
        });
    }
}

function addWorkspacePickedFile(file: {
    rootId: string;
    rootLabel?: string;
    path: string;
    name: string;
    size?: number;
    mimeType?: string;
}) {
    const id = `${file.rootId}:${file.path}`;
    if (
        workspacePickedAttachments.value.some(
            (attachment) => attachment.id === id,
        ) ||
        workspaceMentionAttachments.value.some(
            (attachment) => attachment.id === id,
        )
    ) {
        return;
    }
    workspacePickedAttachments.value.push({
        id,
        kind: 'file',
        source: 'workspace',
        name: file.name || file.path,
        preview: file.rootLabel
            ? `${file.rootLabel} - ${file.path}`
            : file.path,
        path: file.path,
        rootId: file.rootId,
        mimeType: file.mimeType,
        size: file.size,
    });
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

function syncViewportEnterBehavior() {
    if (typeof window === 'undefined') return;

    const media = window.matchMedia('(max-width: 767px)');
    const update = () => {
        enterCreatesNewLine.value = media.matches;
    };

    update();

    if (typeof media.addEventListener === 'function') {
        media.addEventListener('change', update);
        viewportChangeCleanup = () =>
            media.removeEventListener('change', update);
        return;
    }

    media.addListener(update);
    viewportChangeCleanup = () => media.removeListener(update);
}

function moveSelection(delta: number, length: number, current: number) {
    if (!length) return 0;
    return Math.min(length - 1, Math.max(0, current + delta));
}

function selectMention(item = mentionMenu.items[mentionMenu.selectedIndex]) {
    if (!item || !selectMentionFromSuggestion) return;
    selectMentionFromSuggestion(item);
}

function selectSlashCommand(item = slashMenu.items[slashMenu.selectedIndex]) {
    if (!item || !selectSlashFromSuggestion) return;
    selectSlashFromSuggestion(item);
}

function createMentionRenderHooks() {
    return {
        onStart: (
            props: SuggestionLifecycleProps<FileMentionSuggestionItem>,
        ) => {
            mentionMenu.open = true;
            mentionMenu.items = props.items;
            mentionMenu.selectedIndex = 0;
            selectMentionFromSuggestion = props.command;
            closeSlashMenu();
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

function createSlashRenderHooks() {
    return {
        onStart: (props: SuggestionLifecycleProps<ChatCommandDefinition>) => {
            slashMenu.open = true;
            slashMenu.items = props.items;
            slashMenu.selectedIndex = 0;
            selectSlashFromSuggestion = props.command;
            closeMentionMenu();
        },
        onUpdate: (props: SuggestionLifecycleProps<ChatCommandDefinition>) => {
            slashMenu.open = true;
            slashMenu.items = props.items;
            slashMenu.selectedIndex = Math.min(
                slashMenu.selectedIndex,
                Math.max(0, props.items.length - 1),
            );
            selectSlashFromSuggestion = props.command;
        },
        onKeyDown: ({ event }: SuggestionKeydownProps) => {
            if (!slashMenu.open) return false;
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                slashMenu.selectedIndex = moveSelection(
                    1,
                    slashMenu.items.length,
                    slashMenu.selectedIndex,
                );
                return true;
            }
            if (event.key === 'ArrowUp') {
                event.preventDefault();
                slashMenu.selectedIndex = moveSelection(
                    -1,
                    slashMenu.items.length,
                    slashMenu.selectedIndex,
                );
                return true;
            }
            if (
                (event.key === 'Enter' || event.key === 'Tab') &&
                slashMenu.items.length
            ) {
                event.preventDefault();
                selectSlashCommand();
                return true;
            }
            if (event.key === 'Escape') {
                event.preventDefault();
                closeSlashMenu();
                return true;
            }
            return false;
        },
        onExit: () => {
            closeSlashMenu();
        },
    };
}

onMounted(() => {
    syncViewportEnterBehavior();

    const mentionRenderHooks = createMentionRenderHooks();
    const slashRenderHooks = createSlashRenderHooks();
    const editorInstanceId = Math.random().toString(36).slice(2);
    const fileMentionSuggestionPluginKey = new PluginKey(
        `assistantFileMentionSuggestion-${editorInstanceId}`,
    );
    const slashCommandSuggestionPluginKey = new PluginKey(
        `assistantSlashCommandSuggestion-${editorInstanceId}`,
    );

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
                node.attrs.path ||
                node.attrs.label ||
                node.attrs.name ||
                'file';
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
                node.attrs.path ||
                node.attrs.label ||
                node.attrs.name ||
                'file';
            return `@${label}`;
        },
    }).configure({
        deleteTriggerWithBackspace: true,
        suggestion: {
            pluginKey: fileMentionSuggestionPluginKey,
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

    const SlashCommand = Extension.create({
        name: 'slashCommand',
        addProseMirrorPlugins() {
            return [
                Suggestion({
                    pluginKey: slashCommandSuggestionPluginKey,
                    editor: this.editor as any,
                    char: '/',
                    startOfLine: true,
                    allowSpaces: false,
                    items: ({ query }) => filterCommands(query),
                    command: ({
                        editor: instance,
                        range,
                        props: item,
                    }: any) => {
                        instance.chain().focus().deleteRange(range).run();
                        void runCommand(item);
                    },
                    render: () => slashRenderHooks as any,
                }),
            ];
        },
    }) as any;

    editor.value = new Editor({
        content: props.modelValue || '',
        extensions: [
            Document,
            Paragraph,
            Text,
            HardBreak,
            Placeholder.configure({
                placeholder: () => composerPlaceholder.value,
            }),
            FileMention as any,
            SlashCommand as any,
        ],
        autofocus: false,
        editorProps: {
            attributes: {
                class: 'min-h-6 outline-none',
                'data-placeholder': composerPlaceholder.value,
            },
            handleKeyDown(_view, event) {
                if (
                    (mentionMenu.open || slashMenu.open) &&
                    event.key === 'Escape'
                ) {
                    event.preventDefault();
                    closeSuggestionMenus();
                    return true;
                }

                if (event.key === 'Enter' && !event.isComposing) {
                    if (enterCreatesNewLine.value) {
                        if (event.metaKey || event.ctrlKey) {
                            event.preventDefault();
                            void submit();
                            return true;
                        }
                        return false;
                    }

                    if (event.shiftKey) return false;
                    event.preventDefault();
                    void submit();
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
            formState.text = instance.getText({ blockSeparator: '\n\n' });
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

    registerPaneInput(props.paneId, {
        setText: (value) => {
            updateEditorText(value);
            nextTick(() => focusEditorAtEnd());
        },
        triggerSend: submit,
    });
});

onBeforeUnmount(() => {
    unregisterPaneInput(props.paneId);
    viewportChangeCleanup?.();
    closeSuggestionMenus();
    clearManualAttachments();
    clearWorkspacePickedAttachments();
    const dom = editor.value?.view.dom;
    dom?.removeEventListener('dragenter', onDragEnter);
    dom?.removeEventListener('dragover', onDragOver);
    dom?.removeEventListener('dragleave', onDragLeave);
    dom?.removeEventListener('drop', onDrop);
    editor.value?.destroy();
});
</script>

<style scoped>
.or3-composer {
    border-radius: 2rem;
    overflow: hidden;
    transition:
        border-color 0.18s ease,
        box-shadow 0.18s ease,
        transform 0.18s ease;
}

.or3-composer--focused {
    border-color: color-mix(in srgb, var(--or3-green) 42%, white 58%);
    box-shadow:
        var(--or3-shadow),
        0 0 0 1px color-mix(in srgb, var(--or3-green) 22%, transparent);
}

.or3-composer__attachments {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding: 0.9rem 0.9rem 0;
}

.or3-composer__attachment {
    display: inline-flex;
    align-items: center;
    gap: 0.625rem;
    max-width: 100%;
    min-height: 3.5rem;
    border-radius: 1.25rem;
    border: 1px solid var(--or3-border);
    background: color-mix(in srgb, white 88%, var(--or3-surface-soft) 12%);
    padding: 0.75rem 0.875rem;
    font-size: 0.8125rem;
}

.or3-composer__attachment-thumb {
    width: 2.75rem;
    height: 2.75rem;
    flex-shrink: 0;
    border-radius: 0.9rem;
    object-fit: cover;
    border: 1px solid color-mix(in srgb, var(--or3-border) 88%, transparent);
    background: color-mix(in srgb, white 70%, var(--or3-surface-soft) 30%);
}

.or3-composer__row {
    display: flex;
    align-items: flex-end;
    gap: 0.35rem;
    padding: 0.65rem 0.75rem;
}

.or3-composer__editor-wrap {
    flex: 1 1 auto;
    min-width: 0;
    align-self: stretch;
    display: flex;
    align-items: center;
    padding: 0.4rem 0.35rem 0.4rem 0.15rem;
}

.or3-composer__icon,
.or3-composer__send {
    width: 2.8rem;
    min-width: 2.8rem;
    height: 2.8rem;
    border-radius: 9999px;
}

.or3-composer__icon {
    align-self: flex-end;
}

.or3-composer__plus {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    background: transparent;
    color: var(--or3-text-muted);
}

.or3-composer__plus:hover,
.or3-composer__plus[aria-expanded='true'] {
    background: color-mix(in srgb, var(--or3-surface-soft) 72%, white 28%);
    color: var(--or3-text);
}

.or3-composer-menu {
    width: min(21rem, calc(100vw - 2rem));
    max-height: min(32rem, calc(100vh - 8rem));
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-gutter: stable;
    -webkit-overflow-scrolling: touch;
    border-radius: 1.25rem;
    border: 1px solid var(--or3-border);
    background: color-mix(in srgb, white 94%, var(--or3-surface) 6%);
    padding: 0.55rem;
    box-shadow: 0 18px 44px rgba(35, 31, 27, 0.16);
}

.or3-composer-menu__item,
.or3-composer-menu__mode {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    border: 0;
    border-radius: 0.8rem;
    background: transparent;
    color: var(--or3-text);
    text-align: left;
}

.or3-composer-menu__item {
    min-height: 2.8rem;
    padding: 0.55rem 0.65rem;
    font-size: 0.96rem;
    font-weight: 650;
}

.or3-composer-menu__item:hover,
.or3-composer-menu__mode:hover {
    background: color-mix(in srgb, var(--or3-surface-soft) 82%, white 18%);
}

.or3-composer-menu__divider {
    height: 1px;
    margin: 0.45rem 0.2rem;
    background: var(--or3-border);
}

.or3-composer-menu__eyebrow {
    margin: 0.2rem 0.55rem 0.35rem;
    color: var(--or3-text-muted);
    font-size: 0.68rem;
    font-weight: 800;
    text-transform: uppercase;
}

.or3-composer-menu__input {
    width: 100%;
    border: 1px solid var(--or3-border);
    border-radius: 0.8rem;
    background: var(--or3-surface);
    color: var(--or3-text);
    font-size: 0.9rem;
    padding: 0.62rem 0.7rem;
}

.or3-composer-menu__picker {
    position: relative;
    display: grid;
    gap: 0.35rem;
}

.or3-composer-menu__picker-trigger {
    width: 100%;
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.65rem;
    border: 1px solid var(--or3-border);
    border-radius: 0.8rem;
    background: var(--or3-surface);
    color: var(--or3-text);
    font-size: 0.9rem;
    font-weight: 750;
    padding: 0.62rem 0.7rem;
}

.or3-composer-menu__picker-trigger span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.or3-composer-menu__picker-panel {
    display: grid;
    gap: 0.35rem;
    border: 1px solid var(--or3-border);
    border-radius: 0.9rem;
    background: color-mix(in srgb, white 94%, var(--or3-surface) 6%);
    padding: 0.4rem;
}

.or3-composer-menu__model-list {
    display: grid;
    gap: 0.15rem;
    max-height: 12rem;
    overflow-y: auto;
}

.or3-composer-menu__model-option {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.65rem;
    border: 0;
    border-radius: 0.75rem;
    background: transparent;
    color: var(--or3-text);
    padding: 0.5rem 0.55rem;
    text-align: left;
}

.or3-composer-menu__model-option:hover,
.or3-composer-menu__model-option.is-active {
    background: color-mix(in srgb, var(--or3-green-soft) 30%, white 70%);
}

.or3-composer-menu__model-option span span,
.or3-composer-menu__model-option small {
    display: block;
}

.or3-composer-menu__model-option span span {
    font-size: 0.86rem;
    font-weight: 800;
}

.or3-composer-menu__model-option small {
    color: var(--or3-text-muted);
    font-size: 0.72rem;
    font-weight: 650;
}

.or3-composer-menu__eyebrow--sub {
    margin-top: 0.55rem;
}

.or3-composer-menu__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
}

.or3-composer-menu__chip {
    border: 1px solid var(--or3-border);
    border-radius: 999px;
    background: var(--or3-surface);
    color: var(--or3-text);
    font-size: 0.76rem;
    font-weight: 800;
    padding: 0.35rem 0.55rem;
    text-transform: capitalize;
}

.or3-composer-menu__chip.is-active {
    border-color: color-mix(
        in srgb,
        var(--or3-green-dark) 52%,
        var(--or3-border)
    );
    background: color-mix(in srgb, var(--or3-green-soft) 42%, white 58%);
    color: var(--or3-green-dark);
}

.or3-composer-menu__hint {
    display: block;
    margin: 0.35rem 0.55rem 0;
    color: var(--or3-text-muted);
    font-size: 0.72rem;
    line-height: 1.25;
}

.or3-composer-menu__modes {
    display: grid;
    gap: 0.15rem;
}

.or3-composer-menu__mode {
    min-height: 3.4rem;
    padding: 0.55rem 0.65rem;
}

.or3-composer-menu__mode.is-active {
    color: var(--or3-green-dark);
    background: color-mix(in srgb, var(--or3-green-soft) 34%, white 66%);
}

.or3-composer-menu__mode.is-disabled {
    cursor: not-allowed;
    opacity: 0.55;
}

.or3-composer-menu__mode-copy {
    display: grid;
    min-width: 0;
    gap: 0.08rem;
    font-weight: 750;
}

.or3-composer-menu__mode-copy small {
    overflow: hidden;
    color: var(--or3-text-muted);
    font-size: 0.73rem;
    font-weight: 600;
    line-height: 1.25;
    text-overflow: ellipsis;
    white-space: nowrap;
}

:deep(.assistant-composer-editor .ProseMirror) {
    font-size: 16px;
    min-height: 1.5rem;
    outline: none;
    white-space: pre-wrap;
    word-break: break-word;
}

@media (min-width: 640px) {
    :deep(.assistant-composer-editor .ProseMirror) {
        font-size: 0.9375rem;
    }
}

:deep(
    .assistant-composer-editor
        .ProseMirror
        p.is-editor-empty:first-child::before
) {
    content: attr(data-placeholder);
    float: left;
    color: var(--or3-text-muted);
    pointer-events: none;
    height: 0;
}

:deep(.assistant-composer-editor .ProseMirror p) {
    margin: 0;
}

:deep(.assistant-composer-editor .or3-file-mention) {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--or3-green) 16%, white 84%);
    color: var(--or3-green-dark);
    padding: 0.05rem 0.45rem;
    font-weight: 600;
}
</style>
