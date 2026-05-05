<template>
    <nav
        class="or3-nav-shell or3-bottom-nav"
        :class="isKeyboardOpen ? 'or3-bottom-nav--keyboard-open' : ''"
        :aria-hidden="isKeyboardOpen ? 'true' : undefined"
        aria-label="Primary"
    >
        <div class="or3-nav-chassis">
            <!-- Left endcap pixels -->
            <div class="or3-nav-endcap or3-nav-endcap--left" aria-hidden="true">
                <span class="or3-nav-endcap-line" />
                <span class="or3-nav-pixel or3-nav-pixel--green" />
                <span class="or3-nav-pixel" />
                <span class="or3-nav-pixel" />
            </div>

            <ul class="or3-nav-row">
                <li
                    v-for="(item, index) in items"
                    :key="item.to"
                    class="or3-nav-cell"
                    :class="{
                        'or3-nav-cell--center': item.center,
                        'or3-nav-cell--active':
                            !item.center && isActive(item.to),
                    }"
                >
                    <span
                        v-if="
                            index > 0 &&
                            !item.center &&
                            !items[index - 1]?.center
                        "
                        class="or3-nav-divider"
                        aria-hidden="true"
                    />
                    <NuxtLink
                        :to="item.to"
                        :aria-label="item.label"
                        :aria-current="isActive(item.to) ? 'page' : undefined"
                        class="or3-nav-link or3-focus-ring"
                    >
                        <template v-if="item.center">
                            <span class="or3-nav-keycap" aria-hidden="true">
                                <span class="or3-nav-keycap__top">
                                    <Icon
                                        :name="item.icon"
                                        class="or3-nav-keycap__icon"
                                    />
                                </span>
                            </span>
                            <span class="sr-only">{{ item.label }}</span>
                        </template>
                        <template v-else>
                            <Icon
                                :name="item.icon"
                                class="or3-nav-icon"
                                aria-hidden="true"
                            />
                            <span class="or3-nav-label">{{ item.label }}</span>
                            <span
                                v-if="isActive(item.to)"
                                class="or3-nav-underline"
                                aria-hidden="true"
                            />
                        </template>
                    </NuxtLink>
                </li>
            </ul>

            <!-- Right endcap pixels -->
            <div
                class="or3-nav-endcap or3-nav-endcap--right"
                aria-hidden="true"
            >
                <span class="or3-nav-endcap-line" />
                <span class="or3-nav-pixel" />
                <span class="or3-nav-pixel or3-nav-pixel--green" />
                <span class="or3-nav-pixel or3-nav-pixel--green" />
            </div>
        </div>
    </nav>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router';
import { useKeyboardOpen } from '../../composables/useKeyboardOpen';

const route = useRoute();
const { isKeyboardOpen } = useKeyboardOpen();

const items = [
    { label: 'Chat', to: '/', icon: 'i-pixelarticons-message' },
    { label: 'Agents', to: '/agents', icon: 'i-pixelarticons-robot' },
    { label: 'Add', to: '/add', icon: 'i-pixelarticons-plus', center: true },
    { label: 'Computer', to: '/computer', icon: 'i-pixelarticons-monitor' },
    {
        label: 'Settings',
        to: '/settings',
        icon: 'i-pixelarticons-settings-cog',
    },
];

function isActive(to: string) {
    if (to === '/') return route.path === '/';
    return route.path.startsWith(to);
}
</script>

<style scoped>
.or3-nav-shell {
    position: fixed;
    inset-inline: 0;
    bottom: 0;
    z-index: 50;
    display: flex;
    justify-content: stretch;
    padding: 0;
    pointer-events: none;
}

