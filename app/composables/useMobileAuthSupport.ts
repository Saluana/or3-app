import { computed, ref } from 'vue'
import { Capacitor } from '@capacitor/core'
import { getWebAuthnCapabilities } from '~/utils/auth/webauthn'
import { getNativeSecureStorageMode } from '~/utils/auth/nativeSecureStorage'

const supportState = ref({
  checked: false,
  nativePlatform: false,
  webAuthnSupported: false,
  platformAuthenticatorAvailable: false,
  conditionalMediationAvailable: false,
  secureStorageMode: 'browser-fallback' as 'browser-fallback' | 'native-secure' | 'native-plugin-missing',
})

export function useMobileAuthSupport() {
  async function refreshSupport() {
    const webauthn = await getWebAuthnCapabilities()
    supportState.value = {
      checked: true,
      nativePlatform: import.meta.client ? Capacitor.isNativePlatform() : false,
      webAuthnSupported: webauthn.supported,
      platformAuthenticatorAvailable: webauthn.platformAuthenticatorAvailable,
      conditionalMediationAvailable: webauthn.conditionalMediationAvailable,
      secureStorageMode: getNativeSecureStorageMode(),
    }
    return supportState.value
  }

  const degradedState = computed(() => {
    if (!supportState.value.checked) return null
    if (supportState.value.nativePlatform && supportState.value.secureStorageMode !== 'native-secure') {
      return {
        tone: 'caution',
        title: 'Native secure storage still needs a plugin',
        message: 'This mobile build can run, but token storage is falling back until a NativeBiometric-compatible secure storage plugin is present.',
      }
    }
    if (!supportState.value.webAuthnSupported) {
      return {
        tone: 'caution',
        title: 'Passkeys are unavailable here',
        message: 'This environment does not expose WebAuthn yet, so passkey sign-in and step-up will not work until you switch to a supported browser or native runtime.',
      }
    }
    if (!supportState.value.nativePlatform) {
      return {
        tone: 'info',
        title: 'Browser fallback mode',
        message: 'This browser build keeps compatibility features on, but native secure storage is only available in the mobile app runtime.',
      }
    }
    return null
  })

  return {
    support: computed(() => supportState.value),
    degradedState,
    refreshSupport,
  }
}
