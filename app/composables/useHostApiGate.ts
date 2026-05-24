import { readonly, ref } from 'vue';
import { isPinEnabled, needsUnlock } from './usePinLock';

/** Blocks host API consumers during PIN unlock credential merge. */
const settling = ref(false);
const settled = ref(!import.meta.client);

export function isHostApiReady(): boolean {
    if (!import.meta.client) return true;
    if (settling.value) return false;
    if (isPinEnabled() && !settled.value) return false;
    return true;
}

export function beginHostApiSettlement(): void {
    settling.value = true;
    settled.value = false;
    void import('./useHostWorkspaceBootstrap').then(({ resetHostWorkspaceBootstrap }) =>
        resetHostWorkspaceBootstrap(),
    );
}

export function completeHostApiSettlement(): void {
    settling.value = false;
    settled.value = true;
    void import('./useHostWorkspaceBootstrap').then(({ bootstrapHostWorkspace }) =>
        bootstrapHostWorkspace({ force: true }),
    );
}

export function resetHostApiSettlement(): void {
    settling.value = false;
    settled.value = false;
}

/** Call once on app boot to settle credentials when PIN is off or session was restored. */
export function bootstrapHostApiGate(): void {
    if (!import.meta.client) return;
    if (!isPinEnabled()) {
        completeHostApiSettlement();
        return;
    }
    if (needsUnlock()) {
        resetHostApiSettlement();
        return;
    }
    beginHostApiSettlement();
    void import('./useCredentialsSync')
        .then(({ syncCredentialsAfterUnlock }) => syncCredentialsAfterUnlock())
        .finally(() => {
            completeHostApiSettlement();
        });
}

export function useHostApiGateState() {
    return {
        settling: readonly(settling),
        settled: readonly(settled),
        ready: readonly(settled),
    };
}
