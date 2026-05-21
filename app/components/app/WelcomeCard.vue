<template>
    <LockScreenWelcomeSection
        :can-host-locally="canHostLocally"
        @setup-host="$emit('setupHost')"
        @pair-device="$emit('pairDevice')"
        @learn-more="$emit('learnMore')"
    />
</template>

<script setup lang="ts">
defineProps<{
    canHostLocally: boolean;
}>();

defineEmits<{
    setupHost: [];
    pairDevice: [];
    learnMore: [];
}>();
</script>
