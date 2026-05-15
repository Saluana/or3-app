<template>
  <AppShell
    desktop-title="Files"
    desktop-subtitle="Browse and manage workspace files on your computer."
  >
    <template #sidebar>
      <ComputerSidebar />
    </template>
    <AppHeader subtitle="MEMORIES & FILES" />
    <FileBrowser />
  </AppShell>
</template>
