<template>
    <Transition name="or3-status-fade">
        <div
            v-if="active"
            class="or3-status"
            role="status"
            aria-live="polite"
            :aria-label="`or3-intern is ${verb}`"
        >
            <span class="or3-status__prefix" aria-hidden="true">//</span>

            <span class="or3-status__bar" aria-hidden="true">
                <span
                    v-for="i in CELLS"
                    :key="i"
                    class="or3-status__cell"
                    :style="{ '--or3-status-cell': String(i - 1) }"
                />
                <span class="or3-status__scanner" />
            </span>

            <span class="or3-status__label">
                <span class="or3-status__verb">{{ verb }}</span>
                <span class="or3-status__cursor" aria-hidden="true">_</span>
            </span>
        </div>
    </Transition>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';

const props = defineProps<{ active: boolean }>();

const CELLS = 10;
const VERBS = [
    'thinking',
    'tinkering',
    'computing',
    'musing',
    'rummaging',
    'scheming',
] as const;

const verbIndex = ref(0);
const verb = computed(() => VERBS[verbIndex.value % VERBS.length]);

let timer: ReturnType<typeof setInterval> | null = null;

function start() {
    if (timer) return;
    // Pick a fresh verb each time we kick off so it doesn't always start the same.
    verbIndex.value = Math.floor(Math.random() * VERBS.length);
    timer = setInterval(() => {
        verbIndex.value = (verbIndex.value + 1) % VERBS.length;
    }, 2400);
}

function stop() {
    if (!timer) return;
    clearInterval(timer);
    timer = null;
}

watch(
    () => props.active,
    (active) => {
        if (active) start();
        else stop();
    },
    { immediate: true },
);

onBeforeUnmount(stop);
</script>

<style scoped>
.or3-status {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    margin: 0 auto 0.45rem;
    padding: 0.3rem 0.7rem;
    border: 1px solid var(--or3-border);
    border-radius: 999px;
    background: color-mix(in srgb, var(--or3-surface) 85%, transparent);
    backdrop-filter: blur(6px);
    box-shadow: var(--or3-shadow-soft);
    font-family:
        'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.7rem;
    line-height: 1;
    letter-spacing: 0.08em;
    text-transform: lowercase;
    color: var(--or3-text-muted);
    user-select: none;
    /* center horizontally in the composer column */
    width: max-content;
    max-width: 90%;
}

.or3-status__prefix {
    color: var(--or3-green);
    font-weight: 600;
    letter-spacing: 0;
    opacity: 0.75;
}

.or3-status__bar {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 2px 3px;
    border-radius: 4px;
    background: color-mix(in srgb, var(--or3-text) 6%, transparent);
}

.or3-status__cell {
    width: 5px;
    height: 7px;
    border-radius: 1px;
    background: color-mix(in srgb, var(--or3-text) 14%, transparent);
}

/* KITT-style sweeper: a single bright pixel slides L→R→L across the cells. */
.or3-status__scanner {
    position: absolute;
    top: 2px;
    left: 3px;
    width: 5px;
    height: 7px;
    border-radius: 1px;
    background: var(--or3-green);
    box-shadow:
        0 0 4px color-mix(in srgb, var(--or3-green) 70%, transparent),
        0 0 1px var(--or3-green-dark);
    /* Travel distance = (cells-1) * (cell width 5px + gap 2px) */
    --or3-status-travel: calc((10 - 1) * 7px);
    animation: or3-status-sweep 1.5s cubic-bezier(0.45, 0, 0.55, 1) infinite
        alternate;
}

@keyframes or3-status-sweep {
    from {
        transform: translateX(0);
    }
    to {
        transform: translateX(var(--or3-status-travel));
    }
}

.or3-status__label {
    display: inline-flex;
    align-items: baseline;
    gap: 1px;
    min-width: 6.5ch; /* reserve space so the pill doesn't jiggle on verb swap */
    color: var(--or3-text-muted);
}

.or3-status__verb {
    transition: opacity 220ms ease;
}

.or3-status__cursor {
    color: var(--or3-green-dark);
    font-weight: 700;
    animation: or3-status-blink 1.05s steps(1, end) infinite;
}

@keyframes or3-status-blink {
    0%,
    49% {
        opacity: 1;
    }
    50%,
    100% {
        opacity: 0;
    }
}

.or3-status-fade-enter-active,
.or3-status-fade-leave-active {
    transition:
        opacity 180ms ease,
        transform 180ms ease;
}
.or3-status-fade-enter-from,
.or3-status-fade-leave-to {
    opacity: 0;
    transform: translateY(4px);
}

@media (prefers-reduced-motion: reduce) {
    .or3-status__scanner {
        animation: none;
        opacity: 0.85;
    }
    .or3-status__cursor {
        animation: none;
        opacity: 0.6;
    }
    .or3-status-fade-enter-active,
    .or3-status-fade-leave-active {
        transition: opacity 80ms linear;
    }
}
</style>
