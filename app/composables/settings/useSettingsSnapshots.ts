/**
 * Frontend-only snapshot store (Phase 14).
 *
 * Stashes the most recent applied SimpleSettings change set in localStorage
 * so we can support an "Undo last change" affordance before any backend
 * snapshot endpoint exists.
 */

import { ref, watchEffect } from 'vue'
import type { SimpleSettingChange } from '~/settings/simpleSettings'

const STORAGE_KEY = 'or3-app:settings-snapshots:v1'
const MAX_SNAPSHOTS = 8

export interface SettingsSnapshot {
    id: string
    label: string
    createdAt: string
    /** The forward changes that were applied. */
    applied: SimpleSettingChange[]
    /** Inverse changes that would undo the apply. */
    inverse: SimpleSettingChange[]
}

const snapshots = ref<SettingsSnapshot[]>([])
let hydrated = false

function hydrate() {
    if (hydrated || typeof window === 'undefined') return
    hydrated = true
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (raw) snapshots.value = JSON.parse(raw) as SettingsSnapshot[]
    } catch {
        snapshots.value = []
    }
}

if (typeof window !== 'undefined') {
    watchEffect(() => {
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshots.value))
        } catch {
            /* ignore quota errors */
        }
    })
}

export function useSettingsSnapshots() {
    hydrate()

    function record(label: string, applied: SimpleSettingChange[], inverse: SimpleSettingChange[]) {
        const snapshot: SettingsSnapshot = {
            id: `snap_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
            label,
            createdAt: new Date().toISOString(),
            applied,
            inverse,
        }
        snapshots.value = [snapshot, ...snapshots.value].slice(0, MAX_SNAPSHOTS)
        return snapshot
    }

    function latest(): SettingsSnapshot | null {
        return snapshots.value[0] ?? null
    }

    function remove(id: string) {
        snapshots.value = snapshots.value.filter((s) => s.id !== id)
    }

    function clear() {
        snapshots.value = []
    }

    return { snapshots, record, latest, remove, clear }
}
