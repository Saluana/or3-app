import { useToast } from '@nuxt/ui/composables';
import { useApprovals } from './useApprovals';
import { approvalIdFromError } from '~/utils/approval-errors';

const activeApprovalToastIds = new Map<string, string>();

function approvalToastKey(approvalId: number | string) {
    return String(approvalId);
}

function describeApproval(approval: {
    type?: string;
    domain?: string;
    preview?: string;
}) {
    const type = approval.type?.trim();
    const title = type
        ? `${type.charAt(0).toUpperCase()}${type.slice(1)} approval`
        : 'Approval required';
    const description =
        approval.preview?.trim() ||
        approval.domain?.trim() ||
        'This action needs your approval before it can continue.';
    return { title, description };
}

export function useApprovalActionToast() {
    const toast = useToast();
    const { fetchApproval, approve, deny } = useApprovals();

    function dismissApprovalToast(approvalId: number | string) {
        const key = approvalToastKey(approvalId);
        const toastId = activeApprovalToastIds.get(key);
        if (toastId !== undefined) {
            toast.remove(toastId);
            activeApprovalToastIds.delete(key);
        }
    }

    async function promptApprovalAction(options: {
        approvalId: number | string;
        title?: string;
        description?: string;
        onApproved?: () => void | Promise<void>;
        onDenied?: () => void | Promise<void>;
    }) {
        const key = approvalToastKey(options.approvalId);
        if (activeApprovalToastIds.has(key)) return;

        let title = options.title ?? 'Approval required';
        let description =
            options.description ??
            `Request #${options.approvalId} is waiting for your decision.`;

        try {
            const approval = await fetchApproval(options.approvalId);
            const described = describeApproval(approval);
            title = options.title ?? described.title;
            description = options.description ?? described.description;
        } catch {
            // Fall back to generic copy when the detail request fails.
        }

        const toastId = `approval-${key}`;
        toast.add({
            id: toastId,
            title,
            description,
            color: 'neutral',
            icon: 'i-pixelarticons-shield',
            duration: 0,
            orientation: 'vertical',
            ui: {
                description: 'font-mono text-xs leading-relaxed text-(--or3-text-muted)',
                actions: 'flex flex-wrap gap-1.5 pt-1',
            },
            actions: [
                {
                    label: 'Approve',
                    color: 'primary',
                    variant: 'soft',
                    size: 'xs',
                    onClick: async () => {
                        try {
                            await approve(options.approvalId);
                            dismissApprovalToast(options.approvalId);
                            await options.onApproved?.();
                            toast.add({
                                title: 'Approved',
                                description:
                                    'Continuing with the requested action.',
                                color: 'success',
                                icon: 'i-pixelarticons-check',
                            });
                        } catch (error: unknown) {
                            toast.add({
                                title: 'Approval failed',
                                description:
                                    error &&
                                    typeof error === 'object' &&
                                    'message' in error
                                        ? String(
                                              (error as { message?: unknown })
                                                  .message,
                                          )
                                        : 'Could not approve this request.',
                                color: 'error',
                                icon: 'i-pixelarticons-warning-box',
                            });
                        }
                    },
                },
                {
                    label: 'Deny',
                    color: 'neutral',
                    variant: 'outline',
                    size: 'xs',
                    onClick: async () => {
                        try {
                            await deny(options.approvalId);
                            dismissApprovalToast(options.approvalId);
                            await options.onDenied?.();
                        } catch (error: unknown) {
                            toast.add({
                                title: 'Deny failed',
                                description:
                                    error &&
                                    typeof error === 'object' &&
                                    'message' in error
                                        ? String(
                                              (error as { message?: unknown })
                                                  .message,
                                          )
                                        : 'Could not deny this request.',
                                color: 'error',
                                icon: 'i-pixelarticons-warning-box',
                            });
                        }
                    },
                },
                {
                    label: 'Remember',
                    color: 'neutral',
                    variant: 'ghost',
                    size: 'xs',
                    onClick: async () => {
                        try {
                            await approve(options.approvalId, true);
                            dismissApprovalToast(options.approvalId);
                            await options.onApproved?.();
                            toast.add({
                                title: 'Approved and remembered',
                                description:
                                    'Similar actions can run without asking again.',
                                color: 'success',
                                icon: 'i-pixelarticons-check',
                            });
                        } catch (error: unknown) {
                            toast.add({
                                title: 'Approval failed',
                                description:
                                    error &&
                                    typeof error === 'object' &&
                                    'message' in error
                                        ? String(
                                              (error as { message?: unknown })
                                                  .message,
                                          )
                                        : 'Could not save this approval rule.',
                                color: 'error',
                                icon: 'i-pixelarticons-warning-box',
                            });
                        }
                    },
                },
            ],
        });

        activeApprovalToastIds.set(key, toastId);
    }

    async function promptApprovalForError(
        error: unknown,
        handlers: {
            onApproved?: () => void | Promise<void>;
            onDenied?: () => void | Promise<void>;
        } = {},
    ) {
        const approvalId = approvalIdFromError(error);
        if (!approvalId) return false;
        await promptApprovalAction({
            approvalId,
            onApproved: handlers.onApproved,
            onDenied: handlers.onDenied,
        });
        return true;
    }

    return {
        promptApprovalAction,
        promptApprovalForError,
        dismissApprovalToast,
    };
}
