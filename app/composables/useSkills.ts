import { ref } from 'vue'
import type { SkillItem, SkillSettingsRequest, SkillsResponse } from '~/types/or3-api'
import { useOr3Api } from './useOr3Api'

const skills = ref<SkillItem[]>([])
const globalSkillsDir = ref('')
const globalSkillsEnabled = ref(false)
const skillsLoading = ref(false)
const skillsSaving = ref<Record<string, boolean>>({})
const skillsError = ref<string | null>(null)

export function useSkills() {
    const api = useOr3Api()

    async function loadSkills() {
        skillsLoading.value = true
        skillsError.value = null
        try {
            const response = await api.request<SkillsResponse>('/internal/v1/skills')
            skills.value = response.items ?? []
            globalSkillsDir.value = response.global_dir ?? ''
            globalSkillsEnabled.value = Boolean(response.global_skills_enabled)
            return response
        } catch (error: any) {
            skillsError.value = error?.message ?? 'Unable to load skills.'
            throw error
        } finally {
            skillsLoading.value = false
        }
    }

    async function updateSkill(skill: SkillItem | string, settings: SkillSettingsRequest) {
        const name = typeof skill === 'string' ? skill : skill.name
        skillsSaving.value = { ...skillsSaving.value, [name]: true }
        skillsError.value = null
        try {
            const response = await api.request<{ ok: boolean; skill?: SkillItem }>(
                `/internal/v1/skills/${encodeURIComponent(name)}/settings`,
                {
                    method: 'POST',
                    body: settings,
                },
            )
            if (response.skill) {
                const index = skills.value.findIndex((item) => item.name === response.skill?.name)
                if (index >= 0) skills.value.splice(index, 1, response.skill)
                else skills.value.push(response.skill)
            }
            return response
        } catch (error: any) {
            skillsError.value = error?.message ?? 'Unable to save skill settings.'
            throw error
        } finally {
            skillsSaving.value = { ...skillsSaving.value, [name]: false }
        }
    }

    function resetSkills() {
        skills.value = []
        globalSkillsDir.value = ''
        globalSkillsEnabled.value = false
        skillsSaving.value = {}
        skillsError.value = null
    }

    return {
        skills,
        globalSkillsDir,
        globalSkillsEnabled,
        skillsLoading,
        skillsSaving,
        skillsError,
        loadSkills,
        updateSkill,
        resetSkills,
    }
}
