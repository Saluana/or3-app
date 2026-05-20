<template>
    <div class="or3-welcome-card">
        <div class="or3-welcome-card__icon">
            <img
                src="/computer-icons/chat-guy.webp"
                alt=""
                class="or3-welcome-card__icon-image"
            />
        </div>
        <h1 class="or3-welcome-card__title">
            Welcome! Let's get you set up.
        </h1>
        <p class="or3-welcome-card__subtitle">
            Connect OR3 to your computer to start chatting, managing files,
            and getting things done.
        </p>
        <div class="or3-welcome-card__actions">
            <UButton
                v-if="canHostLocally"
                icon="i-pixelarticons-monitor"
                color="primary"
                variant="solid"
                size="lg"
                class="or3-welcome-card__primary-action"
                @click="$emit('setupHost')"
            >
                Set up this computer
            </UButton>
            <UButton
                icon="i-pixelarticons-link"
                :color="canHostLocally ? 'neutral' : 'primary'"
                :variant="canHostLocally ? 'soft' : 'solid'"
                size="lg"
                class="or3-welcome-card__primary-action"
                @click="$emit('pairDevice')"
            >
                Connect to a computer
            </UButton>
        </div>
        <div class="or3-welcome-card__secondary">
            <UButton
                icon="i-pixelarticons-book"
                color="neutral"
                variant="ghost"
                size="sm"
                @click="$emit('learnMore')"
            >
                What can OR3 do?
            </UButton>
        </div>
    </div>
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

<style scoped>
.or3-welcome-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 2rem 1.5rem;
    max-width: 28rem;
    margin: 0 auto;
}

.or3-welcome-card__icon {
    width: 5rem;
    height: 5rem;
    margin-bottom: 1.5rem;
    border-radius: 1.25rem;
    overflow: hidden;
    border: 2px solid var(--or3-border);
    background: var(--or3-surface);
    box-shadow:
        0 2px 0 rgba(255, 255, 255, 0.65) inset,
        0 8px 24px rgba(42, 35, 25, 0.08);
}

.or3-welcome-card__icon-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    image-rendering: auto;
}

.or3-welcome-card__title {
    font-family: var(--font-display, 'Press Start 2P', monospace);
    font-size: 1.25rem;
    line-height: 1.6;
    color: var(--or3-text);
    margin-bottom: 0.75rem;
}

.or3-welcome-card__subtitle {
    font-size: 0.9375rem;
    line-height: 1.6;
    color: var(--or3-text-muted, #6b7280);
    margin-bottom: 2rem;
    max-width: 24rem;
}

.or3-welcome-card__actions {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
    max-width: 20rem;
}

.or3-welcome-card__primary-action {
    width: 100%;
    justify-content: center;
    min-height: 3rem;
    font-weight: 600;
}

.or3-welcome-card__secondary {
    margin-top: 1.5rem;
}
</style>
