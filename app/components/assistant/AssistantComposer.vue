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

        <div v-if="attachments.length" class="or3-composer__attachments">
            <button
                v-for="attachment in attachments"
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
                        >{{ attachment.preview }}</span
                    >
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

        <div
            v-if="mentionState.open"
            class="mx-3 mb-3 overflow-hidden rounded-2xl border border-(--or3-border) bg-(--or3-surface) shadow-(--or3-shadow-soft)"
        >
            <div
                class="flex items-center gap-2 border-b border-(--or3-border) px-3 py-2 text-xs text-(--or3-text-muted)"
            >
                <Icon
                    name="i-pixelarticons-file"
                    class="size-3.5 text-(--or3-green-dark)"
                />
                <span class="font-mono uppercase tracking-[0.16em]"
                    >Mention file</span
                >
                <span v-if="mentionState.loading" class="ml-auto"
                    >Searching…</span
                >
            </div>
            <div
                v-if="mentionState.items.length"
                class="max-h-56 overflow-y-auto p-1"
            >
                <button
                    v-for="(item, index) in mentionState.items"
                    :key="`${item.root_id}:${item.path}`"
                    type="button"
                    class="flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left text-sm"
                    :class="
                        index === mentionState.selectedIndex
                            ? 'bg-(--or3-green-soft) text-(--or3-green-dark)'
                            : 'text-(--or3-text) hover:bg-(--or3-surface-soft)'
                    "
                    @mousedown.prevent="selectMention(item)"
                >
                    <Icon
                        name="i-pixelarticons-file"
                        class="mt-0.5 size-4 shrink-0"
                    />
                    <span class="min-w-0 flex-1">
                        <span class="block truncate font-medium">{{
                            item.name
                        }}</span>
                        <span
                            class="block truncate text-xs text-(--or3-text-muted)"
                            >{{ item.root_label }} / {{ item.path }}</span
                        >
                    </span>
                </button>
            </div>
            <p v-else class="px-3 py-3 text-sm text-(--or3-text-muted)">
                {{
                    mentionState.loading
                        ? 'Searching workspace files…'
                        : 'No files found. Keep typing after @ to search.'
                }}
            </p>
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
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import {
    registerPaneInput,
    unregisterPaneInput,
} from '../../composables/useChatInputBridge';
import { useComputerFiles } from '../../composables/useComputerFiles';
import type {
    AssistantSendPayload,
    ChatAttachment,
} from '../../types/app-state';
import type { FileSearchItem } from '../../types/or3-api';

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

interface MentionEditorState {
    state: {
        selection: {
            empty: boolean;
            from: number;
        };
        doc: {
            textBetween: (
                from: number,
                to: number,
                blockSeparator?: string,
                leafText?: string,
            ) => string;
        };
    };
}

const fileInput = ref<HTMLInputElement | null>(null);
const editor = shallowRef<Editor>();
const isDragging = ref(false);
const isFocused = ref(false);
const dragDepth = ref(0);
const attachments = ref<DraftAttachment[]>([]);
const enterCreatesNewLine = ref(false);
const { searchWorkspaceFiles } = useComputerFiles();
const formState = reactive({
    text: props.modelValue,
});
const mentionState = reactive<{
    open: boolean;
    query: string;
    from: number;
    to: number;
    selectedIndex: number;
    loading: boolean;
    items: FileSearchItem[];
}>({
    open: false,
    query: '',
    from: 0,
    to: 0,
    selectedIndex: 0,
    loading: false,
    items: [],
});
let mentionSearchTimer: ReturnType<typeof setTimeout> | null = null;
let viewportChangeCleanup: (() => void) | null = null;

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
const canSend = computed(
    () => !!formState.text.trim() || attachments.value.length > 0,
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
    editor.value?.commands.setContent(value || '', false);
}

function focusEditor() {
    editor.value?.commands.focus('end');
}

function revokeAttachmentPreview(attachment: DraftAttachment) {
    if (attachment.objectUrl) URL.revokeObjectURL(attachment.objectUrl);
}

function removeAttachment(id: string) {
    const attachment = attachments.value.find((item) => item.id === id);
    if (attachment) revokeAttachmentPreview(attachment);
    attachments.value = attachments.value.filter((item) => item.id !== id);
}

function clearAttachments() {
    for (const attachment of attachments.value) {
        revokeAttachmentPreview(attachment);
    }
    attachments.value = [];
}

function closeMention() {
    mentionState.open = false;
    mentionState.query = '';
    mentionState.items = [];
    mentionState.selectedIndex = 0;
    mentionState.loading = false;
}

