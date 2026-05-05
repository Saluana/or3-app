import { describe, expect, it } from "vitest";
import {
  extractReadableResultText,
  looksLikeJsonDocument,
  normalizeResultDisplayText,
  shouldRenderResultAsMarkdown,
} from "../../app/utils/or3/result-display";

describe("result display helpers", () => {
  it("treats JSON objects and arrays as raw structured output", () => {
    expect(looksLikeJsonDocument('{"response":"done"}')).toBe(true);
    expect(looksLikeJsonDocument('[{"type":"result"}]')).toBe(true);
    expect(
      looksLikeJsonDocument(
        '{"type":"step_start"} {"type":"text","part":{"type":"text","text":"done"}}',
      ),
    ).toBe(true);
    expect(shouldRenderResultAsMarkdown('{"response":"done"}')).toBe(false);
  });

  it("treats markdown and plain text as renderable content", () => {
    expect(looksLikeJsonDocument("## Done\n\nShip it.")).toBe(false);
    expect(shouldRenderResultAsMarkdown("## Done\n\nShip it.")).toBe(true);
    expect(shouldRenderResultAsMarkdown("Applied the requested fix.")).toBe(
      true,
    );
  });

  it("extracts readable text from Gemini JSON output", () => {
    const raw =
      '{"response":"## Summary\\n\\nAll tests passed.","stats":{"totalTokens":12}}';
    expect(extractReadableResultText(raw, "gemini")).toBe(
      "## Summary\n\nAll tests passed.",
    );
    expect(normalizeResultDisplayText(raw, "gemini")).toBe(
      "## Summary\n\nAll tests passed.",
    );
  });

  it("extracts readable text from Codex JSONL output", () => {
    const raw = [
      '{"type":"thread.started","thread_id":"t1"}',
      '{"type":"item.completed","item":{"id":"item_3","type":"agent_message","text":"Repo contains docs and examples."}}',
    ].join("\n");
    expect(extractReadableResultText(raw, "codex")).toBe(
      "Repo contains docs and examples.",
    );
  });

  it("extracts readable text from OpenCode text events", () => {
    const raw = [
      '{"type":"step_start","timestamp":1777866965731}',
      '{"type":"tool_use","part":{"type":"tool","tool":"webfetch"}}',
      '{"type":"text","part":{"type":"text","text":"## Summary\\n\\nOpenCode returned markdown."}}',
    ].join(" ");

    expect(extractReadableResultText(raw, "opencode")).toBe(
      "## Summary\n\nOpenCode returned markdown.",
    );
    expect(normalizeResultDisplayText(raw, "opencode")).toBe(
      "## Summary\n\nOpenCode returned markdown.",
    );
    expect(
      shouldRenderResultAsMarkdown(normalizeResultDisplayText(raw, "opencode")),
    ).toBe(true);
  });
});
