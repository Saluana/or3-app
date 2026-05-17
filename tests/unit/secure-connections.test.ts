import { describe, expect, it } from "vitest";
import {
  applyWebEnrollmentRestrictions,
  buildSecureFrame,
  rejectSensitiveDeepLink,
  secureConnectionCapabilityDiscovery,
  shouldRekeySecureSession,
} from "~/utils/or3/secure-connections";

describe("secure connection helpers", () => {
  it("caps browser enrollment trust and capabilities", () => {
    const restricted = applyWebEnrollmentRestrictions(
      "web",
      ["chat", "terminal", "secrets"],
      Date.now() + 7 * 24 * 60 * 60 * 1000,
      1_000,
    );
    expect(restricted.trustLevel).toBe("web-limited");
    expect(restricted.capabilities).toEqual(["chat"]);
    expect(restricted.expiresAtUnixMs).toBe(86_401_000);
  });

  it("rejects sensitive deep-link query material", () => {
    expect(rejectSensitiveDeepLink("or3://pair?token=abc")).toBe(true);
    expect(rejectSensitiveDeepLink("or3://pair?session_id=abc")).toBe(true);
    expect(rejectSensitiveDeepLink("or3://pair?code=123456")).toBe(false);
  });

  it("rekeys on resume, age, count, bytes, and near expiry", () => {
    const claims = {
      issued_at_unix_ms: 1_000,
      expires_at_unix_ms: 2_000_000,
    };
    expect(shouldRekeySecureSession(claims, { appResumed: true })).toBe(true);
    expect(shouldRekeySecureSession(claims, { nowUnixMs: 700_000 })).toBe(true);
    expect(shouldRekeySecureSession(claims, { messageCount: 8192 })).toBe(true);
    expect(
      shouldRekeySecureSession(claims, { byteCount: 32 * 1024 * 1024 }),
    ).toBe(true);
    expect(
      shouldRekeySecureSession(
        { issued_at_unix_ms: 1_000, expires_at_unix_ms: 31_000 },
        { nowUnixMs: 2_000 },
      ),
    ).toBe(true);
  });

  it("builds secure frame metadata", () => {
    expect(
      buildSecureFrame({
        kind: "control",
        sessionId: "session",
        sequence: 1,
        correlationId: "corr",
        body: new Uint8Array([1, 2, 3]),
        sentAtUnixMs: 1_000,
      }),
    ).toMatchObject({ version: 1, sessionId: "session", sequence: 1 });
  });

  it("reports v2 feature discovery without remote legacy pairing", () => {
    const discovery = secureConnectionCapabilityDiscovery();
    expect(discovery.qrPairingV2).toBe(true);
    expect(discovery.legacyPairingRemote).toBe(false);
  });
});
