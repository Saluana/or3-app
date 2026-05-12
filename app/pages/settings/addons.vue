<template>
    <AppShell>
        <AppHeader subtitle="ADD-ONS" />

        <div class="space-y-4">
            <SurfaceCard class-name="space-y-3">
                <button
                    type="button"
                    class="inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-medium text-(--or3-green) transition hover:bg-(--or3-green-soft)"
                    @click="$router.push('/settings')"
                >
                    <Icon name="i-pixelarticons-chevron-left" class="size-4" />
                    Settings
                </button>
                <div class="flex flex-col items-start gap-3">
                    <div class="flex">
                        <RetroIcon
                            name="pixelarticons:add-grid"
                            size="sm"
                            class="mr-3"
                        />
                        <div class="min-w-0 flex-1">
                            <p
                                class="font-mono text-base font-semibold text-(--or3-text)"
                            >
                                MCP add-ons
                            </p>
                            <p
                                class="mt-1 text-sm leading-6 text-(--or3-text-muted)"
                            >
                                Connect Model Context Protocol servers to add
                                external tools. Save changes, then restart
                                or3-intern for them to become active.
                            </p>
                        </div>
                    </div>
                    <UButton
                        class="w-full mt-3"
                        size="sm"
                        color="primary"
                        icon="i-pixelarticons-plus"
                        label="Add server"
                        @click="startNewServer"
                    />
                </div>
                <StatusPill
                    v-if="mcpRestartRequired"
                    label="Restart required"
                    tone="amber"
                />
            </SurfaceCard>

            <p
                v-if="mcpLoading && !mcpServers.length"
                class="text-center font-mono text-xs text-(--or3-text-muted)"
            >
                Loading add-ons...
            </p>

            <SurfaceCard v-if="mcpError" tone="danger" class-name="space-y-2">
                <p class="font-mono text-sm font-semibold text-red-900">
                    Could not manage MCP add-ons
                </p>
                <p class="text-xs leading-5 text-red-800">{{ mcpError }}</p>
            </SurfaceCard>

            <div
                class="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
            >
                <div class="space-y-3">
                    <SurfaceCard
                        v-for="server in mcpServers"
                        :key="server.name"
                        class-name="space-y-3 transition hover:bg-(--or3-green-soft)"
                    >
                        <button
                            type="button"
                            class="block w-full text-left"
                            @click="selectServer(server)"
                        >
                            <div class="flex items-start justify-between gap-3">
                                <div class="min-w-0 flex-1">
                                    <p
                                        class="font-mono text-sm font-semibold text-(--or3-text)"
                                    >
                                        {{ server.name }}
                                    </p>
                                    <p
                                        class="mt-0.5 break-all text-xs text-(--or3-text-muted)"
                                    >
                                        {{ server.config.transport }}
                                        <span
                                            v-if="
                                                server.config.transport ===
                                                'stdio'
                                            "
                                        >
                                            ·
                                            {{
                                                server.config.command ||
                                                'no command'
                                            }}</span
                                        >
                                        <span v-else>
                                            ·
                                            {{
                                                server.config.url || 'no URL'
                                            }}</span
                                        >
                                    </p>
                                </div>
                                <div
                                    class="flex shrink-0 flex-col items-end gap-1"
                                >
                                    <StatusPill
                                        :label="
                                            server.config.enabled
                                                ? 'enabled'
                                                : 'disabled'
                                        "
                                        :tone="
                                            server.config.enabled
                                                ? 'green'
                                                : 'neutral'
                                        "
                                    />
                                    <StatusPill
                                        :label="
                                            server.status?.connected
                                                ? `${server.status.toolCount || 0} tools`
                                                : statusLabel(server)
                                        "
                                        :tone="statusTone(server)"
                                    />
                                </div>
                            </div>
                        </button>

                        <div
                            v-if="server.status?.lastError"
                            class="rounded-xl border border-red-200 bg-red-50/70 p-3 text-xs leading-5 text-red-800"
                        >
                            {{ server.status.lastError }}
                        </div>

                        <div class="flex flex-wrap justify-end gap-2">
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
                    </SurfaceCard>

                    <EmptyState
                        v-if="!mcpLoading && !mcpServers.length"
                        icon="i-pixelarticons-puzzle"
                        title="No MCP add-ons yet"
                        description="Add a stdio, SSE, or streamable HTTP MCP server to expose more tools."
                    />
                </div>

                <SurfaceCard class-name="space-y-4">
                    <div class="flex items-start justify-between gap-3">
                        <div>
                            <p
                                class="font-mono text-sm font-semibold text-(--or3-text)"
                            >
                                {{
                                    selectedExistingName
                                        ? 'Edit MCP server'
                                        : 'Add MCP server'
                                }}
                            </p>
                            <p
                                class="mt-0.5 text-xs leading-5 text-(--or3-text-muted)"
                            >
                                Keep it simple: pick a transport, fill in the
                                required endpoint, then save.
                            </p>
                        </div>
                        <StatusPill
                            v-if="testResult"
                            :label="
                                testResult.ok
                                    ? `Test passed (${testResult.toolCount || 0} tools)`
                                    : 'Test failed'
                            "
                            :tone="testResult.ok ? 'green' : 'danger'"
                        />
                    </div>

                    <div
                        v-if="testResult?.error"
                        class="rounded-xl border border-red-200 bg-red-50/70 p-3 text-xs leading-5 text-red-800"
                    >
                        {{ testResult.error }}
                    </div>

                    <div class="grid gap-3 sm:grid-cols-2">
                        <label class="space-y-1">
                            <span class="font-mono text-xs text-(--or3-text)"
                                >Name</span
                            >
                            <UInput
                                v-model="form.name"
                                :disabled="Boolean(selectedExistingName)"
                                placeholder="filesystem"
                            />
                        </label>

                        <label class="space-y-1">
                            <span class="font-mono text-xs text-(--or3-text)"
                                >Transport</span
                            >
                            <select
                                v-model="form.transport"
                                class="h-10 w-full rounded-xl border border-(--or3-border) bg-white px-3 text-sm text-(--or3-text)"
                            >
                                <option value="stdio">stdio command</option>
                                <option value="sse">SSE URL</option>
                                <option value="streamable-http">
                                    Streamable HTTP URL
                                </option>
                            </select>
                        </label>
                    </div>

                    <label
                        class="flex items-center justify-between gap-3 rounded-xl border border-(--or3-border) bg-white/70 p-3"
                    >
                        <span>
                            <span
                                class="block font-mono text-xs text-(--or3-text)"
                                >Enabled</span
                            >
                            <span class="block text-xs text-(--or3-text-muted)"
                                >Disabled servers stay saved but do not expose
                                tools.</span
                            >
                        </span>
                        <USwitch v-model="form.enabled" />
                    </label>

                    <div
                        v-if="form.transport === 'stdio'"
                        class="grid gap-3 sm:grid-cols-2"
                    >
                        <label class="space-y-1">
                            <span class="font-mono text-xs text-(--or3-text)"
                                >Command</span
                            >
                            <UInput v-model="form.command" placeholder="npx" />
                        </label>
                        <label class="space-y-1">
                            <span class="font-mono text-xs text-(--or3-text)"
                                >Arguments</span
                            >
                            <UInput
                                v-model="form.args"
                                placeholder="-y @modelcontextprotocol/server-filesystem ."
                            />
                        </label>
                        <label class="space-y-1 sm:col-span-2">
                            <span class="font-mono text-xs text-(--or3-text)"
                                >Child environment allowlist</span
                            >
                            <UInput
                                v-model="form.childEnvAllowlist"
                                placeholder="PATH,HOME"
                            />
                        </label>
                    </div>

                    <div v-else class="space-y-3">
                        <label class="space-y-1">
                            <span class="font-mono text-xs text-(--or3-text)"
                                >URL</span
                            >
                            <UInput
                                v-model="form.url"
                                placeholder="http://127.0.0.1:3000/mcp"
                            />
                        </label>
                        <label
                            class="flex items-center justify-between gap-3 rounded-xl border border-(--or3-border) bg-white/70 p-3"
                        >
                            <span>
                                <span
                                    class="block font-mono text-xs text-(--or3-text)"
                                    >Allow insecure HTTP</span
                                >
                                <span
                                    class="block text-xs text-(--or3-text-muted)"
                                    >Only loopback or localhost HTTP endpoints
                                    are accepted.</span
                                >
                            </span>
                            <USwitch v-model="form.allowInsecureHttp" />
                        </label>
                    </div>

                    <div class="grid gap-3 sm:grid-cols-2">
                        <label class="space-y-1">
                            <span class="font-mono text-xs text-(--or3-text)"
                                >Environment</span
                            >
                            <UTextarea
                                v-model="form.env"
                                :rows="4"
                                placeholder="TOKEN=..."
                            />
                        </label>
                        <label class="space-y-1">
                            <span class="font-mono text-xs text-(--or3-text)"
                                >Headers</span
                            >
                            <UTextarea
                                v-model="form.headers"
                                :rows="4"
                                placeholder="Authorization=Bearer ..."
                            />
                        </label>
                    </div>

                    <div class="grid gap-3 sm:grid-cols-2">
                        <label class="space-y-1">
                            <span class="font-mono text-xs text-(--or3-text)"
                                >Connect timeout seconds</span
                            >
                            <UInput
                                v-model="form.connectTimeoutSeconds"
                                type="number"
                                min="1"
                                placeholder="10"
                            />
                        </label>
                        <label class="space-y-1">
                            <span class="font-mono text-xs text-(--or3-text)"
                                >Tool timeout seconds</span
                            >
                            <UInput
                                v-model="form.toolTimeoutSeconds"
                                type="number"
                                min="1"
                                placeholder="30"
                            />
                        </label>
                    </div>

                    <div class="flex flex-wrap justify-end gap-2">
                        <UButton
                            v-if="selectedExistingName"
                            variant="soft"
                            icon="i-pixelarticons-search"
                            label="Test saved config"
                            :loading="Boolean(mcpTesting[selectedExistingName])"
                            @click="runTest(selectedExistingName)"
                        />
                        <UButton
                            color="primary"
                            icon="i-pixelarticons-save"
                            label="Save add-on"
                            :loading="Boolean(mcpSaving[form.name])"
                            @click="saveCurrent"
                        />
                    </div>
                </SurfaceCard>
            </div>
        </div>
    </AppShell>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useMCP } from '~/composables/useMCP';
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

