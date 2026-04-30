import type { CapacitorConfig } from '@capacitor/cli'
import { KeyboardResize } from '@capacitor/keyboard'

const passkeyDomain = process.env.OR3_PASSKEY_DOMAIN || 'or3.chat'

const config: CapacitorConfig = {
  appId: 'com.or3.app',
  appName: 'or3-app',
  webDir: '.output/public',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https'
  },
  plugins: {
    Keyboard: {
      resize: KeyboardResize.Native,
      resizeOnFullScreen: true,
    },
    Or3Auth: {
      passkeyDomain,
      associatedDomains: [`applinks:${passkeyDomain}`, `webcredentials:${passkeyDomain}`],
    },
  },
}

export default config