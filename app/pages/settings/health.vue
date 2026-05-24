<template>
    <AppShell desktop-flush>
        <template #sidebar><SettingsSidebar /></template>

        <!-- Mobile body (default slot): full-height chat shell -->
        <SettingsHealthChat />

        <!-- Desktop body: same chat shell inside desktop workspace pane -->
        <template #desktop>
            <div class="or3-doctor-desktop">
                <SettingsHealthChat desktop />
            </div>
        </template>
    </AppShell>
</template>

<script setup lang="ts">
import SettingsHealthChat from '~/components/settings/SettingsHealthChat.vue';
</script>

<style>
.or3-doctor-desktop {
    position: relative;
    height: 100%;
    min-height: 0;
    width: 100%;
}

/* On desktop, scope the chat shell inside the workspace pane so it does not
   cover the desktop sidebar/header. */
@media (min-width: 1024px) {
    .or3-doctor-desktop .or3-chat-shell {
        position: absolute;
        inset: 0;
        height: 100%;
    }

    .or3-doctor-desktop .or3-chat-shell__header {
        padding: 1rem 1.5rem 0.75rem;
    }

    .or3-doctor-desktop .or3-chat-shell__body {
        padding: 0 1.5rem;
    }

    .or3-doctor-desktop .or3-chat-shell__content {
        padding-bottom: 8.5rem;
    }

    .or3-doctor-desktop .or3-chat-shell__content--virtualized {
        padding-bottom: 0;
    }

    .or3-doctor-desktop .or3-chat-shell__composer {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 1rem;
        padding: 0 1.5rem;
    }
}
</style>
