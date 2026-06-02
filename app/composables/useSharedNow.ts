import { onBeforeUnmount, onMounted, ref } from 'vue';

const subscribers = new Set<(ts: number) => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let intervalMs = 1000;

function tick() {
    const now = Date.now();
    for (const fn of subscribers) fn(now);
}

function start() {
    if (timer) return;
    timer = setInterval(tick, intervalMs);
}

function stop() {
    if (!timer) return;
    clearInterval(timer);
    timer = null;
}

export function useSharedNow(ms?: number) {
    const now = ref(Date.now());
    if (ms && ms > 0) intervalMs = ms;

    let handler: (ts: number) => void;

    onMounted(() => {
        handler = (ts: number) => { now.value = ts; };
        subscribers.add(handler);
        start();
    });

    onBeforeUnmount(() => {
        if (handler) subscribers.delete(handler);
        if (subscribers.size === 0) stop();
    });

    return now;
}
