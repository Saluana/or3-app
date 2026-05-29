<template>
    <div class="space-y-7 pb-4">
        <!-- Connection details -->
        <ComputerConnectionDetails />

        <!-- Talk to Doctor -->
        <SurfaceCard class-name="or3-doctor-hero relative overflow-hidden p-0">
            <div aria-hidden="true" class="or3-doctor-hero__glow" />
            <div class="relative flex items-start gap-4 p-5">
                <div class="or3-doctor-hero__icon">
                    <Icon name="i-pixelarticons-heart" class="size-7" />
                </div>
                <div class="min-w-0 flex-1 space-y-2">
                    <p
                        class="or3-display-title text-xl leading-tight text-(--or3-text)"
                    >
                        {{ doctorHero.title }}
                    </p>
                    <p class="text-sm leading-6 text-(--or3-text-muted)">
                        {{ doctorHero.body }}
                    </p>
                </div>
            </div>
            <div class="relative space-y-4 px-5 pb-5">
                <ComputerAttentionCallout />
                <UButton
                    :label="doctorHero.actionLabel"
                    :to="doctorHero.actionTo"
                    :icon="
                        doctorHero.statusTone === 'green'
                            ? 'i-pixelarticons-heart'
                            : 'i-pixelarticons-link'
                    "
                    color="primary"
                    size="lg"
                    class="min-h-12 w-full justify-center"
                    block
                />
            </div>
        </SurfaceCard>

        <!-- Essential actions -->
        <section>
            <p class="or3-section-label">Essentials</p>
            <div class="relative mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <SettingsActionCard
                    v-for="item in actionCards"
                    :key="item.key"
                    :title="item.label"
                    :description="item.description"
                    :icon="item.icon"
                    :to="item.to"
                    :disabled="item.disabled"
                    :badge="item.badge"
                />
            </div>
        </section>

        <!-- PIN lock -->
        <section>
            <p class="or3-section-label">App security</p>
            <div class="mt-3">
                <PinLockSettings />
            </div>
        </section>

        <!-- Advanced escape hatch -->
        <section>
            <p class="or3-section-label">Power tools</p>
            <NuxtLink
                to="/settings/advanced"
                class="or3-focus-ring or3-advanced-link mt-3"
            >
                <span class="or3-advanced-link__icon">
                    <Icon name="i-pixelarticons-sliders" class="size-5" />
                </span>
                <span class="min-w-0 flex-1">
                    <span
                        class="block font-mono text-sm font-semibold text-(--or3-text)"
                    >
                        Advanced Settings
                    </span>
                    <span
                        class="mt-0.5 block text-xs leading-5 text-(--or3-text-muted)"
                    >
                        Models, memory, workspace, approvals, automation, and
                        other expert controls live here.
                    </span>
                </span>
                <Icon
                    name="i-pixelarticons-chevron-right"
                    class="size-5 shrink-0 self-center text-(--or3-text-muted)"
                />
            </NuxtLink>
        </section>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useActiveHost } from '~/composables/useActiveHost';
import { useAuthSession } from '~/composables/useAuthSession';
import { useElectronHostSetup } from '~/composables/useElectronHostSetup';
import { usePasskeys } from '~/composables/usePasskeys';
import {
    mobileHomeDestinations,
    resolveDeviceManagementRoute,
    SETTINGS_ROUTES,
    type SettingsDestination,
} from '~/settings/settingsNavigation';

type ActionBadge = { label: string; tone?: 'green' | 'amber' | 'neutral' | 'danger' };

type MobileActionCard = SettingsDestination & {
    disabled?: boolean;
    badge?: ActionBadge;
};

const HOST_BACKED_KEYS = new Set(['addons', 'skills']);

const { isConnected, isPaired } = useActiveHost();
const authSession = useAuthSession();
const passkeys = usePasskeys();
const electronHost = useElectronHostSetup();

void electronHost.ensureLoaded();

const deviceRoute = computed(() =>
    resolveDeviceManagementRoute(electronHost.isElectronHostMode.value),
);

const doctorHero = computed(() => {
    if (!isPaired.value) {
        return {
            title: 'Pair a computer first.',
            body: 'Doctor can help after this app is connected to your OR3 computer.',
            actionLabel: 'Pair computer',
            actionTo: deviceRoute.value,
            statusTone: 'amber' as const,
        };
    }
    if (!isConnected.value) {
        return {
            title: 'Reconnect to use Doctor.',
            body: 'This app remembers your computer, but cannot reach it right now.',
            actionLabel: 'Open pairing',
            actionTo: deviceRoute.value,
            statusTone: 'amber' as const,
        };
    }
    return {
        title: 'Ask Doctor to change settings.',
        body: 'Tell OR3 what you want. Doctor can diagnose problems, explain options, and guide safe changes.',
        actionLabel: 'Ask Doctor',
        actionTo: SETTINGS_ROUTES.health,
        statusTone: 'green' as const,
    };
});

