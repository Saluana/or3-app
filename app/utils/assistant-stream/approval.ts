import type { ApprovalRequest } from '~/types/or3-api';
import {
    formatApprovalInlineCopy,
    formatApprovalSubjectPreview,
} from '~/utils/or3/approval-display';
import { coerceErrorText } from './errors';
import { truncateLogDetail } from './activity';

export function isApprovalRequiredPayload(payload?: Record<string, unknown>) {
    if (!payload) return false;
    const state = String(payload.code ?? payload.status ?? '')
        .trim()
        .toLowerCase();
    if (state === 'approval_required') return true;
    return (
        typeof payload.approval_id === 'string' ||
        typeof payload.approval_id === 'number' ||
        typeof payload.approval_request_id === 'string' ||
        typeof payload.approval_request_id === 'number'
    );
}

function parseJsonRecord(value?: string) {
    if (!value) return undefined;
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object'
            ? (parsed as Record<string, unknown>)
            : undefined;
    } catch {
        return undefined;
    }
}

function quoteCommandPart(value: string) {
    return /^[\w./:@%+=,-]+$/.test(value) ? value : JSON.stringify(value);
}

function formatCommandPreview(parts: unknown[]) {
    const normalized = parts
        .map((part) =>
            typeof part === 'string' || typeof part === 'number'
                ? String(part)
                : typeof part === 'boolean'
                  ? String(part)
                  : '',
        )
        .filter(Boolean)
        .map(quoteCommandPart);
    return truncateLogDetail(normalized.join(' '), 180);
}