function buildTransportText() {
    const sections: string[] = [];
    const promptText = formState.text.trim();
    if (promptText) sections.push(promptText);

    const textAttachments = attachments.value.filter(
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

    const workspaceFiles = attachments.value.filter(
        (attachment) =>
            attachment.kind === 'file' && attachment.source === 'workspace',
    );
    if (workspaceFiles.length) {
        sections.push(
            [
                'Workspace files mentioned by the user:',
                ...workspaceFiles.map(
                    (attachment) =>
                        `- ${attachment.rootId || 'workspace'}:${attachment.path || attachment.name}`,
                ),
            ].join('\n'),
        );
    }

    const localFiles = attachments.value.filter(
        (attachment) =>
            attachment.kind === 'file' && attachment.source !== 'workspace',
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
    if (attachments.value.length === 1)
        return `Shared ${attachments.value[0]?.name || 'an attachment'} for context.`;
    return `Shared ${attachments.value.length} attachments for context.`;
}

function submit() {
    if (!canSend.value || props.streaming) return;
    const payload: AssistantSendPayload = {
        text: visiblePayloadText(),
        transportText: buildTransportText(),
        attachments: attachments.value.map(
            ({
                content: _content,
                thumbnailUrl: _thumbnailUrl,
                objectUrl: _objectUrl,
                ...attachment
            }) => attachment,
        ),
    };
    emit('send', payload);
    clearAttachments();
    updateEditorText('');
}

function addFiles(files: File[]) {
    for (const file of files) {
        const isImage = file.type.startsWith('image/');
        const objectUrl = isImage ? URL.createObjectURL(file) : undefined;
        attachments.value.push({
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

function addWorkspaceFileMention(item: FileSearchItem) {
    const id = `${item.root_id}:${item.path}`;
    if (attachments.value.some((attachment) => attachment.id === id)) return;
    attachments.value.push({
        id,
        kind: 'file',
        source: 'workspace',
        name: item.name,
        preview: item.path,
        mimeType: item.mime_type || undefined,
        size: item.size || undefined,
        path: item.path,
        rootId: item.root_id,
    });
}

function scheduleMentionSearch(query: string) {
    if (mentionSearchTimer) clearTimeout(mentionSearchTimer);
    mentionState.loading = true;
    mentionSearchTimer = setTimeout(async () => {
        const activeQuery = query.trim();
        try {
            const items = await searchWorkspaceFiles(activeQuery, 12);
            if (!mentionState.open || mentionState.query !== query) return;
            mentionState.items = items;
            mentionState.selectedIndex = 0;
        } finally {
            if (mentionState.query === query) mentionState.loading = false;
        }
    }, 120);
}

function updateMentionState(instance: MentionEditorState) {
    const { selection, doc } = instance.state;
    if (!selection.empty) {
        closeMention();
        return;
    }
    const to = selection.from;
    const from = Math.max(0, to - 96);
    const textBefore = doc.textBetween(from, to, '\n', '\n');
    const atIndex = textBefore.lastIndexOf('@');
    if (atIndex < 0) {
        closeMention();
        return;
    }
    const previous = atIndex > 0 ? textBefore.charAt(atIndex - 1) : ' ';
    const query = textBefore.slice(atIndex + 1);
    if (
        (previous && !/\s|[(\[{]/.test(previous)) ||
        /\s/.test(query) ||
        query.length > 80
    ) {
        closeMention();
        return;
    }
    mentionState.open = true;
    mentionState.query = query;
    mentionState.from = from + atIndex;
    mentionState.to = to;
    scheduleMentionSearch(query);
}

function selectMention(item = mentionState.items[mentionState.selectedIndex]) {
    if (!item || !editor.value) return;
    addWorkspaceFileMention(item);
    editor.value
        .chain()
        .focus()
        .insertContentAt(
            { from: mentionState.from, to: mentionState.to },
            `@${item.path} `,
        )
        .run();
    closeMention();
}

function addPastedText(text: string) {
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount < 120) return false;
    attachments.value.push({
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

onMounted(() => {
    syncViewportEnterBehavior();

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
        ],
        autofocus: false,
        editorProps: {
            attributes: {
                class: 'min-h-6 outline-none',
            },
            handleKeyDown(_view, event) {
                if (mentionState.open) {
                    if (event.key === 'ArrowDown') {
                        event.preventDefault();
                        mentionState.selectedIndex = Math.min(
                            mentionState.items.length - 1,
                            mentionState.selectedIndex + 1,
                        );
                        return true;
                    }
                    if (event.key === 'ArrowUp') {
                        event.preventDefault();
                        mentionState.selectedIndex = Math.max(
                            0,
                            mentionState.selectedIndex - 1,
                        );
                        return true;
                    }
                    if (
                        (event.key === 'Enter' || event.key === 'Tab') &&
                        mentionState.items.length
                    ) {
                        event.preventDefault();
                        selectMention();
                        return true;
                    }
                    if (event.key === 'Escape') {
                        event.preventDefault();
                        closeMention();
                        return true;
                    }
                }

                if (event.key === 'Enter' && !event.isComposing) {
                    if (enterCreatesNewLine.value) {
                        if (event.metaKey || event.ctrlKey) {
                            event.preventDefault();
                            submit();
                            return true;
                        }
                        return false;
                    }

                    if (event.shiftKey) return false;
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
            formState.text = instance.getText({ blockSeparator: '\n\n' });
            updateMentionState(instance);
        },
        onSelectionUpdate({ editor: instance }) {
            updateMentionState(instance);
        },
    });

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
    if (mentionSearchTimer) clearTimeout(mentionSearchTimer);
    viewportChangeCleanup?.();
    clearAttachments();
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
</style>
