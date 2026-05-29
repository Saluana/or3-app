<template>
    <AppShell
        desktop-title="Settings"
        desktop-subtitle="Grouped controls for models, memory, workspace, and more."
    >
        <template #sidebar><SettingsSidebar /></template>
        <AppHeader subtitle="ADVANCED SETTINGS" />

        <AdvancedSettingsHome />
    </AppShell>
</template>
