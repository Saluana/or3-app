<template>
    <SurfaceCard class-name="or3-overview space-y-5 sm:space-y-6">
        <div class="or3-overview__hero">
            <div class="or3-overview__mascot-shell">
                <div class="or3-overview__mascot-glow" aria-hidden="true" />
                <svg
                    class="or3-overview__sparkles"
                    viewBox="0 0 220 210"
                    fill="none"
                    aria-hidden="true"
                >
                    <path class="or3-overview__sparkle or3-overview__sparkle--soft" d="M28 54h8m-4-4v8" />
                    <path class="or3-overview__sparkle or3-overview__sparkle--green" d="M178 38h16m-8-8v16" />
                    <path class="or3-overview__sparkle" d="M190 116h12m-6-6v12" />
                    <path class="or3-overview__sparkle or3-overview__sparkle--soft" d="M154 82h8m-4-4v8" />
                    <path class="or3-overview__sparkle or3-overview__sparkle--green" d="M78 28h10m-5-5v10" />
                    <circle class="or3-overview__sparkle-dot" cx="38" cy="96" r="2.5" />
                    <circle class="or3-overview__sparkle-dot or3-overview__sparkle-dot--green" cx="168" cy="148" r="2.5" />
                </svg>
                <div class="or3-overview__mascot">
                    <RetroComputerMascot
                        src="/computer-icons/waving-guy.webp"
                        :size="184"
                        :sparkle="online"
                        class="or3-overview__mascot-img"
                    />
                </div>
            </div>

            <div class="or3-overview__copy">
                <p
                    class="or3-overview__eyebrow"
                >
                    <span class="or3-overview__eyebrow-dot" aria-hidden="true" />
                    Connected to
                </p>
                <h2
                    class="or3-overview__title"
                >
                    {{ hostName }}
                </h2>
                <div class="mt-3 flex flex-wrap items-center gap-2">
                    <span
                        :class="['or3-overview__pill', `or3-overview__pill--${statusTone}`]"
                    >
                        <Icon
                            v-if="statusTone === 'amber'"
                            name="i-pixelarticons-warning-box"
                            class="or3-overview__pill-icon"
                            aria-hidden="true"
                        />
                        <span
                            v-else
                            :class="['or3-overview__pill-dot', online ? 'or3-live-dot' : '']"
                            aria-hidden="true"
                        />
                        <span class="or3-overview__pill-label">{{ statusLabel }}</span>
                    </span>
                </div>
                <p class="or3-overview__message">
                    {{ statusMessage }}
                </p>
            </div>
        </div>

        <nav class="or3-overview__tabs">
            <NuxtLink
                v-for="tab in tabs"
                :key="tab.to"
                :to="tab.to"
                class="or3-overview__tab"
                :class="{
                    'or3-overview__tab--active': tab.to === activeTab,
                }"
            >
                <div class="or3-overview__tab-icon-wrap">
                    <img :src="tab.iconSrc" alt="" :class="['or3-overview__tab-icon', tab.iconClass]" />
                </div>
                <span class="or3-overview__tab-label">{{ tab.label }}</span>
                <span class="or3-overview__tab-underline" aria-hidden="true" />
            </NuxtLink>
        </nav>
    </SurfaceCard>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { CapabilitiesResponse, HealthResponse, ReadinessResponse } from '~/types/or3-api';

const props = withDefaults(
    defineProps<{
        hostName?: string;
        baseUrl?: string;
        health?: HealthResponse | null;
        readiness?: ReadinessResponse | null;
        capabilities?: CapabilitiesResponse | null;
        connected?: boolean;
        activeTab?: string;
    }>(),
    {
        hostName: 'No computer paired',
        baseUrl: '',
        health: null,
        readiness: null,
        capabilities: null,
        connected: false,
        activeTab: '/computer/files',
    },
);

const tabs = [
    { label: 'Files', iconSrc: '/computer-icons/folder.png', to: '/computer/files' },
    { label: 'Terminal', iconSrc: '/computer-icons/terminal.png', to: '/computer/terminal' },
    { label: 'Approvals', iconSrc: '/computer-icons/security.png', iconClass: 'or3-overview__tab-icon--approvals', to: '/approvals' },
    { label: 'Preferences', iconSrc: '/computer-icons/settings.png', to: '/settings' },
];