const passkeyCard = computed((): Pick<MobileActionCard, 'description' | 'badge' | 'disabled'> => {
    if (!isPaired.value || !isConnected.value) {
        return {
            description: 'Pair to your computer before setting up passkeys.',
            badge: { label: 'Pair first', tone: 'amber' },
            disabled: true,
        };
    }
    const caps = authSession.capabilities.value;
    if (caps && (!caps.passkeysEnabled || caps.passkeyMode === 'off')) {
        return {
            description: 'Passkeys are not available on this host yet.',
            badge: { label: 'Unavailable', tone: 'neutral' },
            disabled: true,
        };
    }
    const hasActive = passkeys.passkeys.value.some((p) => !p.revoked_at);
    if (hasActive) {
        return {
            description: 'Passkey set up. Manage labels or add another device.',
            badge: { label: 'Ready', tone: 'green' },
            disabled: false,
        };
    }
    return {
        description: 'Add a passkey so sensitive changes verify it is really you.',
        badge: { label: 'Recommended', tone: 'amber' },
        disabled: false,
    };
});

const actionCards = computed<MobileActionCard[]>(() =>
    mobileHomeDestinations(electronHost.isElectronHostMode.value).map((item) => {
        if (item.key === 'passkeys') {
            return { ...item, ...passkeyCard.value };
        }
        return {
            ...item,
            disabled: HOST_BACKED_KEYS.has(item.key) && !isConnected.value,
        };
    }),
);

onMounted(() => {
    if (isConnected.value) {
        void authSession.loadCapabilities().catch(() => null);
        void passkeys.listPasskeys().catch(() => null);
    }
});
</script>

<style scoped>
.or3-doctor-hero {
    border-color: color-mix(in srgb, var(--or3-green) 22%, var(--or3-border));
    box-shadow: var(--or3-shadow);
}

/* Soft radial wash anchored top-right so the hero reads as the page's
   primary surface without overwhelming the cream palette. */
.or3-doctor-hero__glow {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
        radial-gradient(
            120% 90% at 100% 0%,
            color-mix(in srgb, var(--or3-green) 18%, transparent),
            transparent 60%
        );
}

.or3-doctor-hero__icon {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 3.5rem;
    height: 3.5rem;
    border-radius: 18px;
    background: linear-gradient(
        160deg,
        color-mix(in srgb, var(--or3-green-soft) 92%, white 8%),
        color-mix(in srgb, var(--or3-green-soft) 70%, var(--or3-green) 30%)
    );
    border: 1px solid color-mix(in srgb, var(--or3-green) 30%, white 70%);
    color: var(--or3-green-dark);
    box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.65),
        0 6px 16px -8px color-mix(in srgb, var(--or3-green) 60%, transparent);
}

.or3-advanced-link {
    display: flex;
    align-items: stretch;
    gap: 0.85rem;
    width: 100%;
    padding: 1rem;
    border-radius: var(--or3-radius-card);
    border: 1px dashed color-mix(in srgb, var(--or3-border) 85%, var(--or3-green) 15%);
    background: color-mix(in srgb, var(--or3-surface) 55%, var(--or3-background) 45%);
    text-align: left;
    text-decoration: none;
    transition:
        background 0.16s ease,
        border-color 0.16s ease,
        box-shadow 0.16s ease;
}

.or3-advanced-link:hover {
    background: var(--or3-green-soft);
    border-color: color-mix(in srgb, var(--or3-green) 35%, white 65%);
    border-style: solid;
    box-shadow: var(--or3-shadow-soft);
}

.or3-advanced-link__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 13px;
    background: var(--or3-surface);
    border: 1px solid var(--or3-border);
    color: var(--or3-text-muted);
    transition: color 0.16s ease;
}

.or3-advanced-link:hover .or3-advanced-link__icon {
    color: var(--or3-green-dark);
    border-color: color-mix(in srgb, var(--or3-green) 28%, white 72%);
}

@media (prefers-reduced-motion: reduce) {
    .or3-advanced-link,
    .or3-advanced-link__icon {
        transition: none;
    }
}
</style>
