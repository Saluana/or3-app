/** Strip admin-brain envelope text if it leaked into persisted user content. */
export function scrubDoctorUserMessageContent(content: string) {
    const trimmed = String(content ?? '').trim();
    if (
        !trimmed.includes('Current doctor summary:') ||
        !trimmed.includes('User message:')
    ) {
        return trimmed;
    }
    return trimmed.split('User message:').pop()?.trim() || trimmed;
}
