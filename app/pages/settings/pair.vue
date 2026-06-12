<template>
    <AppShell desktop-title="Settings" desktop-subtitle="Configure or3-intern.">
        <template #sidebar><SettingsSidebar /></template>
        <AppHeader :subtitle="isElectronHostMode ? 'TRUSTED DEVICES' : 'PAIR DEVICE'" />

        <div class="or3-pair-page">
            <!-- decorative backdrop, fades behind the cards -->
            <div class="or3-pair-page__backdrop" aria-hidden="true">
                <div class="or3-pair-page__grid" />
                <div class="or3-pair-page__blob or3-pair-page__blob--a" />
                <div class="or3-pair-page__blob or3-pair-page__blob--b" />
            </div>

            <div class="or3-pair-page__inner">
                <!-- breadcrumb / back -->
                <button
                    type="button"
                    class="or3-pair-back"
                    @click="goBack"
                >
                    <UIcon name="i-pixelarticons-chevron-left" class="or3-pair-back__icon" />
                    <span>Settings</span>
                </button>

                <!-- hero -->
                <section class="or3-pair-hero or3-pair-fade-in">
                    <div class="or3-pair-hero__icon">
                        <UIcon
                            :name="isElectronHostMode ? 'i-pixelarticons-monitor' : 'i-pixelarticons-link'"
                            class="or3-pair-hero__icon-glyph"
                        />
                    </div>
                    <div class="or3-pair-hero__text">
                        <span class="or3-pair-hero__kicker">
                            <span class="or3-pair-hero__kicker-dot" />
                            {{ isElectronHostMode ? 'HOST MODE' : 'DEVICE PAIRING' }}
                        </span>
                        <h2 class="or3-pair-hero__title">
                            {{
                                isElectronHostMode
                                    ? 'This computer is the host'
                                    : 'Pair this app with your computer'
                            }}
                        </h2>
                        <p class="or3-pair-hero__subtitle">
                            {{
                                isElectronHostMode
                                    ? 'Manage which phones, browsers, and remote apps can talk to this machine.'
                                    : 'Scan a QR, paste an invite link, or use a one-time code. Secure pairing is recommended.'
                            }}
                        </p>
                    </div>
                </section>

                <!-- host-mode short-cuts -->
                <section
                    v-if="isElectronHostMode"
                    class="or3-pair-card or3-pair-fade-in"
                    style="animation-delay: 80ms"
                >
                    <div class="or3-pair-card__body">
                        <div class="flex flex-col gap-3">
                            <p class="font-mono text-base font-semibold text-(--or3-text)">
                                Manage devices on this computer
                            </p>
                            <p class="text-sm leading-6 text-(--or3-text-muted)">
                                Use <strong>Connect devices</strong> to add phones,
                                browsers, or remote Electron apps.
                                <strong>Trusted devices</strong> lists enrolled secure devices.
                            </p>
                            <div class="flex flex-wrap gap-2 pt-1">
                                <UButton
                                    label="Connect devices"
                                    icon="i-pixelarticons-link"
                                    to="/computer/connect-device"
                                />
                                <UButton
                                    label="Trusted devices"
                                    icon="i-pixelarticons-shield"
                                    color="neutral"
                                    variant="soft"
                                    to="/computer/trusted-devices"
                                />
                            </div>
                        </div>
                    </div>
                </section>

                <!-- client pairing surface -->
                <template v-else>
                    <div class="or3-pair-fade-in" style="animation-delay: 80ms">
                        <div class="or3-pair-card or3-pair-card--accent">
                            <SecurePairingCard />
                        </div>
                    </div>

                    <div class="or3-pair-fade-in" style="animation-delay: 200ms">
                        <div class="or3-pair-card">
                            <SecureDeviceApprovalCard />
                        </div>
                    </div>
                </template>
            </div>
        </div>
    </AppShell>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { onMounted } from 'vue';
import { useElectronHostSetup } from '~/composables/useElectronHostSetup';

const router = useRouter();
const { isElectronHostMode, ensureLoaded } = useElectronHostSetup();

onMounted(() => {
    void ensureLoaded();
});

function goBack() {
    void router.push('/settings');
}
</script>

<style scoped>
.or3-pair-page {
    position: relative;
}

/* ---------- backdrop ---------- */
.or3-pair-page__backdrop {
    position: absolute;
    inset: -1rem -1rem auto -1rem;
    height: 22rem;
    pointer-events: none;
    z-index: 0;
    overflow: hidden;
    border-radius: 1.5rem;
    mask-image: linear-gradient(180deg, black 0%, black 60%, transparent 100%);
    -webkit-mask-image: linear-gradient(
        180deg,
        black 0%,
        black 60%,
        transparent 100%
    );
}

