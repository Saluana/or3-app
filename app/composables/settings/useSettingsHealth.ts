/**
 * Settings health check (Phase 12).
 *
 * Runs lightweight, read-only checks against the existing intern API surface
 * (sections, capabilities, readiness) and reports a single list of findings
 * the user can act on. No backend changes required.
 */

import { computed, ref } from 'vue';
import type {
    CapabilitiesResponse,
    DoctorFindingCard,
    DoctorStatusResponse,
    ReadinessResponse,
} from '~/types/or3-api';
import { useOr3Api } from '~/composables/useOr3Api';
import { useActiveHost } from '~/composables/useActiveHost';
import {
    coerceReadinessPayload,
    formatReadinessDetail,
} from '~/utils/or3/readiness';
import { createLogger } from '~/utils/logger';
import { useSimpleSettings } from './useSimpleSettings';

const logger = createLogger('settings_health');

export type HealthStatus = 'ok' | 'warning' | 'error' | 'unknown';

export interface HealthFinding {
    id: string;
    label: string;
    status: HealthStatus;
    detail: string;
    fixHref?: string;
    fixLabel?: string;
    doctorCard?: DoctorFindingCard;
}

function healthStatusFromRisk(risk?: string): HealthStatus {
    switch (risk) {
        case 'danger':
        case 'warning':
            return 'error';
        case 'notice':
            return 'warning';
        case 'safe':
            return 'ok';
        default:
            return 'unknown';
    }
}

function mapDoctorCard(card: DoctorFindingCard): HealthFinding {
    return {
        id: card.id,
        label: card.what_i_found || card.id,
        status: healthStatusFromRisk(card.risk_level),
        detail:
            card.what_this_means ||
            card.recommended_fix ||
            'Doctor reported this finding.',
        fixHref: '/settings/health',
        fixLabel: card.recommended_fix ? 'Review fix' : 'Details',
        doctorCard: card,
    };
}

