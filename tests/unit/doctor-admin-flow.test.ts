import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SettingsChangePreviewCard from '../../app/components/doctor/SettingsChangePreviewCard.vue';
import DoctorDiagnosticResultCard from '../../app/components/doctor/DoctorDiagnosticResultCard.vue';
import RiskApprovalCard from '../../app/components/doctor/RiskApprovalCard.vue';
import UndoFixCard from '../../app/components/doctor/UndoFixCard.vue';
import {
    buildDoctorChatDisplayMessages,
    compareDoctorMessageOrder,
    DOCTOR_EMPTY_FINAL_TEXT_WARNING,
    doctorCardsForMessage,
    doctorSynthesizeFinalSummary,
    doctorToolResultText,
    doctorVisibleTextForMessage,
    finalizeDoctorMessagesAfterReload,
    mergeDoctorMessages,
    mergeDoctorSessionWithLocal,
    parseDoctorToolResult,
    sortDoctorMessages,
    useDoctorAdminChat,
} from '../../app/composables/useDoctorAdminChat';
import { useSettingsHealth } from '../../app/composables/settings/useSettingsHealth';
import { useConfigure } from '../../app/composables/useConfigure';
import { useLocalCache } from '../../app/composables/useLocalCache';
import { useSimpleSettings } from '../../app/composables/settings/useSimpleSettings';

const stubs = {
    Icon: { template: '<span />' },
    StatusPill: {
        props: ['label', 'tone'],
        template: '<span class="pill">{{ label }}</span>',
    },
    UButton: {
        template: '<button><slot />{{ label }}</button>',
        props: ['label'],
    },
    NuxtLink: { template: '<a><slot /></a>' },
};

function pairedHost() {
    useLocalCache().updateHost({
        id: 'host-1',
        name: 'Host',
        baseUrl: 'http://127.0.0.1:9100',
        token: 'paired-token',
        pairedToken: 'paired-token',
    });
}

