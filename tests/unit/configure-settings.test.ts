import { afterEach, describe, expect, it, vi } from 'vitest';
import { useConfigure } from '../../app/composables/useConfigure';
import { useLocalCache } from '../../app/composables/useLocalCache';
import { useSimpleSettings } from '../../app/composables/settings/useSimpleSettings';
import { useMCP } from '../../app/composables/useMCP';
import { useSkills } from '../../app/composables/useSkills';

describe('settings configure mappings', () => {
    afterEach(() => {
        useSimpleSettings().reset();
        useMCP().resetMCPServers();
        useSkills().resetSkills();
        useLocalCache().clearAll();
        sessionStorage.clear();
        localStorage.clear();
        vi.unstubAllGlobals();
    });

    it('loads advanced configure sections and applies field changes through the existing configure API', async () => {
        useLocalCache().updateHost({
            id: 'host-1',
            name: 'Host',
            baseUrl: 'http://127.0.0.1:9100',
            token: 'paired-token',
            pairedToken: 'paired-token',
        });
        const fetchMock = vi.fn(
            async (_url: string | URL | Request, init?: RequestInit) => {
                const url = String(_url);
                if (url.endsWith('/internal/v1/configure/sections')) {
                    return new Response(
                        JSON.stringify({
                            items: [
                                { key: 'security', label: 'Security' },
                                { key: 'service', label: 'Service' },
                            ],
                        }),
                        {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                if (
                    url.includes(
                        '/internal/v1/configure/fields?section=security',
                    )
                ) {
                    return new Response(
                        JSON.stringify({
                            fields: [
                                { key: 'security_approval_exec', value: 'ask' },
                            ],
                        }),
                        {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                if (url.endsWith('/internal/v1/configure/apply')) {
                    expect(init?.method).toBe('POST');
                    expect(JSON.parse(init?.body as string)).toEqual({
                        changes: [
                            { key: 'security_approval_exec', value: 'ask' },
                            { key: 'auth_enforcement_mode', value: 'warn' },
                        ],
                    });
                    return new Response(
                        JSON.stringify({
                            ok: true,
                            config_path: '/tmp/config.json',
                        }),
                        {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                return new Response('{}', {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' },
                });
            },
        );
        vi.stubGlobal('fetch', fetchMock);

        const configure = useConfigure();
        await configure.loadSections();
        await configure.loadFields('security');
        await expect(
            configure.applyChanges([
                { key: 'security_approval_exec', value: 'ask' },
                { key: 'auth_enforcement_mode', value: 'warn' },
            ]),
        ).resolves.toMatchObject({ ok: true });

        expect(configure.sections.value.map((section) => section.key)).toEqual([
            'security',
            'service',
        ]);
        expect(configure.fields.value[0]).toMatchObject({
            key: 'security_approval_exec',
        });
    });

    it('maps simple settings aliases to raw configure fields', async () => {
        useLocalCache().updateHost({
            id: 'host-1',
            name: 'Host',
            baseUrl: 'http://127.0.0.1:9100',
            token: 'paired-token',
            pairedToken: 'paired-token',
        });
        const fetchMock = vi.fn(
            async (_url: string | URL | Request, init?: RequestInit) => {
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
                                    key: 'provider_api_key',
                                    kind: 'secret',
                                    value: 'configured',
                                },
                                {
                                    key: 'provider_model',
                                    kind: 'text',
                                    value: 'openai/gpt-4.1-mini',
                                },
                                {
                                    key: 'provider_vision',
                                    kind: 'toggle',
                                    value: false,
                                },
                                {
                                    key: 'provider_temperature',
                                    kind: 'text',
                                    value: '0.7',
                                },
                            ],
                        }),
                        {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                if (
                    url.includes(
                        '/internal/v1/configure/fields?section=runtime',
                    )
                ) {
                    return new Response(
                        JSON.stringify({ section: 'runtime', fields: [] }),
                        {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                if (url.endsWith('/internal/v1/configure/apply')) {
                    expect(init?.method).toBe('POST');
                    expect(JSON.parse(init?.body as string)).toEqual({
                        changes: [
                            {
                                section: 'provider',
                                field: 'provider_model',
                                op: 'set',
                                value: 'openai/gpt-4.1',
                            },
                            {
                                section: 'provider',
                                field: 'provider_vision',
                                op: 'set',
                                value: true,
                            },
                        ],
                    });
                    return new Response(JSON.stringify({ ok: true }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    });
                }
                return new Response(
                    JSON.stringify({ section: 'empty', fields: [] }),
                    {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    },
                );
            },
        );
        vi.stubGlobal('fetch', fetchMock);

        const simple = useSimpleSettings();
        await simple.ensureLoaded('ai');

        expect(simple.valueIndex.value['provider.apiKey']).toBe('configured');
        expect(simple.valueIndex.value['provider.model']).toBe(
            'openai/gpt-4.1-mini',
        );
        expect(simple.valueIndex.value['provider.enableVision']).toBe(false);
        expect(simple.findField('provider', 'apiKey')?.key).toBe(
            'provider_api_key',
        );
        expect(simple.findField('provider', 'enableVision')?.key).toBe(
            'provider_vision',
        );

        await expect(
            simple.applyChanges([
                {
                    section: 'provider',
                    field: 'model',
                    value: 'openai/gpt-4.1',
                },
                { section: 'provider', field: 'enableVision', value: true },
            ]),
        ).resolves.toMatchObject({ ok: true });
    });

    it('stops simple settings loading after the host is unreachable', async () => {
        useLocalCache().updateHost({
            id: 'host-1',
            name: 'Host',
            baseUrl: 'http://127.0.0.1:59999',
            token: 'paired-token',
            pairedToken: 'paired-token',
        });
        const fetchMock = vi.fn(async () => {
            throw new TypeError('Failed to fetch');
        });
        vi.stubGlobal('fetch', fetchMock);

        const simple = useSimpleSettings();
        await expect(simple.ensureLoaded()).resolves.toBeUndefined();

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(simple.lastError.value).toBe(
            'Could not reach the selected computer.',
        );
    });

    it('exposes tools settings and maps them to raw configure fields', async () => {
        useLocalCache().updateHost({
            id: 'host-1',
            name: 'Host',
            baseUrl: 'http://127.0.0.1:9100',
            token: 'paired-token',
            pairedToken: 'paired-token',
        });
        const fetchMock = vi.fn(
            async (_url: string | URL | Request, init?: RequestInit) => {
                const url = String(_url);
                if (
                    url.includes(
                        '/internal/v1/configure/fields?section=service',
                    )
                ) {
                    return new Response(
                        JSON.stringify({
                            section: 'service',
                            fields: [
                                {
                                    key: 'service_max_capability',
                                    kind: 'choice',
                                    value: 'safe',
                                    choices: ['safe', 'guarded', 'privileged'],
                                },
                            ],
                        }),
                        {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                if (
                    url.includes('/internal/v1/configure/fields?section=tools')
                ) {
                    return new Response(
                        JSON.stringify({
                            section: 'tools',
                            fields: [
                                {
                                    key: 'tools_enable_exec',
                                    kind: 'toggle',
                                    value: false,
                                },
                                {
                                    key: 'tools_exec_timeout',
                                    kind: 'text',
                                    value: '60',
                                },
                                {
                                    key: 'tools_path_append',
                                    kind: 'text',
                                    value: '/opt/homebrew/bin',
                                },
                            ],
                        }),
                        {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                if (
                    url.includes('/internal/v1/configure/fields?section=skills')
                ) {
                    return new Response(
                        JSON.stringify({
                            section: 'skills',
                            fields: [
                                {
                                    key: 'skills_enable_exec',
                                    kind: 'toggle',
                                    value: false,
                                },
                            ],
                        }),
                        {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                if (
                    url.includes(
                        '/internal/v1/configure/fields?section=hardening',
                    )
                ) {
                    return new Response(
                        JSON.stringify({
                            section: 'hardening',
                            fields: [
                                {
                                    key: 'hardening_guarded_tools',
                                    kind: 'toggle',
                                    value: true,
                                },
                                {
                                    key: 'hardening_exec_allowed_programs',
                                    kind: 'text',
                                    value: 'git',
                                },
                                {
                                    key: 'hardening_exec_shell',
                                    kind: 'toggle',
                                    value: false,
                                },
                            ],
                        }),
                        {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                if (
                    url.includes(
                        '/internal/v1/configure/fields?section=security',
                    )
                ) {
                    return new Response(
                        JSON.stringify({
                            section: 'security',
                            fields: [
                                {
                                    key: 'security_approval_exec_mode',
                                    kind: 'choice',
                                    value: 'ask',
                                    choices: [
                                        'deny',
                                        'ask',
                                        'allowlist',
                                        'trusted',
                                    ],
                                },
                                {
                                    key: 'security_approval_skill_mode',
                                    kind: 'choice',
                                    value: 'ask',
                                    choices: [
                                        'deny',
                                        'ask',
                                        'allowlist',
                                        'trusted',
                                    ],
                                },
                            ],
                        }),
                        {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                if (url.endsWith('/internal/v1/configure/apply')) {
                    expect(init?.method).toBe('POST');
                    expect(JSON.parse(init?.body as string)).toEqual({
                        changes: [
                            {
                                section: 'tools',
                                field: 'tools_enable_exec',
                                op: 'set',
                                value: true,
                            },
                            {
                                section: 'service',
                                field: 'service_max_capability',
                                op: 'choose',
                                value: 'guarded',
                            },
                            {
                                section: 'hardening',
                                field: 'hardening_exec_allowed_programs',
                                op: 'set',
                                value: 'git,gws',
                            },
                        ],
                    });
                    return new Response(JSON.stringify({ ok: true }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    });
                }
                return new Response(
                    JSON.stringify({ section: 'empty', fields: [] }),
                    {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    },
                );
            },
        );
        vi.stubGlobal('fetch', fetchMock);

        const simple = useSimpleSettings();
        await simple.ensureLoaded('tools');
        const section = simple.getSection('tools');

        expect(section?.label).toBe('Tools & Skills');
        expect(section?.controls.map((control) => control.key)).toContain(
            'tools-enable-exec',
        );
        expect(
            section?.controls.find(
                (control) => control.key === 'tools-allowed-programs',
            )?.kind,
        ).toBe('command-programs');
        expect(
            section?.controls.find(
                (control) => control.key === 'tools-path-append',
            )?.kind,
        ).toBe('path');
        expect(
            section?.controls.find(
                (control) => control.key === 'tools-exec-timeout',
            )?.kind,
        ).toBe('seconds');
        expect(simple.valueIndex.value['tools.enableExec']).toBe(false);
        expect(simple.valueIndex.value['service.maxCapability']).toBe('safe');
        expect(simple.summaryFor(section!)).toContain('Local exec is off');
        expect(simple.findField('tools', 'enableExec')?.key).toBe(
            'tools_enable_exec',
        );

        await expect(
            simple.applyChanges([
                { section: 'tools', field: 'enableExec', value: true },
                {
                    section: 'service',
                    field: 'maxCapability',
                    value: 'guarded',
                },
                {
                    section: 'hardening',
                    field: 'execAllowedPrograms',
                    value: 'git,gws',
                },
            ]),
        ).resolves.toMatchObject({ ok: true });
    });

    it('uses choose ops for tools approval choice fields', async () => {
        useLocalCache().updateHost({
            id: 'host-1',
            name: 'Host',
            baseUrl: 'http://127.0.0.1:9100',
            token: 'paired-token',
            pairedToken: 'paired-token',
        });
        const fetchMock = vi.fn(
            async (_url: string | URL | Request, init?: RequestInit) => {
                const url = String(_url);
                if (
                    url.includes(
                        '/internal/v1/configure/fields?section=service',
                    )
                ) {
                    return new Response(
                        JSON.stringify({
                            section: 'service',
                            fields: [
                                {
                                    key: 'service_max_capability',
                                    kind: 'choice',
                                    value: 'safe',
                                    choices: ['safe', 'guarded', 'privileged'],
                                },
                            ],
                        }),
                        {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                if (
                    url.includes('/internal/v1/configure/fields?section=tools')
                ) {
                    return new Response(
                        JSON.stringify({
                            section: 'tools',
                            fields: [
                                {
                                    key: 'tools_enable_exec',
                                    kind: 'toggle',
                                    value: false,
                                },
                            ],
                        }),
                        {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                if (
                    url.includes('/internal/v1/configure/fields?section=skills')
                ) {
                    return new Response(
                        JSON.stringify({
                            section: 'skills',
                            fields: [
                                {
                                    key: 'skills_enable_exec',
                                    kind: 'toggle',
                                    value: false,
                                },
                            ],
                        }),
                        {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                if (
                    url.includes(
                        '/internal/v1/configure/fields?section=hardening',
                    )
                ) {
                    return new Response(
                        JSON.stringify({
                            section: 'hardening',
                            fields: [
                                {
                                    key: 'hardening_exec_allowed_programs',
                                    kind: 'text',
                                    value: 'git',
                                },
                            ],
                        }),
                        {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                if (
                    url.includes(
                        '/internal/v1/configure/fields?section=security',
                    )
                ) {
                    return new Response(
                        JSON.stringify({
                            section: 'security',
                            fields: [
                                {
                                    key: 'security_approval_exec_mode',
                                    kind: 'choice',
                                    value: 'ask',
                                    choices: [
                                        'deny',
                                        'ask',
                                        'allowlist',
                                        'trusted',
                                    ],
                                },
                                {
                                    key: 'security_approval_skill_mode',
                                    kind: 'choice',
                                    value: 'ask',
                                    choices: [
                                        'deny',
                                        'ask',
                                        'allowlist',
                                        'trusted',
                                    ],
                                },
                            ],
                        }),
                        {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                if (url.endsWith('/internal/v1/configure/apply')) {
                    expect(init?.method).toBe('POST');
                    expect(JSON.parse(init?.body as string)).toEqual({
                        changes: [
                            {
                                section: 'security',
                                field: 'security_approval_exec_mode',
                                op: 'choose',
                                value: 'ask',
                            },
                            {
                                section: 'security',
                                field: 'security_approval_skill_mode',
                                op: 'choose',
                                value: 'allowlist',
                            },
                            {
                                section: 'service',
                                field: 'service_max_capability',
                                op: 'choose',
                                value: 'privileged',
                            },
                        ],
                    });
                    return new Response(JSON.stringify({ ok: true }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    });
                }
                return new Response(
                    JSON.stringify({ section: 'empty', fields: [] }),
                    {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    },
                );
            },
        );
        vi.stubGlobal('fetch', fetchMock);

        const simple = useSimpleSettings();
        await simple.ensureLoaded('tools');

        await expect(
            simple.applyChanges([
                {
                    section: 'security',
                    field: 'approvals.execMode',
                    value: 'ask',
                },
                {
                    section: 'security',
                    field: 'approvals.skillMode',
                    value: 'allowlist',
                },
                {
                    section: 'service',
                    field: 'maxCapability',
                    value: 'privileged',
                },
            ]),
        ).resolves.toMatchObject({ ok: true });
    });

    it('hides legacy model, context, vision, and skill controls when runners are enabled', async () => {
        useLocalCache().updateHost({
            id: 'host-1',
            name: 'Host',
            baseUrl: 'http://127.0.0.1:9100',
            token: 'paired-token',
            pairedToken: 'paired-token',
        });
        const fieldsBySection: Record<string, Array<Record<string, unknown>>> = {
            agentcli: [{ key: 'agentCLI_enabled', value: true }],
            provider: [
                { key: 'provider_preset', value: 'openrouter' },
                { key: 'provider_model', value: 'openai/gpt-4.1-mini' },
                { key: 'provider_vision', value: true },
                { key: 'provider_timeout', value: 120 },
                { key: 'routing_chat_provider', value: 'openrouter' },
                { key: 'routing_chat_model', value: 'openai/gpt-4.1-mini' },
                { key: 'routing_chat_fallbacks', value: '' },
                { key: 'routing_agents_provider', value: 'openrouter' },
                { key: 'routing_agents_model', value: 'openai/gpt-4.1' },
                { key: 'routing_agents_fallbacks', value: '' },
                { key: 'routing_summarization_provider', value: 'openrouter' },
                { key: 'routing_summarization_model', value: 'openai/gpt-4.1-mini' },
                { key: 'routing_summarization_fallbacks', value: '' },
                { key: 'routing_context_provider', value: 'openrouter' },
                { key: 'routing_context_model', value: 'openai/gpt-4.1-mini' },
                { key: 'routing_context_fallbacks', value: '' },
                { key: 'routing_embeddings_provider', value: 'openai' },
                { key: 'routing_embeddings_model', value: 'text-embedding-3-small' },
                { key: 'routing_embeddings_dimensions', value: 1536 },
            ],
            runtime: [
                { key: 'runtime_history_max', value: 40 },
                { key: 'runtime_memory_retrieve', value: 8 },
                { key: 'runtime_vector_k', value: 8 },
                { key: 'runtime_fts_k', value: 8 },
                { key: 'runtime_vector_scan_limit', value: 64 },
                { key: 'runtime_consolidation_enabled', value: true },
            ],
            context: [
                { key: 'context_max_input_tokens', value: 16000 },
                { key: 'context_task_card_enforce_plan', value: true },
            ],
            tools: [
                { key: 'tools_enable_exec', value: true },
                { key: 'tools_exec_timeout', value: 60 },
                { key: 'tools_path_append', value: '/opt/homebrew/bin' },
            ],
            hardening: [
                { key: 'hardening_guarded_tools', value: true },
                { key: 'hardening_exec_allowed_programs', value: 'git,gws' },
                { key: 'hardening_exec_shell', value: true },
            ],
            security: [
                { key: 'security_approval_exec_mode', value: 'ask' },
                { key: 'security_approval_skill_mode', value: 'trusted' },
            ],
            service: [{ key: 'service_max_capability', value: 'safe' }],
            skills: [{ key: 'skills_enable_exec', value: true }],
        };
        vi.stubGlobal(
            'fetch',
            vi.fn(async (_url: string | URL | Request) => {
                const url = String(_url);
                const section = new URL(url).searchParams.get('section') ?? '';
                return new Response(
                    JSON.stringify({
                        section,
                        fields: fieldsBySection[section] ?? [],
                    }),
                    {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    },
                );
            }),
        );

        const simple = useSimpleSettings();
        await simple.ensureLoaded();

        const aiSection = simple.getSection('ai');
        const aiKeys = aiSection?.controls.map((control) => control.key) ?? [];
        expect(aiKeys).toEqual([
            'embeddings-provider',
            'embeddings-model',
            'embeddings-dimensions',
        ]);
        expect(simple.summaryFor(aiSection!)).toContain('Runners handle chat');

        const memoryKeys =
            simple.getSection('memory')?.controls.map((control) => control.key) ?? [];
        expect(memoryKeys).toContain('memory-history');
        expect(memoryKeys).toContain('memory-cleanup');
        expect(memoryKeys).not.toContain('memory-detail');

        const toolKeys =
            simple.getSection('tools')?.controls.map((control) => control.key) ?? [];
        expect(toolKeys).toContain('tools-service-capability');
        expect(toolKeys).toContain('tools-allowed-programs');
        expect(toolKeys).not.toContain('tools-enable-skill-exec');
        expect(toolKeys).not.toContain('tools-enforce-plan');
        expect(toolKeys).not.toContain('tools-skill-approval');
        expect(toolKeys).not.toContain('tools-exec-timeout');
        expect(toolKeys).not.toContain('tools-shell-mode');
    });

    it('loads and updates agent skills through the skills API', async () => {
        useLocalCache().updateHost({
            id: 'host-1',
            name: 'Host',
            baseUrl: 'http://127.0.0.1:9100',
            token: 'paired-token',
            pairedToken: 'paired-token',
        });
        const fetchMock = vi.fn(
            async (_url: string | URL | Request, init?: RequestInit) => {
                const url = String(_url);
                if (
                    url.endsWith('/internal/v1/skills') &&
                    init?.method === 'GET'
                ) {
                    return new Response(
                        JSON.stringify({
                            global_dir: '/Users/brendon/.agents/skills',
                            global_skills_enabled: true,
                            items: [
                                {
                                    name: 'demo',
                                    key: 'demo',
                                    source: 'global',
                                    location:
                                        '/Users/brendon/.agents/skills/demo',
                                    eligible: true,
                                    disabled: false,
                                    hidden: false,
                                    status: 'eligible',
                                    permission_state: 'approved',
                                    user_invocable: true,
                                },
                            ],
                        }),
                        {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                if (url.endsWith('/internal/v1/skills/demo/settings')) {
                    expect(init?.method).toBe('POST');
                    expect(JSON.parse(init?.body as string)).toEqual({
                        enabled: false,
                        apiKey: 'secret',
                    });
                    return new Response(
                        JSON.stringify({
                            ok: true,
                            skill: {
                                name: 'demo',
                                key: 'demo',
                                source: 'global',
                                location: '/Users/brendon/.agents/skills/demo',
                                eligible: false,
                                disabled: true,
                                hidden: false,
                                status: 'disabled',
                                permission_state: 'approved',
                                user_invocable: true,
                            },
                        }),
                        {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                return new Response('{}', {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' },
                });
            },
        );
        vi.stubGlobal('fetch', fetchMock);

        const skillApi = useSkills();
        await skillApi.loadSkills();

        expect(skillApi.globalSkillsDir.value).toBe(
            '/Users/brendon/.agents/skills',
        );
        expect(skillApi.skills.value[0]?.source).toBe('global');

        await expect(
            skillApi.updateSkill('demo', { enabled: false, apiKey: 'secret' }),
        ).resolves.toMatchObject({ ok: true });
        expect(skillApi.skills.value[0]?.disabled).toBe(true);
    });

    it('manages MCP servers through the add-ons API', async () => {
        useLocalCache().updateHost({
            id: 'host-1',
            name: 'Host',
            baseUrl: 'http://127.0.0.1:9100',
            token: 'paired-token',
            pairedToken: 'paired-token',
        });
        const fetchMock = vi.fn(
            async (_url: string | URL | Request, init?: RequestInit) => {
                const url = String(_url);
                if (
                    url.endsWith('/internal/v1/mcp/servers') &&
                    (!init?.method || init.method === 'GET')
                ) {
                    return new Response(
                        JSON.stringify({
                            servers: [
                                {
                                    name: 'local',
                                    config: {
                                        enabled: true,
                                        transport: 'stdio',
                                        command: 'mcp-local',
                                    },
                                    status: {
                                        connected: true,
                                        toolCount: 1,
                                        tools: ['mcp_local_echo'],
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
                if (
                    url.endsWith('/internal/v1/mcp/servers') &&
                    init?.method === 'POST'
                ) {
                    expect(JSON.parse(init.body as string)).toMatchObject({
                        name: 'local',
                        config: {
                            enabled: true,
                            transport: 'stdio',
                            command: 'mcp-local',
                        },
                    });
                    return new Response(
                        JSON.stringify({ ok: true, restartRequired: true }),
                        {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                if (url.endsWith('/internal/v1/mcp/servers/local/test')) {
                    return new Response(
                        JSON.stringify({
                            ok: true,
                            toolCount: 1,
                            tools: [{ name: 'mcp_local_echo' }],
                        }),
                        {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                if (
                    url.endsWith('/internal/v1/mcp/servers/local') &&
                    init?.method === 'DELETE'
                ) {
                    return new Response(
                        JSON.stringify({ ok: true, restartRequired: true }),
                        {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                return new Response('{}', {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' },
                });
            },
        );
        vi.stubGlobal('fetch', fetchMock);

        const mcpApi = useMCP();
        await mcpApi.loadMCPServers();
        expect(mcpApi.mcpServers.value[0]?.status?.toolCount).toBe(1);

        await expect(
            mcpApi.saveMCPServer('local', {
                enabled: true,
                transport: 'stdio',
                command: 'mcp-local',
            }),
        ).resolves.toMatchObject({ ok: true });
        expect(mcpApi.mcpRestartRequired.value).toBe(true);
        await expect(mcpApi.testMCPServer('local')).resolves.toMatchObject({
            ok: true,
            toolCount: 1,
        });
        await expect(mcpApi.deleteMCPServer('local')).resolves.toMatchObject({
            ok: true,
        });
    });
});
