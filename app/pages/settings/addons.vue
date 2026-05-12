<template>
    <AppShell>
        <AppHeader subtitle="ADD-ONS" />

        <div class="space-y-4">
            <!-- Back + intro -->
            <SurfaceCard class-name="space-y-3">
                <button
                    type="button"
                    class="inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-medium text-(--or3-green) transition hover:bg-(--or3-green-soft)"
                    @click="$router.push('/settings')"
                >
                    <Icon name="i-pixelarticons-chevron-left" class="size-4" />
                    Settings
                </button>
                <div class="flex items-start gap-3">
                    <RetroIcon
                        name="pixelarticons:add-grid"
                        size="sm"
                        class="mt-0.5 shrink-0"
                    />
                    <div class="min-w-0 flex-1">
                        <p
                            class="font-mono text-base font-semibold text-(--or3-text)"
                        >
                            Add-ons (MCP)
                        </p>
                        <p
                            class="mt-1 text-sm leading-6 text-(--or3-text-muted)"
                        >
                            Give your AI new abilities by connecting MCP
                            servers. Add-ons let your AI read files, control
                            smart home devices, access databases, and more.
                        </p>
                    </div>
                </div>
                <StatusPill
                    v-if="mcpRestartRequired"
                    label="Restart or3-intern to activate changes"
                    tone="amber"
                />
            </SurfaceCard>

            <!-- Loading -->
            <p
                v-if="mcpLoading && !mcpServers.length"
                class="text-center font-mono text-xs text-(--or3-text-muted)"
            >
                Loading add-ons...
            </p>

            <!-- Error -->
            <SurfaceCard v-if="mcpError" tone="danger" class-name="space-y-2">
                <p class="font-mono text-sm font-semibold text-red-900">
                    Could not load add-ons
                </p>
                <p class="text-xs leading-5 text-red-800">{{ mcpError }}</p>
            </SurfaceCard>

            <!-- Server cards -->
            <div class="space-y-3">
                <SurfaceCard
                    v-for="server in mcpServers"
                    :key="server.name"
                    class-name="space-y-3"
                >
                    <div class="flex items-start justify-between gap-3">
                        <button
                            type="button"
                            class="min-w-0 flex-1 text-left"
                            @click="openEditSheet(server)"
                        >
                            <div class="flex items-center gap-2">
                                <Icon
                                    :name="
                                        server.config.transport === 'stdio'
                                            ? 'i-pixelarticons-terminal'
                                            : 'i-pixelarticons-link'
                                    "
                                    class="size-4 shrink-0 text-(--or3-text-muted)"
                                />
                                <p
                                    class="truncate font-mono text-sm font-semibold text-(--or3-text)"
                                >
                                    {{ server.name }}
                                </p>
                            </div>
                            <p class="mt-1 text-xs text-(--or3-text-muted)">
                                <template
                                    v-if="server.config.transport === 'stdio'"
                                >
                                    Program:
                                    <span
                                        class="font-medium text-(--or3-text)"
                                        >{{
                                            server.config.command || 'not set'
                                        }}</span
                                    >
                                </template>
                                <template v-else>
                                    Address:
                                    <span
                                        class="font-medium text-(--or3-text) break-all"
                                        >{{
                                            server.config.url || 'not set'
                                        }}</span
                                    >
                                </template>
                            </p>
                        </button>
                        <div class="flex shrink-0 flex-col items-end gap-1">
                            <StatusPill
                                :label="
                                    server.config.enabled
                                        ? 'Enabled'
                                        : 'Disabled'
                                "
                                :tone="
                                    server.config.enabled ? 'green' : 'neutral'
                                "
                            />
                            <StatusPill
                                :label="connectionLabel(server)"
                                :tone="connectionTone(server)"
                            />
                        </div>
                    </div>

                    <!-- Error banner -->
                    <div
                        v-if="server.status?.lastError"
                        class="rounded-xl border border-red-200 bg-red-50/70 p-3 text-xs leading-5 text-red-800"
                    >
                        {{ server.status.lastError }}
                    </div>

                    <!-- Tool list preview -->
                    <div
                        v-if="
                            server.status?.connected && server.status.toolCount
                        "
                        class="text-xs text-(--or3-text-muted)"
                    >
                        <span class="font-medium text-(--or3-green-dark)">{{
                            server.status.toolCount
                        }}</span>
                        tool{{ server.status.toolCount === 1 ? '' : 's' }}
                        available
                    </div>

                    <!-- Actions -->
                    <div class="flex flex-wrap items-center gap-2">
                        <UButton
                            size="xs"
                            variant="soft"
                            icon="i-pixelarticons-edit"
                            label="Edit"
                            @click="openEditSheet(server)"
                        />
                        <UButton
                            size="xs"
                            variant="soft"
                            icon="i-pixelarticons-search"
                            label="Test"
                            :loading="Boolean(mcpTesting[server.name])"
                            @click="runTest(server.name)"
                        />
                        <UButton
                            size="xs"
                            variant="soft"
                            color="error"
                            icon="i-pixelarticons-trash"
                            label="Remove"
                            :loading="Boolean(mcpSaving[server.name])"
                            @click="removeServer(server.name)"
                        />
                    </div>

                    <!-- Inline test result -->
                    <div
                        v-if="testResults[server.name]"
                        :class="[
                            'rounded-xl border p-3 text-xs leading-5',
                            testResults[server.name]?.ok
                                ? 'border-green-200 bg-green-50/70 text-green-800'
                                : 'border-red-200 bg-red-50/70 text-red-800',
                        ]"
                    >
                        <div class="flex items-center gap-1.5 font-semibold">
                            <Icon
                                :name="
                                    testResults[server.name]?.ok
                                        ? 'i-pixelarticons-check'
                                        : 'i-pixelarticons-close'
                                "
                                class="size-3.5"
                            />
                            {{
                                testResults[server.name]?.ok
                                    ? `Connected — ${testResults[server.name]?.toolCount ?? 0} tool${(testResults[server.name]?.toolCount ?? 0) === 1 ? '' : 's'} found`
                                    : 'Connection failed'
                            }}
                        </div>
                        <p
                            v-if="
                                !testResults[server.name]?.ok &&
                                testResults[server.name]?.error
                            "
                            class="mt-1"
                        >
                            {{ testResults[server.name]?.error }}
                        </p>
                        <ul
                            v-if="
                                testResults[server.name]?.ok &&
                                testResults[server.name]?.tools?.length
                            "
                            class="mt-2 space-y-0.5"
                        >
                            <li
                                v-for="tool in testResults[server.name]!.tools"
                                :key="tool.name"
                                class="flex items-baseline gap-1.5"
                            >
                                <code
                                    class="font-semibold text-(--or3-green-dark)"
                                    >{{ tool.name }}</code
                                >
                                <span
                                    v-if="tool.description"
                                    class="text-(--or3-text-muted)"
                                    >{{ tool.description }}</span
                                >
                            </li>
                        </ul>
                    </div>
                </SurfaceCard>
            </div>

            <!-- Empty state -->
            <SurfaceCard
                v-if="!mcpLoading && !mcpServers.length"
                class-name="text-center py-8"
            >
                <Icon
                    name="i-pixelarticons-puzzle"
                    class="mx-auto size-10 text-(--or3-border-strong)"
                />
                <p
                    class="mt-3 font-mono text-sm font-semibold text-(--or3-text)"
                >
                    No add-ons yet
                </p>
                <p
                    class="mt-1 text-xs leading-5 text-(--or3-text-muted) max-w-xs mx-auto"
                >
                    Add-ons give your AI new tools &mdash; like reading files,
                    managing your calendar, or controlling smart devices.
                </p>
                <UButton
                    class="mt-4"
                    size="sm"
                    color="primary"
                    icon="i-pixelarticons-plus"
                    label="Add your first add-on"
                    @click="openNewSheet"
                />
            </SurfaceCard>

            <!-- Add button (when servers exist) -->
            <UButton
                v-if="mcpServers.length"
                class="w-full"
                size="lg"
                color="primary"
                variant="solid"
                icon="i-pixelarticons-plus"
                label="Add another add-on"
                @click="openNewSheet"
            />
        </div>

        <!-- Form sheet -->
        <McpServerFormSheet
            v-model:open="sheetOpen"
            :server="editingServer"
            @save="onSheetSave"
            @test="onSheetTest"
        />
    </AppShell>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useMCP } from '~/composables/useMCP';
