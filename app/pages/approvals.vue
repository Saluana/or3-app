<template>
    <AppShell
        desktop-title="Approvals"
        desktop-subtitle="Review and resolve pending requests from your computer."
    >
        <template #sidebar>
            <ComputerSidebar />
        </template>
        <AppHeader subtitle="APPROVALS" />
        <ApprovalsPanel />
    </AppShell>
</template>

<script setup lang="ts">
</script>
