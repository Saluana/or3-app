<template>
  <UApp>
    <NuxtRouteAnnouncer />

    <main class="min-h-screen bg-neutral-950 text-white">
      <div class="mx-auto flex min-h-screen max-w-5xl flex-col justify-center gap-8 px-6 py-16">
        <div class="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80">
          <Icon name="i-lucide-smartphone" class="size-4" />
          Nuxt 4 + Capacitor starter
        </div>

        <div class="space-y-4">
          <h1 class="text-4xl font-semibold tracking-tight sm:text-6xl">
            Ship one app to web, iOS, and Android.
          </h1>
          <p class="max-w-2xl text-lg leading-8 text-white/70">
            This starter is configured with Nuxt UI, Nuxt Icon, Nuxt Fonts, and Capacitor so you can build a polished mobile-friendly app from day one.
          </p>
        </div>

        <div class="flex flex-wrap gap-3">
          <UButton label="Run dev server" icon="i-lucide-play" to="https://nuxt.com" target="_blank" />
          <UButton label="Capacitor docs" icon="i-lucide-book-open" color="neutral" variant="subtle" to="https://capacitorjs.com/docs" target="_blank" />
        </div>

        <div class="grid gap-4 md:grid-cols-3">
          <UCard>
            <template #header>
              <div class="flex items-center gap-2 font-medium">
                <Icon name="i-lucide-layers-3" class="size-5 text-primary" />
                Nuxt UI
              </div>
            </template>
            <p class="text-sm leading-6 text-neutral-300">
              Ready-to-use app shell components, buttons, cards, and theming.
            </p>
          </UCard>

          <UCard>
            <template #header>
              <div class="flex items-center gap-2 font-medium">
                <Icon name="i-lucide-image" class="size-5 text-primary" />
                Nuxt Icon
              </div>
            </template>
            <p class="text-sm leading-6 text-neutral-300">
              Iconify-powered icons available directly in your Vue templates.
            </p>
          </UCard>

          <UCard>
            <template #header>
              <div class="flex items-center gap-2 font-medium">
                <Icon name="i-lucide-type" class="size-5 text-primary" />
                Nuxt Fonts
              </div>
            </template>
            <p class="text-sm leading-6 text-neutral-300">
              Automatic font loading and optimization using the Inter family.
            </p>
          </UCard>
        </div>
      </div>
    </main>
  </UApp>
</template>
