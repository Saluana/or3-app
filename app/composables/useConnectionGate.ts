import { computed, markRaw, reactive, type Component } from 'vue';
import { useActiveHost } from './useActiveHost';
import { useElectronHostSetup } from './useElectronHostSetup';

/**
 * Section that can be rendered on the lock screen (/connect page).
 *
 * Register additional sections from anywhere in the app to extend the
 * onboarding experience without modifying the lock screen page itself.
 *
 * @example
 * ```ts
 * const { registerLockScreenSection } = useConnectionGate();
 * registerLockScreenSection({
 *   id: 'my-custom-tips',
 *   priority: 50,
 *   component: MyCustomTipsCard,
 * });
 * ```
 */
export interface LockScreenSection {
    /** Unique id. Re-registering the same id replaces the previous entry. */
    id: string;
    /** Higher values render first. Built-in welcome section uses priority 100. */
    priority: number;
    /** Vue component to render. Receives no props by default. */
    component: Component;
    /** Optional predicate; section is hidden when this returns false. */
    condition?: () => boolean;
}

/**
 * Paths that remain accessible even while the connection gate is active.
 * Users must be able to reach pairing, settings, and the computer panel so
 * they can recover from a disconnected state.
 */
export const LOCK_SCREEN_ALLOWED_PATHS: ReadonlyArray<string> = Object.freeze([
    '/connect',
    '/pair',
    '/settings',
    '/settings/pair',
    '/settings/permissions',
    '/settings/advanced',
    '/computer',
]);

const sectionRegistry = reactive(new Map<string, LockScreenSection>());

/**
 * Connection gate hook used by the lock screen page and route middleware.
 *
 * The gate is active when there is no usable host connection AND we are not
 * inside Electron host mode (the local service is the host) AND the Electron
 * first-run setup wizard is not asking for attention. This preserves Electron
 * onboarding while still walling off the rest of the app for unpaired clients.
 */
export function useConnectionGate() {
    const { isConnected, isPaired, activeHost } = useActiveHost();
    const { isElectronHostMode, shouldShowSetup } = useElectronHostSetup();

    const isGated = computed(() => {
        if (shouldShowSetup.value) return false;
        if (isElectronHostMode.value) return false;
        return !isConnected.value;
    });

    function isAllowedPath(path: string): boolean {
        if (!path) return false;
        // Strip query/hash before matching.
        const clean = path.split('?')[0]!.split('#')[0]!;
        if (LOCK_SCREEN_ALLOWED_PATHS.includes(clean)) return true;
        // Allow nested computer routes (e.g. /computer/trusted-devices).
        if (clean.startsWith('/computer/')) return true;
        if (clean.startsWith('/settings/')) return true;
        return false;
    }

    function registerLockScreenSection(section: LockScreenSection) {
        sectionRegistry.set(section.id, {
            ...section,
            component: markRaw(section.component as object) as Component,
        });
    }

    function unregisterLockScreenSection(id: string) {
        sectionRegistry.delete(id);
    }

    const lockScreenSections = computed<LockScreenSection[]>(() => {
        const sections = Array.from(sectionRegistry.values()).filter((s) =>
            s.condition ? s.condition() : true,
        );
        sections.sort((a, b) => b.priority - a.priority);
        return sections;
    });

    return {
        isGated,
        isConnected,
        isPaired,
        activeHost,
        isElectronHostMode,
        shouldShowSetup,
        isAllowedPath,
        registerLockScreenSection,
        unregisterLockScreenSection,
        lockScreenSections,
    };
}