const online = computed(
    () =>
        props.connected &&
        (props.health?.status === 'ok' ||
            props.health?.status === 'healthy'),
);

const needsAttention = computed(
    () => props.connected && online.value && props.readiness?.ready === false,
);

const statusLabel = computed(() => {
    if (!props.connected) return 'not paired';
    if (needsAttention.value) return 'needs attention';
    if (online.value) return 'Online';
    if (props.health) return 'check connection';
    return 'connecting…';
});

const statusTone = computed<'green' | 'amber' | 'neutral'>(() => {
    if (!props.connected) return 'neutral';
    if (needsAttention.value) return 'amber';
    if (online.value) return 'green';
    return 'amber';
});

const statusMessage = computed(() => {
    if (!props.connected)
        return 'Pair a computer in Settings to connect or3-intern to your machine.';
    if (needsAttention.value)
        return 'or3-intern is reachable, but its readiness checks found something that needs attention.';
    if (online.value)
        return "Everything looks good. You're connected and ready to go.";
    if (props.health)
        return 'Connection trouble — check that or3-intern is running on your computer.';
    return 'Reaching your computer…';
});
</script>

<style scoped>
.or3-overview {
    position: relative;
    overflow: hidden;
}

.or3-overview::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
        radial-gradient(circle at 18% 20%, color-mix(in srgb, var(--or3-green-soft) 55%, transparent) 0%, transparent 28%),
        radial-gradient(circle at 82% 18%, rgba(255, 255, 255, 0.82) 0%, transparent 24%),
        linear-gradient(180deg, rgba(255, 255, 255, 0.18), transparent 32%);
}

.or3-overview__hero {
    position: relative;
    display: flex;
    align-items: center;
    gap: 1.25rem;
    min-width: 0;
}

.or3-overview__mascot-shell {
    position: relative;
    flex-shrink: 0;
    width: 200px;
    min-height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.or3-overview__mascot-glow {
    position: absolute;
    inset: -6px -4px 4px;
    border-radius: 999px;
    background:
        radial-gradient(circle at 52% 48%, rgba(220, 249, 184, 0.62) 0%, rgba(206, 239, 192, 0.48) 34%, transparent 68%),
        radial-gradient(circle at 42% 78%, rgba(238, 255, 197, 0.85) 0%, rgba(201, 235, 176, 0.44) 28%, transparent 52%),
        radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--or3-green-soft) 72%, white 28%) 0%, transparent 72%);
    filter: blur(4px);
    opacity: 0.95;
}

.or3-overview__mascot-glow::after {
    content: '';
    position: absolute;
    left: 16%;
    right: 12%;
    bottom: 14%;
    height: 22%;
    border-radius: 999px;
    background: radial-gradient(ellipse at center, rgba(226, 255, 173, 0.72) 0%, rgba(180, 225, 141, 0.34) 44%, transparent 72%);
    filter: blur(2px);
}

.or3-overview__mascot {
    position: relative;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    z-index: 1;
}

.or3-overview__mascot-img {
    width: 184px;
    height: auto;
}

.or3-overview__sparkles {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 2;
    overflow: visible;
}

.or3-overview__sparkle {
    stroke: rgba(255, 255, 255, 0.96);
    stroke-width: 4;
    stroke-linecap: square;
    filter: drop-shadow(0 0 5px rgba(193, 229, 145, 0.72));
    opacity: 0.92;
}

.or3-overview__sparkle--green {
    stroke: color-mix(in srgb, var(--or3-green) 38%, white 62%);
    opacity: 0.78;
}

.or3-overview__sparkle--soft {
    opacity: 0.58;
    stroke-width: 3;
}

.or3-overview__sparkle-dot {
    fill: rgba(255, 255, 255, 0.88);
    filter: drop-shadow(0 0 4px rgba(193, 229, 145, 0.62));
}

.or3-overview__sparkle-dot--green {
    fill: color-mix(in srgb, var(--or3-green) 42%, white 58%);
}

