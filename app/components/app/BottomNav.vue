<template>
  <nav class="fixed inset-x-0 bottom-0 z-50 border-t border-(--or3-border) bg-[#FFFCF5]/95 px-4 pt-2 backdrop-blur or3-bottom-nav-safe" aria-label="Primary">
    <div class="mx-auto grid max-w-xl grid-cols-5 items-end gap-1">
      <NuxtLink v-for="item in items" :key="item.to" :to="item.to" :aria-label="item.label" class="flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-xs transition active:scale-95" :class="isActive(item.to) ? 'text-(--or3-green)' : 'text-(--or3-text-muted)'">
        <span v-if="item.center" class="grid size-14 -translate-y-2 place-items-center rounded-3xl bg-(--or3-green-soft) text-(--or3-green) shadow-sm">
          <Icon :name="item.icon" class="size-8" />
        </span>
        <Icon v-else :name="item.icon" class="size-6" />
        <span :class="item.center ? 'sr-only' : 'font-medium'">{{ item.label }}</span>
      </NuxtLink>
    </div>
  </nav>
</template>

<script setup lang="ts">
const route = useRoute()

const items = [
  { label: 'Chat', to: '/', icon: 'i-lucide-home' },
  { label: 'Agents', to: '/agents', icon: 'i-lucide-bot' },
  { label: 'Add', to: '/add', icon: 'i-lucide-plus', center: true },
  { label: 'Computer', to: '/computer', icon: 'i-lucide-terminal-square' },
  { label: 'Settings', to: '/settings', icon: 'i-lucide-settings' },
]

function isActive(to: string) {
  if (to === '/') return route.path === '/'
  return route.path.startsWith(to)
}
</script>
