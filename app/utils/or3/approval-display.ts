import type { ApprovalRequest } from '~/types/or3-api';

function stringValue(value: unknown) {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' && Number.isFinite(value))
        return String(value);
    return '';
}

function stringArray(value: unknown) {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) =>
            typeof item === 'string' || typeof item === 'number'
                ? String(item)
                : '',
        )
        .filter(Boolean);
}

function quoteCommandPart(value: string) {
    return /^[\w./:@%+=,-]+$/.test(value) ? value : JSON.stringify(value);
}

function formatCommandParts(parts: string[]) {
    return parts.filter(Boolean).map(quoteCommandPart).join(' ');
}

export function approvalStatusLabel(status?: string) {
    switch (String(status ?? '').trim()) {
        case 'pending':
            return 'Waiting';
        case 'approved':
            return 'Approved';
        case 'denied':
            return 'Denied';
        case 'canceled':
            return 'Canceled';
        case 'expired':
            return 'Expired';
        case 'failed':
            return 'Failed';
        case 'completed':
            return 'Completed';
        default:
            return String(status ?? '').trim() || 'Unknown';
    }
}

export function approvalStatusTone(status?: string) {
    switch (String(status ?? '').trim()) {
        case 'approved':
        case 'completed':
            return 'green' as const;
        case 'pending':
            return 'amber' as const;
        case 'denied':
        case 'failed':
        case 'expired':
            return 'danger' as const;
        default:
            return 'neutral' as const;
    }
}

export function approvalKindType(
    approval: Pick<ApprovalRequest, 'type' | 'domain' | 'subject'> | undefined,
) {
    if (!approval) return '';
    const subj = approval.subject;
    if (subj && typeof subj === 'object' && !Array.isArray(subj)) {
        const obj = subj as Record<string, unknown>;
        const fromSubject = stringValue(obj.type);
        if (fromSubject) return fromSubject;
    }
    return String(approval.type || approval.domain || '').trim();
}

