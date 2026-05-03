<template>
  <div class="or3-fb-crumbs-wrap">
    <!-- At root: show just the root label, no chain, no popover -->
    <span v-if="!parts.length" class="or3-fb-current-static" :title="rootLabel">
      <span class="truncate">{{ rootLabel }}</span>
    </span>

    <!-- Otherwise: show only the current folder name, openable to reveal full chain -->
    <UPopover
      v-else
      v-model:open="popoverOpen"
      :content="{ align: 'start', sideOffset: 8 }"
      :ui="{ content: 'or3-fb-crumb-pop' }"
    >
      <button
        type="button"
        class="or3-fb-current or3-focus-ring h-8"
        :title="`${rootLabel} / ${path}`"
        :aria-label="`Current folder: ${currentName}. Tap to see the full path.`"
      >
        <Icon name="pixelarticons:folder" class="size-3.5 shrink-0 text-(--or3-green-dark, var(--or3-green))" />
        <span class="or3-fb-current-name" :title="currentName">{{ currentName }}</span>
        <Icon name="i-pixelarticons-chevron-down" class="size-3 shrink-0 opacity-60" />
      </button>

      <template #content>
        <div class="or3-fb-crumb-list" role="menu" aria-label="Path breadcrumb">
          <p class="or3-fb-crumb-eyebrow">Full path</p>

          <button
            type="button"
            role="menuitem"
            class="or3-fb-crumb-item"
            @click="navigate('.')"
          >
            <Icon name="i-pixelarticons-device-laptop" class="size-4 shrink-0 text-(--or3-text-muted)" />
            <span class="truncate">{{ rootLabel }}</span>
            <span class="or3-fb-crumb-tag">root</span>
          </button>

          <div
            v-for="(part, index) in parts"
            :key="part.path"
            class="or3-fb-crumb-row"
          >
            <span class="or3-fb-crumb-rail pl-3" aria-hidden="true">
              <Icon name="i-pixelarticons-corner-down-right" class="size-3 text-(--or3-text-muted) shrink-0" />
            </span>
            <button
              type="button"
              role="menuitem"
              class="or3-fb-crumb-item"
              :class="{ 'is-current': index === parts.length - 1 }"
              @click="navigate(part.path)"
            >
              <Icon
                :name="'i-pixelarticons-folder'"
                class="size-4 shrink-0"
                :class="index === parts.length - 1 ? 'text-(--or3-green-dark, var(--or3-green))' : 'text-(--or3-text-muted)'"
              />
              <span class="truncate" :title="part.name">{{ part.name }}</span>
              <span v-if="index === parts.length - 1" class="or3-fb-crumb-tag is-current">here</span>
            </button>
          </div>
        </div>
      </template>
    </UPopover>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

interface CrumbPart { name: string; path: string }

const props = defineProps<{ path: string; rootLabel: string }>()
const emit = defineEmits<{ navigate: [path: string] }>()

const popoverOpen = ref(false)

const parts = computed<CrumbPart[]>(() => {
  if (!props.path || props.path === '.') return []
  const names = props.path.split('/').filter(Boolean)
  return names.map((name, index) => ({
    name,
    path: names.slice(0, index + 1).join('/'),
  }))
})

const currentName = computed(() => parts.value[parts.value.length - 1]?.name ?? props.rootLabel)

function navigate(path: string) {
  popoverOpen.value = false
  emit('navigate', path)
}
</script>

<style scoped>
.or3-fb-crumbs-wrap {
  display: flex;
  align-items: center;
  min-width: 0;
  flex: 1 1 auto;
}

/* Static label when at root */
.or3-fb-current-static {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.55rem;
  border-radius: 0.7rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--or3-text);
  min-width: 0;
  max-width: 100%;
}

/* The current-folder pill button */
.or3-fb-current {
  display: inline-flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 0.35rem;
  padding: 0.3rem 0.55rem 0.3rem 0.55rem;
  border-radius: 0.7rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--or3-green-dark, var(--or3-text));
  background: color-mix(in srgb, var(--or3-green-soft) 55%, transparent);
  border: 1px solid color-mix(in srgb, var(--or3-green) 22%, transparent);
  min-width: 0;
  max-width: min(100%, 18rem);
  overflow: hidden;
  transition: background 140ms ease, border-color 140ms ease, transform 120ms ease;
}
.or3-fb-current:hover { background: color-mix(in srgb, var(--or3-green-soft) 80%, transparent); }
.or3-fb-current:active { transform: scale(0.98); }
.or3-fb-current-name {
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>

<style>
/* The popover is teleported to the body, so unscoped styles needed */
.or3-fb-crumb-pop {
  background: var(--or3-surface) !important;
  border: 1px solid var(--or3-border) !important;
  border-radius: 1rem !important;
  box-shadow: 0 18px 40px rgba(42, 35, 25, 0.2) !important;
  padding: 0 !important;
  min-width: 16rem;
  max-width: min(20rem, calc(100vw - 1.5rem));
}

.or3-fb-crumb-list {
  display: flex;
  flex-direction: column;
  padding: 0.55rem;
  max-height: 60vh;
  overflow-y: auto;
}
.or3-fb-crumb-eyebrow {
  padding: 0.2rem 0.55rem 0.45rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--or3-text-muted);
}

.or3-fb-crumb-row {
  display: grid;
  grid-template-columns: 1.4rem 1fr;
  align-items: stretch;
  gap: 0.1rem;
}

.or3-fb-crumb-rail {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

@media (max-width: 480px) {
  .or3-fb-current {
    max-width: min(100%, 13.5rem);
  }
}

.or3-fb-crumb-item {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.5rem 0.65rem;
  border-radius: 0.7rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.82rem;
  color: var(--or3-text);
  text-align: left;
  width: 100%;
  background: transparent;
  transition: background 130ms ease;
  min-width: 0;
}
.or3-fb-crumb-item:hover {
  background: color-mix(in srgb, var(--or3-green-soft) 65%, transparent);
}
.or3-fb-crumb-item.is-current {
  background: color-mix(in srgb, var(--or3-green-soft) 75%, transparent);
  color: var(--or3-green-dark, var(--or3-text));
  font-weight: 600;
}
.or3-fb-crumb-item .truncate { min-width: 0; flex: 1 1 auto; }

.or3-fb-crumb-tag {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  background: var(--or3-surface-soft);
  color: var(--or3-text-muted);
  border: 1px solid var(--or3-border);
  white-space: nowrap;
}
.or3-fb-crumb-tag.is-current {
  background: var(--or3-green);
  color: white;
  border-color: var(--or3-green);
}
</style>
