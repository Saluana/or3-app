<template>
    <div class="or3-lock-welcome">
        <div class="or3-lock-welcome__crt">
            <div class="or3-lock-welcome__crt-screen">
                <img
                    src="/computer-icons/chat-guy.webp"
                    alt=""
                    class="or3-lock-welcome__icon-image"
                />
                <div class="or3-lock-welcome__crt-scanlines" aria-hidden="true" />
            </div>
            <div class="or3-lock-welcome__crt-stand" aria-hidden="true" />
        </div>

        <div class="or3-lock-welcome__eyebrow">
            <span class="or3-lock-welcome__dot" />
            <span>READY WHEN YOU ARE</span>
        </div>

        <h1 class="or3-lock-welcome__title">
            Welcome!<br />
            <span class="or3-lock-welcome__title-accent">
                Let's get you set up.
            </span>
        </h1>

        <p class="or3-lock-welcome__subtitle">
            Connect OR3 to your computer to start chatting, managing files,
            and getting things done.
        </p>

        <div class="or3-lock-welcome__actions">
            <button
                v-if="canHostLocally"
                type="button"
                class="or3-lock-cta or3-lock-cta--primary"
                @click="$emit('setupHost')"
            >
                <UIcon
                    name="i-pixelarticons-monitor"
                    class="or3-lock-cta__icon"
                />
                <span class="or3-lock-cta__label">Set up this computer</span>
                <UIcon
                    name="i-pixelarticons-chevron-right"
                    class="or3-lock-cta__chev"
                />
            </button>
            <button
                type="button"
                :class="[
                    'or3-lock-cta',
                    canHostLocally
                        ? 'or3-lock-cta--secondary'
                        : 'or3-lock-cta--primary',
                ]"
                @click="$emit('pairDevice')"
            >
                <UIcon name="i-pixelarticons-link" class="or3-lock-cta__icon" />
                <span class="or3-lock-cta__label">Connect to a computer</span>
                <UIcon
                    name="i-pixelarticons-chevron-right"
                    class="or3-lock-cta__chev"
                />
            </button>
        </div>

        <button
            type="button"
            class="or3-lock-welcome__learn"
            @click="$emit('learnMore')"
        >
            <UIcon name="i-pixelarticons-book" />
            What can OR3 do?
        </button>
    </div>
</template>

<script setup lang="ts">
withDefaults(
    defineProps<{
        canHostLocally?: boolean;
    }>(),
    { canHostLocally: false },
);

defineEmits<{
    setupHost: [];
    pairDevice: [];
    learnMore: [];
}>();
</script>

<style scoped>
.or3-lock-welcome {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 2.25rem 1.5rem 1.5rem;
    max-width: 30rem;
    margin: 0 auto;
}

/* ---------- CRT monitor icon ---------- */
.or3-lock-welcome__crt {
    position: relative;
    margin-bottom: 1.75rem;
    animation: or3-lock-float 6s ease-in-out infinite;
}

