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

    if (path === 'hardening.enableExecShell' && change.value === true) {
        return {
            level: 'high',
            message: 'You are allowing terminal commands.',
        }
    }
    if (path === 'tools.restrictToWorkspace' && change.value === false) {
        return {
            level: 'high',
            message: 'You are disabling workspace limits.',
        }
    }
    if (path === 'hardening.enableNetwork' && change.value === true) {
        return {
            level: 'medium',
            message: 'You are allowing network access.',
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
    if (
        path === 'runtimeProfile' &&
        typeof change.value === 'string' &&
        change.value.startsWith('local-dev')
    ) {
        return {
            level: 'medium',
            message: 'You are switching to a more permissive safety mode.',
        }
    }
    if (path.startsWith('channels.') && path.endsWith('.enabled') && change.value === true) {
        return {
            level: 'low',
            message: 'You are allowing external messages.',
        }
    }
    if (path === 'approvalModes.exec' && change.value === 'auto') {
        return {
            level: 'high',
            message: 'You are removing approval prompts for terminal commands.',
        }
    }
    if (path === 'approvalModes.skill' && change.value === 'auto') {
        return {
            level: 'medium',
            message: 'You are removing approval prompts for skill execution.',
        }
    }

    return null
}
