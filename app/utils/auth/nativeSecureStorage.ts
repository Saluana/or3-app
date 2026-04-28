import { Capacitor } from '@capacitor/core'
import type { HostTokenRecord } from '~/composables/useSecureHostTokens'

const NATIVE_TOKEN_SERVER = 'or3.app.host-tokens'
const NATIVE_TOKEN_USERNAME = 'host-token-map'

type NativeBiometricPlugin = {
  setCredentials?: (options: { server: string; username: string; password: string }) => Promise<void>
  getCredentials?: (options: { server: string }) => Promise<{ username?: string; password?: string }>
  deleteCredentials?: (options: { server: string }) => Promise<void>
}

function getNativeBiometricPlugin(): NativeBiometricPlugin | null {
  if (!import.meta.client || !Capacitor.isNativePlatform()) return null
  const plugin = ((globalThis as Record<string, unknown>).Capacitor as { Plugins?: Record<string, unknown> } | undefined)?.Plugins?.NativeBiometric as NativeBiometricPlugin | undefined
  return plugin || ((globalThis as Record<string, unknown>).NativeBiometric as NativeBiometricPlugin | undefined) || null
}

export function getNativeSecureStorageMode() {
  if (!import.meta.client) return 'browser-fallback' as const
  if (!Capacitor.isNativePlatform()) return 'browser-fallback' as const
  return getNativeBiometricPlugin() ? 'native-secure' as const : 'native-plugin-missing' as const
}

export async function readHostTokensFromNativeStorage() {
  const plugin = getNativeBiometricPlugin()
  if (!plugin?.getCredentials) return {} as Record<string, HostTokenRecord>
  try {
    const credentials = await plugin.getCredentials({ server: NATIVE_TOKEN_SERVER })
    if (!credentials?.password) return {} as Record<string, HostTokenRecord>
    return JSON.parse(credentials.password) as Record<string, HostTokenRecord>
  } catch {
    return {} as Record<string, HostTokenRecord>
  }
}

export async function writeHostTokensToNativeStorage(tokens: Record<string, HostTokenRecord>) {
  const plugin = getNativeBiometricPlugin()
  if (!plugin?.setCredentials) return
  const hasTokens = Object.values(tokens).some((value) => value?.pairedToken || value?.sessionToken)
  if (!hasTokens) {
    await deleteHostTokensFromNativeStorage()
    return
  }
  await plugin.setCredentials({
    server: NATIVE_TOKEN_SERVER,
    username: NATIVE_TOKEN_USERNAME,
    password: JSON.stringify(tokens),
  }).catch(() => undefined)
}

export async function deleteHostTokensFromNativeStorage() {
  const plugin = getNativeBiometricPlugin()
  if (!plugin?.deleteCredentials) return
  await plugin.deleteCredentials({ server: NATIVE_TOKEN_SERVER }).catch(() => undefined)
}
