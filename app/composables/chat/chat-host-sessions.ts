import { ref } from 'vue';
import type { ChatSession } from '~/types/app-state';

const hostSessions = ref<ChatSession[]>([]);
let hostSessionsHostId = '';
let hostSessionsSessionIds = '';

function sessionListSignature(sessions: ChatSession[]) {
    return sessions.map((session) => session.id).join(',');
}

export function syncHostSessions(
    hostId: string | undefined,
    allSessions: ChatSession[],
    options: { force?: boolean } = {},
) {
    const normalizedHostId = hostId?.trim() ?? '';
    const filtered = normalizedHostId
        ? allSessions.filter((session) => session.hostId === normalizedHostId)
        : allSessions;
    const sessionIds = sessionListSignature(filtered);
    if (
        !options.force &&
        normalizedHostId === hostSessionsHostId &&
        sessionIds === hostSessionsSessionIds
    ) {
        return;
    }
    hostSessionsHostId = normalizedHostId;
    hostSessionsSessionIds = sessionIds;
    hostSessions.value = filtered;
}

export function useHostSessionsRef() {
    return hostSessions;
}

export function resetHostSessionsForTests() {
    hostSessions.value = [];
    hostSessionsHostId = '';
    hostSessionsSessionIds = '';
}