import McpServerFormSheet from '~/components/settings/McpServerFormSheet.vue';
import type {
    MCPServerConfig,
    MCPServerDetail,
    MCPServerTestResult,
} from '~/types/or3-api';

const {
    mcpServers,
    mcpLoading,
    mcpSaving,
    mcpTesting,
    mcpError,
    mcpRestartRequired,
    loadMCPServers,
    saveMCPServer,
    deleteMCPServer,
    testMCPServer,
} = useMCP();

const sheetOpen = ref(false);
const editingServer = ref<MCPServerDetail | null>(null);
const testResults = ref<Record<string, MCPServerTestResult | null>>({});

function openNewSheet() {
    editingServer.value = null;
    sheetOpen.value = true;
}

function openEditSheet(server: MCPServerDetail) {
    editingServer.value = server;
    sheetOpen.value = true;
}

async function onSheetSave(name: string, config: MCPServerConfig) {
    await saveMCPServer(name, config);
    sheetOpen.value = false;
}

async function onSheetTest(name: string) {
    const result = await testMCPServer(name);
    testResults.value[name] = result;
}

async function removeServer(name: string) {
    testResults.value[name] = null;
    await deleteMCPServer(name);
}

async function runTest(name: string) {
    testResults.value[name] = null;
    const result = await testMCPServer(name);
    testResults.value[name] = result;
}

function connectionLabel(server: MCPServerDetail) {
    if (!server.config.enabled) return 'Disabled';
    if (server.status?.connected)
        return `${server.status.toolCount ?? 0} tools`;
    if (server.status?.lastError) return 'Error';
    return 'Not connected';
}

function connectionTone(server: MCPServerDetail) {
    if (!server.config.enabled) return 'neutral';
    if (server.status?.connected) return 'green';
    if (server.status?.lastError) return 'danger';
    return 'amber';
}

onMounted(async () => {
    await loadMCPServers();
});
</script>
