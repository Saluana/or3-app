<template>
    <AppShell>
        <AppHeader subtitle="SKILLS" />

        <div class="space-y-4">
            <SurfaceCard class-name="space-y-3">
                <button
                    type="button"
                    class="inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-medium text-(--or3-green) transition hover:bg-(--or3-green-soft)"
                    @click="$router.push('/settings')"
                >
                    <Icon name="i-pixelarticons-chevron-left" class="size-4" />
                    Settings
                </button>
                <div class="flex items-start gap-3">
                    <RetroIcon name="i-pixelarticons-sparkle" size="sm" />
                    <div class="min-w-0 flex-1">
                        <p class="font-mono text-base font-semibold text-(--or3-text)">Agent skills</p>
                        <p class="mt-1 text-sm leading-6 text-(--or3-text-muted)">
                            Skills from your OR3 workspace, managed installs, and the shared
                            <code class="rounded bg-white/70 px-1">{{ globalSkillsDir || '~/.agents/skills' }}</code>
                            folder.
                        </p>
                    </div>
                </div>
                <StatusPill
                    :label="globalSkillsEnabled ? 'Global skills folder enabled' : 'Global skills folder disabled'"
                    :tone="globalSkillsEnabled ? 'green' : 'amber'"
                />
            </SurfaceCard>

            <p v-if="skillsLoading && !skills.length" class="text-center font-mono text-xs text-(--or3-text-muted)">Loading skills...</p>

            <SurfaceCard v-if="skillsError" tone="danger" class-name="space-y-2">
                <p class="font-mono text-sm font-semibold text-red-900">Could not load skills</p>
                <p class="text-xs leading-5 text-red-800">{{ skillsError }}</p>
            </SurfaceCard>

            <EmptyState
                v-if="!skillsLoading && !skills.length && !skillsError"
                icon="i-pixelarticons-sparkle"
                title="No skills found"
                description="Install skills into ~/.agents/skills or your OR3 skills folders, then refresh this page."
            />

            <SurfaceCard
                v-for="skill in skills"
                :key="skill.key || skill.name"
                class-name="space-y-3"
            >
                <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0 flex-1">
                        <div class="flex flex-wrap items-center gap-2">
                            <p class="font-mono text-sm font-semibold text-(--or3-text)">{{ skill.name }}</p>
                            <StatusPill :label="skill.status" :tone="statusTone(skill)" />
                            <StatusPill :label="skill.permission_state || 'approved'" :tone="permissionTone(skill)" />
                        </div>
                        <p class="mt-1 text-xs leading-5 text-(--or3-text-muted)">
                            {{ skill.description || skill.summary || 'No description provided.' }}
                        </p>
                        <p class="mt-1 break-all font-mono text-[11px] text-(--or3-text-muted)">
                            {{ skill.source }} · {{ skill.location }}
                        </p>
                    </div>
                    <USwitch
                        :model-value="!skill.disabled"
                        :loading="Boolean(skillsSaving[skill.name])"
                        class="mt-1 shrink-0"
                        @update:model-value="(value) => toggleSkill(skill, value)"
                    />
                </div>

                <div v-if="reasonsFor(skill).length" class="rounded-xl border border-amber-200 bg-amber-50/70 p-3">
                    <p class="font-mono text-[11px] uppercase tracking-wide text-amber-900">Needs attention</p>
                    <ul class="mt-1 space-y-1 text-xs leading-5 text-amber-900">
                        <li v-for="reason in reasonsFor(skill)" :key="reason">{{ reason }}</li>
                    </ul>
                </div>

                <div v-if="isConfigurable(skill)" class="space-y-3 rounded-xl border border-(--or3-border) bg-white/70 p-3">
                    <p class="font-mono text-[11px] uppercase tracking-wide text-(--or3-green-dark)">Configuration</p>

                    <div v-if="skill.primary_env" class="space-y-1">
                        <label class="font-mono text-xs text-(--or3-text)">{{ skill.primary_env }}</label>
                        <UInput
                            type="password"
                            :model-value="apiKeyInputs[skill.name] ?? ''"
                            :placeholder="skill.api_key_configured ? 'Configured. Enter a new value to replace.' : 'Paste key or token'"
                            @update:model-value="(value) => { apiKeyInputs[skill.name] = String(value) }"
                        />
                    </div>

                    <div
                        v-for="envName in envFields(skill)"
                        :key="`${skill.name}-${envName}`"
                        class="space-y-1"
                    >
                        <label class="font-mono text-xs text-(--or3-text)">{{ envName }}</label>
                        <UInput
                            type="password"
                            :model-value="envInputs[skill.name]?.[envName] ?? ''"
                            placeholder="Optional environment override"
                            @update:model-value="(value) => setEnvInput(skill.name, envName, String(value))"
                        />
                    </div>

                    <div
                        v-for="field in skill.config_fields ?? []"
                        :key="`${skill.name}-${field}`"
                        class="space-y-1"
                    >
                        <label class="font-mono text-xs text-(--or3-text)">{{ field }}</label>
                        <UInput
                            :model-value="configInputs[skill.name]?.[field] ?? ''"
                            placeholder="Value"
                            @update:model-value="(value) => setConfigInput(skill.name, field, String(value))"
                        />
                    </div>

                    <div class="flex justify-end">
                        <UButton
                            size="sm"
                            color="primary"
                            label="Save skill config"
                            icon="i-pixelarticons-save"
                            :loading="Boolean(skillsSaving[skill.name])"
                            @click="saveSkillConfig(skill)"
                        />
                    </div>
                </div>
            </SurfaceCard>
        </div>
    </AppShell>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { Ref } from 'vue'
