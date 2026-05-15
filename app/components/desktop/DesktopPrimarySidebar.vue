<template>
    <nav class="or3-desktop-primary" aria-label="Global navigation">
        <NuxtLink to="/" class="or3-desktop-primary__brand or3-focus-ring">
            <span class="or3-desktop-primary__brand-mark">
                <BrandMark size="md" />
            </span>
            <span class="or3-desktop-primary__brand-text">
                <span class="or3-desktop-primary__brand-name">or3</span>
                <span class="or3-desktop-primary__brand-tag">intern</span>
            </span>
        </NuxtLink>

        <ul class="or3-desktop-primary__nav">
            <li v-for="item in items" :key="item.to">
                <NuxtLink
                    :to="item.to"
                    class="or3-desktop-nav-item or3-focus-ring"
                    :class="{ 'is-active': isActive(item) }"
                    :aria-current="isActive(item) ? 'page' : undefined"
                >
                    <span class="or3-desktop-nav-item__icon" aria-hidden="true">
                        <Icon :name="item.icon" class="size-4" />
                    </span>
                    <span class="or3-desktop-nav-item__label">{{ item.label }}</span>
                    <span
                        v-if="item.badgeCount"
                        class="or3-desktop-nav-item__badge"
                        aria-hidden="true"
                    >{{ item.badgeCount > 99 ? '99+' : item.badgeCount }}</span>
                </NuxtLink>
            </li>
        </ul>

        <div class="or3-desktop-primary__spacer" aria-hidden="true" />

        <div class="or3-desktop-primary__status">
            <div class="or3-desktop-primary__status-mascot" aria-hidden="true">
                <img
                    src="/or3-brand-mark.png"
                    alt=""
                    class="or3-desktop-primary__status-img"
                />
            </div>
            <div class="or3-desktop-primary__status-text">
                <p class="or3-desktop-primary__status-name">or3-intern</p>
                <p class="or3-desktop-primary__status-state">
                    <span
                        class="or3-desktop-primary__status-dot"
                        :data-tone="connected ? 'green' : 'muted'"
                    />
                    {{ connected ? 'Online' : 'Offline' }}
                </p>
            </div>
        </div>
    </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useApprovals } from '~/composables/useApprovals';
import { useActiveHost } from '~/composables/useActiveHost';

const route = useRoute();
const { pendingCount } = useApprovals();
const { activeHost } = useActiveHost();
const connected = computed(() => Boolean(activeHost.value?.token));

interface NavItem {
    label: string;
    to: string;
    icon: string;
    matches?: string[];
    badgeCount?: number;
}

const items = computed<NavItem[]>(() => [
    { label: 'Chat', to: '/', icon: 'i-pixelarticons-message' },
    { label: 'Agents', to: '/agents', icon: 'i-pixelarticons-robot' },
    { label: 'Computer', to: '/computer', icon: 'i-pixelarticons-monitor' },
    {
        label: 'Approvals',
        to: '/approvals',
        icon: 'i-pixelarticons-shield',
        badgeCount: pendingCount.value || 0,
    },
    {
        label: 'Settings',
        to: '/settings',
        icon: 'i-pixelarticons-settings-cog',
    },
]);

function isActive(item: NavItem) {
    if (item.to === '/') return route.path === '/';
    return route.path === item.to || route.path.startsWith(item.to + '/');
}
</script>
