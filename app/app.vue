<template>
    <UApp>
        <NuxtRouteAnnouncer />
        <NuxtPage />
    </UApp>
</template>

<script setup lang="ts">
import { useKeyboardOpen } from './composables/useKeyboardOpen';

useKeyboardOpen();
</script>
