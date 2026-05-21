<template>
    <div class="or3-lock-screen">
        <!-- Preserve Electron first-run wizard if a user lands here while it's pending. -->
        <ElectronHostSetupWizard />

        <!-- Decorative animated backdrop -->
        <div class="or3-lock-screen__backdrop" aria-hidden="true">
            <div class="or3-lock-screen__grid" />
            <div class="or3-lock-screen__blob or3-lock-screen__blob--a" />
            <div class="or3-lock-screen__blob or3-lock-screen__blob--b" />
            <div class="or3-lock-screen__blob or3-lock-screen__blob--c" />
        </div>

        <div class="or3-lock-screen__viewport">
            <header class="or3-lock-screen__header">
                <NuxtLink
                    to="/connect"
                    class="or3-lock-screen__brand"
                    aria-label="OR3"
                >
                    <BrandMark size="lg" />
                    <span class="or3-lock-screen__brand-text">
                        <span class="or3-lock-screen__brand-name">OR3</span>
                        <span class="or3-lock-screen__brand-tag">
                            companion
                        </span>
                    </span>
                </NuxtLink>

                <div class="or3-lock-screen__header-actions">
                    <span
                        class="or3-lock-screen__status"
                        :data-tone="statusTone"
                    >
                        <span class="or3-lock-screen__status-dot" />
                        {{ statusLabel }}
                    </span>
                    <NuxtLink
                        to="/settings"
                        class="or3-lock-screen__settings-link"
                        aria-label="Open settings"
                    >
                        <UIcon
                            name="i-pixelarticons-sliders"
                            class="or3-lock-screen__settings-icon"
                        />
                        <span>Settings</span>
                    </NuxtLink>
                </div>
            </header>

            <main class="or3-lock-screen__main">
                <div class="or3-lock-screen__primary or3-lock-screen__fade-in">
                    <LockScreenWelcomeSection
                        :can-host-locally="isElectron"
                        @setup-host="onSetupHost"
                        @pair-device="onPairDevice"
                        @learn-more="onLearnMore"
                    />
                </div>

                <div
                    v-for="(section, idx) in lockScreenSections"
                    :key="section.id"
                    class="or3-lock-screen__card or3-lock-screen__fade-in"
                    :style="{ animationDelay: `${(idx + 1) * 80}ms` }"
                >
                    <component :is="section.component" />
                </div>

                <div
                    class="or3-lock-screen__card or3-lock-screen__tips or3-lock-screen__fade-in"
                    style="animation-delay: 160ms"
                >
                    <div class="or3-lock-screen__tips-head">
                        <span class="or3-lock-screen__tips-kicker">
                            HELP
                        </span>
                        <h2 class="or3-lock-screen__tips-title">
                            Tips for getting connected
                        </h2>
                    </div>
                    <ul class="or3-lock-screen__tips-list">
                        <li>
                            <span class="or3-lock-screen__tip-icon">
                                <UIcon name="i-pixelarticons-zap" />
                            </span>
                            <span>
                                Make sure your computer is running the OR3
                                service and reachable on the same network (LAN,
                                Tailscale, or another reachable address).
                            </span>
                        </li>
                        <li>
                            <span class="or3-lock-screen__tip-icon">
                                <UIcon name="i-pixelarticons-shield" />
                            </span>
                            <span>
                                Secure pairing uses a one-time code from your
                                computer. The code expires after a few minutes.
                            </span>
                        </li>
                        <li>
                            <span class="or3-lock-screen__tip-icon">
                                <UIcon name="i-pixelarticons-reload" />
                            </span>
                            <span>
                                Already paired? Open
                                <NuxtLink to="/settings" class="or3-lock-link">
                                    Settings
                                </NuxtLink>
                                to retry the connection or pick a different
                                computer.
                            </span>
                        </li>
                    </ul>
                </div>

                <p class="or3-lock-screen__footer">
                    Made with care ·
                    <span class="or3-lock-screen__footer-accent">
                        or3-intern
                    </span>
                </p>
            </main>
        </div>

        <PairingSheet v-model:open="pairingOpen" />
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useConnectionGate } from '~/composables/useConnectionGate';
import { useElectronHostSetup } from '~/composables/useElectronHostSetup';

