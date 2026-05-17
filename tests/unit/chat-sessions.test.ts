import { afterEach, describe, expect, it } from "vitest";

import { useChatSessions } from "../../app/composables/useChatSessions";
import { useLocalCache } from "../../app/composables/useLocalCache";

describe("useChatSessions", () => {
    afterEach(() => {
        useLocalCache().clearAll();
    });

    it("finds the active assistant message tied to an approval request", () => {
        useLocalCache().updateHost({
            id: "test-host",
            name: "Test Host",
            baseUrl: "http://127.0.0.1:9100",
            token: "secret",
        });

        const chat = useChatSessions();
        const session = chat.ensureSession();
        chat.addMessage({
            sessionId: session.id,
            role: "assistant",
            content: "waiting",
            status: "attention",
            approvalRequestId: 73,
            approvalState: "pending",
        });

        expect(
            chat.findAssistantMessageForApproval(73, session.sessionKey)
                ?.content,
        ).toBe("waiting");
        expect(
            chat.findAssistantMessageForApproval(74, session.sessionKey),
        ).toBeNull();
    });

    it("promotes a session by key and reuses it for approval placeholders", () => {
        useLocalCache().updateHost({
            id: "test-host",
            name: "Test Host",
            baseUrl: "http://127.0.0.1:9100",
            token: "secret",
        });

        const chat = useChatSessions();
        const original = chat.ensureSession();
        const newer = chat.newSession("Newer conversation");

        expect(chat.activeSession.value?.id).toBe(newer.id);

        const activated = chat.activateSessionByKey(original.sessionKey);
        const placeholder = chat.ensureApprovalMessage({
            approvalRequestId: 101,
            sessionKey: original.sessionKey,
            content: "Approval is needed before or3-intern can continue.",
        });

        expect(activated?.id).toBe(original.id);
        expect(chat.activeSession.value?.id).toBe(original.id);
        expect(placeholder?.sessionId).toBe(original.id);
        expect(
            chat.findAssistantMessageForApproval(101, original.sessionKey)?.id,
        ).toBe(placeholder?.id);
    });

    it("creates a session when activating an unseen session key", () => {
        useLocalCache().updateHost({
            id: "test-host",
            name: "Test Host",
            baseUrl: "http://127.0.0.1:9100",
            token: "secret",
        });

        const chat = useChatSessions();
        const activated = chat.activateSessionByKey(
            "svc:approval-session",
            "Imported approval",
        );

        expect(activated?.sessionKey).toBe("svc:approval-session");
        expect(activated?.title).toBe("Imported approval");
        expect(chat.activeSession.value?.sessionKey).toBe(
            "svc:approval-session",
        );
    });

    it("attaches hydrated approvals to the in-flight assistant message", () => {
        useLocalCache().updateHost({
            id: "test-host",
            name: "Test Host",
            baseUrl: "http://127.0.0.1:9100",
            token: "secret",
        });

        const chat = useChatSessions();
        const session = chat.ensureSession();
        const assistant = chat.addMessage({
            sessionId: session.id,
            role: "assistant",
            content: "",
            status: "attention",
            errorCode: "approval_required",
        });

        const approvalMessage = chat.ensureApprovalMessage({
            approvalRequestId: 202,
            sessionKey: session.sessionKey,
            content: "Approval is needed before or3-intern can continue.",
        });

        expect(approvalMessage?.id).toBe(assistant.id);
        expect(chat.messages.value).toHaveLength(1);
        expect(approvalMessage?.approvalRequestId).toBe(202);
        expect(approvalMessage?.approvalState).toBe("pending");
    });

    it("does not recreate a resolved approval placeholder", () => {
        useLocalCache().updateHost({
            id: "test-host",
            name: "Test Host",
            baseUrl: "http://127.0.0.1:9100",
            token: "secret",
        });

        const chat = useChatSessions();
        const session = chat.ensureSession();
        chat.addMessage({
            sessionId: session.id,
            role: "assistant",
            content: "waiting",
            status: "attention",
            approvalRequestId: 303,
            approvalState: "pending",
        });

        chat.markApprovalResolved(303, "approved", session.sessionKey);

        expect(
            chat.ensureApprovalMessage({
                approvalRequestId: 303,
                sessionKey: session.sessionKey,
                content: "Approval is needed before or3-intern can continue.",
            }),
        ).toBeNull();
        expect(chat.messages.value).toHaveLength(1);
        expect(chat.messages.value[0]?.approvalRequestId).toBeUndefined();
        expect(chat.messages.value[0]?.approvalState).toBeUndefined();
    });

    it("hydrates backend tool rows into the assistant activity instead of raw chat bubbles", () => {
        useLocalCache().updateHost({
            id: "test-host",
            name: "Test Host",
            baseUrl: "http://127.0.0.1:9100",
            token: "secret",
        });

        const chat = useChatSessions();
        const session = chat.activateSessionByKey("discord:C1:U1", "Discord C1:U1");
        if (!session) throw new Error("expected session");

        chat.hydrateBackendMessages(session, [
            {
                id: 10,
                session_key: "discord:C1:U1",
                role: "assistant",
                content: "",
                created_at: 1_717_171_717_000,
                payload: {
                    tool_calls: [
                        {
                            id: "tc-list",
                            type: "function",
                            function: {
                                name: "list_dir",
                                arguments: '{"path":"/Users/brendon/Documents/or3-intern"}',
                            },
                        },
                    ],
                },
            },
            {
                id: 11,
                session_key: "discord:C1:U1",
                role: "tool",
                content: '{"kind":"list_dir","ok":true,"summary":"Listed 26 entries"}',
                created_at: 1_717_171_718_000,
                payload: {
                    tool: "list_dir",
                    tool_call_id: "tc-list",
                    args: { path: "/Users/brendon/Documents/or3-intern" },
                },
            },
            {
                id: 12,
                session_key: "discord:C1:U1",
                role: "assistant",
                content: "Here is what I see.",
                created_at: 1_717_171_719_000,
                payload: { in_reply_to: 9 },
            },
        ]);

        expect(chat.messages.value).toHaveLength(2);
        const toolAssistant = chat.messages.value[0];
        expect(toolAssistant?.content).toBe("");
        expect(toolAssistant?.toolCalls?.[0]).toMatchObject({
            id: "tc-list",
            name: "list_dir",
            status: "complete",
            result: "Listed 26 entries",
        });
        expect(toolAssistant?.parts?.[0]).toMatchObject({
            type: "tool",
            toolCallId: "tc-list",
            status: "complete",
        });
        expect(toolAssistant?.activityLog?.[0]).toMatchObject({
            type: "tool_call",
            status: "complete",
        });
        expect(chat.latestBackendMessageId(session.id)).toBe(12);
        expect(chat.messages.value[1]?.content).toBe("Here is what I see.");

        chat.hydrateBackendMessages(session, [
            {
                id: 11,
                session_key: "discord:C1:U1",
                role: "tool",
                content: '{"kind":"list_dir","ok":true,"summary":"Listed 26 entries"}',
                created_at: 1_717_171_718_000,
                payload: {
                    tool: "list_dir",
                    tool_call_id: "tc-list",
                },
            },
        ]);
        expect(chat.messages.value).toHaveLength(2);
    });
});
