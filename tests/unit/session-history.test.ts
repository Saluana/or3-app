import { afterEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

async function loadComposable(options?: {
    requestImpl?: (...args: any[]) => Promise<any>;
    chatOverrides?: Record<string, any>;
}) {
    vi.resetModules();

    const chat = {
        activeSession: ref<{ id: string; sessionKey: string } | null>({
            id: 'local-session',
            sessionKey: 'svc:active',
        }),
        sessions: ref([]),
        messages: ref([]),
        findSessionByKey: vi.fn().mockReturnValue(null),
        setSessionRunnerMetadata: vi.fn(),
        syncBackendSessionMeta: vi.fn(),
        applyBackendSessionMeta: vi.fn((meta) => ({
            id: `local:${meta.session_key}`,
            sessionKey: meta.session_key,
            title: meta.title,
        })),
        activateSessionByKey: vi.fn((sessionKey: string) => ({
            id: `local:${sessionKey}`,
            sessionKey,
        })),
        hydrateBackendMessages: vi.fn(),
        clearSessionMessages: vi.fn(),
        ...(options?.chatOverrides || {}),
    };

    const request = vi.fn(
        options?.requestImpl ||
            (async () => ({
                sessions: [],
            })),
    );

    vi.doMock('../../app/composables/useChatSessions', () => ({
        useChatSessions: () => chat,
    }));
    vi.doMock('../../app/composables/useOr3Api', () => ({
        useOr3Api: () => ({ request }),
    }));

    const mod = await import('../../app/composables/useSessionHistory');
    return {
        sessionHistory: mod.useSessionHistory(),
        chat,
        request,
    };
}

describe('useSessionHistory', () => {
    afterEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        vi.restoreAllMocks();
    });

    it('refreshes with filters, stores sessions, and syncs backend metadata', async () => {
        const meta = {
            session_key: 'svc:active',
            title: 'Existing backend session',
            runner_id: 'opencode',
            archived: false,
            message_count: 3,
        };
        const { sessionHistory, chat, request } = await loadComposable({
            requestImpl: async (path: string) => {
                expect(path).toBe(
                    '/internal/v1/chat-sessions?include_archived=true&runner_id=opencode&q=fork',
                );
                return { sessions: [meta] };
            },
        });

        const sessions = await sessionHistory.refresh({
            includeArchived: true,
            runnerId: 'opencode',
            q: 'fork',
        });

        expect(request).toHaveBeenCalledTimes(1);
        expect(sessions).toEqual([meta]);
        expect(sessionHistory.sessions.value).toEqual([meta]);
        expect(chat.syncBackendSessionMeta).toHaveBeenCalledWith(meta);
        expect(sessionHistory.activeBackendSession.value).toEqual(meta);
    });

    it('includes local active sessions before backend history refresh catches up', async () => {
        const localSession = {
            id: 'local-session',
            hostId: 'test-host',
            sessionKey: 'svc:active',
            title: 'New conversation',
            createdAt: '2026-05-13T00:00:00.000Z',
            updatedAt: '2026-05-13T00:01:00.000Z',
            runnerId: 'or3-intern',
            runnerLabel: 'OR3 Intern',
            runnerContinuationMode: 'replay',
        };
        const { sessionHistory } = await loadComposable({
            chatOverrides: {
                sessions: ref([localSession]),
                messages: ref([
                    {
                        id: 'msg-user',
                        sessionId: 'local-session',
                        role: 'user',
                        content: 'I need a friend right now',
                        status: 'complete',
                        createdAt: '2026-05-13T00:01:00.000Z',
                    },
                ]),
            },
        });

        expect(sessionHistory.sessions.value).toEqual([
            expect.objectContaining({
                session_key: 'svc:active',
                title: 'New conversation',
                message_count: 1,
                last_message_preview: 'I need a friend right now',
            }),
        ]);
    });

    it('archives local-only sessions without requiring backend metadata', async () => {
        const localSession = {
            id: 'local-session',
            hostId: 'test-host',
            sessionKey: 'svc:local-only',
            title: 'Local only',
            createdAt: '2026-05-13T00:00:00.000Z',
            updatedAt: '2026-05-13T00:01:00.000Z',
            runnerId: 'or3-intern',
            runnerLabel: 'OR3 Intern',
            runnerContinuationMode: 'replay',
        };
        const { sessionHistory, chat, request } = await loadComposable({
            chatOverrides: {
                activeSession: ref({
                    id: 'local-session',
                    sessionKey: 'svc:local-only',
                }),
                sessions: ref([localSession]),
                messages: ref([]),
                findSessionByKey: vi.fn().mockReturnValue(localSession),
            },
            requestImpl: async () => {
                throw {
                    code: 'chat_session_not_found',
                    status: 404,
                    message: 'chat session not found',
                };
            },
        });

        await expect(
            sessionHistory.archive('svc:local-only', true),
        ).resolves.toMatchObject({
            session_key: 'svc:local-only',
            archived: true,
        });
        expect(request).not.toHaveBeenCalled();
        expect(chat.setSessionRunnerMetadata).toHaveBeenCalledWith(
            'local-session',
            { archived: true },
        );
    });

    it('clears local messages before hydrating an opened session', async () => {
        const clearSessionMessages = vi.fn();
        const { sessionHistory, chat, request } = await loadComposable({
            chatOverrides: { clearSessionMessages },
            requestImpl: async (path: string) => {
                if (
                    path ===
                    '/internal/v1/chat-sessions/svc%3Ahistory/messages?limit=100'
                ) {
                    return {
                        messages: [
                            {
                                id: 1,
                                session_key: 'svc:history',
                                role: 'user',
                                content: 'hello',
                                created_at: 1,
                            },
                        ],
                    };
                }
                throw new Error(`unexpected path ${path}`);
            },
        });

        await sessionHistory.openSession({
            session_key: 'svc:history',
            title: 'History',
        });

        expect(chat.activateSessionByKey).toHaveBeenCalledWith('svc:history');
        expect(clearSessionMessages).toHaveBeenCalledWith('local:svc:history');
        expect(chat.hydrateBackendMessages).toHaveBeenCalled();
        expect(request).toHaveBeenCalledTimes(1);
    });

    it('forks through replay, hydrates the new session, and closes the panel', async () => {
        vi.spyOn(Date, 'now').mockReturnValue(1_717_171_717_000);
        vi.spyOn(Math, 'random').mockReturnValue(0.123456789);

        const forkMeta = {
            session_key: 'svc:forked',
            title: 'Forked conversation',
            runner_id: 'claude',
            archived: false,
            message_count: 2,
        };
        const backendMessages = [
            { id: 41, role: 'user', content: 'fork source', payload: {} },
            { id: 42, role: 'assistant', content: 'fork result', payload: {} },
        ];
        const { sessionHistory, chat, request } = await loadComposable({
            requestImpl: async (path: string, init?: { method?: string; body?: Record<string, any> }) => {
                if (path === '/internal/v1/chat-sessions/svc%3Asource/fork') {
                    expect(init?.method).toBe('POST');
                    expect(init?.body).toMatchObject({
                        anchor_message_id: 99,
                        target_runner_id: 'claude',
                        title: 'Forked conversation',
                        allow_incomplete_anchor: true,
                        fork_strategy: 'replay',
                    });
                    expect(typeof init?.body?.new_session_key).toBe('string');
                    expect(String(init?.body?.new_session_key)).toContain('or3-app:local:session_');
                    return forkMeta;
                }
                if (path === '/internal/v1/chat-sessions/svc%3Aforked/messages?limit=100') {
                    return { messages: backendMessages };
                }
                throw new Error(`unexpected path ${path}`);
            },
        });
        sessionHistory.historyOpen.value = true;

        const session = await sessionHistory.forkSession({
            sourceSessionKey: 'svc:source',
            anchorMessageId: 99,
            targetRunnerId: 'claude',
            title: 'Forked conversation',
            allowIncompleteAnchor: true,
        });

        expect(request).toHaveBeenCalledTimes(2);
        expect(chat.applyBackendSessionMeta).toHaveBeenCalledWith(forkMeta);
        expect(chat.activateSessionByKey).toHaveBeenCalledWith('svc:forked');
        expect(chat.hydrateBackendMessages).toHaveBeenCalledWith(
            { id: 'local:svc:forked', sessionKey: 'svc:forked' },
            backendMessages,
        );
        expect(session).toEqual({
            id: 'local:svc:forked',
            sessionKey: 'svc:forked',
            title: 'Forked conversation',
        });
        expect(sessionHistory.historyOpen.value).toBe(false);
    });
});
