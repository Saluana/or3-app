import { computed } from 'vue'
import { useChatSessions } from './useChatSessions'

export function useThreadCwd() {
    const { activeSession, setSessionRunnerMetadata } = useChatSessions()

    const cwd = computed(() => activeSession.value?.runnerCwd)

    function setCwd(path: string) {
        const session = activeSession.value
        if (!session) return
        // Validate: must be non-empty absolute path
        if (!path || !path.startsWith('/')) return
        setSessionRunnerMetadata(session.id, { runnerCwd: path })
    }

    return { cwd, setCwd }
}
