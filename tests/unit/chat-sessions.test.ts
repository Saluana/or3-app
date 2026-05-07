import { afterEach, describe, expect, it } from 'vitest';

import { useChatSessions } from '../../app/composables/useChatSessions';
import { useLocalCache } from '../../app/composables/useLocalCache';

describe('useChatSessions', () => {
    afterEach(() => {
        useLocalCache().clearAll();
    });

    it('finds the active assistant message tied to an approval request', () => {
        useLocalCache().updateHost({
            id: 'test-host',
            name: 'Test Host',
            baseUrl: 'http://127.0.0.1:9100',
            token: 'secret',
        });

        const chat = useChatSessions();
        const session = chat.ensureSession();
        chat.addMessage({
            sessionId: session.id,
            role: 'assistant',
            content: 'waiting',
            status: 'attention',
            approvalRequestId: 73,
            approvalState: 'pending',
        });

        expect(
            chat.findAssistantMessageForApproval(73, session.sessionKey)
                ?.content,
        ).toBe('waiting');
        expect(
            chat.findAssistantMessageForApproval(74, session.sessionKey),
        ).toBeNull();
    });

    it('promotes a session by key and reuses it for approval placeholders', () => {
        useLocalCache().updateHost({
            id: 'test-host',
            name: 'Test Host',
            baseUrl: 'http://127.0.0.1:9100',
            token: 'secret',
        });

        const chat = useChatSessions();
        const original = chat.ensureSession();
        const newer = chat.newSession('Newer conversation');

        expect(chat.activeSession.value?.id).toBe(newer.id);

        const activated = chat.activateSessionByKey(original.sessionKey);
        const placeholder = chat.ensureApprovalMessage({
            approvalRequestId: 101,
            sessionKey: original.sessionKey,
            content: 'Approval is needed before or3-intern can continue.',
        });

        expect(activated?.id).toBe(original.id);
        expect(chat.activeSession.value?.id).toBe(original.id);
        expect(placeholder?.sessionId).toBe(original.id);
        expect(
            chat.findAssistantMessageForApproval(101, original.sessionKey)?.id,
        ).toBe(placeholder?.id);
    });

    it('creates a session when activating an unseen session key', () => {
        useLocalCache().updateHost({
            id: 'test-host',
            name: 'Test Host',
            baseUrl: 'http://127.0.0.1:9100',
            token: 'secret',
        });

        const chat = useChatSessions();
        const activated = chat.activateSessionByKey(
            'svc:approval-session',
            'Imported approval',
        );

        expect(activated?.sessionKey).toBe('svc:approval-session');
        expect(activated?.title).toBe('Imported approval');
        expect(chat.activeSession.value?.sessionKey).toBe(
            'svc:approval-session',
        );
    });
});
