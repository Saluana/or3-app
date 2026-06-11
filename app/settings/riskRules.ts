/**
 * Risk rules: which simple changes should escalate the save-review screen
 * with red/amber language.
 *
 * Keep this conservative — these are user-facing warnings.
 */

import type { SimpleSettingChange } from './simpleSettings'

export interface RiskFinding {
    level: 'high' | 'medium' | 'low'
    message: string
}

export function evaluateRisk(change: SimpleSettingChange): RiskFinding | null {
    const path = `${change.section}.${change.field}`

    if (path === 'tools.restrictToWorkspace' && change.value === false) {
        return {
            level: 'high',
            message: 'You are disabling workspace limits.',
        }
    }
    if (path === 'security.audit.enabled' && change.value === false) {
        return {
            level: 'high',
            message: 'You are turning off the safety log.',
        }
    }
    if (path === 'security.secretStore.enabled' && change.value === false) {
        return {
            level: 'high',
            message: 'You are turning off encrypted secret storage.',
        }
    }
    if (path.startsWith('channels.') && path.endsWith('.enabled') && change.value === true) {
        return {
            level: 'low',
            message: 'You are allowing external messages.',
        }
    }
    return null
}
