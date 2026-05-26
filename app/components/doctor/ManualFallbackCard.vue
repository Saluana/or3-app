<template>
    <div class="rounded-xl border border-(--or3-border) bg-white/70 px-3 py-3 text-sm">
        <div class="flex items-start gap-2">
            <Icon name="i-pixelarticons-message-text" class="mt-0.5 size-4 shrink-0 text-(--or3-text-muted)" />
            <div class="min-w-0">
                <p class="font-mono font-semibold text-(--or3-text)">Manual fallback</p>
                <p class="mt-0.5 text-xs leading-5 text-(--or3-text-muted)">
                    {{ message || 'Automatic repair is not available for this finding. Use the recommended fix text or open advanced settings.' }}
                </p>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
defineProps<{ message?: string }>();
</script>
