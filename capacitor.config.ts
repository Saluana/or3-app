import type { CapacitorConfig } from '@capacitor/cli'

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
    Or3Auth: {
      passkeyDomain,
      associatedDomains: [`applinks:${passkeyDomain}`, `webcredentials:${passkeyDomain}`],
    },
  },
}

export default config