.or3-overview__copy {
    min-width: 0;
    flex: 1 1 auto;
    padding-top: 0.5rem;
}

.or3-overview__eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    margin: 0;
    color: color-mix(in srgb, var(--or3-green-dark) 70%, var(--or3-text) 30%);
    font-size: 0.92rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
}

.or3-overview__eyebrow-dot {
    width: 9px;
    height: 9px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--or3-green) 70%, white 30%);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--or3-green-soft) 75%, transparent);
}

.or3-overview__title {
    margin: 0.4rem 0 0;
    font-family: Georgia, 'Iowan Old Style', 'Times New Roman', serif;
    font-size: clamp(2.2rem, 4.5vw, 3.25rem);
    line-height: 0.95;
    font-weight: 700;
    color: var(--or3-text);
    letter-spacing: -0.03em;
}

.or3-overview__pill {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    padding: 0.55rem 1rem 0.55rem 0.85rem;
    border-radius: 999px;
    border: 1.5px solid;
    background: white;
    font-size: 1rem;
    font-weight: 600;
    line-height: 1;
    box-shadow: 0 6px 18px rgba(42, 35, 25, 0.06);
}

.or3-overview__pill-icon {
    width: 1.15rem;
    height: 1.15rem;
    flex-shrink: 0;
}

.or3-overview__pill-dot {
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 999px;
    flex-shrink: 0;
}

