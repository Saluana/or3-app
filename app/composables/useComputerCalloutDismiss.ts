import { computed, ref, watch, type Ref } from 'vue';
import {
    type ComputerCalloutKind,
    readDismissedCalloutFingerprint,
    writeDismissedCalloutFingerprint,
} from '~/utils/or3/computerCalloutDismiss';

export function useComputerCalloutDismiss(hostId: Ref<string>) {
    const dismissed = ref<Record<ComputerCalloutKind, string | null>>({
        readiness: null,
        bootstrap: null,
        connecting: null,
    });

    function syncFromStorage() {
        const id = hostId.value || 'default';
        dismissed.value = {
            readiness: readDismissedCalloutFingerprint(id, 'readiness'),
            bootstrap: readDismissedCalloutFingerprint(id, 'bootstrap'),
            connecting: readDismissedCalloutFingerprint(id, 'connecting'),
        };
    }

    function dismiss(kind: ComputerCalloutKind, fingerprint: string) {
        if (!fingerprint) return;
        const id = hostId.value || 'default';
        writeDismissedCalloutFingerprint(id, kind, fingerprint);
        dismissed.value = {
            ...dismissed.value,
            [kind]: fingerprint,
        };
    }

    function isDismissed(kind: ComputerCalloutKind, fingerprint: string) {
        if (!fingerprint) return false;
        return dismissed.value[kind] === fingerprint;
    }

    watch(hostId, syncFromStorage, { immediate: true });

    return {
        dismissed: computed(() => dismissed.value),
        dismiss,
        isDismissed,
        syncFromStorage,
    };
}