import { useSkills } from '~/composables/useSkills'
import type { SkillItem } from '~/types/or3-api'

const {
    skills,
    globalSkillsDir,
    globalSkillsEnabled,
    skillsLoading,
    skillsSaving,
    skillsError,
    loadSkills,
    updateSkill,
} = useSkills()

const apiKeyInputs = ref<Record<string, string>>({})
const envInputs = ref<Record<string, Record<string, string>>>({})
const configInputs = ref<Record<string, Record<string, string>>>({})

type StatusTone = 'green' | 'amber' | 'danger' | 'neutral'

function statusTone(skill: SkillItem): StatusTone {
    if (skill.status === 'eligible') return 'green'
    if (skill.status === 'disabled') return 'neutral'
    if (skill.status === 'hidden') return 'neutral'
    return 'amber'
}

function permissionTone(skill: SkillItem): StatusTone {
    if (skill.permission_state === 'blocked') return 'danger'
    if (skill.permission_state === 'quarantined') return 'amber'
    return 'green'
}

function reasonsFor(skill: SkillItem) {
    return [
        ...(skill.permission_notes ?? []),
        ...(skill.missing ?? []),
        ...(skill.unsupported ?? []),
        ...(skill.parse_error ? [skill.parse_error] : []),
    ].filter(Boolean)
}

function envFields(skill: SkillItem) {
    return (skill.required_env ?? []).filter((name) => name && name !== skill.primary_env)
}

function isConfigurable(skill: SkillItem) {
    return Boolean(skill.primary_env || envFields(skill).length || skill.config_fields?.length)
}

function setNestedInput(target: Ref<Record<string, Record<string, string>>>, skillName: string, key: string, value: string) {
    target.value = {
        ...target.value,
        [skillName]: {
            ...(target.value[skillName] ?? {}),
            [key]: value,
        },
    }
}

function setEnvInput(skillName: string, key: string, value: string) {
    setNestedInput(envInputs, skillName, key, value)
}

function setConfigInput(skillName: string, key: string, value: string) {
    setNestedInput(configInputs, skillName, key, value)
}

function parseConfigValue(value: string) {
    const trimmed = value.trim()
    if (trimmed === 'true') return true
    if (trimmed === 'false') return false
    if (trimmed !== '' && Number.isFinite(Number(trimmed))) return Number(trimmed)
    return trimmed
}

async function toggleSkill(skill: SkillItem, enabled: boolean) {
    await updateSkill(skill, { enabled })
}

async function saveSkillConfig(skill: SkillItem) {
    const env = envInputs.value[skill.name] ?? {}
    const rawConfig = configInputs.value[skill.name] ?? {}
    const config: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(rawConfig)) {
        config[key] = parseConfigValue(value)
    }
    const apiKey = apiKeyInputs.value[skill.name]
    await updateSkill(skill, {
        ...(apiKey !== undefined ? { apiKey } : {}),
        ...(Object.keys(env).length ? { env } : {}),
        ...(Object.keys(config).length ? { config } : {}),
    })
    apiKeyInputs.value = { ...apiKeyInputs.value, [skill.name]: '' }
}

onMounted(() => {
    void loadSkills()
})
</script>
