function normalizeRunnerID(value: string | null | undefined) {
    return typeof value === 'string' ? value.trim() : '';
}

export function canUseDoctorRunnerID(
    candidate: string | null | undefined,
    options: {
        adminBrainRunnerID?: string | null;
        selectableRunnerIDs: string[];
    },
) {
    const normalized = normalizeRunnerID(candidate);
    if (!normalized) return false;
    if (normalized === normalizeRunnerID(options.adminBrainRunnerID))
        return true;
    return options.selectableRunnerIDs.some((id) => id === normalized);
}

export function resolveDoctorRunnerID(options: {
    currentRunnerID?: string | null;
    adminBrainRunnerID?: string | null;
    defaultRunnerID?: string | null;
    selectableRunnerIDs: string[];
}) {
    if (canUseDoctorRunnerID(options.currentRunnerID, options)) {
        return normalizeRunnerID(options.currentRunnerID);
    }
    if (canUseDoctorRunnerID(options.adminBrainRunnerID, options)) {
        return normalizeRunnerID(options.adminBrainRunnerID);
    }
    if (canUseDoctorRunnerID(options.defaultRunnerID, options)) {
        return normalizeRunnerID(options.defaultRunnerID);
    }
    return '';
}