export function approvalKindLabel(type?: string) {
    const normalized = String(type ?? '').trim();
    if (!normalized) return 'Permission needed';
    if (normalized === 'exec') return 'Run command';
    if (normalized === 'file_write') return 'Write file';
    if (normalized === 'network') return 'Reach the internet';
    if (normalized === 'tool_quota') return 'Tool call limit reached';
    if (
        normalized === 'skill_exec' ||
        normalized === 'skill_execution' ||
        normalized === 'run_skill_script'
    ) {
        return 'Run skill script';
    }
    if (normalized === 'runner_permission') return 'Runner permission';
    return normalized
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function approvalKindDescription(type?: string) {
    const normalized = String(type ?? '').trim();
    if (!normalized) {
        return 'or3-intern needs your permission before it can continue this turn.';
    }
    if (normalized === 'exec') {
        return 'or3-intern wants to run a shell command on this machine.';
    }
    if (normalized === 'file_write') {
        return 'or3-intern wants to create or update a file.';
    }
    if (normalized === 'network') {
        return 'or3-intern wants to reach an external service.';
    }
    if (normalized === 'tool_quota') {
        return 'This turn used more tool calls than the current limit allows. Approve to let or3-intern continue with more tool calls.';
    }
    if (
        normalized === 'skill_exec' ||
        normalized === 'skill_execution' ||
        normalized === 'run_skill_script'
    ) {
        return 'or3-intern wants to run a skill script.';
    }
    if (normalized === 'runner_permission') {
        return 'or3-intern needs permission to use a runner on your computer.';
    }
    return 'or3-intern is asking for permission to continue.';
}

export function approvalKindIcon(type?: string) {
    const normalized = String(type ?? '').trim();
    if (normalized === 'exec') return 'i-pixelarticons-terminal';
    if (normalized === 'file_write') return 'i-pixelarticons-file-text';
    if (normalized === 'network') return 'i-pixelarticons-globe';
    if (normalized === 'tool_quota') return 'i-pixelarticons-alert';
    if (
        normalized === 'skill_exec' ||
        normalized === 'skill_execution' ||
        normalized === 'run_skill_script'
    ) {
        return 'i-pixelarticons-script';
    }
    if (normalized === 'runner_permission') return 'i-pixelarticons-shield';
    return 'i-pixelarticons-shield';
}

export function formatApprovalInlineCopy(
    approval: Pick<ApprovalRequest, 'type' | 'domain' | 'subject'> | undefined,
) {
    const type = approvalKindType(approval);
    const preview = approval
        ? formatApprovalSubjectPreview(approval)
        : '';
    return {
        type,
        title: approvalKindLabel(type),
        description: approvalKindDescription(type),
        icon: approvalKindIcon(type),
        preview,
    };
}

export function formatApprovalSubjectPreview(
    approval: Pick<
        ApprovalRequest,
        'type' | 'domain' | 'subject' | 'preview'
    >,
) {
    const preview = stringValue(approval.preview);
    if (preview) return preview;

    const subj = approval.subject;
    if (!subj) return '';
    if (typeof subj === 'string') return subj;
    if (typeof subj !== 'object') return '';

    const obj = subj as Record<string, unknown>;
    const type = approval.type || approval.domain || stringValue(obj.type);
    if (type === 'exec') {
        const executable =
            stringValue(obj.executable_path) ||
            stringValue(obj.program) ||
            stringValue(obj.command) ||
            stringValue(obj.cmd);
        const argv = stringArray(obj.argv);
        const args = stringArray(obj.args);
        const command = formatCommandParts(
            argv.length ? argv : [executable, ...args],
        );
        const cwd = stringValue(obj.working_dir) || stringValue(obj.cwd);
        if (command && cwd) return `${command}  (cwd: ${cwd})`;
        if (command) return command;
        if (cwd) return `cwd: ${cwd}`;
    }

    if (
        type === 'skill_exec' ||
        type === 'skill_execution' ||
        type === 'run_skill_script'
    ) {
        const skill =
            stringValue(obj.skill_id) ||
            stringValue(obj.skillName) ||
            stringValue(obj.skill_name);
        const command =
            stringValue(obj.command_name) ||
            stringValue(obj.commandName) ||
            stringValue(obj.entrypoint) ||
            stringValue(obj.path);
        if (skill && command) return `${skill}: ${command}`;
        if (skill) return skill;
        if (command) return command;
    }

    if (type === 'runner_permission') {
        const runner = stringValue(obj.runner_id);
        const access = stringValue(obj.access);
        const target = stringValue(obj.target_path);
        if (runner && access && target) return `${runner} ${access} ${target}`;
        if (runner && target) return `${runner}: ${target}`;
        if (target) return target;
    }

    if (type === 'tool_quota') {
        const scope = stringValue(obj.scope);
        const limitName = stringValue(obj.limit_name);
        const tool = stringValue(obj.tool_name);
        const current = stringValue(obj.current);
        const limit = stringValue(obj.limit);
        const target = [scope, limitName || tool].filter(Boolean).join(' ');
        const usage = current && limit ? `${current}/${limit}` : '';
        if (target && usage) return `${target} (${usage})`;
        if (target) return target;
        if (usage) return usage;
    }

    return (
        stringValue(obj.command) ||
        stringValue(obj.cmd) ||
        stringValue(obj.path) ||
        stringValue(obj.file) ||
        stringValue(obj.url) ||
        stringValue(obj.target) ||
        stringValue(obj.summary)
    );
}

export type ApprovalRiskLevel = 'low' | 'medium' | 'high' | 'extreme';

export function resolveApprovalRiskLevel(input: {
    explicitRisk?: string;
    fallbackMedium?: boolean;
}): ApprovalRiskLevel {
    const explicit = String(input.explicitRisk ?? '').trim().toLowerCase();
    if (explicit === 'extreme') return 'extreme';
    if (explicit === 'high' || explicit === 'critical') return 'high';
    if (explicit === 'medium' || explicit === 'moderate') return 'medium';
    if (input.fallbackMedium) return 'medium';
    return 'low';
}

export function approvalRiskPresentation(level: ApprovalRiskLevel): {
    label: string;
    tone: 'green' | 'amber' | 'danger';
    icon: string;
} {
    if (level === 'extreme') {
        return {
            label: 'Extreme risk',
            tone: 'danger',
            icon: 'i-pixelarticons-shield-off',
        };
    }
    if (level === 'high') {
        return {
            label: 'High risk',
            tone: 'danger',
            icon: 'i-pixelarticons-shield-off',
        };
    }
    if (level === 'medium') {
        return {
            label: 'Medium risk',
            tone: 'amber',
            icon: 'i-pixelarticons-shield-off',
        };
    }
    return {
        label: 'Low risk',
        tone: 'green',
        icon: 'i-pixelarticons-shield',
    };
}
