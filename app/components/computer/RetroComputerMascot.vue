<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 64 64"
    role="img"
    aria-hidden="true"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    class="or3-mascot"
    :class="{ 'or3-mascot--happy': sparkle }"
  >
    <!-- Monitor body -->
    <rect
      x="6.5"
      y="9.5"
      width="44"
      height="34"
      rx="4"
      :stroke="stroke"
      stroke-width="2"
    />
    <!-- Screen -->
    <rect
      x="11"
      y="14"
      width="35"
      height="25"
      rx="2"
      :stroke="stroke"
      stroke-width="1.5"
    />
    <!-- Eyes -->
    <circle :cx="22" :cy="25" r="1.6" :fill="stroke" />
    <circle :cx="32" :cy="25" r="1.6" :fill="stroke" />
    <!-- Smile -->
    <path
      d="M22 30 Q 27 34 32 30"
      :stroke="stroke"
      stroke-width="1.5"
      stroke-linecap="round"
      fill="none"
    />
    <!-- Vent line -->
    <line
      x1="11"
      y1="41"
      x2="46"
      y2="41"
      :stroke="stroke"
      stroke-width="1"
      stroke-dasharray="2 2"
      opacity="0.6"
    />
    <!-- Stand -->
    <path
      d="M22 44 L20 52 L37 52 L35 44"
      :stroke="stroke"
      stroke-width="2"
      stroke-linejoin="round"
      fill="none"
    />
    <!-- Base -->
    <rect x="16" y="52" width="25" height="3" rx="1.5" :stroke="stroke" stroke-width="2" />
    <!-- Power dot -->
    <circle cx="48" cy="40.5" r="1.2" :fill="accent" />

    <!-- Optional sparkles -->
    <g v-if="sparkle" :stroke="accent" stroke-width="1.4" stroke-linecap="round">
      <path d="M55 14 L55 19" />
      <path d="M52.5 16.5 L57.5 16.5" />
      <path d="M58 24 L58 27" />
      <path d="M56.5 25.5 L59.5 25.5" />
    </g>
  </svg>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: number | string
    stroke?: string
    accent?: string
    sparkle?: boolean
  }>(),
  {
    size: 72,
    stroke: 'var(--or3-text)',
    accent: 'var(--or3-green)',
    sparkle: false,
  },
)
</script>

<style scoped>
.or3-mascot {
  display: block;
  color: var(--or3-text);
}
</style>
