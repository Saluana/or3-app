/**
 * Compose a plain-language diff for the SaveReview screen (Phase 8).
 */

import type { SimpleSettingChange } from '~/settings/simpleSettings'
import { labelForFieldRef } from '~/settings/labels'
import { evaluateRisk, type RiskFinding } from '~/settings/riskRules'
import { useConfigure } from '~/composables/useConfigure'

export interface DiffLine {
    text: string
    severity: 'info' | 'low' | 'medium' | 'high'
}

export function useSettingsDiff() {
    const configure = useConfigure()

    function metadataRisk(change: SimpleSettingChange): DiffLine | null {
        const meta = configure.metadataFor(change.section, change.field)
        if (!meta) return null
        const label = meta.label || labelForFieldRef(change.section, change.field)
        if (meta.risk_level === 'danger') {
            return {
                text: `${label} is a danger-level setting. ${meta.description || 'Review the exact diff before applying.'}`,
                severity: 'high',
            }
        }
        if (meta.risk_level === 'warning') {
            return {
                text: `${label} requires approval. ${meta.description || 'Review before applying.'}`,
                severity: 'medium',
            }
        }
        if (meta.risk_level === 'notice' || meta.restart_required) {
            return {
                text: `${label}${meta.restart_required ? ' requires a restart' : ' needs review'}. ${meta.description || ''}`.trim(),
                severity: 'low',
            }
        }
        return null
    }

    function describe(change: SimpleSettingChange): DiffLine {
        const backendRisk = metadataRisk(change)
        if (backendRisk) return backendRisk
        const risk: RiskFinding | null = evaluateRisk(change)
        if (risk) {
            return { text: risk.message, severity: risk.level }
        }
        const label = labelForFieldRef(change.section, change.field)
        if (typeof change.value === 'boolean') {
            return {
                text: change.value
                    ? `OR3 will turn on “${label}”.`
                    : `OR3 will turn off “${label}”.`,
                severity: 'info',
            }
        }
        if (typeof change.value === 'string' && !change.value.trim()) {
            return { text: `OR3 will clear “${label}”.`, severity: 'info' }
        }
        return {
            text: `OR3 will change “${label}” to ${formatValue(change.value)}.`,
            severity: 'info',
        }
    }

    function formatValue(value: unknown): string {
        if (Array.isArray(value)) return value.join(', ') || '(empty list)'
        if (value === null || value === undefined) return '(none)'
        return String(value)
    }

    function describeAll(changes: SimpleSettingChange[]): DiffLine[] {
        // Deduplicate by (section, field, channel) — keep last-write semantics.
        const seen = new Map<string, SimpleSettingChange>()
        for (const change of changes) {
            const key = `${change.section}::${change.channel ?? ''}::${change.field}`
            seen.set(key, change)
        }
        return Array.from(seen.values()).map(describe)
    }

    function highestSeverity(lines: DiffLine[]): DiffLine['severity'] {
        const order = ['info', 'low', 'medium', 'high'] as const
        let max: DiffLine['severity'] = 'info'
        for (const l of lines) {
            if (order.indexOf(l.severity) > order.indexOf(max)) max = l.severity
        }
        return max
    }

    return { describe, describeAll, highestSeverity, formatValue }
}
