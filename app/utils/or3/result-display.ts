type ParsedPayload = Record<string, unknown>;

export function extractReadableResultText(
  text: string | null | undefined,
  runnerId?: string,
): string | null {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return null;

  let bestScore = 0;
  let bestCandidate = "";
  const consider = (payload: unknown) => {
    const { score, text: candidate } = extractCandidate(payload, runnerId);
    if (!candidate || score <= 0) return;
    if (score >= bestScore) {
      bestScore = score;
      bestCandidate = candidate;
    }
  };

  try {
    consider(JSON.parse(trimmed));
  } catch {
    for (const line of trimmed.split("\n")) {
      const candidateLine = line.trim();
      if (!candidateLine) continue;
      try {
        consider(JSON.parse(candidateLine));
      } catch {
        continue;
      }
    }
  }

  return bestCandidate || null;
}

export function normalizeResultDisplayText(
  text: string | null | undefined,
  runnerId?: string,
): string {
  return extractReadableResultText(text, runnerId) ?? text ?? "";
}

export function looksLikeJsonDocument(
  text: string | null | undefined,
): boolean {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return false;
  if (
    !trimmed.startsWith("{") &&
    !trimmed.startsWith("[") &&
    !trimmed.startsWith('"')
  ) {
    return false;
  }
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

export function shouldRenderResultAsMarkdown(
  text: string | null | undefined,
): boolean {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return false;
  return !looksLikeJsonDocument(trimmed);
}

function extractCandidate(
  payload: unknown,
  runnerId?: string,
): { score: number; text: string } {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { score: 0, text: "" };
  }
  const obj = payload as ParsedPayload;

  switch (runnerId) {
    case "gemini":
      if (asText(obj.response)) {
        return { score: 100, text: asText(obj.response)! };
      }
      break;
    case "claude":
      if (
        obj.type === "result" &&
        obj.subtype === "success" &&
        asText(obj.result)
      ) {
        return { score: 100, text: asText(obj.result)! };
      }
      if (obj.type === "assistant") {
        const assistant = extractClaudeAssistantText(obj.message);
        if (assistant) return { score: 85, text: assistant };
      }
      break;
    case "codex": {
      const item = asObject(obj.item);
      if (
        obj.type === "item.completed" &&
        item?.type === "agent_message" &&
        asText(item.text)
      ) {
        return { score: 100, text: asText(item.text)! };
      }
      break;
    }
    case "opencode":
      if (
        (obj.type === "assistant_message" || obj.type === "assistant") &&
        asText(obj.message)
      ) {
        return { score: 100, text: asText(obj.message)! };
      }
      break;
  }

  if (obj.type === "result" && asText(obj.response)) {
    return { score: 92, text: asText(obj.response)! };
  }
  if (obj.type === "result" && asText(obj.result)) {
    return { score: 88, text: asText(obj.result)! };
  }
  if (
    (obj.type === "assistant_message" || obj.type === "assistant") &&
    asText(obj.message)
  ) {
    return { score: 90, text: asText(obj.message)! };
  }
  if (obj.type === "assistant" && asText(obj.content)) {
    return { score: 85, text: asText(obj.content)! };
  }
  if (
    obj.type === "message" &&
    (obj.role === "assistant" || obj.role === "model")
  ) {
    if (asText(obj.message)) return { score: 80, text: asText(obj.message)! };
    if (asText(obj.content)) return { score: 78, text: asText(obj.content)! };
    if (asText(obj.text)) return { score: 75, text: asText(obj.text)! };
  }

  const item = asObject(obj.item);
  if (item?.type === "agent_message" && asText(item.text)) {
    return { score: 90, text: asText(item.text)! };
  }
  if (asText(obj.response)) return { score: 70, text: asText(obj.response)! };
  if (obj.type !== "tool_result" && asText(obj.result)) {
    return { score: 68, text: asText(obj.result)! };
  }
  return { score: 0, text: "" };
}

function extractClaudeAssistantText(value: unknown): string {
  const message = asObject(value);
  const content = message?.content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        const block = asObject(part);
        return block?.type === "text" ? asText(block.text) : null;
      })
      .filter((part): part is string => !!part)
      .join("\n\n");
  }
  return asText(content) ?? "";
}

function asObject(value: unknown): ParsedPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as ParsedPayload;
}

function asText(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (Array.isArray(value)) {
    const joined = value
      .map((item) => asText(item))
      .filter((item): item is string => !!item)
      .join("\n\n")
      .trim();
    return joined || null;
  }
  if (value && typeof value === "object") {
    const obj = value as ParsedPayload;
    for (const key of ["text", "message", "content", "response", "result"]) {
      const candidate = asText(obj[key]);
      if (candidate) return candidate;
    }
  }
  return null;
}
