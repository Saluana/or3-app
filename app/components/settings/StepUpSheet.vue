<template>
  <UModal :open="open" :ui="{ content: 'sm:max-w-md' }" @update:open="emit('update:open', $event)">
    <template #content>
      <div class="space-y-4 p-5">
        <div class="flex items-start gap-3">
          <div class="grid size-11 shrink-0 place-items-center rounded-2xl bg-(--or3-green-soft) text-(--or3-green)">
            <Icon name="i-pixelarticons-shield" class="size-5" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="font-mono text-base font-semibold text-(--or3-text)">{{ title || 'Verify with your passkey' }}</p>
            <p class="mt-1 text-sm leading-6 text-(--or3-text-muted)">{{ message || 'We need one more passkey check before changing this security setting.' }}</p>
          </div>
        </div>

        <DangerCallout tone="info" title="Why this appears">
          Pairing trusts this device. A passkey step-up confirms that the owner is really holding it before a sensitive change is applied.
        </DangerCallout>

        <div class="flex justify-end gap-2">
          <UButton label="Not now" color="neutral" variant="ghost" @click="emit('update:open', false)" />
          <UButton :label="confirmLabel || 'Verify now'" color="primary" :loading="loading" @click="emit('confirm')" />
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
defineProps<{
  open: boolean
  title?: string
  message?: string
  confirmLabel?: string
  loading?: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: []
}>()
</script>
