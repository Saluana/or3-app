<template>
  <div class="or3-app-shell">
    <ElectronHostSetupWizard />
    <template v-if="isDesktop">
      <DesktopAppShell
        :title="desktopTitle"
        :subtitle="desktopSubtitle"
        :badges="desktopBadges"
        :flush="desktopFlush"
      >
        <template v-if="$slots.sidebar" #sidebar>
          <slot name="sidebar" />
        </template>
        <template v-if="$slots['header-actions']" #header-actions>
          <slot name="header-actions" />
        </template>
        <template v-if="$slots.header" #header>
          <slot name="header" />
        </template>
        <slot name="desktop">
          <slot />
        </slot>
      </DesktopAppShell>
    </template>

    <template v-else>
      <main class="or3-mobile-screen mx-auto flex w-full max-w-xl flex-col">
        <slot name="mobile-extras" />
        <slot />
      </main>
      <BottomNav />
    </template>
  </div>
</template>

<script setup lang="ts">
import { useViewport } from '~/composables/useViewport'

const { matches: isDesktop } = useViewport('(min-width: 1024px)')

withDefaults(
  defineProps<{
    desktopTitle?: string
    desktopSubtitle?: string
    desktopBadges?: Array<{ label: string; tone?: 'green' | 'amber' | 'neutral' | 'rose'; icon?: string }>
    desktopFlush?: boolean
  }>(),
  {
    desktopTitle: '',
    desktopSubtitle: '',
    desktopBadges: () => [],
    desktopFlush: false,
  },
)
</script>
