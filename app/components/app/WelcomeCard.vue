<template>
    <LockScreenWelcomeSection
        :can-host-locally="canHostLocally"
        @setup-host="$emit('setup-host')"
        @pair-device="$emit('pair-device')"
        @learn-more="$emit('learn-more')"
    />
</template>

<script setup lang="ts">
defineProps<{
    canHostLocally: boolean;
}>();

defineEmits<{
    'setup-host': [];
    'pair-device': [];
    'learn-more': [];
}>();
</script>
