import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.or3.app',
  appName: 'or3-app',
  webDir: '.output/public',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https'
  }
}

export default config