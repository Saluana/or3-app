<template>
    <section>
        <p class="or3-section-label">{{ label }}</p>
        <div class="mt-3 grid grid-cols-2 gap-3">
            <NuxtLink
                v-for="item in items"
                :key="item.to"
                :to="item.to"
                class="or3-action-card"
            >
                <span class="or3-action-card__icon">
                    <Icon :name="item.icon" class="size-5" />
                </span>
                <span class="or3-action-card__title">{{ item.label }}</span>
                <span class="or3-action-card__desc">{{ item.description }}</span>
            </NuxtLink>
        </div>
    </section>
</template>

<script setup lang="ts">
export interface ComputerActionItem {
    label: string;
    description: string;
    icon: string;
    to: string;
}

withDefaults(
    defineProps<{
        items: ComputerActionItem[];
        label?: string;
    }>(),
    {
        label: 'WHAT YOU CAN DO',
    },
);
</script>
