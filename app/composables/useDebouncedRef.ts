import { onScopeDispose, ref, watch, type Ref } from 'vue';

export function useDebouncedRef<T, U = T>(
    source: Ref<T>,
    delayMs: number,
    map?: (value: T) => U,
) {
    const initial = map ? map(source.value) : (source.value as unknown as U);
    const debounced = ref(initial) as Ref<U>;
    let timer: ReturnType<typeof setTimeout> | null = null;

    watch(
        source,
        (value) => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
                debounced.value = map ? map(value) : (value as unknown as U);
            }, delayMs);
        },
        { immediate: true },
    );

    onScopeDispose(() => {
        if (timer) clearTimeout(timer);
    });

    return debounced;
}