.or3-pair-page__grid {
    position: absolute;
    inset: 0;
    background-image:
        linear-gradient(rgba(42, 35, 25, 0.05) 1px, transparent 1px),
        linear-gradient(90deg, rgba(42, 35, 25, 0.05) 1px, transparent 1px);
    background-size: 28px 28px;
    opacity: 0.5;
}

.or3-pair-page__blob {
    position: absolute;
    border-radius: 50%;
    filter: blur(50px);
    opacity: 0.55;
}

.or3-pair-page__blob--a {
    width: 18rem;
    height: 18rem;
    background: color-mix(
        in srgb,
        var(--or3-green-soft, #e1efe4) 80%,
        var(--or3-green, #71a75f) 20%
    );
    top: -5rem;
    left: -4rem;
    animation: or3-pair-drift 18s ease-in-out infinite;
}

.or3-pair-page__blob--b {
    width: 14rem;
    height: 14rem;
    background: var(--or3-amber-soft, #f7ecd0);
    top: -3rem;
    right: -3rem;
    opacity: 0.45;
    animation: or3-pair-drift 22s ease-in-out infinite reverse;
}

/* ---------- layout ---------- */
.or3-pair-page__inner {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 1.1rem;
}

/* ---------- back pill ---------- */
.or3-pair-back {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.45rem 0.9rem 0.45rem 0.65rem;
    border-radius: 999px;
    border: 1px solid var(--or3-border, #ddd4c7);
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--or3-text, #24241f);
    cursor: pointer;
    transition:
        transform 150ms ease,
        background 150ms ease,
        border-color 150ms ease,
        box-shadow 180ms ease;
    box-shadow:
        0 1px 0 rgba(255, 255, 255, 0.85) inset,
        0 6px 14px -10px rgba(42, 35, 25, 0.25);
}

.or3-pair-back:hover {
    background: #ffffff;
    border-color: color-mix(in srgb, var(--or3-green, #71a75f) 40%, white 60%);
    color: var(--or3-green-dark, #28623b);
    transform: translateX(-2px);
    box-shadow:
        0 1px 0 rgba(255, 255, 255, 0.95) inset,
        0 10px 18px -10px rgba(42, 35, 25, 0.3);
}

.or3-pair-back__icon {
    width: 0.95rem;
    height: 0.95rem;
}

/* ---------- hero ---------- */
.or3-pair-hero {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    padding: 1.15rem 1.25rem;
    border-radius: 1.5rem;
    border: 1px solid var(--or3-border, #ddd4c7);
    background: linear-gradient(
        180deg,
        rgba(255, 255, 255, 0.92) 0%,
        rgba(255, 252, 245, 0.92) 100%
    );
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    box-shadow:
        0 1px 0 rgba(255, 255, 255, 0.95) inset,
        0 -1px 0 rgba(42, 35, 25, 0.04) inset,
        0 22px 44px -22px rgba(42, 35, 25, 0.18),
        0 4px 14px -8px rgba(42, 35, 25, 0.08);
    overflow: hidden;
}

.or3-pair-hero::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(
        90deg,
        var(--or3-green, #71a75f),
        var(--or3-green-dark, #28623b),
        var(--or3-green, #71a75f)
    );
    opacity: 0.85;
}

.or3-pair-hero__icon {
    flex-shrink: 0;
    width: 3.25rem;
    height: 3.25rem;
    border-radius: 1rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(
        160deg,
        var(--or3-green-soft, #e1efe4) 0%,
        #ffffff 100%
    );
    border: 1px solid
        color-mix(in srgb, var(--or3-green, #71a75f) 30%, white 70%);
    color: var(--or3-green-dark, #28623b);
    box-shadow:
        0 1px 0 rgba(255, 255, 255, 0.95) inset,
        0 6px 12px -6px rgba(40, 98, 59, 0.25);
}

.or3-pair-hero__icon-glyph {
    width: 1.5rem;
    height: 1.5rem;
}

.or3-pair-hero__text {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
}

.or3-pair-hero__kicker {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    align-self: flex-start;
    font-family: var(--font-display, 'Press Start 2P', monospace);
    font-size: 0.6rem;
    letter-spacing: 0.2em;
    color: var(--or3-green-dark, #28623b);
    background: var(--or3-green-soft, #e1efe4);
    padding: 0.3rem 0.55rem;
    border-radius: 999px;
    border: 1px solid
        color-mix(in srgb, var(--or3-green, #71a75f) 25%, white 75%);
}

.or3-pair-hero__kicker-dot {
    width: 0.4rem;
    height: 0.4rem;
    border-radius: 50%;
    background: var(--or3-green, #71a75f);
    animation: or3-pair-blink 1.6s ease-in-out infinite;
}

.or3-pair-hero__title {
    font-family: var(--font-display, 'Press Start 2P', monospace);
    font-size: clamp(0.95rem, 1.6vw, 1.1rem);
    line-height: 1.5;
    color: var(--or3-text, #24241f);
    margin: 0;
}

.or3-pair-hero__subtitle {
    font-size: 0.875rem;
    line-height: 1.55;
    color: var(--or3-text-muted, #6f6a60);
    margin: 0;
    max-width: 38rem;
}

/* ---------- generic card wrapper ---------- */
.or3-pair-card {
    position: relative;
    border-radius: 1.5rem;
    border: 1px solid var(--or3-border, #ddd4c7);
    background: linear-gradient(
        180deg,
        rgba(255, 255, 255, 0.92) 0%,
        rgba(255, 252, 245, 0.92) 100%
    );
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    box-shadow:
        0 1px 0 rgba(255, 255, 255, 0.95) inset,
        0 -1px 0 rgba(42, 35, 25, 0.04) inset,
        0 22px 44px -22px rgba(42, 35, 25, 0.18),
        0 4px 14px -8px rgba(42, 35, 25, 0.08);
    overflow: hidden;
}

.or3-pair-card--accent::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(
        90deg,
        var(--or3-green, #71a75f),
        var(--or3-green-dark, #28623b),
        var(--or3-green, #71a75f)
    );
    opacity: 0.85;
    z-index: 1;
}

.or3-pair-card__body {
    padding: 1.15rem 1.25rem 1.3rem;
}

/* Strip nested SurfaceCard chrome so embedded cards inherit our shell */
.or3-pair-card :deep(.or3-surface) {
    border: 0;
    background: transparent;
    box-shadow: none;
    border-radius: 0;
    padding: 1.15rem 1.25rem 1.3rem;
}

/* ---------- disclosure ---------- */
.or3-pair-disclosure {
    border-radius: 1.25rem;
    border: 1px dashed
        color-mix(in srgb, var(--or3-border-strong, #c9beaf) 80%, white 20%);
    background: rgba(255, 255, 255, 0.6);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    transition: background 180ms ease, border-color 180ms ease;
}

.or3-pair-disclosure[open] {
    border-style: solid;
    background: rgba(255, 255, 255, 0.88);
    box-shadow:
        0 1px 0 rgba(255, 255, 255, 0.85) inset,
        0 18px 36px -22px rgba(42, 35, 25, 0.18);
}

.or3-pair-disclosure__summary {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    padding: 0.85rem 1.1rem;
    cursor: pointer;
    list-style: none;
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--or3-text, #24241f);
}

.or3-pair-disclosure__summary::-webkit-details-marker {
    display: none;
}

.or3-pair-disclosure__chev {
    width: 0.95rem;
    height: 0.95rem;
    color: var(--or3-text-muted, #6f6a60);
    transition: transform 180ms ease, color 180ms ease;
}

.or3-pair-disclosure[open] .or3-pair-disclosure__chev {
    transform: rotate(90deg);
    color: var(--or3-green-dark, #28623b);
}

.or3-pair-disclosure__label {
    margin-right: auto;
}

.or3-pair-disclosure__hint {
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 0.7rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--or3-text-muted, #6f6a60);
    padding: 0.2rem 0.5rem;
    border-radius: 999px;
    background: var(--or3-surface-soft, #f1eadf);
    border: 1px solid var(--or3-border, #ddd4c7);
}

.or3-pair-disclosure__body {
    padding: 0 1.1rem 1.1rem;
}

/* ---------- animations ---------- */
.or3-pair-fade-in {
    opacity: 0;
    transform: translateY(8px);
    animation: or3-pair-rise 480ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
}

@keyframes or3-pair-rise {
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes or3-pair-blink {
    0%,
    100% {
        opacity: 1;
    }
    50% {
        opacity: 0.35;
    }
}

@keyframes or3-pair-drift {
    0%,
    100% {
        transform: translate(0, 0) scale(1);
    }
    50% {
        transform: translate(14px, -8px) scale(1.04);
    }
}

@media (prefers-reduced-motion: reduce) {
    .or3-pair-fade-in,
    .or3-pair-page__blob,
    .or3-pair-hero__kicker-dot {
        animation: none;
        opacity: 1;
        transform: none;
    }
}
</style>
