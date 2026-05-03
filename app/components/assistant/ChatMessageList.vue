<template>
  <div class="min-h-90 flex-1 overflow-hidden rounded-3xl border border-(--or3-border) bg-[#FFFCF5]/60">
    <Or3Scroll
      v-if="messages.length"
      :items="messages"
      item-key="id"
      :estimate-height="112"
      :overscan="400"
      :maintain-bottom="autoScrollLocked"
      :bottom-threshold="24"
      :autoscroll-threshold="2"
      :tail-count="4"
      :padding-bottom="24"
      class="h-[54vh] max-h-170 min-h-90"
      @scroll="onScroll"
      @reach-bottom="autoScrollLocked = true"
    >
      <template #default="{ item }">
        <div class="px-3 py-2">
          <ChatMessage :message="item" />
        </div>
      </template>
    </Or3Scroll>
    <div v-else class="grid min-h-90 place-items-center px-6 text-center">
      <div>
        <div class="mx-auto mb-4 grid size-16 place-items-center rounded-3xl bg-(--or3-green-soft) text-(--or3-green)">
          <Icon name="i-pixelarticons-terminal" class="size-8" />
        </div>
        <h2 class="font-mono text-xl font-semibold text-(--or3-text)">Ask or3-intern anything</h2>
        <p class="mt-2 text-sm leading-6 text-(--or3-text-muted)">Chat, run agents, inspect files, and control your trusted computer.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Or3Scroll } from 'or3-scroll'
import type { ChatMessage } from '~/types/app-state'

defineProps<{ messages: ChatMessage[] }>()

const RELEASE_DISTANCE_PX = 2
const autoScrollLocked = ref(true)

function onScroll(event: {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
  isAtBottom: boolean
}) {
  const distanceFromBottom = event.scrollHeight - event.scrollTop - event.clientHeight
  if (distanceFromBottom > RELEASE_DISTANCE_PX) {
    autoScrollLocked.value = false
    return
  }
  if (event.isAtBottom) {
    autoScrollLocked.value = true
  }
}
</script>
