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

        <div v-if="displayedAttachments.length" class="or3-composer__attachments">
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
                    :name="attachment.kind === 'text' ? 'i-pixelarticons-notebook' : attachment.source === 'workspace' ? 'i-pixelarticons-file' : 'i-pixelarticons-paperclip'"
                    class="size-4 shrink-0 text-(--or3-green-dark)"
                />
                <span class="min-w-0 flex-1 text-left">
                    <span class="block truncate font-medium text-(--or3-text)">{{ attachment.name }}</span>
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
            <UButton
                icon="i-pixelarticons-paperclip"
                color="neutral"
                variant="ghost"
                class="or3-composer__icon or3-touch-target"
                aria-label="Attach file"
                type="button"
                @click="fileInput?.click()"
            />
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

            <div class="or3-composer__editor-wrap" @click="focusEditor">
                <EditorContent
                    v-if="editor"
                    :editor="editor"
                    class="assistant-composer-editor min-h-6 max-h-40 overflow-y-auto text-base leading-6 text-(--or3-text) sm:text-[0.9375rem]"
                    aria-label="Message or3-intern"
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
import StarterKit from '@tiptap/starter-kit';
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
import type {
    AssistantSendPayload,
    ChatAttachment,
} from '../../types/app-state';

const props = withDefaults(
    defineProps<{
        modelValue?: string;
        streaming?: boolean;
        paneId?: string;
    }>(),
    {
        modelValue: '',
        streaming: false,
        paneId: 'main',
    },
);

const emit = defineEmits<{
    'update:modelValue': [value: string];
    send: [value: AssistantSendPayload];
    stop: [];
}>();

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
const enterCreatesNewLine = ref(false);
const formState = reactive({
    text: props.modelValue,
});
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
let selectMentionFromSuggestion: ((item: FileMentionSuggestionItem) => void) | null = null;
let selectSlashFromSuggestion: ((item: ChatCommandDefinition) => void) | null = null;

const {
    loading: mentionLoading,
    error: mentionError,
    search: searchMentionFiles,
    reset: resetMentionSearch,
} = useFileMentionSuggestions();
const { filterCommands, findCommand, runCommand } = useChatCommands();

const displayedAttachments = computed(() => [
    ...workspaceMentionAttachments.value,
    ...manualAttachments.value,
]);

const canSend = computed(
    () => !!formState.text.trim() || displayedAttachments.value.length > 0,
);

watch(
    () => props.modelValue,
    (value) => {
        if (formState.text === value) return;
        formState.text = value;
        if (
            editor.value &&
            editor.value.getText({ blockSeparator: '\n\n' }) !== value
        ) {
            editor.value.commands.setContent(value || '', false);
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
    editor.value?.commands.setContent(value || '', false);
}

function focusEditor() {
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
            node.attrs.id || `${node.attrs.rootId || 'workspace'}:${node.attrs.path || node.attrs.name || 'file'}`,
        );
        if (nextAttachments.has(id)) return;
        nextAttachments.set(id, {
            id,
            kind: 'file',
            source: 'workspace',
            name: node.attrs.name || node.attrs.label || node.attrs.path || 'Workspace file',
            preview: node.attrs.path || undefined,
            mimeType: node.attrs.mimeType || undefined,
            size: typeof node.attrs.size === 'number' ? node.attrs.size : undefined,
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
            node.attrs.id || `${node.attrs.rootId || 'workspace'}:${node.attrs.path || node.attrs.name || 'file'}`,
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
            to: trailing === ' ' ? pos + node.nodeSize + 1 : pos + node.nodeSize,
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

function buildTransportText() {
    const sections: string[] = [];
    const promptText = formState.text.trim();
    if (promptText) sections.push(promptText);

    const textAttachments = manualAttachments.value.filter(
        (attachment) => attachment.kind === 'text' && attachment.content,
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

    const localFiles = manualAttachments.value.filter(
        (attachment) => attachment.kind === 'file' && attachment.source !== 'workspace',
    );
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
    if (props.streaming) return;
    if (await maybeRunSlashCommandFromInput()) return;
    if (!canSend.value) return;

    const payload: AssistantSendPayload = {
        text: visiblePayloadText(),
        transportText: buildTransportText(),
        attachments: displayedAttachments.value.map(
            ({
                content: _content,
                thumbnailUrl: _thumbnailUrl,
                objectUrl: _objectUrl,
                ...attachment
            }) => attachment,
        ),
    };

    emit('send', payload);
    clearManualAttachments();
    updateEditorText('');
}

function addFiles(files: File[]) {
    for (const file of files) {
        const isImage = file.type.startsWith('image/');
        const objectUrl = isImage ? URL.createObjectURL(file) : undefined;
        manualAttachments.value.push({
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
        });
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
        onStart: (props: SuggestionLifecycleProps<FileMentionSuggestionItem>) => {
            mentionMenu.open = true;
            mentionMenu.items = props.items;
            mentionMenu.selectedIndex = 0;
            selectMentionFromSuggestion = props.command;
            closeSlashMenu();
        },
        onUpdate: (props: SuggestionLifecycleProps<FileMentionSuggestionItem>) => {
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
            const label = node.attrs.path || node.attrs.label || node.attrs.name || 'file';
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
            const label = node.attrs.path || node.attrs.label || node.attrs.name || 'file';
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

    const SlashCommand = Extension.create({
        name: 'slashCommand',
        addProseMirrorPlugins() {
            return [
                Suggestion({
                    editor: this.editor as any,
                    char: '/',
                    startOfLine: true,
                    allowSpaces: false,
                    items: ({ query }) => filterCommands(query),
                    command: ({ editor: instance, range, props: item }: any) => {
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
            StarterKit.configure({
                heading: false,
                blockquote: false,
                bulletList: false,
                orderedList: false,
                codeBlock: false,
                horizontalRule: false,
            }),
            Placeholder.configure({
                placeholder: 'Ask or3-intern to help with your computer…',
            }),
            FileMention as any,
            SlashCommand as any,
        ],
        autofocus: false,
        editorProps: {
            attributes: {
                class: 'min-h-6 outline-none',
            },
            handleKeyDown(_view, event) {
                if ((mentionMenu.open || slashMenu.open) && event.key === 'Escape') {
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
            nextTick(() => focusEditor());
        },
        triggerSend: submit,
    });
});

onBeforeUnmount(() => {
    unregisterPaneInput(props.paneId);
    viewportChangeCleanup?.();
    closeSuggestionMenus();
    clearManualAttachments();
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