.or3-lock-welcome__crt-screen {
    position: relative;
    width: 5.75rem;
    height: 5.75rem;
    border-radius: 1.1rem;
    overflow: hidden;
    border: 2px solid var(--or3-border-strong, #c9beaf);
    background: linear-gradient(
        160deg,
        #fffaee 0%,
        var(--or3-surface, #fffcf5) 50%,
        #f1eadf 100%
    );
    box-shadow:
        0 2px 0 rgba(255, 255, 255, 0.85) inset,
        0 -2px 0 rgba(42, 35, 25, 0.08) inset,
        0 14px 28px -10px rgba(42, 35, 25, 0.25),
        0 0 0 4px rgba(255, 255, 255, 0.6),
        0 0 0 5px var(--or3-border, #ddd4c7);
}

.or3-lock-welcome__icon-image {
    position: relative;
    z-index: 1;
    width: 100%;
    height: 100%;
    object-fit: cover;
    image-rendering: auto;
}

.or3-lock-welcome__crt-scanlines {
    position: absolute;
    inset: 0;
    z-index: 2;
    pointer-events: none;
    background-image: repeating-linear-gradient(
        0deg,
        rgba(42, 35, 25, 0.06) 0,
        rgba(42, 35, 25, 0.06) 1px,
        transparent 1px,
        transparent 3px
    );
    mix-blend-mode: multiply;
    opacity: 0.55;
}

.or3-lock-welcome__crt-stand {
    position: absolute;
    left: 50%;
    bottom: -10px;
    transform: translateX(-50%);
    width: 2.5rem;
    height: 0.55rem;
    border-radius: 0 0 0.4rem 0.4rem;
    background: var(--or3-border, #ddd4c7);
    box-shadow:
        0 2px 0 rgba(42, 35, 25, 0.1),
        inset 0 1px 0 rgba(255, 255, 255, 0.6);
}

/* ---------- Text ---------- */
.or3-lock-welcome__eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    font-family: var(--font-display, 'Press Start 2P', monospace);
    font-size: 0.625rem;
    letter-spacing: 0.18em;
    color: var(--or3-green-dark, #28623b);
    background: var(--or3-green-soft, #e1efe4);
    padding: 0.4rem 0.7rem;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--or3-green, #71a75f) 30%, white 70%);
    margin-bottom: 1rem;
}

.or3-lock-welcome__dot {
    width: 0.45rem;
    height: 0.45rem;
    border-radius: 50%;
    background: var(--or3-green, #71a75f);
    animation: or3-lock-blink 1.6s ease-in-out infinite;
}

.or3-lock-welcome__title {
    font-family: var(--font-display, 'Press Start 2P', monospace);
    font-size: clamp(1.05rem, 2.4vw, 1.4rem);
    line-height: 1.55;
    color: var(--or3-text, #24241f);
    margin-bottom: 0.85rem;
    letter-spacing: 0.01em;
}

.or3-lock-welcome__title-accent {
    background: linear-gradient(
        90deg,
        var(--or3-green-dark, #28623b),
        var(--or3-green, #71a75f)
    );
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
}

.or3-lock-welcome__subtitle {
    font-size: 0.9375rem;
    line-height: 1.6;
    color: var(--or3-text-muted, #6f6a60);
    margin-bottom: 2rem;
    max-width: 24rem;
}

/* ---------- CTA buttons ---------- */
.or3-lock-welcome__actions {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
    max-width: 22rem;
}

.or3-lock-cta {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.65rem;
    width: 100%;
    min-height: 3.25rem;
    padding: 0 1rem;
    border-radius: 1rem;
    font-size: 0.95rem;
    font-weight: 600;
    letter-spacing: 0.01em;
    cursor: pointer;
    border: 2px solid transparent;
    transition:
        transform 120ms ease,
        box-shadow 180ms ease,
        background 180ms ease,
        border-color 180ms ease;
}

.or3-lock-cta__icon {
    width: 1.15rem;
    height: 1.15rem;
    flex-shrink: 0;
}

.or3-lock-cta__chev {
    width: 1.1rem;
    height: 1.1rem;
    margin-left: auto;
    opacity: 0.7;
    transition: transform 180ms ease, opacity 180ms ease;
}

.or3-lock-cta:hover .or3-lock-cta__chev {
    transform: translateX(3px);
    opacity: 1;
}

.or3-lock-cta:active {
    transform: translateY(1px);
}

/* primary */
.or3-lock-cta--primary {
    color: #ffffff;
    background: linear-gradient(
        160deg,
        color-mix(in srgb, var(--or3-green, #71a75f) 95%, white 5%) 0%,
        var(--or3-green-dark, #28623b) 100%
    );
    border-color: var(--or3-green-dark, #28623b);
    box-shadow:
        0 1px 0 rgba(255, 255, 255, 0.35) inset,
        0 -2px 0 rgba(0, 0, 0, 0.12) inset,
        0 10px 22px -8px rgba(40, 98, 59, 0.5);
    animation: or3-lock-pulse 2.6s ease-in-out infinite;
}

.or3-lock-cta--primary:hover {
    box-shadow:
        0 1px 0 rgba(255, 255, 255, 0.45) inset,
        0 -2px 0 rgba(0, 0, 0, 0.15) inset,
        0 14px 26px -8px rgba(40, 98, 59, 0.6);
}

/* secondary */
.or3-lock-cta--secondary {
    color: var(--or3-text, #24241f);
    background: var(--or3-surface, #fffcf5);
    border-color: var(--or3-border, #ddd4c7);
    box-shadow:
        0 1px 0 rgba(255, 255, 255, 0.85) inset,
        0 6px 14px -8px rgba(42, 35, 25, 0.18);
}

.or3-lock-cta--secondary:hover {
    background: #ffffff;
    border-color: color-mix(in srgb, var(--or3-green, #71a75f) 45%, white 55%);
    color: var(--or3-green-dark, #28623b);
}

.or3-lock-cta--secondary .or3-lock-cta__icon {
    color: var(--or3-green-dark, #28623b);
}

/* learn more link */
.or3-lock-welcome__learn {
    margin-top: 1.5rem;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: transparent;
    border: 0;
    cursor: pointer;
    color: var(--or3-text-muted, #6f6a60);
    font-size: 0.8125rem;
    padding: 0.4rem 0.7rem;
    border-radius: 0.6rem;
    transition: color 150ms ease, background 150ms ease;
}

.or3-lock-welcome__learn:hover {
    color: var(--or3-green-dark, #28623b);
    background: var(--or3-green-soft, #e1efe4);
}

/* ---------- Animations ---------- */
@keyframes or3-lock-pulse {
    0%,
    100% {
        transform: translateY(0);
    }
    50% {
        transform: translateY(-2px);
    }
}

@keyframes or3-lock-float {
    0%,
    100% {
        transform: translateY(0);
    }
    50% {
        transform: translateY(-4px);
    }
}

@keyframes or3-lock-blink {
    0%,
    100% {
        opacity: 1;
    }
    50% {
        opacity: 0.35;
    }
}

@media (prefers-reduced-motion: reduce) {
    .or3-lock-cta--primary,
    .or3-lock-welcome__crt,
    .or3-lock-welcome__dot {
        animation: none;
    }
}
</style>
