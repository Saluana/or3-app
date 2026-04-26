// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  ssr: false,

  modules: [
    '@nuxt/ui',
    '@nuxt/icon',
    '@nuxt/fonts'
  ],

  css: ['~/assets/css/main.css'],

  app: {
    head: {
      title: 'or3-app',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#F7F3EA' }
      ]
    }
  },

  fonts: {
    families: [
      { name: 'Inter', provider: 'google' }
    ]
  }
})