definePageMeta({
    // This page intentionally bypasses the connection gate.
    layout: false,
});

const route = useRoute();
const router = useRouter();
const { isGated, isConnected, isPaired, lockScreenSections } =
    useConnectionGate();

const electronHost = useElectronHostSetup();
const { isElectron } = electronHost;
const pairingOpen = ref(false);

const statusLabel = computed(() => {
    if (isConnected.value) return 'Connected';
    if (isPaired.value) return 'Reconnecting…';
    return 'Not connected';
});

const statusTone = computed<'connected' | 'reconnecting' | 'idle'>(() => {
    if (isConnected.value) return 'connected';
    if (isPaired.value) return 'reconnecting';
    return 'idle';
});

async function onSetupHost() {
    await electronHost.ensureLoaded();
    await electronHost.chooseMode('host');
}

function onPairDevice() {
    pairingOpen.value = true;
}

function onLearnMore() {
    void router.push('/settings/permissions');
}

function nextDestination(): string {
    const raw = route.query.next;
    const candidate = Array.isArray(raw) ? raw[0] : raw;
    if (typeof candidate !== 'string' || !candidate) return '/';
    if (!candidate.startsWith('/') || candidate.startsWith('//')) return '/';
    if (candidate === '/connect') return '/';
    return candidate;
}

watch(
    () => isGated.value,
    (gated) => {
        if (!gated) void router.replace(nextDestination());
    },
);

onMounted(() => {
    if (!isGated.value) void router.replace(nextDestination());
});
</script>

