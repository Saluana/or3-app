import { useConnectionGate } from '~/composables/useConnectionGate';

/**
 * Global route middleware that gates the app behind a connected host.
 *
 * When the gate is active, navigations are redirected to `/connect` with the
 * intended path preserved as the `next` query parameter. Whitelisted paths
 * (pairing, settings, computer panel, the lock screen itself) remain
 * reachable so users can recover from a disconnected state.
 *
 * Electron host mode and the Electron first-run setup wizard are exempt from
 * gating — those flows manage their own onboarding UI.
 */
export default defineNuxtRouteMiddleware((to) => {
    // Only run on the client; the gate depends on local cache + electron bridge
    // which are not available during SSR/SSG and the app is configured ssr: false.
    if (import.meta.server) return;

    const { isGated, isAllowedPath } = useConnectionGate();

    if (!isGated.value) {
        // Reverse case: if a user is on /connect but already connected, send
        // them back to their intended destination (handled inside the page
        // via onMounted as well, this is a safety net).
        if (to.path === '/connect') {
            const raw = to.query.next;
            const candidate = Array.isArray(raw) ? raw[0] : raw;
            if (
                typeof candidate === 'string' &&
                candidate.startsWith('/') &&
                !candidate.startsWith('//') &&
                candidate !== '/connect'
            ) {
                return navigateTo(candidate, { replace: true });
            }
        }
        return;
    }

    if (isAllowedPath(to.path)) return;

    const next = to.fullPath && to.fullPath !== '/connect' ? to.fullPath : '/';
    return navigateTo(
        {
            path: '/connect',
            query: next === '/' ? {} : { next },
        },
        { replace: true },
    );
});