.or3-overview__pill--amber {
    border-color: color-mix(in srgb, var(--or3-amber, #e0a83a) 55%, white 45%);
    color: color-mix(in srgb, var(--or3-amber, #c2871f) 80%, #6b4a14 20%);
    background: color-mix(in srgb, #fff8e8 80%, white 20%);
}
.or3-overview__pill--amber .or3-overview__pill-icon {
    color: color-mix(in srgb, var(--or3-amber, #d99a2b) 85%, #8a5a10 15%);
}

.or3-overview__pill--green {
    border-color: color-mix(in srgb, var(--or3-green) 35%, white 65%);
    color: color-mix(in srgb, var(--or3-green-dark) 85%, var(--or3-text) 15%);
    background: color-mix(in srgb, var(--or3-green-soft) 55%, white 45%);
}
.or3-overview__pill--green .or3-overview__pill-dot {
    background: var(--or3-green);
}

.or3-overview__pill--neutral {
    border-color: var(--or3-border);
    color: var(--or3-text-muted);
    background: var(--or3-surface-soft);
}
.or3-overview__pill--neutral .or3-overview__pill-dot {
    background: var(--or3-text-muted);
}

.or3-overview__message {
    margin: 1.15rem 0 0;
    max-width: 28rem;
    font-size: 1rem;
    line-height: 1.75;
    color: var(--or3-text-muted);
}

.or3-overview__tabs {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.25rem;
    padding: 0.85rem 0.5rem 0.7rem;
    border-radius: 24px;
    background: color-mix(in srgb, var(--or3-surface-soft) 78%, white 22%);
    border: 1px solid var(--or3-border);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.or3-overview__tab {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    gap: 0.6rem;
    min-height: 118px;
    padding: 0.55rem 0.35rem 0.7rem;
    border-radius: 16px;
    color: var(--or3-text);
    font-size: 0.85rem;
    font-weight: 600;
    transition:
        background 0.15s ease,
        color 0.15s ease,
        box-shadow 0.15s ease,
        transform 0.15s ease;
    text-decoration: none;
}

.or3-overview__tab-icon-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    border-radius: 14px;
    background: transparent;
    box-shadow: none;
}

.or3-overview__tab-icon {
    display: block;
    width: auto;
    height: 40px;
    max-width: 44px;
    object-fit: contain;
    image-rendering: pixelated;
}
.or3-overview__tab-icon--approvals {
    height: 42px;
    max-width: 40px;
}

.or3-overview__tab-label {
    line-height: 1.1;
}

.or3-overview__tab-underline {
    display: block;
    width: 22px;
    height: 3px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--or3-green) 35%, white 65%);
    opacity: 0.85;
    transition: background 0.15s ease, width 0.15s ease, opacity 0.15s ease;
}

.or3-overview__tab:hover {
    background: rgba(255, 255, 255, 0.65);
}
.or3-overview__tab:hover .or3-overview__tab-underline {
    background: color-mix(in srgb, var(--or3-green) 55%, white 45%);
    opacity: 1;
}
.or3-overview__tab:active {
    transform: scale(0.98);
}
.or3-overview__tab--active {
    color: var(--or3-green-dark);
}
.or3-overview__tab--active .or3-overview__tab-underline {
    width: 28px;
    background: color-mix(in srgb, var(--or3-green) 70%, white 30%);
    opacity: 1;
}

@media (max-width: 520px) {
    .or3-overview__hero {
        align-items: center;
        gap: 0.65rem;
    }

    .or3-overview__mascot-shell {
        width: clamp(112px, 34vw, 150px);
        min-height: clamp(124px, 38vw, 158px);
    }

    .or3-overview__mascot-img {
        width: clamp(108px, 32vw, 144px);
    }

    .or3-overview__copy {
        padding-top: 0;
        text-align: left;
    }

    .or3-overview__eyebrow {
        gap: 0.35rem;
        font-size: clamp(0.64rem, 2.35vw, 0.76rem);
        letter-spacing: 0.11em;
        margin-bottom: 0.28rem;
    }

    .or3-overview__eyebrow-dot {
        width: 7px;
        height: 7px;
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--or3-green-soft) 75%, transparent);
    }

    .or3-overview__title {
        margin-top: 0;
        font-size: clamp(1.62rem, 7.4vw, 2.08rem);
        line-height: 0.98;
        white-space: nowrap;
    }

    .or3-overview__copy > .mt-3 {
        margin-top: 0.58rem;
    }

    .or3-overview__pill {
        gap: 0.4rem;
        padding: 0.42rem 0.72rem 0.42rem 0.62rem;
        font-size: clamp(0.7rem, 2.85vw, 0.84rem);
    }

    .or3-overview__pill-icon {
        width: 0.95rem;
        height: 0.95rem;
    }

    .or3-overview__message {
        max-width: none;
        margin-top: 0.72rem;
        font-size: clamp(0.76rem, 3.1vw, 0.88rem);
        line-height: 1.5;
    }

    .or3-overview__tabs {
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 0.15rem;
        padding: 0.6rem 0.3rem 0.5rem;
    }

    .or3-overview__tab {
        min-height: 104px;
        gap: 0.4rem;
        padding: 0.4rem 0.2rem 0.55rem;
        font-size: 0.78rem;
    }

    .or3-overview__tab-icon-wrap {
        width: 48px;
        height: 48px;
    }

    .or3-overview__tab-icon {
        height: 32px;
        max-width: 36px;
    }
}

@media (max-width: 420px) {
    .or3-overview__hero {
        gap: 0.45rem;
    }

    .or3-overview__mascot-shell {
        width: clamp(94px, 31vw, 118px);
        min-height: clamp(108px, 35vw, 132px);
    }

    .or3-overview__mascot-img {
        width: clamp(94px, 30vw, 116px);
    }

    .or3-overview__eyebrow {
        font-size: clamp(0.56rem, 2.15vw, 0.66rem);
        letter-spacing: 0.1em;
        margin-bottom: 0.22rem;
    }

    .or3-overview__title {
        font-size: clamp(1.3rem, 6.5vw, 1.68rem);
        line-height: 1;
    }

    .or3-overview__copy > .mt-3 {
        margin-top: 0.48rem;
    }

    .or3-overview__pill {
        padding: 0.34rem 0.54rem 0.34rem 0.48rem;
        font-size: clamp(0.62rem, 2.7vw, 0.74rem);
    }

    .or3-overview__message {
        margin-top: 0.62rem;
        font-size: clamp(0.68rem, 2.85vw, 0.78rem);
        line-height: 1.45;
    }

    .or3-overview__tabs {
        border-radius: 20px;
        padding-inline: 0.2rem;
    }

    .or3-overview__tab {
        font-size: 0.68rem;
    }

    .or3-overview__tab-icon-wrap {
        width: 42px;
        height: 42px;
    }

    .or3-overview__tab-icon {
        height: 29px;
        max-width: 32px;
    }
}
</style>
