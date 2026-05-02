import type { ApprovalRequest } from '~/types/or3-api';

function stringValue(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
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

export function formatApprovalSubjectPreview(approval: Pick<ApprovalRequest, 'type' | 'domain' | 'subject'>) {
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

    if (type === 'skill_exec' || type === 'run_skill_script') {
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
