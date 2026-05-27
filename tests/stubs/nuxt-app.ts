import { ref, type Ref } from 'vue';
import { vi } from 'vitest';

export const navigateTo = vi.fn(async () => undefined);

const nuxtState = new Map<string, Ref<unknown>>();

export function useState<T>(
    key: string,
    init?: () => T,
): Ref<T> {
    if (!nuxtState.has(key)) {
        nuxtState.set(key, ref(init ? init() : undefined) as Ref<unknown>);
    }
    return nuxtState.get(key) as Ref<T>;
}

/** Test-only reset for stubbed Nuxt shared state. */
export function clearNuxtAppStateForTests() {
    nuxtState.clear();
}
