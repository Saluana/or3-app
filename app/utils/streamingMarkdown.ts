import type { ChatMessage } from '../types/app-state';

export function shouldRepairIncompleteMarkdownForStatus(
    status: ChatMessage['status'] | null | undefined,
): boolean {
    return status === 'streaming';
}