.or3-nav-chassis {
    pointer-events: auto;
    position: relative;
    width: 100%;
    display: flex;
    align-items: stretch;
    gap: 0;
    padding: 0.2rem 0.5rem calc(var(--or3-safe-bottom) + 0.25rem);
    min-height: 60px;
    border-radius: 0;
    background: var(--or3-surface, #faf4df);
    border-top: 1px solid var(--or3-border, #d4cab1);
    border-bottom: 1px solid var(--or3-border, #d4cab1);
    box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.78),
        inset 0 -1px 0 rgba(120, 100, 60, 0.08);
}

.or3-nav-chassis::before {
    /* faint inner top highlight */
    content: '';
    position: absolute;
    inset: 0 0 auto 0;
    height: 14px;
    pointer-events: none;
    background: linear-gradient(
        180deg,
        rgba(255, 255, 255, 0.55) 0%,
        rgba(255, 255, 255, 0) 100%
    );
}

.or3-nav-endcap {
    flex: 0 0 auto;
    display: grid;
    flex-direction: column;
    align-items: center;
    justify-items: center;
    align-content: center;
    gap: 0.4rem;
    padding: 0.1rem 0.2rem;
    width: 18px;
}

.or3-nav-endcap-line {
    width: 2px;
    height: 22px;
    background: #e1d8bf;
    grid-row: 1 / span 3;
    align-self: start;
}

.or3-nav-pixel {
    width: 6px;
    height: 6px;
    background: #cfc6ad;
}

.or3-nav-pixel--green {
    background: color-mix(in srgb, var(--or3-green) 82%, #f4ecd4 18%);
}

.or3-nav-bars {
    display: flex;
    gap: 0.35rem;
}

.or3-nav-bars span {
    width: 3px;
    height: 14px;
    background: #c9bea2;
}

.or3-nav-row {
    list-style: none;
    margin: 0;
    padding: 0;
    flex: 1 1 auto;
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    align-items: stretch;
}

.or3-nav-cell {
    position: relative;
    display: flex;
    align-items: stretch;
    justify-content: center;
}

.or3-nav-divider {
    position: absolute;
    left: 0;
    top: 20%;
    bottom: 20%;
    width: 2px;
    background: #e1d8bf;
    opacity: 0.9;
}

.or3-nav-link {
    flex: 1 1 auto;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.2rem;
    padding: 0.45rem 0.2rem 0.5rem;
    border-radius: 0;
    color: var(--or3-text-muted);
    text-decoration: none;
    transition:
        color 0.15s ease,
        background 0.15s ease,
        transform 0.12s ease;
}

.or3-nav-link:hover {
    color: var(--or3-text);
}

.or3-nav-link:active {
    transform: scale(0.97);
}

.or3-nav-cell--active .or3-nav-link {
    color: var(--or3-green-dark);
    background: transparent;
    box-shadow: none;
}

.or3-nav-cell--active .or3-nav-link::before {
    content: none;
}

.or3-nav-cell--active .or3-nav-icon {
    filter: drop-shadow(
        0 1px 0 color-mix(in srgb, var(--or3-green-soft) 70%, transparent)
    );
}

.or3-nav-icon {
    width: 1.25rem;
    height: 1.25rem;
}

.or3-nav-label {
    font-family:
        'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    line-height: 1;
}

.or3-nav-underline {
    position: absolute;
    bottom: 1px;
    left: 50%;
    width: 34px;
    height: 3px;
    border-radius: 0;
    transform: translateX(-50%);
    background: linear-gradient(
        90deg,
        transparent 0 4px,
        var(--or3-green) 4px calc(100% - 4px),
        transparent calc(100% - 4px) 100%
    );
    box-shadow: none;
}

/* Center "+" keycap — fully contained inside the chassis */
.or3-nav-cell--center {
    align-items: center;
    justify-content: center;
}

.or3-nav-cell--center .or3-nav-link {
    background: transparent;
    box-shadow: none;
    padding: 0;
    margin: 0;
    align-self: center;
    transform: translateY(-1px);
}

.or3-nav-keycap {
    position: relative;
    display: inline-grid;
    place-items: center;
    width: 52px;
    height: 46px;
    border-radius: 0;
    background: #beb49b;
    clip-path: polygon(
        5px 0,
        calc(100% - 5px) 0,
        calc(100% - 5px) 2px,
        calc(100% - 2px) 2px,
        calc(100% - 2px) 5px,
        100% 5px,
        100% calc(100% - 5px),
        calc(100% - 2px) calc(100% - 5px),
        calc(100% - 2px) calc(100% - 2px),
        calc(100% - 5px) calc(100% - 2px),
        calc(100% - 5px) 100%,
        5px 100%,
        5px calc(100% - 2px),
        2px calc(100% - 2px),
        2px calc(100% - 5px),
        0 calc(100% - 5px),
        0 5px,
        2px 5px,
        2px 2px,
        5px 2px
    );
    box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.72),
        inset 0 -1px 0 rgba(92, 82, 56, 0.12);
    transition:
        transform 0.12s ease,
        box-shadow 0.12s ease;
}

.or3-nav-keycap::before {
    content: none;
}

.or3-nav-keycap__top {
    position: relative;
    z-index: 1;
    display: grid;
    place-items: center;
    width: 46px;
    height: 40px;
    border-radius: 0;
    background: #fbf6e8;
    clip-path: polygon(
        4px 0,
        calc(100% - 4px) 0,
        calc(100% - 4px) 2px,
        calc(100% - 2px) 2px,
        calc(100% - 2px) 4px,
        100% 4px,
        100% calc(100% - 4px),
        calc(100% - 2px) calc(100% - 4px),
        calc(100% - 2px) calc(100% - 2px),
        calc(100% - 4px) calc(100% - 2px),
        calc(100% - 4px) 100%,
        4px 100%,
        4px calc(100% - 2px),
        2px calc(100% - 2px),
        2px calc(100% - 4px),
        0 calc(100% - 4px),
        0 4px,
        2px 4px,
        2px 2px,
        4px 2px
    );
    box-shadow:
        inset 2px 2px 0 rgba(255, 255, 255, 0.78),
        inset -2px -2px 0 rgba(125, 108, 64, 0.12);
    color: var(--or3-green-dark);
}

.or3-nav-keycap__icon {
    width: 1.35rem;
    height: 1.35rem;
}

.or3-nav-link:hover .or3-nav-keycap {
    transform: translateY(-1px);
    box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.76),
        inset 0 -1px 0 rgba(92, 82, 56, 0.14);
}

.or3-nav-link:active .or3-nav-keycap {
    transform: translateY(1px);
    box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.58),
        inset 0 -1px 0 rgba(92, 82, 56, 0.1);
}

@media (max-width: 420px) {
    .or3-nav-chassis {
        padding: 0.2rem 0.25rem calc(var(--or3-safe-bottom) + 0.25rem);
        min-height: 64px;
    }

    .or3-nav-endcap {
        width: 12px;
        padding-inline: 0.1rem;
        gap: 0.3rem;
    }

    .or3-nav-endcap-line {
        height: 18px;
    }

    .or3-nav-pixel {
        width: 4px;
        height: 4px;
    }

    .or3-nav-bars span {
        width: 3px;
        height: 11px;
    }

    .or3-nav-icon {
        width: 1.15rem;
        height: 1.15rem;
    }

    .or3-nav-label {
        font-size: 0.62rem;
    }

    .or3-nav-keycap {
        width: 46px;
        height: 42px;
    }

    .or3-nav-keycap__top {
        width: 40px;
        height: 36px;
    }

    .or3-nav-keycap__icon {
        width: 1.15rem;
        height: 1.15rem;
    }
}
</style>
