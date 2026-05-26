import { computed } from 'vue';
import { useLocalCache } from './useLocalCache';
import { useActiveHost } from './useActiveHost';

const PREF_KEY = 'reviewedAgentJobIds';

function readReviewedByHost(
    preferences: Record<string, unknown>,
): Record<string, string[]> {
    const raw = preferences[PREF_KEY];
    if (!raw || typeof raw !== 'object') return {};
    return raw as Record<string, string[]>;
}

export function useReviewedJobs() {
    const cache = useLocalCache();
    const { activeHost } = useActiveHost();

    const hostId = computed(() => activeHost.value?.id ?? '');

    const reviewedIds = computed(() => {
        const map = readReviewedByHost(cache.state.value.preferences);
        return new Set(map[hostId.value] ?? []);
    });

    function persist(ids: string[]) {
        const map = readReviewedByHost(cache.state.value.preferences);
        map[hostId.value] = ids;
        cache.state.value.preferences = {
            ...cache.state.value.preferences,
            [PREF_KEY]: map,
        };
        cache.persist();
    }

    function markReviewed(jobId: string) {
        if (!jobId || reviewedIds.value.has(jobId)) return;
        persist([...reviewedIds.value, jobId]);
    }

    function unmarkReviewed(jobId: string) {
        if (!reviewedIds.value.has(jobId)) return;
        persist([...reviewedIds.value].filter((id) => id !== jobId));
    }

    function isReviewed(jobId: string): boolean {
        return reviewedIds.value.has(jobId);
    }

    return {
        reviewedIds,
        markReviewed,
        unmarkReviewed,
        isReviewed,
    };
}
