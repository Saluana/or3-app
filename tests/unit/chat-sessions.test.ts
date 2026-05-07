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
});
