import type { ChatAttachment } from '~/types/app-state';

const MAX_TEXT_EXCERPT = 1200;

export type ServiceChatAttachment = {
    id: string;
    source: 'workspace_ref' | 'local_artifact' | 'text_block';
    kind: 'file' | 'image' | 'audio' | 'video' | 'text';
    name: string;
    mime_type?: string;
    size_bytes?: number;
    root_id?: string;
    path?: string;
    artifact_id?: string;
    preview?: string;
    content_excerpt?: string;
};

function normalizeSource(
    attachment: ChatAttachment,
): ServiceChatAttachment['source'] {
    const source = attachment.source;
    if (source === 'workspace_ref' || source === 'local_artifact' || source === 'text_block') {
        return source;
    }
    if (source === 'workspace' || attachment.path) {
        return 'workspace_ref';
    }
    if (attachment.artifact_id) {
        return 'local_artifact';
    }
    if (attachment.kind === 'text') {
        return 'text_block';
    }
    return 'local_artifact';
}

function normalizeKind(
    attachment: ChatAttachment,
): ServiceChatAttachment['kind'] {
    if (attachment.kind === 'text') return 'text';
    const mime = attachment.mime_type || attachment.mimeType || '';
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('audio/')) return 'audio';
    if (mime.startsWith('video/')) return 'video';
    return 'file';
}

export function toServiceAttachment(
    attachment: ChatAttachment,
): ServiceChatAttachment {
    const source = normalizeSource(attachment);
    const excerpt =
        attachment.content_excerpt ||
        (attachment.kind === 'text' && attachment.content
            ? attachment.content.slice(0, MAX_TEXT_EXCERPT)
            : undefined);
    return {
        id: attachment.id,
        source,
        kind: normalizeKind(attachment),
        name: attachment.name,
        mime_type: attachment.mime_type || attachment.mimeType,
        size_bytes: attachment.size_bytes ?? attachment.size,
        root_id: attachment.root_id || attachment.rootId,
        path: attachment.path,
        artifact_id: attachment.artifact_id,
        preview: attachment.preview,
        content_excerpt: excerpt,
    };
}

export function toServiceAttachments(
    attachments: ChatAttachment[] | undefined,
): ServiceChatAttachment[] {
    if (!attachments?.length) return [];
    return attachments.map(toServiceAttachment);
}
