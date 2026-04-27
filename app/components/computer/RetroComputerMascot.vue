<template>
    <svg
        :width="size"
        :height="size"
        viewBox="0 0 80 80"
        role="img"
        aria-hidden="true"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        class="or3-mascot"
    >
        <!-- Body / case -->
        <rect
            x="9"
            y="14"
            width="52"
            height="42"
            rx="6"
            fill="#F4ECD8"
            :stroke="stroke"
            stroke-width="2"
        />
        <!-- Inner face plate -->
        <rect
            x="13"
            y="18"
            width="44"
            height="34"
            rx="4"
            fill="#FFFCF5"
            :stroke="stroke"
            stroke-width="1.5"
        />
        <!-- Green screen -->
        <rect
            x="17"
            y="22"
            width="36"
            height="22"
            rx="2"
            :fill="accent"
            :stroke="stroke"
            stroke-width="1.5"
        />
        <!-- Eyes (on the green screen) -->
        <rect x="26" y="29" width="3" height="3" :fill="stroke" />
        <rect x="41" y="29" width="3" height="3" :fill="stroke" />
        <!-- Smile -->
        <path
            d="M28 36 Q 35 41 42 36"
            :stroke="stroke"
            stroke-width="1.6"
            stroke-linecap="round"
            fill="none"
        />
        <!-- Vent / power row -->
        <line
            x1="17"
            y1="48"
            x2="44"
            y2="48"
            :stroke="stroke"
            stroke-width="1"
            stroke-dasharray="2 2"
            opacity="0.5"
        />
        <circle cx="50" cy="48" r="1.3" :fill="accent" />
        <!-- Stand -->
        <path
            d="M28 56 L25 64 L45 64 L42 56"
            fill="#F4ECD8"
            :stroke="stroke"
            stroke-width="2"
            stroke-linejoin="round"
        />
        <!-- Base -->
        <rect
            x="20"
            y="64"
            width="30"
            height="4"
            rx="2"
            fill="#F4ECD8"
            :stroke="stroke"
            stroke-width="2"
        />
        <!-- Waving arm -->
        <path
            d="M61 28 Q 70 24 72 16"
            :stroke="stroke"
            stroke-width="2.2"
            stroke-linecap="round"
            fill="none"
        />
        <circle
            cx="72.5"
            cy="14"
            r="2.6"
            fill="#F4ECD8"
            :stroke="stroke"
            stroke-width="1.6"
        />

        <!-- Sparkles -->
        <g
            v-if="sparkle"
            :stroke="accent"
            stroke-width="1.6"
            stroke-linecap="round"
        >
            <path d="M68 36 L68 41" />
            <path d="M65.5 38.5 L70.5 38.5" />
            <path d="M73 46 L73 49" />
            <path d="M71.5 47.5 L74.5 47.5" />
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
