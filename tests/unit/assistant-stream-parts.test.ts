import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const streamEvents: Array<{
    event: string;
    sequence: number;
    data: Record<string, unknown>;
}> = [];
let snapshotResponse: Record<string, unknown> = {
    job_id: "job_parts",
    status: "completed",
    events: [],
};

vi.mock("../../app/composables/useOr3Api", () => ({
    useOr3Api: () => ({
        async *stream(
            _path: string,
            options?: { onOpen?: (response: Response) => void },
        ) {
            options?.onOpen?.(
                new Response(null, {
                    headers: { "X-Or3-Job-Id": "job_parts" },
                }),
            );
            for (const event of streamEvents) {
                yield event;
            }
        },
        request: vi.fn(async () => snapshotResponse),
    }),
}));

import { useAssistantStream } from "../../app/composables/useAssistantStream";
import { useChatSessions } from "../../app/composables/useChatSessions";
import { useLocalCache } from "../../app/composables/useLocalCache";

describe("assistant stream ordered parts", () => {
    beforeEach(() => {
        vi.stubGlobal("useToast", () => ({ add: vi.fn() }));
    });

    afterEach(() => {
        streamEvents.length = 0;
        snapshotResponse = {
            job_id: "job_parts",
            status: "completed",
            events: [],
        };
        useLocalCache().clearAll();
        vi.clearAllMocks();
    });

    it("keeps tool calls at the point where they occurred in streamed text", async () => {
        useLocalCache().updateHost({
            id: "test-host",
            name: "Test Host",
            baseUrl: "http://127.0.0.1:9100",
            token: "secret",
        });

        streamEvents.push(
            {
                event: "text_delta",
                sequence: 1,
                data: { content: "First text.", job_id: "job_parts" },
            },
            {
                event: "tool_call",
                sequence: 2,
                data: {
                    name: "read_file",
                    arguments: '{"path":"README.md"}',
                    tool_call_id: "call_1",
                    job_id: "job_parts",
                },
            },
            {
                event: "tool_result",
                sequence: 3,
                data: {
                    name: "read_file",
                    result: "contents",
                    tool_call_id: "call_1",
                    job_id: "job_parts",
                },
            },
            {
                event: "text_delta",
                sequence: 4,
                data: { content: " Final text.", job_id: "job_parts" },
            },
            {
                event: "completion",
                sequence: 5,
                data: { status: "completed", job_id: "job_parts" },
            },
        );

        await useAssistantStream().send("check file");

        const assistant = useChatSessions().messages.value.find(
            (message) => message.role === "assistant",
        );

        expect(assistant?.content).toBe("First text. Final text.");
        expect(
            assistant?.parts?.map((part) =>
                part.type === "text" ? part.content : part.name,
            ),
        ).toEqual(["First text.", "read_file", "Final text."]);
        expect(assistant?.parts?.[1]).toMatchObject({
            type: "tool",
            toolCallId: "call_1",
            status: "complete",
            resultPreview: "contents",
        });
    });

    it("dedupes replayed lifecycle and legacy tool events for one call", async () => {
        useLocalCache().updateHost({
            id: "test-host",
            name: "Test Host",
            baseUrl: "http://127.0.0.1:9100",
            token: "secret",
        });

        streamEvents.push(
            {
                event: "tool_call",
                sequence: 1,
                data: {
                    name: "exec",
                    arguments: '{"program":"pwd"}',
                    tool_call_id: "call_exec",
                    job_id: "job_parts",
                },
            },
            {
                event: "tool_result",
                sequence: 2,
                data: {
                    name: "exec",
                    result: "/tmp",
                    tool_call_id: "call_exec",
                    job_id: "job_parts",
                },
            },
        );
        snapshotResponse = {
            job_id: "job_parts",
            status: "completed",
            events: [
                {
                    type: "tool_call",
                    sequence: 1,
                    data: {
                        name: "exec",
                        arguments: '{"program":"pwd"}',
                        tool_call_id: "call_exec",
                        job_id: "job_parts",
                    },
                },
                {
                    type: "tool_result",
                    sequence: 2,
                    data: {
                        name: "exec",
                        result: "/tmp",
                        tool_call_id: "call_exec",
                        job_id: "job_parts",
                    },
                },
                {
                    type: "completion",
                    sequence: 3,
                    data: { status: "completed", job_id: "job_parts" },
                },
            ],
        };

        await useAssistantStream().send("run pwd");

        const assistant = useChatSessions().messages.value.find(
            (message) => message.role === "assistant",
        );
        expect(assistant?.toolCalls).toHaveLength(1);
        expect(
            assistant?.parts?.filter((part) => part.type === "tool"),
        ).toHaveLength(1);
        expect(assistant?.toolCalls?.[0]).toMatchObject({
            id: "tool:call_exec",
            name: "exec",
            status: "complete",
            result: "/tmp",
        });
    });

    it("surfaces empty completion after tool work as an attention state", async () => {
        useLocalCache().updateHost({
            id: "test-host",
            name: "Test Host",
            baseUrl: "http://127.0.0.1:9100",
            token: "secret",
        });

        streamEvents.push(
            {
                event: "tool_call",
                sequence: 1,
                data: {
                    name: "exec",
                    arguments: '{"program":"node","args":["--version"]}',
                    tool_call_id: "call_node",
                    job_id: "job_parts",
                },
            },
            {
                event: "tool_result",
                sequence: 2,
                data: {
                    name: "exec",
                    result: "v22.21.1",
                    tool_call_id: "call_node",
                    job_id: "job_parts",
                },
            },
            {
                event: "completion",
                sequence: 3,
                data: { status: "completed", final_text: "", job_id: "job_parts" },
            },
        );

        await useAssistantStream().send("check node");

        const assistant = useChatSessions().messages.value.find(
            (message) => message.role === "assistant",
        );
        expect(assistant?.status).toBe("attention");
        expect(assistant?.errorCode).toBe("empty_final_text");
        expect(assistant?.content).toContain(
            "did not return a final assistant message",
        );
        expect(
            assistant?.activityLog?.find(
                (entry) => entry.type === "completion",
            ),
        ).toMatchObject({ status: "attention" });
    });

    it("surfaces empty completion without tool work as an attention state", async () => {
        useLocalCache().updateHost({
            id: "test-host",
            name: "Test Host",
            baseUrl: "http://127.0.0.1:9100",
            token: "secret",
        });

        streamEvents.push({
            event: "completion",
            sequence: 1,
            data: { status: "completed", final_text: "", job_id: "job_parts" },
        });

        await useAssistantStream().send("say something");

        const assistant = useChatSessions().messages.value.find(
            (message) => message.role === "assistant",
        );
        expect(assistant?.status).toBe("attention");
        expect(assistant?.errorCode).toBe("empty_final_text");
        expect(assistant?.content).toContain("did not return any visible text");
    });

    it("merges legacy pending tool records when replay provides the canonical tool id", async () => {
        useLocalCache().updateHost({
            id: "test-host",
            name: "Test Host",
            baseUrl: "http://127.0.0.1:9100",
            token: "secret",
        });

        streamEvents.push(
            {
                event: "tool_call",
                sequence: 1,
                data: {
                    name: "exec",
                    arguments: '{"program":"pwd"}',
                    job_id: "job_parts",
                },
            },
            {
                event: "tool_result",
                sequence: 2,
                data: {
                    name: "exec",
                    status: "failed",
                    code: "approval_required",
                    request_id: 42,
                    error: "approval required",
                    job_id: "job_parts",
                },
            },
            {
                event: "tool_call",
                sequence: 3,
                data: {
                    name: "exec",
                    arguments: '{"program":"pwd"}',
                    tool_call_id: "tc-exec",
                    job_id: "job_parts",
                },
            },
            {
                event: "tool_result",
                sequence: 4,
                data: {
                    name: "exec",
                    result: "/tmp",
                    tool_call_id: "tc-exec",
                    job_id: "job_parts",
                },
            },
            {
                event: "completion",
                sequence: 5,
                data: {
                    status: "completed",
                    final_text: "done",
                    job_id: "job_parts",
                },
            },
        );

        await useAssistantStream().send("run pwd");

        const assistant = useChatSessions().messages.value.find(
            (message) => message.role === "assistant",
        );
        expect(assistant?.toolCalls).toHaveLength(1);
        expect(assistant?.toolCalls?.[0]).toMatchObject({
            id: "tool:tc-exec",
            name: "exec",
            status: "complete",
            result: "/tmp",
        });
        expect(
            assistant?.parts?.filter((part) => part.type === "tool"),
        ).toHaveLength(1);
        expect(assistant?.parts?.find((part) => part.type === "tool")).toMatchObject({
            id: "tool:tc-exec",
            status: "complete",
            resultPreview: "/tmp",
        });
    });
});
