<template>
    <UApp :toaster="toaster">
        <NuxtRouteAnnouncer />
        <NuxtPage />
    </UApp>
</template>

<script setup lang="ts">
import { useKeyboardOpen } from './composables/useKeyboardOpen';

const toaster = {
  position: 'top-right',
  duration: 2600,
  max: 3,
  expand: true,
} as const;

useKeyboardOpen();
</script>