<style scoped>
.or3-lock-screen {
    position: relative;
    min-height: 100dvh;
    color: var(--or3-text, #24241f);
    padding: clamp(1rem, 4vw, 3rem) clamp(1rem, 4vw, 2rem) 2.5rem;
    display: flex;
    justify-content: center;
    overflow: hidden;
    background:
        radial-gradient(
            ellipse at top,
            color-mix(in srgb, var(--or3-green-soft, #e1efe4) 70%, transparent)
                0%,
            transparent 55%
        ),
        linear-gradient(180deg, #faf4e6 0%, #f4ecdb 100%);
}

/* ---------- Backdrop ---------- */
.or3-lock-screen__backdrop {
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
}

.or3-lock-screen__grid {
    position: absolute;
    inset: 0;
    background-image:
        linear-gradient(rgba(42, 35, 25, 0.05) 1px, transparent 1px),
        linear-gradient(90deg, rgba(42, 35, 25, 0.05) 1px, transparent 1px);
    background-size: 28px 28px;
    mask-image: radial-gradient(
        ellipse at center,
        black 0%,
        black 40%,
        transparent 75%
    );
    -webkit-mask-image: radial-gradient(
        ellipse at center,
        black 0%,
        black 40%,
        transparent 75%
    );
    opacity: 0.55;
}

.or3-lock-screen__blob {
    position: absolute;
    border-radius: 50%;
    filter: blur(50px);
    opacity: 0.55;
    animation: or3-lock-drift 18s ease-in-out infinite;
}

.or3-lock-screen__blob--a {
    width: 22rem;
    height: 22rem;
    background: color-mix(
        in srgb,
        var(--or3-green-soft, #e1efe4) 80%,
        var(--or3-green, #71a75f) 20%
    );
    top: -6rem;
    left: -6rem;
}

.or3-lock-screen__blob--b {
    width: 18rem;
    height: 18rem;
    background: var(--or3-amber-soft, #f7ecd0);
    bottom: -4rem;
    right: -4rem;
    animation-delay: -6s;
}

.or3-lock-screen__blob--c {
    width: 14rem;
    height: 14rem;
    background: color-mix(
        in srgb,
        var(--or3-green, #71a75f) 18%,
        transparent
    );
    top: 40%;
    right: 12%;
    animation-delay: -12s;
    opacity: 0.35;
}

/* ---------- Layout ---------- */
.or3-lock-screen__viewport {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 40rem;
    display: flex;
    flex-direction: column;
    gap: 1.75rem;
}

.or3-lock-screen__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
}

.or3-lock-screen__brand {
    display: inline-flex;
    align-items: center;
    gap: 0.7rem;
    text-decoration: none;
    color: inherit;
}

.or3-lock-screen__brand-text {
    display: flex;
    flex-direction: column;
    line-height: 1.1;
}

.or3-lock-screen__brand-name {
    font-family: var(--font-display, 'Press Start 2P', monospace);
    font-size: 0.95rem;
    letter-spacing: 0.04em;
    color: var(--or3-text, #24241f);
}

.or3-lock-screen__brand-tag {
    font-size: 0.7rem;
    color: var(--or3-text-muted, #6f6a60);
    margin-top: 0.2rem;
    letter-spacing: 0.06em;
}

.or3-lock-screen__header-actions {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
}

/* status pill */
.or3-lock-screen__status {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.4rem 0.8rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    border: 1px solid var(--or3-border, #ddd4c7);
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    color: var(--or3-text, #24241f);
    box-shadow: 0 1px 0 rgba(255, 255, 255, 0.7) inset;
}

.or3-lock-screen__status-dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: var(--or3-text-muted, #6f6a60);
    position: relative;
}

.or3-lock-screen__status-dot::after {
    content: '';
    position: absolute;
    inset: -3px;
    border-radius: 50%;
    background: inherit;
    opacity: 0;
}

.or3-lock-screen__status[data-tone='connected'] {
    border-color: color-mix(in srgb, var(--or3-green, #71a75f) 35%, white 65%);
    background: color-mix(in srgb, var(--or3-green-soft, #e1efe4) 70%, white 30%);
    color: var(--or3-green-dark, #28623b);
}
.or3-lock-screen__status[data-tone='connected'] .or3-lock-screen__status-dot {
    background: var(--or3-green, #71a75f);
    animation: or3-lock-ping 1.8s ease-out infinite;
}

.or3-lock-screen__status[data-tone='reconnecting'] {
    border-color: color-mix(in srgb, var(--or3-amber, #c89232) 35%, white 65%);
    background: color-mix(
        in srgb,
        var(--or3-amber-soft, #f7ecd0) 75%,
        white 25%
    );
    color: #8a5a18;
}
.or3-lock-screen__status[data-tone='reconnecting'] .or3-lock-screen__status-dot {
    background: var(--or3-amber, #c89232);
    animation: or3-lock-ping 1.4s ease-out infinite;
}

/* settings link */
.or3-lock-screen__settings-link {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.45rem 0.85rem;
    border-radius: 0.85rem;
    border: 1px solid var(--or3-border, #ddd4c7);
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--or3-text, #24241f);
    text-decoration: none;
    transition:
        background 150ms ease,
        border-color 150ms ease,
        transform 150ms ease,
        box-shadow 150ms ease;
    box-shadow:
        0 1px 0 rgba(255, 255, 255, 0.85) inset,
        0 6px 14px -10px rgba(42, 35, 25, 0.25);
}

.or3-lock-screen__settings-link:hover {
    background: #ffffff;
    border-color: color-mix(in srgb, var(--or3-green, #71a75f) 35%, white 65%);
    transform: translateY(-1px);
    box-shadow:
        0 1px 0 rgba(255, 255, 255, 0.95) inset,
        0 10px 18px -10px rgba(42, 35, 25, 0.3);
}

.or3-lock-screen__settings-icon {
    width: 1rem;
    height: 1rem;
    color: var(--or3-green-dark, #28623b);
}

/* ---------- Main column ---------- */
.or3-lock-screen__main {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
}

.or3-lock-screen__primary,
.or3-lock-screen__card {
    position: relative;
    background: linear-gradient(
        180deg,
        rgba(255, 255, 255, 0.92) 0%,
        rgba(255, 252, 245, 0.92) 100%
    );
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border: 1px solid var(--or3-border, #ddd4c7);
    border-radius: 1.5rem;
    box-shadow:
        0 1px 0 rgba(255, 255, 255, 0.95) inset,
        0 -1px 0 rgba(42, 35, 25, 0.04) inset,
        0 22px 44px -22px rgba(42, 35, 25, 0.25),
        0 4px 14px -8px rgba(42, 35, 25, 0.1);
}

.or3-lock-screen__primary {
    padding: 0.5rem 0.5rem 1rem;
    overflow: hidden;
}

.or3-lock-screen__primary::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(
        90deg,
        var(--or3-green, #71a75f),
        var(--or3-green-dark, #28623b),
        var(--or3-green, #71a75f)
    );
    border-radius: 1.5rem 1.5rem 0 0;
    opacity: 0.85;
}

/* ---------- Tips card ---------- */
.or3-lock-screen__tips {
    padding: 1.25rem 1.35rem 1.4rem;
}

.or3-lock-screen__tips-head {
    margin-bottom: 1rem;
}

.or3-lock-screen__tips-kicker {
    display: inline-block;
    font-family: var(--font-display, 'Press Start 2P', monospace);
    font-size: 0.6rem;
    letter-spacing: 0.2em;
    color: var(--or3-green-dark, #28623b);
    background: var(--or3-green-soft, #e1efe4);
    padding: 0.3rem 0.55rem;
    border-radius: 999px;
    border: 1px solid
        color-mix(in srgb, var(--or3-green, #71a75f) 25%, white 75%);
    margin-bottom: 0.55rem;
}

.or3-lock-screen__tips-title {
    font-family: var(--font-display, 'Press Start 2P', monospace);
    font-size: 0.9rem;
    line-height: 1.4;
    color: var(--or3-text, #24241f);
}

.or3-lock-screen__tips-list {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    list-style: none;
    padding: 0;
    margin: 0;
}

.or3-lock-screen__tips-list li {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    font-size: 0.875rem;
    line-height: 1.55;
    color: var(--or3-text, #24241f);
}

.or3-lock-screen__tip-icon {
    flex-shrink: 0;
    width: 1.85rem;
    height: 1.85rem;
    border-radius: 0.6rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--or3-green-soft, #e1efe4);
    color: var(--or3-green-dark, #28623b);
    border: 1px solid
        color-mix(in srgb, var(--or3-green, #71a75f) 22%, white 78%);
}

.or3-lock-screen__tip-icon :deep(svg),
.or3-lock-screen__tip-icon :deep(.iconify) {
    width: 1rem;
    height: 1rem;
}

.or3-lock-link {
    color: var(--or3-green-dark, #28623b);
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 2px;
    text-decoration-thickness: 1px;
    transition: color 150ms ease;
}

.or3-lock-link:hover {
    color: var(--or3-green, #71a75f);
}

/* ---------- Footer ---------- */
.or3-lock-screen__footer {
    margin: 0.5rem auto 0;
    text-align: center;
    font-size: 0.75rem;
    color: var(--or3-text-muted, #6f6a60);
    letter-spacing: 0.02em;
}

.or3-lock-screen__footer-accent {
    color: var(--or3-green-dark, #28623b);
    font-weight: 600;
}

/* ---------- Animations ---------- */
.or3-lock-screen__fade-in {
    opacity: 0;
    transform: translateY(10px);
    animation: or3-lock-rise 520ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
}

@keyframes or3-lock-rise {
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes or3-lock-ping {
    0% {
        box-shadow: 0 0 0 0
            color-mix(in srgb, currentColor 50%, transparent);
    }
    70% {
        box-shadow: 0 0 0 6px transparent;
    }
    100% {
        box-shadow: 0 0 0 0 transparent;
    }
}

@keyframes or3-lock-drift {
    0%,
    100% {
        transform: translate(0, 0) scale(1);
    }
    33% {
        transform: translate(20px, -10px) scale(1.04);
    }
    66% {
        transform: translate(-15px, 12px) scale(0.98);
    }
}

@media (prefers-reduced-motion: reduce) {
    .or3-lock-screen__fade-in {
        opacity: 1;
        transform: none;
        animation: none;
    }
    .or3-lock-screen__blob {
        animation: none;
    }
    .or3-lock-screen__status-dot {
        animation: none !important;
    }
}
</style>
