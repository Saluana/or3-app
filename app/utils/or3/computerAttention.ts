import type { AppBootstrapWarning, ReadinessResponse } from '~/types/or3-api'

export interface AttentionAction {
    href: string
    label: string
}

export interface AttentionGuidance {
    title: string
    summary: string
    detail?: string
    action: AttentionAction
    secondaryAction?: AttentionAction
}

export function isDuplicateReadinessWarning(
    warning: AppBootstrapWarning | null | undefined,
    readiness: ReadinessResponse | null | undefined,
): boolean {
    if (!warning || !readiness || readiness.ready) return false

    const code = normalize(warning.code ?? '')
    const message = normalize(warning.message ?? '')

    return code === 'host_not_ready' || message.includes('readiness')
}

function normalize(text: string): string {
    return text.trim().toLowerCase()
}

function getFindingText(readiness: ReadinessResponse | null | undefined): string {
    const finding = readiness?.findings?.find((item) => item.severity === 'block' || item.severity === 'error') || readiness?.findings?.[0]

    return normalize([
        finding?.id,
        finding?.area,
        finding?.summary,
        finding?.detail,
        finding?.fixHint,
        ...(finding?.evidence ?? []),
        ...Object.values(finding?.metadata ?? {}),
    ].filter(Boolean).join(' '))
}

export function getReadinessGuidance(readiness: ReadinessResponse | null | undefined): AttentionGuidance {
    if (!readiness) {
        return {
            title: 'We could not verify your computer yet',
            summary: 'The app could not reach the readiness check, so it cannot explain the host status with confidence yet.',
            detail: 'Start by confirming the pairing address and that or3-intern is running on the computer you expect.',
            action: { href: '/settings/pair', label: 'Check pairing' },
            secondaryAction: { href: '/settings/health', label: 'Open health report' },
        }
    }

    const finding = readiness.findings?.find((item) => item.severity === 'block' || item.severity === 'error') || readiness.findings?.[0]
    const summary = typeof finding?.summary === 'string' && finding.summary.trim()
        ? finding.summary.trim()
        : 'The host reported a startup or safety issue that needs your attention.'
    const detail = typeof finding?.fixHint === 'string' && finding.fixHint.trim()
        ? finding.fixHint.trim()
        : typeof finding?.detail === 'string' && finding.detail.trim()
            ? finding.detail.trim()
            : undefined
    const text = getFindingText(readiness)

    if (text.includes('bubblewrap') || text.includes('sandbox') || text.includes('privileged')) {
        return {
            title: 'Your computer is allowing risky tools without isolation',
            summary,
            detail: detail ?? 'Review the safety settings for terminal access and sandboxing before using privileged tools.',
            action: { href: '/settings/section/safety', label: 'Review safety settings' },
            secondaryAction: { href: '/settings/health', label: 'Open health report' },
        }
    }

    if (text.includes('workspace') || text.includes('folder') || text.includes('docindex') || text.includes('index')) {
        return {
            title: 'Your workspace setup needs a quick fix',
            summary,
            detail: detail ?? 'Check the selected workspace and indexing options so the computer tools know where to work.',
            action: { href: '/settings/section/workspace', label: 'Review workspace settings' },
            secondaryAction: { href: '/settings/health', label: 'Open health report' },
        }
    }

    if (text.includes('model') || text.includes('provider') || text.includes('api key')) {
        return {
            title: 'The AI setup is incomplete',
            summary,
            detail: detail ?? 'Finish the provider setup so the assistant can actually reply and use the connected computer.',
            action: { href: '/settings/section/ai', label: 'Review AI settings' },
            secondaryAction: { href: '/settings/health', label: 'Open health report' },
        }
    }

    return {
        title: 'Your computer still has readiness issues',
        summary,
        detail: detail ?? 'Open the health report for the raw checks, then review the recommended settings based on that finding.',
        action: { href: '/settings/health', label: 'Open health report' },
        secondaryAction: { href: '/settings/advanced', label: 'Open advanced settings' },
    }
}

export function getBootstrapWarningGuidance(
    warning: AppBootstrapWarning | null | undefined,
    readiness: ReadinessResponse | null | undefined,
): AttentionGuidance {
    const code = normalize(warning?.code ?? '')
    const message = warning?.message?.trim() || 'The computer reported a connection-related warning.'

    if (!warning) {
        return {
            title: 'Connection details need a second look',
            summary: 'The app knows something is off, but it did not receive a structured warning payload.',
            detail: 'Open the health report to inspect the host checks and pairing details.',
            action: { href: '/settings/health', label: 'Open health report' },
            secondaryAction: { href: '/settings/pair', label: 'Review pairing' },
        }
    }

    if (code === 'host_not_ready' || normalize(message).includes('readiness')) {
        const readinessGuidance = getReadinessGuidance(readiness)
        return {
            title: 'The computer connected, but it is not fully ready yet',
            summary: message,
            detail: readinessGuidance.detail ?? 'The host is reachable, but one of its readiness checks still needs attention before everything feels normal.',
            action: { href: '/computer/attention', label: 'Learn more' },
            secondaryAction: readinessGuidance.action,
        }
    }

    if (code.includes('pair') || normalize(message).includes('pair')) {
        return {
            title: 'The pairing details need to be checked',
            summary: message,
            detail: 'Open the pairing screen to confirm the host address and token this device is using.',
            action: { href: '/settings/pair', label: 'Review pairing' },
            secondaryAction: { href: '/computer/attention', label: 'Learn more' },
        }
    }

    return {
        title: 'There is a connection warning to review',
        summary: message,
        detail: 'Open the attention page for a plain-language explanation and the most likely next step.',
        action: { href: '/computer/attention', label: 'Learn more' },
        secondaryAction: { href: '/settings/health', label: 'Open health report' },
    }
}