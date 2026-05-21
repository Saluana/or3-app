// https://nuxt.com/docs/api/configuration/nuxt-config
const nuxtUiClientIcons = [
    'lucide:arrow-down',
    'lucide:arrow-left',
    'lucide:arrow-right',
    'lucide:arrow-up',
    'lucide:arrow-up-right',
    'lucide:check',
    'lucide:chevron-down',
    'lucide:chevron-left',
    'lucide:chevron-right',
    'lucide:chevron-up',
    'lucide:chevrons-left',
    'lucide:chevrons-right',
    'lucide:circle-alert',
    'lucide:circle-check',
    'lucide:circle-x',
    'lucide:copy',
    'lucide:copy-check',
    'lucide:ellipsis',
    'lucide:eye',
    'lucide:eye-off',
    'lucide:file',
    'lucide:folder',
    'lucide:folder-open',
    'lucide:grip-vertical',
    'lucide:hash',
    'lucide:info',
    'lucide:lightbulb',
    'lucide:loader-circle',
    'lucide:menu',
    'lucide:minus',
    'lucide:monitor',
    'lucide:moon',
    'lucide:panel-left-close',
    'lucide:panel-left-open',
    'lucide:plus',
    'lucide:plug',
    'lucide:rotate-ccw',
    'lucide:search',
    'lucide:square',
    'lucide:sun',
    'lucide:triangle-alert',
    'lucide:upload',
    'lucide:x',
];

const appClientIcons = [
    'mdi:code-tags',
    'mdi:format-bold',
    'mdi:format-header-2',
    'mdi:format-italic',
    'mdi:format-list-bulleted',
    'mdi:format-list-numbered',
    'mdi:information-symbol',
    'mdi:minus',
    'gridicons:bold',
    'gridicons:heading',
    'gridicons:heading-h1',
    'gridicons:heading-h2',
    'gridicons:heading-h3',
    'gridicons:heading-h4',
    'gridicons:italic',
];

export default defineNuxtConfig({
    compatibilityDate: '2025-07-15',
    devtools: { enabled: false },
    ssr: false,
    experimental: {
        defaults: {
            nuxtLink: {
                prefetch: false,
            },
        },
    },

    modules: ['@nuxt/ui', '@nuxt/icon', '@nuxt/fonts'],

    css: ['or3-scroll/style.css', '~/assets/css/main.css'],

    icon: {
        provider: 'none',
        clientBundle: {
            scan: {
                globInclude: [
                    'app/**/*.{vue,ts}',
                    'node_modules/@nuxt/ui/dist/**/*.{js,mjs}',
                ],
            },
            icons: [
                'pixelarticons:scan-barcode',
                'tabler:activity-heartbeat',
                ...appClientIcons,
                ...nuxtUiClientIcons,
            ],
        },
    },

    components: [{ path: '~/components', pathPrefix: false }],

    vite: {
        optimizeDeps: {
            include: [
                '@capacitor/core',
                '@capacitor/keyboard',
                '@capgo/capacitor-native-biometric',
                '@noble/ciphers/aes.js',
                '@noble/hashes/pbkdf2.js',
                '@noble/hashes/sha2.js',
                '@tiptap/core',
                '@tiptap/extension-document',
                '@tiptap/extension-hard-break',
                '@tiptap/extension-mention',
                '@tiptap/extension-paragraph',
                '@tiptap/extension-placeholder',
                '@tiptap/extension-text',
                '@tiptap/pm/state',
                '@tiptap/starter-kit',
                '@tiptap/suggestion',
                '@tiptap/vue-3',
                '@capacitor-mlkit/barcode-scanning',
                'jsqr',
                'or3-scroll',
                'streamdown-vue',
            ],
        },
    },

    app: {
        head: {
            title: 'or3-app',
            meta: [
                {
                    name: 'viewport',
                    content:
                        'width=device-width, initial-scale=1, viewport-fit=cover',
                },
                { name: 'theme-color', content: '#F7F3EA' },
                {
                    'http-equiv': 'Content-Security-Policy',
                    content:
                        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' http: https: ws: wss:; worker-src 'self' blob:; object-src 'none'; base-uri 'none'",
                },
            ],
        },
    },

    fonts: {
        processCSSVariables: true,
        families: [
            { name: 'Press Start 2P', provider: 'google' },
            { name: 'IBM Plex Sans', provider: 'google' },
            { name: 'IBM Plex Serif', provider: 'google' },
        ],
    },
});
