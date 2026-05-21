import { Capacitor } from "@capacitor/core";
import { NativeBiometric } from "@capgo/capacitor-native-biometric";
import type { HostTokenRecord } from "~/composables/useSecureHostTokens";
import type { SecureConnectionStateRecord } from "~/utils/or3/secure-connections";

const NATIVE_TOKEN_SERVER = "or3.app.host-tokens";
const NATIVE_TOKEN_USERNAME = "host-token-map";
const NATIVE_SECURE_CONNECTION_SERVER = "or3.app.secure-connections";
const NATIVE_SECURE_CONNECTION_USERNAME = "secure-connections-v1";
const NATIVE_SECURE_CONNECTION_MARKER = "or3-app:v1:secure-connections-marker";

type NativeBiometricPlugin = {
  setCredentials?: (options: {
    server: string;
    username: string;
    password: string;
  }) => Promise<void>;
  getCredentials?: (options: {
    server: string;
  }) => Promise<{ username?: string; password?: string }>;
  deleteCredentials?: (options: { server: string }) => Promise<void>;
};

function getNativeBiometricPlugin(): NativeBiometricPlugin | null {
  if (typeof window === "undefined" || !Capacitor.isNativePlatform())
    return null;
  return NativeBiometric as NativeBiometricPlugin;
}

export function getNativeSecureStorageMode() {
  if (typeof window === "undefined") return "browser-fallback" as const;
  if (!Capacitor.isNativePlatform()) return "browser-fallback" as const;
  return getNativeBiometricPlugin()
    ? ("native-secure" as const)
    : ("native-plugin-missing" as const);
}

export function getNativeSecureStorageSignals() {
  const mode = getNativeSecureStorageMode();
  return {
    mode,
    nativePlatform:
      typeof window !== "undefined" && Capacitor.isNativePlatform(),
    pluginAvailable: Boolean(getNativeBiometricPlugin()),
    debugBuild:
      typeof import.meta !== "undefined" &&
      Boolean((import.meta as ImportMeta & { dev?: boolean }).dev),
  };
}

export async function readHostTokensFromNativeStorage() {
  const plugin = getNativeBiometricPlugin();
  if (!plugin?.getCredentials) return {} as Record<string, HostTokenRecord>;
  try {
    const credentials = await plugin.getCredentials({
      server: NATIVE_TOKEN_SERVER,
    });
    if (!credentials?.password) return {} as Record<string, HostTokenRecord>;
    return JSON.parse(credentials.password) as Record<string, HostTokenRecord>;
  } catch {
    return {} as Record<string, HostTokenRecord>;
  }
}

export async function writeHostTokensToNativeStorage(
  tokens: Record<string, HostTokenRecord>,
) {
  const plugin = getNativeBiometricPlugin();
  if (!plugin?.setCredentials) return;
  const hasTokens = Object.values(tokens).some(
    (value) => value?.pairedToken || value?.sessionToken,
  );
  if (!hasTokens) {
    await deleteHostTokensFromNativeStorage();
    return;
  }
  try {
    await plugin.setCredentials({
      server: NATIVE_TOKEN_SERVER,
      username: NATIVE_TOKEN_USERNAME,
      password: JSON.stringify(tokens),
    });
  } catch (error) {
    console.warn('[secure-storage] Failed to write host tokens:', error);
  }
}

export async function deleteHostTokensFromNativeStorage() {
  const plugin = getNativeBiometricPlugin();
  if (!plugin?.deleteCredentials) return;
  try {
    await plugin.deleteCredentials({ server: NATIVE_TOKEN_SERVER });
  } catch (error) {
    console.warn('[secure-storage] Failed to delete host tokens:', error);
  }
}

export async function readSecureConnectionStateFromNativeStorage() {
  const plugin = getNativeBiometricPlugin();
  if (!plugin?.getCredentials)
    return null as SecureConnectionStateRecord | null;
  try {
    const credentials = await plugin.getCredentials({
      server: NATIVE_SECURE_CONNECTION_SERVER,
    });
    if (!credentials?.password) return null;
    const parsed = JSON.parse(
      credentials.password,
    ) as SecureConnectionStateRecord;
    if (
      typeof localStorage !== "undefined" &&
      !localStorage.getItem(NATIVE_SECURE_CONNECTION_MARKER)
    ) {
      localStorage.setItem(NATIVE_SECURE_CONNECTION_MARKER, String(Date.now()));
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function writeSecureConnectionStateToNativeStorage(
  state: SecureConnectionStateRecord,
) {
  const plugin = getNativeBiometricPlugin();
  if (!plugin?.setCredentials) return;
  try {
    await plugin.setCredentials({
      server: NATIVE_SECURE_CONNECTION_SERVER,
      username: NATIVE_SECURE_CONNECTION_USERNAME,
      password: JSON.stringify(state),
    });
  } catch (error) {
    console.warn('[secure-storage] Failed to write secure connection state:', error);
  }
  if (typeof localStorage !== "undefined")
    localStorage.setItem(NATIVE_SECURE_CONNECTION_MARKER, String(Date.now()));
}

export async function deleteSecureConnectionStateFromNativeStorage() {
  const plugin = getNativeBiometricPlugin();
  if (!plugin?.deleteCredentials) return;
  try {
    await plugin.deleteCredentials({ server: NATIVE_SECURE_CONNECTION_SERVER });
  } catch (error) {
    console.warn('[secure-storage] Failed to delete secure connection state:', error);
  }
  if (typeof localStorage !== "undefined")
    localStorage.removeItem(NATIVE_SECURE_CONNECTION_MARKER);
}