const selectedExistingName = ref('');
const testResult = ref<MCPServerTestResult | null>(null);

const form = reactive({
    name: '',
    enabled: true,
    transport: 'stdio',
    command: '',
    args: '',
    childEnvAllowlist: '',
    url: '',
    allowInsecureHttp: false,
    env: '',
    headers: '',
    connectTimeoutSeconds: '10',
    toolTimeoutSeconds: '30',
});

function mapToText(values?: Record<string, string>) {
    return Object.entries(values ?? {})
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
}

function textToMap(value: string) {
    const out: Record<string, string> = {};
    for (const raw of value.split(/[\n,]/)) {
        const line = raw.trim();
        if (!line) continue;
        const [key, rest] = line.split(/=(.*)/s);
        if (key?.trim()) out[key.trim()] = (rest ?? '').trim();
    }
    return out;
}

function resetForm(config?: MCPServerConfig, name = '') {
    selectedExistingName.value = name;
    testResult.value = null;
    form.name = name;
    form.enabled = config?.enabled ?? true;
    form.transport = config?.transport || 'stdio';
    form.command = config?.command || '';
    form.args = (config?.args ?? []).join(' ');
    form.childEnvAllowlist = (config?.childEnvAllowlist ?? []).join(',');
    form.url = config?.url || '';
    form.allowInsecureHttp = Boolean(config?.allowInsecureHttp);
    form.env = mapToText(config?.env);
    form.headers = mapToText(config?.headers);
    form.connectTimeoutSeconds = String(config?.connectTimeoutSeconds || 10);
    form.toolTimeoutSeconds = String(config?.toolTimeoutSeconds || 30);
}

