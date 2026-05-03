<template>
    <img
        :src="src"
        :width="size"
        :height="size"
        class="or3-mascot"
        :class="{ 'or3-mascot--sparkle': sparkle }"
        alt=""
        aria-hidden="true"
    />
</template>

<script setup lang="ts">
withDefaults(
    defineProps<{
        size?: number | string;
        stroke?: string;
        accent?: string;
        sparkle?: boolean;
        src?: string;
    }>(),
    {
        size: 72,
        stroke: 'var(--or3-text)',
        accent: 'var(--or3-green)',
        sparkle: false,
        src: '/computer-icons/robot-2.png',
    },
);
</script>

<style scoped>
.or3-mascot {
  display: block;
  object-fit: contain;
  image-rendering: pixelated;
}

.or3-mascot--sparkle {
  filter: drop-shadow(0 0 10px color-mix(in srgb, var(--or3-green) 24%, transparent));
}
</style>