describe('Doctor admin flow app integration', () => {
    afterEach(() => {
        useDoctorAdminChat().clearMessages();
        useSimpleSettings().reset();
        const configure = useConfigure();
        configure.metadata.value = [];
        configure.metadataLoaded.value = false;
        useLocalCache().clearAll();
        vi.unstubAllGlobals();
    });

    it('renders risk cards, exact diffs, approval setup, and undo affordance', async () => {
        const preview = mount(SettingsChangePreviewCard, {
            props: {
                plan: {
                    title: 'Fix stale skill config',
                    summary: 'Update the skill credential path.',
                    risk_level: 'warning',
                    changes: [
                        {
                            section: 'skills',
                            field: 'credential_path',
                            impact: 'Moves the skill to a valid credential path.',
                        },
                    ],
                    exact_config_diff: [
                        {
                            path: 'skills.demo.credential_path',
                            old_value: '/missing.json',
                            new_value: '/safe.json',
                        },
                    ],
                },
            },
            global: { stubs },
        });
        expect(preview.text()).toContain('Fix stale skill config');
        expect(preview.text()).toContain('Show exact config diff');
        expect(preview.text()).toContain('skills.credential_path');

        const approval = mount(RiskApprovalCard, {
            props: {
                riskLevel: 'danger',
                requiresApproval: true,
                requiresStepUp: true,
                authAvailable: false,
            },
            global: { stubs },
        });
        expect(approval.text()).toContain('Approval required');
        expect(approval.text()).toContain('Set up passkey or PIN');

        const undo = mount(UndoFixCard, {
            props: { planId: 'scp_1', rollbackId: 'scr_1' },
            global: { stubs },
        });
        expect(undo.text()).toContain('Undo available');
        expect(undo.text()).not.toContain('scr_1');

        const findingCard = mount(DoctorDiagnosticResultCard, {
            props: {
                card: {
                    id: 'provider.key',
                    what_i_found: 'Provider key is missing',
                    what_this_means: 'Admin Brain cannot call the model.',
                    recommended_fix: 'Add a provider key.',
                    risk_level: 'warning',
                },
            },
            global: { stubs },
        });
        expect(findingCard.text()).toContain('Recommended fix');
        expect(findingCard.text()).toContain('Fix it');
        await findingCard.find('.or3-doctor-finding__fix-button').trigger('click');
        expect(findingCard.emitted('fix')).toHaveLength(1);
    });

    it('loads Doctor findings before local readiness checks for paired hosts', async () => {
        pairedHost();
        const calls: string[] = [];
        const requestBodies: unknown[] = [];
        vi.stubGlobal(
            'fetch',
            vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
                const url = String(_url);
                calls.push(url);
                if (init?.body)
                    requestBodies.push(JSON.parse(init.body as string));
                if (url.endsWith('/internal/v1/readiness')) {
                    return new Response(
                        JSON.stringify({ ready: true, status: 'ready' }),
                        {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                if (url.endsWith('/internal/v1/capabilities')) {
                    return new Response(
                        JSON.stringify({ execAvailable: true }),
                        {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                if (url.includes('/internal/v1/configure/fields')) {
                    return new Response(
                        JSON.stringify({ section: 'provider', fields: [] }),
                        {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                if (url.endsWith('/internal/v1/doctor/run')) {
                    return new Response(
                        JSON.stringify({
                            basic_doctor_available: true,
                            admin_brain: {
                                available: false,
                                reason: 'Basic Doctor only',
                            },
                            finding_cards: [
                                {
                                    id: 'skill.stale_fixture',
                                    what_i_found: 'Skill fixture is stale',
                                    what_this_means:
                                        'The diagnostic fixture is out of date.',
                                    recommended_fix:
                                        'Refresh the skill fixture.',
                                    risk_level: 'warning',
                                },
                            ],
                        }),
                        {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                return new Response(JSON.stringify({}), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }),
        );

        const health = useSettingsHealth();
        await health.run();

        expect(
            calls.some((url) => url.endsWith('/internal/v1/doctor/run')),
        ).toBe(true);
        expect(
            calls.some((url) => url.endsWith('/internal/v1/readiness')),
        ).toBe(false);
        expect(health.findings.value[0]).toMatchObject({
            id: 'skill.stale_fixture',
            label: 'Skill fixture is stale',
            status: 'error',
        });
        expect(requestBodies).toEqual([{}]);
        expect(health.doctorUnavailable.value).toBe(false);
    });

    it('retries Doctor with local diagnostics when the primary Doctor check fails', async () => {
        pairedHost();
        const calls: string[] = [];
        const requestBodies: unknown[] = [];
        let doctorCalls = 0;
        vi.stubGlobal(
            'fetch',
            vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
                const url = String(_url);
                calls.push(url);
                if (init?.body)
                    requestBodies.push(JSON.parse(init.body as string));
                if (url.endsWith('/internal/v1/doctor/run')) {
                    doctorCalls += 1;
                    if (doctorCalls === 1) {
                        return new Response(
                            JSON.stringify({
                                code: 'validation_failed',
                                error: 'bad diagnostics',
                            }),
                            {
                                status: 400,
                                headers: { 'Content-Type': 'application/json' },
                            },
                        );
                    }
                    return new Response(
                        JSON.stringify({
                            basic_doctor_available: true,
                            finding_cards: [
                                {
                                    id: 'readiness',
                                    what_i_found: 'OR3 service is ready',
                                    what_this_means: 'Ready after retry.',
                                    risk_level: 'safe',
                                },
                            ],
                        }),
                        {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                if (url.endsWith('/internal/v1/readiness')) {
                    return new Response(
                        JSON.stringify({ ready: true, status: 'ready' }),
                        {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                if (url.endsWith('/internal/v1/capabilities')) {
                    return new Response(
                        JSON.stringify({ execAvailable: true }),
                        {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                if (url.includes('/internal/v1/configure/fields')) {
                    return new Response(
                        JSON.stringify({ section: 'provider', fields: [] }),
                        {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                return new Response(JSON.stringify({}), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }),
        );

        const health = useSettingsHealth();
        await health.run();

        expect(
            calls.filter((url) => url.endsWith('/internal/v1/doctor/run')),
        ).toHaveLength(2);
        expect(
            calls.some((url) => url.endsWith('/internal/v1/readiness')),
        ).toBe(true);
        expect(requestBodies).toContainEqual(
            expect.objectContaining({
                client_diagnostics: expect.objectContaining({
                    service_down: false,
                }),
            }),
        );
        expect(health.doctorUnavailable.value).toBe(false);
    });

    it('uses authenticated Doctor plan lifecycle calls with remember and post-check support', async () => {
        pairedHost();
        const bodies: unknown[] = [];
        vi.stubGlobal(
            'fetch',
            vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
                const url = String(_url);
                if (init?.body) bodies.push(JSON.parse(init.body as string));
                if (url.endsWith('/internal/v1/doctor/plans')) {
                    return new Response(
                        JSON.stringify({
                            plan: { id: 'scp_1', title: 'Plan', changes: [] },
                        }),
                        {
                            status: 201,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                if (url.endsWith('/internal/v1/doctor/plans/scp_1/apply')) {
                    return new Response(
                        JSON.stringify({
                            ok: true,
                            plan_id: 'scp_1',
                            rollback_id: 'scr_1',
                            restart_required: true,
                            post_check_pending: true,
                        }),
                        {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                if (
                    url.endsWith('/internal/v1/doctor/plans/scp_1/post-checks')
                ) {
                    return new Response(
                        JSON.stringify({
                            status: 'passed',
                            checkpoint_id: 'dcp_1',
                        }),
                        {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                return new Response(JSON.stringify({}), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }),
        );

        const doctor = useDoctorAdminChat();
        const preview = await doctor.createPlan({ title: 'Plan', changes: [] });
        expect(preview.plan.id).toBe('scp_1');

        await expect(
            doctor.applyPlan(preview.plan, { rememberForMinutes: 5 }),
        ).resolves.toMatchObject({
            ok: true,
            rollback_id: 'scr_1',
            restart_required: true,
        });
        expect(bodies).toContainEqual(
            expect.objectContaining({
                approval: expect.objectContaining({ remember_for_minutes: 5 }),
            }),
        );
        await expect(doctor.runPostChecks('scp_1')).resolves.toMatchObject({
            status: 'passed',
        });
    });

    it('normalizes Go-shaped Doctor chat messages and surfaces API errors clearly', async () => {
        pairedHost();
        vi.stubGlobal(
            'fetch',
            vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
                const url = String(_url);
                if (url.endsWith('/internal/v1/doctor/sessions')) {
                    return new Response(
                        JSON.stringify({
                            session: { SessionKey: 'doctor-app-test' },
                            admin_brain: {
                                available: true,
                                runner_id: 'opencode',
                            },
                        }),
                        {
                            status: 201,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                if (
                    /\/internal\/v1\/doctor\/sessions\/[^/]+\/messages$/.test(
                        url,
                    )
                ) {
                    return new Response(
                        JSON.stringify({
                            messages: [
                                {
                                    ID: 1,
                                    Role: 'user',
                                    Content: 'why is it broken?',
                                    CreatedAt: 1779462000,
                                },
                                {
                                    ID: 2,
                                    Role: 'assistant',
                                    Content: 'The service is not ready yet.',
                                    CreatedAt: 1779462001,
                                },
                            ],
                            admin_brain: {
                                available: true,
                                runner_id: 'opencode',
                            },
                        }),
                        {
                            status: 202,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                return new Response(JSON.stringify({}), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }),
        );

        const doctor = useDoctorAdminChat();
        await doctor.createSession();
        await doctor.sendMessage('why is it broken?');

        expect(doctor.messages.value).toMatchObject([
            { id: 1, role: 'user', content: 'why is it broken?' },
            {
                id: 2,
                role: 'assistant',
                content: 'The service is not ready yet.',
            },
        ]);

        vi.stubGlobal(
            'fetch',
            vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
                const url = String(_url);
                if (
                    /\/internal\/v1\/doctor\/sessions\/[^/]+\/messages$/.test(
                        url,
                    )
                ) {
                    return new Response(
                        JSON.stringify({
                            code: 'runner_chat_turn_active',
                            error: 'another turn is already active for this session',
                        }),
                        {
                            status: 409,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                return new Response(JSON.stringify({}), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }),
        );

        await expect(doctor.sendMessage('again')).rejects.toMatchObject({
            message: 'another turn is already active for this session',
        });
        expect(doctor.error.value).toBe(
            'another turn is already active for this session',
        );
    });

    it('rejects duplicate Doctor sends while a turn is active', async () => {
        pairedHost();
        let messageCalls = 0;
        let resolveMessage: ((response: Response) => void) | undefined;
        vi.stubGlobal(
            'fetch',
            vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
                const url = String(_url);
                if (url.endsWith('/internal/v1/doctor/sessions')) {
                    return new Response(
                        JSON.stringify({
                            session: { SessionKey: 'doctor-app-dedupe' },
                            admin_brain: {
                                available: true,
                                runner_id: 'opencode',
                            },
                        }),
                        {
                            status: 201,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                if (
                    /\/internal\/v1\/doctor\/sessions\/[^/]+\/messages$/.test(
                        url,
                    )
                ) {
                    messageCalls += 1;
                    return new Promise<Response>((resolve) => {
                        resolveMessage = resolve;
                    });
                }
                return new Response(JSON.stringify({}), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }),
        );

        const doctor = useDoctorAdminChat();
        await doctor.createSession();
        const first = doctor.sendMessage('Review my safety settings');

        await vi.waitFor(() => expect(messageCalls).toBe(1));
        const second = expect(
            doctor.sendMessage('Review my safety settings'),
        ).rejects.toThrow(
            'Wait for the current Doctor reply before sending another message.',
        );
        expect(
            doctor.messages.value.filter((message) => message.role === 'user'),
        ).toHaveLength(1);

        resolveMessage?.(
            new Response(
                JSON.stringify({
                    messages: [
                        {
                            ID: 1,
                            Role: 'user',
                            Content: 'Review my safety settings',
                            CreatedAt: 1779462000,
                        },
                        {
                            ID: 2,
                            Role: 'user',
                            Content: 'Review my safety settings',
                            CreatedAt: 1779462000,
                        },
                        {
                            ID: 3,
                            Role: 'assistant',
                            Content: 'I will review those settings.',
                            CreatedAt: 1779462001,
                        },
                    ],
                    admin_brain: { available: true, runner_id: 'opencode' },
                }),
                {
                    status: 202,
                    headers: { 'Content-Type': 'application/json' },
                },
            ),
        );

        await first;
        await second;

        expect(messageCalls).toBe(1);
        expect(doctor.error.value).toContain('Wait for the current Doctor reply');
        expect(doctor.messages.value).toMatchObject([
            { id: 1, role: 'user', content: 'Review my safety settings' },
            {
                id: 3,
                role: 'assistant',
                content: 'I will review those settings.',
            },
        ]);
    });

    it('keeps the optimistic user message before the working bubble while a Doctor turn is pending', async () => {
        pairedHost();
        let messageCalls = 0;
        let eventCalls = 0;
        let resolveMessage: ((response: Response) => void) | undefined;
        vi.stubGlobal(
            'fetch',
            vi.fn(async (_url: string | URL | Request) => {
                const url = String(_url);
                if (url.endsWith('/internal/v1/doctor/sessions')) {
                    return new Response(
                        JSON.stringify({
                            session: { SessionKey: 'doctor-app-order' },
                            admin_brain: {
                                available: true,
                                runner_id: 'opencode',
                            },
                        }),
                        {
                            status: 201,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                if (url.includes('/events')) {
                    eventCalls += 1;
                    return new Response(JSON.stringify({ events: [] }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    });
                }
                if (
                    /\/internal\/v1\/doctor\/sessions\/[^/]+\/messages$/.test(
                        url,
                    )
                ) {
                    messageCalls += 1;
                    return new Promise<Response>((resolve) => {
                        resolveMessage = resolve;
                    });
                }
                return new Response(JSON.stringify({}), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }),
        );

        const doctor = useDoctorAdminChat();
        await doctor.createSession();
        const pending = doctor.sendMessage('Review my safety settings');

        await vi.waitFor(() => expect(messageCalls).toBe(1));
        expect(doctor.messages.value).toMatchObject([
            { role: 'user', content: 'Review my safety settings' },
            { role: 'assistant', content: 'Working…' },
        ]);
        await new Promise((resolve) => setTimeout(resolve, 520));
        expect(eventCalls).toBe(0);

        resolveMessage?.(
            new Response(
                JSON.stringify({
                    messages: [
                        {
                            ID: 1,
                            Role: 'user',
                            Content: 'Review my safety settings',
                        },
                        {
                            ID: 2,
                            Role: 'assistant',
                            Content: 'Your safety settings need attention.',
                        },
                    ],
                }),
                {
                    status: 202,
                    headers: { 'Content-Type': 'application/json' },
                },
            ),
        );

        await pending;
        expect(doctor.messages.value).toMatchObject([
            { id: 1, role: 'user', content: 'Review my safety settings' },
            {
                id: 2,
                role: 'assistant',
                content: 'Your safety settings need attention.',
            },
        ]);
    });

    it('stops an active Doctor request and removes the stuck working bubble', async () => {
        pairedHost();
        let aborted = false;
        vi.stubGlobal(
            'fetch',
            vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
                const url = String(_url);
                if (url.endsWith('/internal/v1/doctor/sessions')) {
                    return new Response(
                        JSON.stringify({
                            session: { SessionKey: 'doctor-app-stop' },
                            admin_brain: {
                                available: true,
                                runner_id: 'opencode',
                            },
                        }),
                        {
                            status: 201,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                if (
                    /\/internal\/v1\/doctor\/sessions\/[^/]+\/messages$/.test(
                        url,
                    )
                ) {
                    return new Promise<Response>((_resolve, reject) => {
                        if (init?.signal?.aborted) {
                            aborted = true;
                            reject(new DOMException('Aborted', 'AbortError'));
                            return;
                        }
                        init?.signal?.addEventListener('abort', () => {
                            aborted = true;
                            reject(new DOMException('Aborted', 'AbortError'));
                        });
                    });
                }
                return new Response(JSON.stringify({}), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }),
        );

        const doctor = useDoctorAdminChat();
        await doctor.createSession();
        const pending = doctor.sendMessage('Review my safety settings');

        await vi.waitFor(() =>
            expect(
                doctor.messages.value.some(
                    (message) => message.content === 'Working…',
                ),
            ).toBe(true),
        );
        doctor.stopStreaming();

        await pending;
        expect(aborted).toBe(true);
        expect(doctor.loading.value).toBe(false);
        expect(doctor.error.value).toBeNull();
        expect(doctor.messages.value).toMatchObject([
            { role: 'user', content: 'Review my safety settings' },
        ]);
        expect(
            doctor.messages.value.some(
                (message) => message.content === 'Working…',
            ),
        ).toBe(false);
    });

    it('normalizes Doctor tool results into renderable chat cards', () => {
        const content = JSON.stringify({
            kind: 'doctor_plan',
            ok: true,
            summary: 'Created validated Doctor settings plan scp_1.',
            plan_id: 'scp_1',
            stats: {
                card_type: 'settings_change_preview',
                status: 'validated',
                post_check_pending: true,
                rollback_id: 'scr_1',
                plan: {
                    id: 'scp_1',
                    title: 'Fix provider key',
                    summary: 'Set the provider key.',
                    risk_level: 'warning',
                    requires_approval: true,
                    restart_required: true,
                    changes: [
                        {
                            section: 'provider',
                            field: 'api_key',
                            operation: 'set',
                            impact: 'Allows Admin Brain to answer.',
                        },
                    ],
                    post_apply_checks: [
                        {
                            id: 'doctor.configure_post_save',
                            description: 'Run Doctor checks.',
                        },
                    ],
                },
            },
        });

        const result = parseDoctorToolResult(content);
        expect(doctorToolResultText(result)).toContain('Created validated');
        expect(doctorCardsForMessage({ role: 'tool', content })).toEqual([
            expect.objectContaining({
                type: 'plan',
                rollbackId: 'scr_1',
                postCheckPending: true,
            }),
            expect.objectContaining({ type: 'risk' }),
            expect.objectContaining({ type: 'restart' }),
            expect.objectContaining({ type: 'post_check', planId: 'scp_1' }),
            expect.objectContaining({
                type: 'undo',
                planId: 'scp_1',
                rollbackId: 'scr_1',
            }),
        ]);
        expect(doctorVisibleTextForMessage({ role: 'tool', content })).toBe('');
    });

    it('hides internal Doctor tool telemetry from visible chat text', () => {
        const metadataResult = JSON.stringify({
            kind: 'doctor_config_metadata',
            ok: true,
            summary: 'Returned 2 Doctor-safe config metadata fields.',
            stats: { count: 2, fields: [] },
        });

        expect(
            doctorVisibleTextForMessage({
                role: 'tool',
                content: metadataResult,
            }),
        ).toBe('');
        expect(
            doctorVisibleTextForMessage({
                role: 'assistant',
                content: metadataResult,
            }),
        ).toBe('');
    });

    it('does not render internal Doctor status/docs tool output as chat cards', () => {
        const statusResult = JSON.stringify({
            kind: 'doctor_status',
            ok: true,
            summary: 'Basic Doctor found issues.',
            stats: {
                finding_cards: [
                    {
                        id: 'tools.exec.shell',
                        what_i_found: 'exec shell command mode is enabled',
                        what_this_means: 'Shell mode is risky.',
                        recommended_fix: 'Turn off shell mode.',
                        risk_level: 'warning',
                    },
                ],
            },
        });
        const docsResult = JSON.stringify({
            kind: 'doctor_docs_search',
            ok: false,
            summary: 'OR3 v1 documentation is not available on this host.',
            stats: { error: 'docs/v1 not found' },
        });

        expect(
            doctorCardsForMessage({ role: 'tool', content: statusResult }),
        ).toEqual([]);
        expect(
            doctorCardsForMessage({ role: 'tool', content: docsResult }),
        ).toEqual([]);
        expect(
            doctorVisibleTextForMessage({ role: 'tool', content: docsResult }),
        ).toBe('');
        expect(
            doctorCardsForMessage({ role: 'assistant', content: docsResult }),
        ).toEqual([]);
        expect(
            doctorVisibleTextForMessage({
                role: 'assistant',
                content: docsResult,
            }),
        ).toBe('');
    });

    it('extracts Doctor cards from assistant JSON code blocks without showing raw JSON', () => {
        const content = [
            'I found a settings fix.',
            '```json',
            JSON.stringify({
                kind: 'doctor_plan',
                ok: true,
                summary: 'Created validated Doctor settings plan scp_2.',
                stats: {
                    card_type: 'settings_change_preview',
                    status: 'validated',
                    plan: {
                        id: 'scp_2',
                        title: 'Fix runner PATH',
                        summary: 'Add the opencode binary folder to PATH.',
                        risk_level: 'notice',
                        changes: [
                            {
                                section: 'tools',
                                field: 'path_append',
                                operation: 'set',
                                impact: 'Lets Doctor discover opencode.',
                            },
                        ],
                    },
                },
            }),
            '```',
        ].join('\n');

        const message = { role: 'assistant' as const, content };

        expect(doctorCardsForMessage(message)).toEqual([
            expect.objectContaining({ type: 'plan', status: 'validated' }),
        ]);
        expect(doctorVisibleTextForMessage(message)).toBe(
            'I found a settings fix.',
        );
    });

    it('repairs assistant-before-user ordering in the transcript', () => {
        const display = buildDoctorChatDisplayMessages([
            {
                id: 2,
                role: 'assistant',
                content: 'You are using deepseek/deepseek-v4-flash.',
                created_at: 2,
            },
            {
                id: 1,
                role: 'user',
                content: 'What models are we using?',
                created_at: 3,
            },
        ]);
        expect(display.map((message) => message.role)).toEqual([
            'user',
            'assistant',
        ]);
    });

    it('keeps multi-turn user messages in order after repair', () => {
        const display = buildDoctorChatDisplayMessages([
            { id: 1, role: 'user', content: 'first' },
            { id: 2, role: 'assistant', content: 'reply one' },
            { id: 3, role: 'user', content: 'second' },
            { id: 4, role: 'assistant', content: 'reply two' },
        ]);
        expect(display.map((message) => message.role)).toEqual([
            'user',
            'assistant',
            'user',
            'assistant',
        ]);
    });

    it('hides interim preface text while a turn is streaming', () => {
        const display = buildDoctorChatDisplayMessages([
            { id: 1, role: 'user', content: 'What models?' },
            {
                id: -2,
                role: 'assistant',
                content: 'Let me also check the routing config.',
                status: 'streaming',
            },
        ]);
        expect(display).toHaveLength(2);
        expect(display[1]?.text).toBe('');
        expect(display[1]?.status).toBe('streaming');
    });

    it('strips interim preface after the turn completes', () => {
        const display = buildDoctorChatDisplayMessages([
            { id: 1, role: 'user', content: 'What models?' },
            {
                id: 2,
                role: 'assistant',
                content:
                    'Let me check.\n\nYou are using deepseek/deepseek-v4-flash.',
            },
        ]);
        expect(display[1]?.text).toBe(
            'You are using deepseek/deepseek-v4-flash.',
        );
    });

    it('keeps optimistic user boundaries when reloading mid-turn', () => {
        const server = [
            {
                id: 1,
                role: 'user' as const,
                content: 'What models are we using?',
                created_at: 1,
            },
            {
                id: 2,
                role: 'assistant' as const,
                content: 'You are using deepseek/deepseek-v4-flash for chat.',
                created_at: 2,
            },
            {
                id: 4,
                role: 'assistant' as const,
                content:
                    'Here is the full picture across OR3 with routing details.',
                created_at: 4,
                parts: [
                    {
                        id: 'tool:1',
                        type: 'tool' as const,
                        name: 'doctor_config_search',
                        status: 'complete' as const,
                        resultPreview: '{}',
                    },
                ],
            },
        ];
        const placeholder = {
            id: -2,
            role: 'assistant' as const,
            content: 'Working…',
            status: 'streaming' as const,
            created_at: 5,
        };
        const local = [
            ...server,
            {
                id: -1,
                role: 'user' as const,
                content: 'what about for sub agents and context manager?',
                created_at: 3,
            },
            placeholder,
        ];
        const merged = mergeDoctorSessionWithLocal(server, local, placeholder);
        const display = buildDoctorChatDisplayMessages(merged);
        expect(display.map((message) => message.role)).toEqual([
            'user',
            'assistant',
            'user',
            'assistant',
        ]);
        expect(display[1]?.text).toContain('deepseek/deepseek-v4-flash');
        expect(display[3]?.text).toContain('full picture across OR3');
    });

    it('extracts plan cards from streaming tool parts', () => {
        const toolResult = JSON.stringify({
            kind: 'doctor_plan',
            ok: true,
            summary: 'Created validated Doctor settings plan scp_stream.',
            plan_id: 'scp_stream',
            stats: {
                card_type: 'settings_change_preview',
                status: 'validated',
                plan: {
                    id: 'scp_stream',
                    title: 'Change default model',
                    summary: 'Switch model.',
                    changes: [{ section: 'provider', field: 'provider_model' }],
                },
            },
        });

        expect(
            doctorCardsForMessage({
                role: 'assistant',
                content: '',
                parts: [
                    {
                        id: 'tool:stream',
                        type: 'tool',
                        name: 'doctor_create_plan',
                        status: 'complete',
                        resultPreview: toolResult,
                    },
                ],
            }),
        ).toEqual([expect.objectContaining({ type: 'plan' })]);
    });

    it('does not synthesize a doctor_status finding wall', () => {
        const toolResult = JSON.stringify({
            kind: 'doctor_status',
            ok: true,
            summary:
                'Basic Doctor found 0 blocking, 0 error, and 14 warning findings.',
            stats: {
                finding_cards: [
                    {
                        id: 'tools.exec.shell',
                        what_i_found: 'exec shell command mode is enabled',
                    },
                    {
                        id: 'tools.workspace',
                        what_i_found: 'workspace restriction is disabled',
                    },
                ],
            },
        });

        expect(
            doctorSynthesizeFinalSummary({
                role: 'assistant',
                parts: [
                    {
                        id: 'tool:status',
                        type: 'tool',
                        name: 'doctor_status',
                        status: 'complete',
                        resultPreview: toolResult,
                    },
                ],
            }),
        ).toBe(
            'Basic Doctor found 0 blocking, 0 error, and 14 warning findings.',
        );
    });

    it('synthesizes connected apps from doctor_status when the user asked about apps', () => {
        const toolResult = JSON.stringify({
            kind: 'doctor_status',
            ok: true,
            summary:
                'Basic Doctor found 0 blocking, 0 error, and 0 warning findings.',
            stats: {
                connected_apps: [
                    {
                        id: 'telegram',
                        name: 'Telegram',
                        enabled: true,
                        detail: 'on and configured',
                    },
                    {
                        id: 'slack',
                        name: 'Slack',
                        enabled: false,
                        detail: 'off',
                    },
                ],
            },
        });

        expect(
            doctorSynthesizeFinalSummary(
                {
                    role: 'assistant',
                    parts: [
                        {
                            id: 'tool:status',
                            type: 'tool',
                            name: 'doctor_status',
                            status: 'complete',
                            resultPreview: toolResult,
                        },
                    ],
                },
                { userMessage: 'do i have any connected apps?' },
            ),
        ).toContain('Telegram');
        expect(
            doctorSynthesizeFinalSummary(
                {
                    role: 'assistant',
                    parts: [
                        {
                            id: 'tool:status',
                            type: 'tool',
                            name: 'doctor_status',
                            status: 'complete',
                            resultPreview: toolResult,
                        },
                    ],
                },
                { userMessage: 'do i have any connected apps?' },
            ),
        ).toContain('Not connected: Slack');
    });

    it('synthesizes a readable answer from doctor_config_search tool output', () => {
        const toolResult = JSON.stringify({
            kind: 'doctor_config_search',
            ok: true,
            summary: 'Found 1 Doctor-safe config fields.',
            stats: {
                count: 1,
                fields: [
                    {
                        label: 'Default Model',
                        key: 'model',
                        path: 'provider.model',
                        description: 'The default model to use for chat and agents',
                        current_value: {
                            value: 'nvidia/nemotron-3-super-120b-a12b:free',
                            present: true,
                        },
                    },
                ],
            },
        });

        expect(
            doctorSynthesizeFinalSummary({
                role: 'assistant',
                parts: [
                    {
                        id: 'tool:1',
                        type: 'tool',
                        name: 'doctor_config_search',
                        status: 'complete',
                        resultPreview: toolResult,
                    },
                ],
            }),
        ).toContain('Default Model');
        expect(
            doctorSynthesizeFinalSummary({
                role: 'assistant',
                parts: [
                    {
                        id: 'tool:1',
                        type: 'tool',
                        name: 'doctor_config_search',
                        status: 'complete',
                        resultPreview: toolResult,
                    },
                ],
            }),
        ).toContain('nvidia/nemotron-3-super-120b-a12b:free');
    });

    it('keeps the empty-final assistant summary when tool cards are present', () => {
        const content = [
            '```json',
            JSON.stringify({
                kind: 'doctor_plan',
                ok: true,
                stats: {
                    card_type: 'settings_change_preview',
                    plan: {
                        id: 'scp_3',
                        title: 'Fix provider key',
                        changes: [],
                    },
                },
            }),
            '```',
        ].join('\n');

        expect(
            doctorVisibleTextForMessage({
                role: 'assistant',
                content,
                errorCode: 'empty_final_text',
            }),
        ).toBe(DOCTOR_EMPTY_FINAL_TEXT_WARNING);
    });

    it('renders plan apply state labels on the preview card', async () => {
        const preview = mount(SettingsChangePreviewCard, {
            props: {
                plan: {
                    id: 'scp_ready',
                    title: 'Ready plan',
                    changes: [],
                },
                applyState: 'ready',
            },
            global: { stubs },
        });
        expect(preview.text()).toContain('Ready to apply');

        await preview.setProps({ applyState: 'applied' });
        expect(preview.text()).toContain('Applied');

        await preview.setProps({ applyState: 'rolled_back' });
        expect(preview.text()).toContain('Reverted');

        await preview.setProps({ applyState: 'failed' });
        expect(preview.text()).toContain('Failed');
    });

    it('retries Doctor session creation without optional runner fields for older services', async () => {
        pairedHost();
        const bodies: unknown[] = [];
        vi.stubGlobal(
            'fetch',
            vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
                const url = String(_url);
                if (init?.body) bodies.push(JSON.parse(init.body as string));
                if (url.endsWith('/internal/v1/doctor/sessions')) {
                    if (bodies.length === 1) {
                        return new Response(
                            JSON.stringify({ error: 'invalid request body' }),
                            {
                                status: 400,
                                headers: { 'Content-Type': 'application/json' },
                            },
                        );
                    }
                    return new Response(
                        JSON.stringify({
                            session: { SessionKey: 'doctor-app-compat' },
                            admin_brain: {
                                available: true,
                                runner_id: 'opencode',
                            },
                        }),
                        {
                            status: 201,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                return new Response(JSON.stringify({}), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }),
        );

        const doctor = useDoctorAdminChat();
        await doctor.createSession('Doctor Session', {
            runnerId: 'opencode',
            runnerModel: 'openai/gpt-5',
        });

        expect(bodies).toEqual([
            expect.objectContaining({
                runner_id: 'opencode',
                model: 'openai/gpt-5',
            }),
            { session_key: expect.any(String), title: 'Doctor Session' },
        ]);
        expect(doctor.sessionKey.value).toMatch(/^doctor-app-/);
        expect(doctor.error.value).toBeNull();
    });

    it('retries Doctor messages without optional runner fields for older services', async () => {
        pairedHost();
        const bodies: unknown[] = [];
        let messageCalls = 0;
        vi.stubGlobal(
            'fetch',
            vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
                const url = String(_url);
                if (init?.body) bodies.push(JSON.parse(init.body as string));
                if (url.endsWith('/internal/v1/doctor/sessions')) {
                    return new Response(
                        JSON.stringify({
                            session: {
                                SessionKey: 'doctor-app-message-compat',
                            },
                            admin_brain: {
                                available: true,
                                runner_id: 'opencode',
                            },
                        }),
                        {
                            status: 201,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                if (
                    /\/internal\/v1\/doctor\/sessions\/[^/]+\/messages$/.test(
                        url,
                    )
                ) {
                    messageCalls += 1;
                    if (messageCalls === 1) {
                        return new Response(
                            JSON.stringify({
                                code: 'validation_failed',
                                error: 'unknown field',
                            }),
                            {
                                status: 400,
                                headers: { 'Content-Type': 'application/json' },
                            },
                        );
                    }
                    return new Response(
                        JSON.stringify({
                            messages: [
                                {
                                    ID: 1,
                                    Role: 'user',
                                    Content: 'test prompt',
                                    CreatedAt: 1779462000,
                                },
                                {
                                    ID: 2,
                                    Role: 'assistant',
                                    Content: 'Fallback reply.',
                                    CreatedAt: 1779462001,
                                },
                            ],
                            admin_brain: {
                                available: true,
                                runner_id: 'opencode',
                            },
                        }),
                        {
                            status: 202,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                return new Response(JSON.stringify({}), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }),
        );

        const doctor = useDoctorAdminChat();
        await doctor.createSession();
        await doctor.sendMessage('test prompt', {
            runnerModel: 'openai/gpt-5',
            runnerThinkingLevel: 'high',
        });

        expect(bodies).toEqual([
            { session_key: expect.any(String), title: 'Doctor Session' },
            {
                content: 'test prompt',
                stream: true,
                model: 'openai/gpt-5',
                thinking_level: 'high',
            },
            { content: 'test prompt', stream: true },
        ]);
        expect(doctor.messages.value).toMatchObject([
            { role: 'user', content: 'test prompt' },
            { role: 'assistant', content: 'Fallback reply.' },
        ]);
        expect(doctor.error.value).toBeNull();
    });

    it('follows runner stream events for Admin Brain replies', async () => {
        pairedHost();
        vi.stubGlobal(
            'fetch',
            vi.fn(async (_url: string | URL | Request) => {
                const url = String(_url);
                if (url.endsWith('/internal/v1/doctor/sessions')) {
                    return new Response(
                        JSON.stringify({
                            session: { SessionKey: 'doctor-app-stream' },
                            admin_brain: {
                                available: true,
                                runner_id: 'opencode',
                            },
                        }),
                        {
                            status: 201,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                if (
                    /\/internal\/v1\/doctor\/sessions\/[^/]+\/messages$/.test(
                        url,
                    )
                ) {
                    return new Response(
                        JSON.stringify({
                            messages: [
                                {
                                    ID: 1,
                                    Role: 'user',
                                    Content: 'stream it',
                                    CreatedAt: 1779462000,
                                },
                            ],
                            admin_brain: {
                                available: true,
                                runner_id: 'opencode',
                            },
                            runner_chat: {
                                session_id: 'rcs_1',
                                turn_id: 'rct_1',
                                job_id: 'job_1',
                            },
                        }),
                        {
                            status: 202,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                if (
                    url.endsWith(
                        '/internal/v1/runner-chat/sessions/rcs_1/turns/rct_1/stream',
                    )
                ) {
                    const body = [
                        'event: text_delta',
                        'data: {"text":"Streaming "}',
                        '',
                        'event: text_delta',
                        'data: {"text":"reply."}',
                        '',
                        'event: done',
                        'data: {"status":"succeeded","final_text":"Streaming reply."}',
                        '',
                    ].join('\n');
                    return new Response(body, {
                        status: 200,
                        headers: { 'Content-Type': 'text/event-stream' },
                    });
                }
                if (/\/internal\/v1\/doctor\/sessions\/[^/]+$/.test(url)) {
                    return new Response(
                        JSON.stringify({
                            messages: [
                                {
                                    ID: 1,
                                    Role: 'user',
                                    Content: 'stream it',
                                    CreatedAt: 1779462000,
                                },
                                {
                                    ID: 2,
                                    Role: 'assistant',
                                    Content: 'Streaming reply.',
                                    CreatedAt: 1779462001,
                                },
                            ],
                        }),
                        {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                return new Response(JSON.stringify({}), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }),
        );

        const doctor = useDoctorAdminChat();
        await doctor.createSession('Doctor Session', { runnerId: 'opencode' });
        await doctor.sendMessage('stream it', { runnerId: 'opencode' });

        expect(doctor.messages.value).toMatchObject([
            { id: 1, role: 'user', content: 'stream it' },
            { id: 2, role: 'assistant', content: 'Streaming reply.' },
        ]);
    });

    it('follows internal Doctor Admin Brain job streams', async () => {
        pairedHost();
        const urls: string[] = [];
        const messageBodies: unknown[] = [];
        vi.stubGlobal(
            'fetch',
            vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
                const url = String(_url);
                urls.push(url);
                if (url.endsWith('/internal/v1/doctor/sessions')) {
                    return new Response(
                        JSON.stringify({
                            session: { SessionKey: 'doctor-app-job-stream' },
                            admin_brain: {
                                available: true,
                                kind: 'api_key',
                            },
                        }),
                        {
                            status: 201,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                if (
                    /\/internal\/v1\/doctor\/sessions\/[^/]+\/messages$/.test(
                        url,
                    )
                ) {
                    messageBodies.push(JSON.parse(String(init?.body ?? '{}')));
                    return new Response(
                        JSON.stringify({
                            job_id: 'doctor_job_1',
                            messages: [
                                {
                                    ID: 1,
                                    Role: 'user',
                                    Content: 'stream through the job',
                                    CreatedAt: 1779462000,
                                },
                            ],
                            admin_brain: {
                                available: true,
                                kind: 'api_key',
                            },
                        }),
                        {
                            status: 202,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                if (url.endsWith('/internal/v1/jobs/doctor_job_1/stream')) {
                    const body = [
                        'event: text_delta',
                        'data: {"text":"Job "}',
                        '',
                        'event: text_delta',
                        'data: {"text":"streamed."}',
                        '',
                        'event: done',
                        'data: {"status":"succeeded","final_text":"Job streamed."}',
                        '',
                    ].join('\n');
                    return new Response(body, {
                        status: 200,
                        headers: { 'Content-Type': 'text/event-stream' },
                    });
                }
                if (/\/internal\/v1\/doctor\/sessions\/[^/]+$/.test(url)) {
                    return new Response(
                        JSON.stringify({
                            messages: [
                                {
                                    ID: 1,
                                    Role: 'user',
                                    Content: 'stream through the job',
                                    CreatedAt: 1779462000,
                                },
                                {
                                    ID: 2,
                                    Role: 'assistant',
                                    Content: 'Job streamed.',
                                    CreatedAt: 1779462001,
                                },
                            ],
                        }),
                        {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                return new Response(JSON.stringify({}), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }),
        );

        const doctor = useDoctorAdminChat();
        await doctor.createSession();
        await doctor.sendMessage('stream through the job');

        expect(messageBodies).toEqual([
            { content: 'stream through the job', stream: true },
        ]);
        expect(urls).toContain(
            'http://127.0.0.1:9100/internal/v1/jobs/doctor_job_1/stream',
        );
        expect(doctor.messages.value).toMatchObject([
            { id: 1, role: 'user', content: 'stream through the job' },
            { id: 2, role: 'assistant', content: 'Job streamed.' },
        ]);
    });

    it('keeps streamed approval state when doctor job reload has no assistant message', async () => {
        pairedHost();
        vi.stubGlobal(
            'fetch',
            vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
                const url = String(_url);
                if (url.endsWith('/internal/v1/doctor/sessions')) {
                    return new Response(
                        JSON.stringify({
                            session: { SessionKey: 'doctor-app-job-approval' },
                            admin_brain: {
                                available: true,
                                kind: 'api_key',
                            },
                        }),
                        {
                            status: 201,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                if (
                    /\/internal\/v1\/doctor\/sessions\/[^/]+\/messages$/.test(
                        url,
                    )
                ) {
                    expect(JSON.parse(String(init?.body ?? '{}'))).toEqual({
                        content: 'needs approval',
                        stream: true,
                    });
                    return new Response(
                        JSON.stringify({
                            job_id: 'doctor_job_approval',
                            messages: [
                                {
                                    ID: 1,
                                    Role: 'user',
                                    Content: 'needs approval',
                                    CreatedAt: 1779462000,
                                },
                            ],
                            admin_brain: {
                                available: true,
                                kind: 'api_key',
                            },
                        }),
                        {
                            status: 202,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                if (url.endsWith('/internal/v1/jobs/doctor_job_approval/stream')) {
                    const body = [
                        'event: tool_call',
                        'data: {"name":"doctor_create_plan","arguments":"{}","status":"running"}',
                        '',
                        'event: tool_result',
                        'data: {"name":"doctor_create_plan","status":"approval_required","code":"approval_required","approval_id":42,"request_id":42}',
                        '',
                        'event: done',
                        'data: {"status":"approval_required","approval_id":42,"request_id":42}',
                        '',
                    ].join('\n');
                    return new Response(body, {
                        status: 200,
                        headers: { 'Content-Type': 'text/event-stream' },
                    });
                }
                if (/\/internal\/v1\/doctor\/sessions\/[^/]+$/.test(url)) {
                    return new Response(
                        JSON.stringify({
                            messages: [
                                {
                                    ID: 1,
                                    Role: 'user',
                                    Content: 'needs approval',
                                    CreatedAt: 1779462000,
                                },
                            ],
                        }),
                        {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                return new Response(JSON.stringify({}), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }),
        );

        const doctor = useDoctorAdminChat();
        await doctor.createSession();
        await doctor.sendMessage('needs approval');

        expect(doctor.messages.value).toMatchObject([
            { id: 1, role: 'user', content: 'needs approval' },
            {
                role: 'assistant',
                status: 'attention',
                approvalRequestId: 42,
                approvalState: 'pending',
            },
        ]);
    });

    it('keeps streamed failure state when doctor job reload has no assistant message', async () => {
        pairedHost();
        vi.stubGlobal(
            'fetch',
            vi.fn(async (_url: string | URL | Request) => {
                const url = String(_url);
                if (url.endsWith('/internal/v1/doctor/sessions')) {
                    return new Response(
                        JSON.stringify({
                            session: { SessionKey: 'doctor-app-job-failure' },
                            admin_brain: {
                                available: true,
                                kind: 'api_key',
                            },
                        }),
                        {
                            status: 201,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                if (
                    /\/internal\/v1\/doctor\/sessions\/[^/]+\/messages$/.test(
                        url,
                    )
                ) {
                    return new Response(
                        JSON.stringify({
                            job_id: 'doctor_job_failure',
                            messages: [
                                {
                                    ID: 1,
                                    Role: 'user',
                                    Content: 'job failed',
                                    CreatedAt: 1779462000,
                                },
                            ],
                            admin_brain: {
                                available: true,
                                kind: 'api_key',
                            },
                        }),
                        {
                            status: 202,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                if (url.endsWith('/internal/v1/jobs/doctor_job_failure/stream')) {
                    const body = [
                        'event: error',
                        'data: {"status":"failed","message":"doctor admin brain turn failed","code":"runtime_unavailable"}',
                        '',
                    ].join('\n');
                    return new Response(body, {
                        status: 200,
                        headers: { 'Content-Type': 'text/event-stream' },
                    });
                }
                if (/\/internal\/v1\/doctor\/sessions\/[^/]+$/.test(url)) {
                    return new Response(
                        JSON.stringify({
                            messages: [
                                {
                                    ID: 1,
                                    Role: 'user',
                                    Content: 'job failed',
                                    CreatedAt: 1779462000,
                                },
                            ],
                        }),
                        {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                return new Response(JSON.stringify({}), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }),
        );

        const doctor = useDoctorAdminChat();
        await doctor.createSession();
        await doctor.sendMessage('job failed');

        expect(doctor.messages.value).toMatchObject([
            { id: 1, role: 'user', content: 'job failed' },
            {
                role: 'assistant',
                status: 'failed',
                error: 'doctor admin brain turn failed',
            },
        ]);
    });

    it('converts finalizing doctor jobs into empty-final warnings from job snapshots', async () => {
        pairedHost();
        vi.stubGlobal(
            'fetch',
            vi.fn(async (_url: string | URL | Request) => {
                const url = String(_url);
                if (url.endsWith('/internal/v1/doctor/sessions')) {
                    return new Response(
                        JSON.stringify({
                            session: { SessionKey: 'doctor-app-job-empty' },
                            admin_brain: {
                                available: true,
                                kind: 'api_key',
                            },
                        }),
                        {
                            status: 201,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                if (
                    /\/internal\/v1\/doctor\/sessions\/[^/]+\/messages$/.test(
                        url,
                    )
                ) {
                    return new Response(
                        JSON.stringify({
                            job_id: 'doctor_job_empty',
                            messages: [
                                {
                                    ID: 1,
                                    Role: 'user',
                                    Content: 'why no suggestion?',
                                    CreatedAt: 1779462000,
                                },
                            ],
                            admin_brain: {
                                available: true,
                                kind: 'api_key',
                            },
                        }),
                        {
                            status: 202,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                if (url.endsWith('/internal/v1/jobs/doctor_job_empty/stream')) {
                    const body = [
                        'event: tool_call',
                        'data: {"name":"doctor_config_search","arguments":"{}","status":"running"}',
                        '',
                        'event: tool_result',
                        'data: {"name":"doctor_config_search","status":"completed","result":"done"}',
                        '',
                        'event: completion',
                        'data: {"status":"completed"}',
                        '',
                    ].join('\n');
                    return new Response(body, {
                        status: 200,
                        headers: { 'Content-Type': 'text/event-stream' },
                    });
                }
                if (url.endsWith('/internal/v1/jobs/doctor_job_empty')) {
                    return new Response(
                        JSON.stringify({
                            job_id: 'doctor_job_empty',
                            kind: 'doctor_admin_brain',
                            status: 'completed',
                            created_at: '2026-05-23T00:00:00Z',
                            updated_at: '2026-05-23T00:00:01Z',
                            events: [
                                {
                                    sequence: 1,
                                    type: 'tool_call',
                                    data: {
                                        job_id: 'doctor_job_empty',
                                        name: 'doctor_config_search',
                                        status: 'running',
                                    },
                                },
                                {
                                    sequence: 2,
                                    type: 'tool_result',
                                    data: {
                                        job_id: 'doctor_job_empty',
                                        name: 'doctor_config_search',
                                        status: 'completed',
                                        result: 'done',
                                    },
                                },
                                {
                                    sequence: 3,
                                    type: 'completion',
                                    data: {
                                        job_id: 'doctor_job_empty',
                                        status: 'completed',
                                    },
                                },
                            ],
                        }),
                        {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                if (/\/internal\/v1\/doctor\/sessions\/[^/]+$/.test(url)) {
                    return new Response(
                        JSON.stringify({
                            messages: [
                                {
                                    ID: 1,
                                    Role: 'user',
                                    Content: 'why no suggestion?',
                                    CreatedAt: 1779462000,
                                },
                            ],
                        }),
                        {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                return new Response(JSON.stringify({}), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }),
        );

        const doctor = useDoctorAdminChat();
        await doctor.createSession();
        await doctor.sendMessage('why no suggestion?');

        expect(doctor.messages.value).toMatchObject([
            { id: 1, role: 'user', content: 'why no suggestion?' },
            {
                role: 'assistant',
                status: 'attention',
                error: 'or3-intern completed without a final assistant message.',
                errorCode: 'empty_final_text',
                content:
                    'Tool work completed, but or3-intern did not return a final assistant message. The last tool result is shown above; retry the turn if it still matters.',
            },
        ]);
    });

    it('exposes metadata preview/apply helpers for settings UI plans', async () => {
        pairedHost();
        vi.stubGlobal(
            'fetch',
            vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
                const url = String(_url);
                if (url.endsWith('/internal/v1/doctor/config-metadata')) {
                    return new Response(
                        JSON.stringify({
                            fields: [
                                {
                                    section: 'provider',
                                    key: 'model',
                                    path: 'provider.model',
                                    label: 'Chat model',
                                    risk_level: 'notice',
                                    restart_required: false,
                                },
                            ],
                        }),
                        {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                if (url.endsWith('/internal/v1/doctor/plans')) {
                    expect(init?.method).toBe('POST');
                    return new Response(
                        JSON.stringify({
                            plan: {
                                id: 'scp_2',
                                title: 'Change model',
                                changes: [],
                            },
                        }),
                        {
                            status: 201,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                if (url.endsWith('/internal/v1/doctor/plans/scp_2/apply')) {
                    return new Response(
                        JSON.stringify({ ok: true, plan_id: 'scp_2' }),
                        {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                return new Response(JSON.stringify({}), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }),
        );

        const configure = useConfigure();
        await configure.loadMetadata({ force: true });
        expect(configure.metadataFor('provider', 'provider_model')?.label).toBe(
            'Chat model',
        );
        expect(configure.metadataFor('provider', 'provider_model')?.path).toBe(
            'provider.model',
        );
        const plan = await configure.previewPlan({
            title: 'Change model',
            changes: [],
        });
        await expect(configure.applyPlan(plan.plan.id!)).resolves.toMatchObject(
            { ok: true },
        );
    });

    it('scopes settings metadata lookup by section instead of key alone', () => {
        const configure = useConfigure();
        configure.metadata.value = [
            {
                section: 'provider',
                key: 'api_key',
                path: 'provider.apiKey',
                label: 'Provider API key',
            },
            {
                section: 'skills',
                key: 'api_key',
                path: 'skills.demo.apiKey',
                label: 'Skill API key',
            },
            {
                section: 'channels',
                key: 'enabled',
                path: 'channels.discord.enabled',
                label: 'Discord enabled',
            },
        ];

        expect(configure.metadataFor('skills', 'api_key')?.label).toBe(
            'Skill API key',
        );
        expect(configure.metadataFor('channels', 'enabled')?.label).toBe(
            'Discord enabled',
        );
        expect(configure.metadataFor('missing', 'api_key')).toBeUndefined();
    });

    it('does not bypass Doctor plan approval failures with legacy configure apply', async () => {
        pairedHost();
        vi.stubGlobal(
            'fetch',
            vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
                const url = String(_url);
                if (
                    url.includes(
                        '/internal/v1/configure/fields?section=provider',
                    )
                ) {
                    return new Response(
                        JSON.stringify({
                            section: 'provider',
                            fields: [
                                {
                                    key: 'provider_model',
                                    kind: 'text',
                                    value: 'old-model',
                                },
                            ],
                        }),
                        {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                if (url.endsWith('/internal/v1/doctor/config-metadata')) {
                    return new Response(
                        JSON.stringify({
                            fields: [
                                {
                                    section: 'provider',
                                    key: 'model',
                                    path: 'provider.model',
                                    label: 'Chat model',
                                    risk_level: 'warning',
                                    requires_approval: true,
                                },
                            ],
                        }),
                        {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                if (url.endsWith('/internal/v1/doctor/plans')) {
                    const body = JSON.parse(String(init?.body ?? '{}'));
                    expect(body.plan.changes[0]).toMatchObject({
                        config_path: 'provider.model',
                        section: 'provider',
                        field: 'provider_model',
                    });
                    expect(body.plan.exact_config_diff[0]).toMatchObject({
                        path: 'provider.model',
                        old_value: 'old-model',
                        new_value: 'new-model',
                    });
                    return new Response(
                        JSON.stringify({
                            code: 'passkey_required',
                            message: 'Passkey required.',
                        }),
                        {
                            status: 403,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                if (url.endsWith('/internal/v1/configure/apply')) {
                    throw new Error(
                        'legacy apply must not run after Doctor rejection',
                    );
                }
                return new Response(
                    JSON.stringify({ section: 'empty', fields: [] }),
                    {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    },
                );
            }),
        );

        const simple = useSimpleSettings();
        await simple.ensureLoaded('ai');
        await expect(
            simple.applyChanges([
                { section: 'provider', field: 'model', value: 'new-model' },
            ]),
        ).rejects.toMatchObject({ status: 403 });
    });
});

describe('Doctor admin chat message ordering', () => {
    it('sorts persisted messages by ascending id', () => {
        const ordered = sortDoctorMessages([
            { id: 12, role: 'assistant', content: 'third' },
            { id: 3, role: 'user', content: 'first' },
            { id: 8, role: 'assistant', content: 'second' },
        ]);
        expect(ordered.map((message) => message.id)).toEqual([3, 8, 12]);
    });

    it('orders optimistic ids after persisted ids', () => {
        expect(
            compareDoctorMessageOrder(
                { id: 4, role: 'assistant', content: 'saved' },
                { id: -2, role: 'assistant', content: 'streaming' },
            ),
        ).toBeLessThan(0);
        expect(
            compareDoctorMessageOrder(
                { id: -1, role: 'user', content: 'draft' },
                { id: -2, role: 'assistant', content: 'draft reply' },
            ),
        ).toBeLessThan(0);
    });

    it('mergeDoctorMessages dedupes by id and sorts', () => {
        const merged = mergeDoctorMessages(
            [
                { id: 2, role: 'assistant', content: 'short' },
                { id: 1, role: 'user', content: 'hi' },
            ],
            [{ id: 2, role: 'assistant', content: 'longer persisted reply' }],
        );
        expect(merged.map((message) => message.id)).toEqual([1, 2]);
        expect(merged[1]?.content).toBe('longer persisted reply');
    });

    it('finalizeDoctorMessagesAfterReload merges streaming parts into persisted assistant', () => {
        const server = [
            { id: 1, role: 'user', content: 'change model' },
            {
                id: 2,
                role: 'assistant',
                content: 'Done. Here is the plan.',
            },
        ];
        const placeholder = {
            id: -2,
            role: 'assistant',
            content: 'Done. Here is the plan.',
            status: 'complete' as const,
            parts: [
                {
                    id: 'text:1',
                    type: 'text',
                    content: 'Let me inspect the settings.',
                },
                {
                    id: 'tool:1',
                    type: 'tool',
                    name: 'doctor_plan',
                    status: 'complete',
                },
            ],
        };
        const result = finalizeDoctorMessagesAfterReload(server, placeholder);
        expect(result.map((message) => message.id)).toEqual([1, 2]);
        expect(result[1]?.parts).toHaveLength(2);
    });

    it('finalizeDoctorMessagesAfterReload keeps unique streaming placeholder', () => {
        const server = [{ id: 1, role: 'user', content: 'change model' }];
        const placeholder = {
            id: -2,
            role: 'assistant',
            content: 'Still drafting the plan…',
            status: 'streaming' as const,
        };
        const result = finalizeDoctorMessagesAfterReload(server, placeholder);
        expect(result.map((message) => message.id)).toEqual([1, -2]);
    });

    it('buildDoctorChatDisplayMessages preserves user/assistant turn order', () => {
        const display = buildDoctorChatDisplayMessages([
            { id: 1, role: 'user', content: 'first' },
            { id: 2, role: 'assistant', content: 'reply one' },
            { id: 3, role: 'user', content: 'second' },
            { id: 4, role: 'assistant', content: 'reply two' },
        ]);
        expect(display.map((message) => message.role)).toEqual([
            'user',
            'assistant',
            'user',
            'assistant',
        ]);
        expect(display.map((message) => message.rawId)).toEqual([1, 2, 3, 4]);
    });

    it('merges consecutive assistant messages from the same turn', () => {
        const display = buildDoctorChatDisplayMessages([
            { id: 1, role: 'user', content: 'change model' },
            { id: 2, role: 'assistant', content: 'Let me look.' },
            { id: 3, role: 'assistant', content: 'Here is the plan.' },
        ]);
        expect(display).toHaveLength(2);
        expect(display[0]?.role).toBe('user');
        expect(display[1]?.text).toBe('Here is the plan.');
    });

    it('preserves inline tool and text order from persisted turn rows', () => {
        const display = buildDoctorChatDisplayMessages([
            { id: 1, role: 'user', content: 'investigate sandbox' },
            { id: 2, role: 'assistant', content: 'Let me inspect the host.' },
            {
                id: 3,
                role: 'tool',
                content: '{"kind":"doctor_config_search","ok":true,"summary":"Found 7 fields."}',
                meta: {
                    doctor_tool_result: {
                        kind: 'doctor_config_search',
                        ok: true,
                        summary: 'Found 7 fields.',
                    },
                },
            },
            {
                id: 4,
                role: 'assistant',
                content: 'Here is what I found next.',
            },
        ]);
        const partTypes = display[1]?.parts.map((part) => part.type);
        expect(partTypes).toEqual(['text', 'tool', 'text']);
    });

    it('collapses assistant, tool, and follow-up assistant rows into one turn bubble', () => {
        const intro = 'Let me dig into how access profiles work so I can give you a concrete answer.';
        const display = buildDoctorChatDisplayMessages([
            { id: 1, role: 'user', content: 'what do we do?' },
            { id: 2, role: 'assistant', content: intro },
            { id: 3, role: 'tool', content: '{"kind":"doctor_docs_search","ok":true}' },
            {
                id: 4,
                role: 'assistant',
                content: intro,
                parts: [
                    { id: 'text:1', type: 'text', content: intro },
                    {
                        id: 'tool:1',
                        type: 'tool',
                        name: 'doctor_docs_search',
                        status: 'complete',
                    },
                ],
            },
        ]);
        expect(display).toHaveLength(2);
        expect(display[1]?.role).toBe('assistant');
        expect(display[1]?.parts.some((part) => part.type === 'tool')).toBe(
            true,
        );
        expect(
            display[1]?.parts.filter((part) => part.type === 'text').length,
        ).toBeGreaterThan(0);
        expect(display[1]?.text).toBe('');
    });

    it('does not merge assistant messages separated by a user turn', () => {
        const display = buildDoctorChatDisplayMessages([
            { id: 1, role: 'user', content: 'first' },
            { id: 2, role: 'assistant', content: 'reply one' },
            { id: 3, role: 'user', content: 'second' },
            { id: 4, role: 'assistant', content: 'reply two' },
        ]);
        expect(display).toHaveLength(4);
    });

    it('keeps out-of-order persisted ids in chronological display order', () => {
        const display = buildDoctorChatDisplayMessages([
            { id: 9, role: 'assistant', content: 'later reply' },
            { id: 2, role: 'user', content: 'earlier' },
            { id: 5, role: 'user', content: 'middle question' },
        ]);
        expect(display.map((message) => message.rawId)).toEqual([2, 5, 9]);
    });
});