function selectServer(server: MCPServerDetail) {
    resetForm(server.config, server.name);
}

function startNewServer() {
    resetForm();
}

function buildConfig(): MCPServerConfig {
    const transport = form.transport || 'stdio';
    return {
        enabled: form.enabled,
        transport,
        command: transport === 'stdio' ? form.command.trim() : '',
        args:
            transport === 'stdio'
                ? form.args
                      .split(/\s+/)
                      .map((part) => part.trim())
                      .filter(Boolean)
                : [],
        childEnvAllowlist:
            transport === 'stdio'
                ? form.childEnvAllowlist
                      .split(',')
                      .map((part) => part.trim())
                      .filter(Boolean)
                : [],
        url: transport === 'stdio' ? '' : form.url.trim(),
        allowInsecureHttp: transport !== 'stdio' && form.allowInsecureHttp,
        env: textToMap(form.env),
        headers: textToMap(form.headers),
        connectTimeoutSeconds: Number(form.connectTimeoutSeconds) || 10,
        toolTimeoutSeconds: Number(form.toolTimeoutSeconds) || 30,
    };
}

async function saveCurrent() {
    const name = form.name.trim();
    if (!name) return;
    await saveMCPServer(name, buildConfig());
    selectedExistingName.value = name;
}

async function removeServer(name: string) {
    if (!window.confirm(`Remove MCP server "${name}"?`)) return;
    await deleteMCPServer(name);
    if (selectedExistingName.value === name) startNewServer();
}

async function runTest(name: string) {
    testResult.value = await testMCPServer(name);
}

function statusLabel(server: MCPServerDetail) {
    if (!server.config.enabled) return 'disabled';
    if (server.status?.lastError) return 'error';
    return 'not connected';
}

function statusTone(server: MCPServerDetail) {
    if (!server.config.enabled) return 'neutral';
    if (server.status?.connected) return 'green';
    if (server.status?.lastError) return 'danger';
    return 'amber';
}

onMounted(async () => {
    await loadMCPServers();
    if (mcpServers.value[0]) selectServer(mcpServers.value[0]);
    else startNewServer();
});
</script>