function firstNonEmptyString(
    record: Record<string, unknown> | undefined,
    ...keys: string[]
) {
    if (!record) return '';
    for (const key of keys) {
        const value = record[key];
        if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return '';
}

export function describeApprovalRequest(toolName: string, argsJson?: string) {
    const args = parseJsonRecord(argsJson);
    const normalizedTool = toolName.trim() || 'tool';
    const cwd = firstNonEmptyString(args, 'cwd');

    if (normalizedTool === 'exec') {
        const program = firstNonEmptyString(args, 'program');
        const command = firstNonEmptyString(args, 'command');
        const rawArgs = Array.isArray(args?.args) ? args?.args : [];
        const commandPreview = program
            ? formatCommandPreview([program, ...rawArgs])
            : command
              ? rawArgs.length
                  ? formatCommandPreview([command, ...rawArgs])
                  : truncateLogDetail(command, 180)
              : '';
        const location = cwd ? `\n**Working directory:** \`${cwd}\`` : '';
        return [
            'Approval is needed before or3-intern can continue.',
            '',
            '**Tool:** `exec`',
            commandPreview
                ? `**Requested action:** Run the local command \`${commandPreview}\``
                : '**Requested action:** Run a local command on this machine.',
            location,
            '',
            'Approve if this is the command you expected. Deny it if you do not want this command to run.',
        ]
            .join('\n')
            .replace(/\n{3,}/g, '\n\n');
    }

    if (normalizedTool === 'run_skill_script') {
        const skillName = firstNonEmptyString(args, 'skillName', 'skill_name');
        const commandName = firstNonEmptyString(
            args,
            'commandName',
            'command_name',
            'entrypoint',
            'path',
        );
        return [
            'Approval is needed before or3-intern can continue.',
            '',
            '**Tool:** `run_skill_script`',
            `**Requested action:** Run ${
                skillName ? `the skill \`${skillName}\`` : 'a skill script'
            }${commandName ? ` using \`${commandName}\`` : ''}.`,
            '',
            'Approve if this is the skill action you expected. Deny it if it looks wrong.',
        ].join('\n');
    }

    const path =
        firstNonEmptyString(args, 'path', 'file', 'artifact_id') ||
        firstNonEmptyString(args, 'url');
    return [
        'Approval is needed before or3-intern can continue.',
        '',
        `**Tool:** \`${normalizedTool}\``,
        path
            ? `**Requested action:** Use this tool with \`${truncateLogDetail(path, 140)}\`.`
            : `**Requested action:** Use the \`${normalizedTool}\` tool with the current request.`,
        '',
        'Approve if this matches what you asked for. Deny it if it looks unexpected.',
    ].join('\n');
}

function parseQuotaPreviewFromText(text: string) {
    const normalized = text.trim();
    if (!normalized) return '';
    const scoped = normalized.match(
        /for\s+(\w+):\s+[^.]*?limit\s+(\d+)\s*\/\s*(\d+)/i,
    );
    if (scoped) {
        const limitName = normalized.includes('max_tool_calls')
            ? 'max_tool_calls'
            : normalized.includes('tool-call')
              ? 'tool_calls'
              : 'tool_calls';
        return `${scoped[1]} ${limitName} (${scoped[2]}/${scoped[3]})`;
    }
    const bare = normalized.match(/limit\s+(\d+)\s*\/\s*(\d+)/i);
    if (bare) return `tool_calls (${bare[1]}/${bare[2]})`;
    return '';
}

export function inferApprovalMetadataFromToolPayload(
    toolName: string,
    payload?: Record<string, unknown>,
) {
    const err = coerceErrorText(payload?.error);
    const preview = coerceErrorText(
        payload?.result_preview ?? payload?.result ?? payload?.summary,
    );
    const combined = `${err} ${preview}`.toLowerCase();
    if (
        combined.includes('tool quota') ||
        combined.includes('max_tool_calls') ||
        combined.includes('per-message total tool-call') ||
        combined.includes('per-session total tool-call')
    ) {
        const approvalPreview =
            parseQuotaPreviewFromText(`${err} ${preview}`) ||
            parseQuotaPreviewFromText(preview) ||
            parseQuotaPreviewFromText(err);
        return {
            approvalType: 'tool_quota',
            approvalPreview: approvalPreview || undefined,
        };
    }
    if (String(payload?.code ?? '').trim() === 'approval_required') {
        return {
            approvalType: toolName.trim() || undefined,
            approvalPreview: preview || err || undefined,
        };
    }
    return {};
}

export function buildInlineApprovalContent(options: {
    approvalType?: string;
    approvalPreview?: string;
    toolName?: string;
    argsJson?: string;
}) {
    if (options.approvalType === 'tool_quota') {
        const copy = formatApprovalInlineCopy({
            type: 'tool_quota',
            subject: options.approvalPreview
                ? { summary: options.approvalPreview }
                : undefined,
        });
        const lines = [
            copy.description,
            '',
            `**${copy.title}**`,
            options.approvalPreview
                ? `**Usage:** ${options.approvalPreview}`
                : 'This turn hit the configured tool-call limit.',
            '',
            'Approve to let or3-intern continue with more tool calls for this message. Deny to stop here.',
        ];
        return lines.join('\n');
    }
    return describeApprovalRequest(options.toolName || 'tool', options.argsJson);
}

export function extractApprovalMetadata(payload?: Record<string, unknown>) {
    if (!payload) return {};
    const nested =
        payload.approval && typeof payload.approval === 'object'
            ? (payload.approval as Record<string, unknown>)
            : undefined;
    const approvalType = String(
        payload.approval_type ??
            nested?.type ??
            payload.type ??
            '',
    ).trim();
    const subject =
        payload.approval_subject ??
        nested?.subject ??
        payload.subject;
    let approvalPreview = '';
    if (typeof subject === 'string') {
        approvalPreview = subject.trim();
    } else if (subject && typeof subject === 'object') {
        approvalPreview = formatApprovalSubjectPreview({
            type: approvalType,
            subject,
        });
    }
    return {
        approvalType: approvalType || undefined,
        approvalPreview: approvalPreview || undefined,
    };
}

export function pendingApprovalPlaceholderContent(approval: ApprovalRequest) {
    const preview = formatApprovalSubjectPreview({
        type: approval.type,
        domain: approval.domain,
        subject: approval.subject,
    });
    if (!preview) {
        return 'Approval is needed before or3-intern can continue.';
    }
    return [
        'Approval is needed before or3-intern can continue.',
        '',
        `Requested action: ${preview}`,
    ].join('\n');
}
