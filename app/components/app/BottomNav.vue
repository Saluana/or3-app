<template>
  <nav
    class="fixed inset-x-0 bottom-0 z-50 border-t border-(--or3-border) bg-[#FFFCF5]/95 px-3 pt-2 backdrop-blur or3-bottom-nav-safe"
    aria-label="Primary"
  >
    <div class="mx-auto grid max-w-xl grid-cols-5 items-end gap-1">
      <NuxtLink
        v-for="item in items"
        :key="item.to"
        :to="item.to"
        :aria-label="item.label"
        :aria-current="isActive(item.to) ? 'page' : undefined"
        class="group relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] transition active:scale-95 outline-none or3-focus-ring"
        :class="isActive(item.to) ? 'text-(--or3-green)' : 'text-(--or3-text-muted) hover:text-(--or3-text)'"
      >
        <span
          v-if="item.center"
          class="grid size-14 -translate-y-2 place-items-center rounded-3xl border border-(--or3-border) bg-(--or3-green-soft) text-(--or3-green) shadow-sm transition group-hover:shadow-md"
        >
          <Icon :name="item.icon" class="size-7" />
        </span>
        <Icon v-else :name="item.icon" class="size-6" />
        <span :class="item.center ? 'sr-only' : 'font-medium'">{{ item.label }}</span>
        <span
          v-if="!item.center && isActive(item.to)"
          class="absolute -bottom-1 left-1/2 h-0.75 w-7 -translate-x-1/2 rounded-full bg-(--or3-green)"
          aria-hidden="true"
        />
      </NuxtLink>
    </div>
  </nav>
</template>

<script setup lang="ts">
const route = useRoute();

const items = [
  { label: 'Chat', to: '/', icon: 'i-pixelarticons-message' },
  { label: 'Agents', to: '/agents', icon: 'i-pixelarticons-robot' },
  { label: 'Add', to: '/add', icon: 'i-pixelarticons-plus', center: true },
  { label: 'Computer', to: '/computer', icon: 'i-pixelarticons-monitor' },
  { label: 'Settings', to: '/settings', icon: 'i-pixelarticons-settings-cog' },
];

function isActive(to: string) {
  if (to === '/') return route.path === '/';
  return route.path.startsWith(to);
}
</script>

