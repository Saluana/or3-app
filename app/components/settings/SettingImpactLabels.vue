<template>
    <div v-if="impacts && impacts.length" class="flex flex-wrap items-center gap-1">
        <span
            v-for="impact in impacts"
            :key="impact"
            class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide"
            :class="toneFor(impact)"
        >
            <Icon :name="iconFor(impact)" class="size-3" />
            {{ labelFor(impact) }}
        </span>
    </div>
</template>

<script setup lang="ts">
import type { SimpleSettingImpact } from '~/settings/simpleSettings'

defineProps<{ impacts?: SimpleSettingImpact[] }>()

function labelFor(impact: SimpleSettingImpact): string {
    switch (impact) {
        case 'higher-cost':
            return 'Higher cost'
        case 'slower':
            return 'May be slower'
        case 'safer':
            return 'Safer'
        case 'higher-risk':
            return 'Higher risk'
        case 'requires-restart':
            return 'Requires restart'
        case 'requires-reindex':
            return 'Requires reindex'
        case 'uses-storage':
            return 'Uses storage'
    }
}

function iconFor(impact: SimpleSettingImpact): string {
    switch (impact) {
        case 'higher-cost':
            return 'i-pixelarticons-coin'
        case 'slower':
            return 'i-pixelarticons-clock'
        case 'safer':
            return 'i-pixelarticons-shield'
        case 'higher-risk':
            return 'i-pixelarticons-warning-box'
        case 'requires-restart':
            return 'i-pixelarticons-reload'
        case 'requires-reindex':
            return 'i-pixelarticons-loader'
        case 'uses-storage':
            return 'i-pixelarticons-database'
    }
}

function toneFor(impact: SimpleSettingImpact): string {
    switch (impact) {
        case 'safer':
            return 'border-green-200 bg-green-50 text-green-800'
        case 'higher-risk':
            return 'border-rose-200 bg-rose-50 text-rose-800'
        case 'higher-cost':
        case 'slower':
        case 'uses-storage':
        case 'requires-restart':
        case 'requires-reindex':
            return 'border-amber-200 bg-amber-50 text-amber-800'
    }
}
</script>