export function useSettingsHealth() {
    const api = useOr3Api();
    const { activeHost, isPaired } = useActiveHost();
    const simple = useSimpleSettings();

    const findings = ref<HealthFinding[]>([]);
    const doctorStatus = ref<DoctorStatusResponse | null>(null);
    const doctorUnavailable = ref(false);
    const loading = ref(false);
    const lastRun = ref<string | null>(null);

    async function safeRequest<T>(path: string): Promise<T | null> {
        try {
            return await api.request<T>(path);
        } catch (error) {
            if (path === '/internal/v1/readiness') {
                const coerced = coerceReadinessPayload(error) as T | null;
                if (coerced) {
                    logger.warn(
                        'request:coerced',
                        'Readiness payload recovered from error response',
                        { path },
                    );
                    return coerced;
                }
            }
            logger.warn('request:failed', 'Settings health request failed', {
                path,
                error:
                    error instanceof Error
                        ? error.message
                        : String(error ?? 'unknown_error'),
            });
            return null;
        }
    }

    function clientDiagnosticsFromFindings(items: HealthFinding[]) {
        const serviceDown = items.some(
            (finding) =>
                finding.id === 'readiness' && finding.status === 'unknown',
        );
        return {
            captured_at: new Date().toISOString(),
            source: 'or3-app',
            service_down: serviceDown,
            findings: items.map((finding) => ({
                id: finding.id,
                severity:
                    finding.status === 'error'
                        ? 'error'
                        : finding.status === 'warning'
                          ? 'warn'
                          : 'info',
                summary: finding.label,
                detail: finding.detail,
            })),
        };
    }

    async function runDoctor(clientFindings: HealthFinding[] = []) {
        const body =
            clientFindings.length > 0
                ? {
                      client_diagnostics:
                          clientDiagnosticsFromFindings(clientFindings),
                  }
                : {};
        const response = await api.request<DoctorStatusResponse>(
            '/internal/v1/doctor/run',
            {
                method: 'POST',
                body,
            },
        );
        doctorStatus.value = response;
        doctorUnavailable.value = false;
        const cards = response.finding_cards ?? [];
        findings.value = cards.length
            ? cards.map(mapDoctorCard)
            : [
                  {
                      id: 'doctor-ok',
                      label: 'Basic Doctor is available',
                      status: 'ok',
                      detail: 'The backend Doctor did not report any findings that need attention.',
                  },
              ];
        lastRun.value = new Date().toISOString();
    }

    async function runMinimalClientChecks() {
        const next: HealthFinding[] = [];
        const host = activeHost.value;
        if (!isPaired.value || !host) {
            next.push({
                id: 'connection',
                label: 'Connected to your computer',
                status: 'error',
                detail: 'No paired computer. Pair this app to start using OR3.',
                fixHref: '/settings/pair',
                fixLabel: 'Pair now',
            });
            return next;
        }
        next.push({
            id: 'connection',
            label: 'Connected to your computer',
            status: 'ok',
            detail: `Paired with ${host.name || 'your computer'}.`,
        });
        const readiness = await safeRequest<ReadinessResponse>(
            '/internal/v1/readiness',
        );
        if (readiness) {
            const status = String(readiness.status ?? '').toLowerCase();
            const hasWarnings = status.includes('warning');
            const detail = formatReadinessDetail(readiness);
            next.push({
                id: 'readiness',
                label: 'OR3 service is ready',
                status: !readiness.ready
                    ? 'error'
                    : hasWarnings
                      ? 'warning'
                      : 'ok',
                detail,
                fixHref:
                    hasWarnings || !readiness.ready
                        ? '/computer'
                        : undefined,
                fixLabel:
                    hasWarnings || !readiness.ready
                        ? 'View computer status'
                        : undefined,
            });
        } else {
            next.push({
                id: 'readiness',
                label: 'OR3 service is ready',
                status: 'unknown',
                detail: 'Could not reach the readiness endpoint.',
            });
        }
        return next;
    }

    async function runClientChecks() {
        try {
            logger.info('run:start', 'Settings health check started', {
                hasActiveHost: isPaired.value,
            });
            const next: HealthFinding[] = [];

            // 1. App is connected to intern.
            const host = activeHost.value;
            if (!isPaired.value || !host) {
                next.push({
                    id: 'connection',
                    label: 'Connected to your computer',
                    status: 'error',
                    detail: 'No paired computer. Pair this app to start using OR3.',
                    fixHref: '/settings/pair',
                    fixLabel: 'Pair now',
                });
            } else {
                next.push({
                    id: 'connection',
                    label: 'Connected to your computer',
                    status: 'ok',
                    detail: `Paired with ${host.name || 'your computer'}.`,
                });
            }

            const readinessPromise = safeRequest<ReadinessResponse>(
                '/internal/v1/readiness',
            );
            const capsPromise = safeRequest<CapabilitiesResponse>(
                '/internal/v1/capabilities',
            );
            const settingsPromise = simple.ensureLoaded();

            // 2. Readiness summary from intern.
            const readiness = await readinessPromise;
            if (readiness) {
                const status = String(readiness.status ?? '').toLowerCase();
                const hasWarnings = status.includes('warning');
                const detail = formatReadinessDetail(readiness);
                next.push({
                    id: 'readiness',
                    label: 'OR3 service is ready',
                    status: !readiness.ready
                        ? 'error'
                        : hasWarnings
                          ? 'warning'
                          : 'ok',
                    detail,
                    fixHref:
                        hasWarnings || !readiness.ready
                            ? '/computer'
                            : undefined,
                    fixLabel:
                        hasWarnings || !readiness.ready
                            ? 'View computer status'
                            : undefined,
                });
            } else {
                next.push({
                    id: 'readiness',
                    label: 'OR3 service is ready',
                    status: 'unknown',
                    detail: 'Could not reach the readiness endpoint.',
                });
            }

            // 3. Capabilities snapshot.
            const caps = await capsPromise;

            // Make sure the schema's fields exist (loads provider/workspace/etc).
            await settingsPromise;
            const v = simple.valueIndex.value;

            // 4. OR3 platform provider keys and retained model roles.
            const openaiKey = v['provider.openaiApiKey'];
            const openrouterKey = v['provider.openrouterApiKey'];
            const legacyApiKey = v['provider.apiKey'];
            const summarizationProvider = String(
                v['routing.summarizationProvider'] ?? v['provider.kind'] ?? '',
            );
            const embeddingsProvider = String(
                v['routing.embeddingsProvider'] ?? '',
            );
            const summarizationModel = v['routing.summarizationModel'];
            const providerHasKey = (provider: string) => {
                if (provider === 'openai')
                    return Boolean(openaiKey || legacyApiKey);
                if (provider === 'openrouter') return Boolean(openrouterKey);
                return Boolean(legacyApiKey);
            };
            if (!openaiKey && !openrouterKey && !legacyApiKey) {
                next.push({
                    id: 'ai-key',
                    label: 'AI provider key set',
                    status: 'error',
                    detail: 'No provider key. The AI cannot reply.',
                    fixHref:
                        '/settings/section/providers?focus=provider-manager',
                    fixLabel: 'Add key',
                });
            } else {
                next.push({
                    id: 'ai-key',
                    label: 'AI provider key set',
                    status: 'ok',
                    detail: 'At least one provider key is present.',
                });
            }
            if (summarizationProvider && !providerHasKey(summarizationProvider)) {
                next.push({
                    id: 'summarization-provider-key',
                    label: 'Summarization provider key set',
                    status: 'warning',
                    detail: `${summarizationProvider} is selected for summarization but has no key.`,
                    fixHref: '/settings/section/providers',
                    fixLabel: 'Review providers',
                });
            }
            if (embeddingsProvider && !providerHasKey(embeddingsProvider)) {
                next.push({
                    id: 'embeddings-provider-key',
                    label: 'Embeddings provider key set',
                    status: 'warning',
                    detail: `${embeddingsProvider} is selected for embeddings but has no key.`,
                    fixHref: '/settings/section/providers',
                    fixLabel: 'Review providers',
                });
            }
            if (!summarizationModel) {
                next.push({
                    id: 'summarization-model',
                    label: 'Summarization model selected',
                    status: 'warning',
                    detail: 'No summarization model picked.',
                    fixHref: '/settings/section/ai?focus=summarization-model',
                    fixLabel: 'Pick a model',
                });
            }

            // 5. Workspace.
            const ws = v['workspace.workspaceDir'];
            if (!ws) {
                next.push({
                    id: 'workspace',
                    label: 'Workspace folder set',
                    status: 'warning',
                    detail: 'OR3 has no workspace folder.',
                    fixHref: '/settings/section/workspace?focus=workspace-dir',
                    fixLabel: 'Choose folder',
                });
            } else {
                next.push({
                    id: 'workspace',
                    label: 'Workspace folder set',
                    status: 'ok',
                    detail: `Workspace: ${String(ws)}`,
                });
            }

            findings.value = next;
            lastRun.value = new Date().toISOString();
            logger.info('run:complete', 'Settings health check completed', {
                findingCount: next.length,
                errorCount: next.filter((finding) => finding.status === 'error')
                    .length,
                warningCount: next.filter(
                    (finding) => finding.status === 'warning',
                ).length,
            });
            return next;
        } catch (error) {
            logger.error('run:error', 'Settings health check failed', {
                error:
                    error instanceof Error
                        ? error.message
                        : String(error ?? 'unknown_error'),
            });
            throw error;
        }
    }

    async function run() {
        loading.value = true;
        try {
            if (isPaired.value && activeHost.value) {
                try {
                    await runDoctor();
                    return;
                } catch (error) {
                    logger.warn(
                        'doctor:primary_failed',
                        'Basic Doctor primary check failed; trying local checks',
                        {
                            error:
                                error instanceof Error
                                    ? error.message
                                    : String(error ?? 'unknown_error'),
                        },
                    );
                }
            }

            let clientFindings: HealthFinding[] = [];
            try {
                clientFindings = await runMinimalClientChecks();
            } catch {
                clientFindings = findings.value;
            }
            try {
                await runDoctor(clientFindings);
            } catch (error) {
                doctorUnavailable.value = true;
                doctorStatus.value = null;
                logger.warn(
                    'doctor:fallback',
                    'Basic Doctor unavailable; using minimal client health checks',
                    {
                        error:
                            error instanceof Error
                                ? error.message
                                : String(error ?? 'unknown_error'),
                    },
                );
                if (!clientFindings.length) {
                    try {
                        clientFindings = await runMinimalClientChecks();
                    } catch {
                        clientFindings = await runClientChecks();
                    }
                }
                findings.value = [
                    {
                        id: 'doctor-unavailable',
                        label: 'Basic Doctor is unavailable',
                        status: 'warning',
                        detail: 'The app could not reach the backend Doctor, so these are local client-side checks.',
                        fixHref: '/computer',
                        fixLabel: 'View computer status',
                    },
                    ...clientFindings,
                ];
                lastRun.value = new Date().toISOString();
            }
        } finally {
            loading.value = false;
        }
    }

    const overall = computed<HealthStatus>(() => {
        if (!findings.value.length) return 'unknown';
        if (findings.value.some((f) => f.status === 'error')) return 'error';
        if (findings.value.some((f) => f.status === 'warning'))
            return 'warning';
        if (findings.value.every((f) => f.status === 'ok')) return 'ok';
        return 'unknown';
    });

    return {
        findings,
        doctorStatus,
        doctorUnavailable,
        loading,
        lastRun,
        run,
        overall,
    };
}
