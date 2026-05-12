<template>
    <USlideover
        :open="open"
        :side="side"
        :ui="{ content: contentClass }"
        @update:open="emit('update:open', $event)"
    >
        <template #content>
            <div
                ref="sheetRef"
                class="or3-mcp-sheet"
                :class="side === 'bottom' ? 'is-bottom' : 'is-side'"
            >
                <!-- Drag handle on mobile -->
                <div
                    v-if="side === 'bottom'"
                    ref="handleRef"
                    class="or3-mcp-handle"
                    aria-label="Drag down to close"
                    role="button"
                    tabindex="0"
                >
                    <span />
                </div>

                <!-- Header -->
                <header class="or3-mcp-head">
                    <div class="or3-mcp-head__main">
                        <span class="or3-mcp-head__icon">
                            <Icon
                                name="pixelarticons:add-grid"
                                class="size-5"
                            />
                        </span>
                        <div class="or3-mcp-head__text">
                            <p class="or3-label or3-mcp-head__eyebrow">
                                {{ isEdit ? 'EDIT ADD-ON' : 'NEW ADD-ON' }}
                            </p>
                            <h2 class="or3-mcp-head__title">
                                {{
                                    isEdit
                                        ? 'Update add-on'
                                        : 'Add a new add-on'
                                }}
                            </h2>
                            <p class="or3-mcp-head__subtitle">
                                {{
                                    isEdit
                                        ? 'Change the connection settings for this add-on.'
                                        : 'Give your AI new abilities by connecting an external tool server.'
                                }}
                            </p>
                        </div>
                    </div>
                    <UButton
                        color="neutral"
                        variant="ghost"
                        icon="i-pixelarticons-close"
                        size="sm"
                        square
                        aria-label="Close"
                        class="or3-mcp-head__close"
                        @click="emit('update:open', false)"
                    />
                </header>

                <!-- Body -->
                <div class="or3-mcp-body">
                    <div class="or3-mcp-form">
                        <!-- Name -->
                        <label class="or3-mcp-field sm:col-span-2">
                            <span class="or3-mcp-label">Add-on name</span>
                            <span class="or3-mcp-hint"
                                >A friendly name to identify this
                                connection.</span
                            >
                            <input
                                v-model="form.name"
                                class="or3-mcp-input"
                                :disabled="isEdit"
                                placeholder="My file manager"
                            />
                        </label>

                        <!-- Connection type -->
                        <label class="or3-mcp-field sm:col-span-2">
                            <span class="or3-mcp-label">Connection type</span>
                            <span class="or3-mcp-hint">
                                <template
                                    v-if="form.connectionType === 'local'"
                                >
                                    Runs a program on your computer to provide
                                    tools.
                                </template>
                                <template v-else>
                                    Connects to a remote server over the
                                    internet.
                                </template>
                            </span>
                            <div class="or3-mcp-type-toggle">
                                <button
                                    type="button"
                                    :class="[
                                        'or3-mcp-type-btn',
                                        {
                                            active:
                                                form.connectionType === 'local',
                                        },
                                    ]"
                                    @click="form.connectionType = 'local'"
                                >
                                    <Icon
                                        name="i-pixelarticons-terminal"
                                        class="size-4"
                                    />
                                    <span>Local program</span>
                                </button>
                                <button
                                    type="button"
                                    :class="[
                                        'or3-mcp-type-btn',
                                        {
                                            active:
                                                form.connectionType ===
                                                'remote',
                                        },
                                    ]"
                                    @click="form.connectionType = 'remote'"
                                >
                                    <Icon
                                        name="i-pixelarticons-link"
                                        class="size-4"
                                    />
                                    <span>Remote server</span>
                                </button>
                            </div>
                        </label>

                        <!-- LOCAL: Program to run -->
                        <template v-if="form.connectionType === 'local'">
                            <div class="or3-mcp-field sm:col-span-2">
                                <div class="or3-mcp-label-row">
                                    <label
                                        for="mcp-command"
                                        class="or3-mcp-label"
                                        >Program to run</label
                                    >
                                    <McpInfoHint
                                        text="The command-line program that starts the add-on server. Usually something like npx, node, or a full path to an executable."
                                    />
                                </div>
                                <span class="or3-mcp-hint"
                                    >The command that starts this add-on (e.g.
                                    npx, python, /usr/bin/my-server).</span
                                >
                                <input
                                    id="mcp-command"
                                    v-model="form.command"
                                    class="or3-mcp-input font-mono"
                                    placeholder="npx"
                                />
                            </div>

                            <div class="or3-mcp-field sm:col-span-2">
                                <div class="or3-mcp-label-row">
                                    <label for="mcp-args" class="or3-mcp-label"
                                        >Startup arguments</label
                                    >
                                    <McpInfoHint
                                        text="Extra arguments passed to the program above. Put each argument on the same line separated by spaces, or use multiple lines."
                                    />
                                </div>
                                <span class="or3-mcp-hint"
                                    >Arguments passed to the program, separated
                                    by spaces.</span
                                >
                                <input
                                    id="mcp-args"
                                    v-model="form.args"
                                    class="or3-mcp-input font-mono"
                                    placeholder="-y @modelcontextprotocol/server-filesystem /Users/me"
                                />
                            </div>
                        </template>

                        <!-- REMOTE: Server address -->
                        <template v-else>
                            <div class="or3-mcp-field sm:col-span-2">
                                <div class="or3-mcp-label-row">
                                    <label for="mcp-url" class="or3-mcp-label"
                                        >Server address</label
                                    >
                                    <McpInfoHint
                                        text="The URL where the add-on server is running. It should start with https:// for security."
                                    />
                                </div>
                                <span class="or3-mcp-hint"
                                    >The web address of the add-on server (e.g.
                                    https://my-server.com/mcp).</span
                                >
                                <input
                                    id="mcp-url"
                                    v-model="form.url"
                                    class="or3-mcp-input font-mono"
                                    placeholder="https://my-server.com/mcp"
                                />
                            </div>

                            <div class="or3-mcp-field sm:col-span-2">
                                <div class="or3-mcp-label-row">
                                    <span class="or3-mcp-label"
                                        >Allow unencrypted connection</span
                                    >
                                    <McpInfoHint
                                        text="Only enable this for local development servers at 127.0.0.1 or localhost. Remote servers should always use HTTPS."
                                    />
                                </div>
                                <div class="or3-mcp-toggle-row">
                                    <span
                                        >Allow HTTP (not HTTPS)
                                        connections</span
                                    >
                                    <USwitch v-model="form.allowInsecureHttp" />
                                </div>
                            </div>
                        </template>

                        <!-- Environment variables (both types) -->
                        <div class="or3-mcp-divider sm:col-span-2">
                            <span>Advanced settings</span>
                        </div>

                        <div class="or3-mcp-field sm:col-span-2">
                            <div class="or3-mcp-label-row">
                                <label for="mcp-env" class="or3-mcp-label"
                                    >Environment variables</label
                                >
                                <McpInfoHint
                                    text="Extra environment variables passed to the server program. Useful for passing API keys or configuration. One per line: KEY=value"
                                />
                            </div>
                            <span class="or3-mcp-hint"
                                >Extra variables the program can access. One per
                                line as KEY=value.</span
                            >
                            <textarea
                                id="mcp-env"
                                v-model="form.env"
                                class="or3-mcp-textarea font-mono"
                                rows="3"
                                placeholder="API_KEY=sk-abc123&#10;DEBUG=true"
                            />
                        </div>

                        <div
                            v-if="form.connectionType === 'remote'"
                            class="or3-mcp-field sm:col-span-2"
                        >
                            <div class="or3-mcp-label-row">
                                <label for="mcp-headers" class="or3-mcp-label"
                                    >Custom headers</label
                                >
                                <McpInfoHint
                                    text="Extra HTTP headers sent with every request to the server. Useful for authentication tokens. One per line: Header-Name: value"
                                />
                            </div>
                            <span class="or3-mcp-hint"
                                >Extra HTTP headers for authentication or
                                configuration. One per line.</span
                            >
                            <textarea
                                id="mcp-headers"
                                v-model="form.headers"
                                class="or3-mcp-textarea font-mono"
                                rows="3"
                                placeholder="Authorization: Bearer my-token&#10;X-Custom-Header: value"
                            />
                        </div>

                        <!-- Timeouts -->
                        <div class="or3-mcp-field">
                            <div class="or3-mcp-label-row">
                                <label
                                    for="mcp-connect-timeout"
                                    class="or3-mcp-label"
                                    >Connection timeout</label
                                >
                                <McpInfoHint
                                    text="How long to wait when first connecting to the add-on server before giving up."
                                />
                            </div>
                            <span class="or3-mcp-hint"
                                >Seconds to wait when connecting (default:
                                10).</span
                            >
                            <input
                                id="mcp-connect-timeout"
                                v-model="form.connectTimeoutSeconds"
                                class="or3-mcp-input"
                                type="number"
                                min="1"
                                placeholder="10"
                            />
                        </div>

                        <div class="or3-mcp-field">
                            <div class="or3-mcp-label-row">
                                <label
                                    for="mcp-tool-timeout"
                                    class="or3-mcp-label"
                                    >Tool timeout</label
                                >
                                <McpInfoHint
                                    text="How long to wait for a single tool to finish running before giving up."
                                />
                            </div>
                            <span class="or3-mcp-hint"
                                >Seconds to wait for each tool call (default:
                                30).</span
                            >
                            <input
                                id="mcp-tool-timeout"
                                v-model="form.toolTimeoutSeconds"
                                class="or3-mcp-input"
                                type="number"
                                min="1"
                                placeholder="30"
                            />
                        </div>
                    </div>

                    <!-- Test result -->
                    <div
                        v-if="testResult"
                        :class="[
                            'or3-mcp-test-result',
                            testResult.ok
                                ? 'or3-mcp-test-result--ok'
                                : 'or3-mcp-test-result--fail',
                        ]"
                    >
                        <div class="or3-mcp-test-result__header">
                            <Icon
                                :name="
                                    testResult.ok
                                        ? 'i-pixelarticons-check'
                                        : 'i-pixelarticons-close'
                                "
                                class="size-4"
                            />
                            <strong>{{
                                testResult.ok
                                    ? 'Connection successful'
                                    : 'Connection failed'
                            }}</strong>
                        </div>
                        <p
                            v-if="testResult.ok && testResult.toolCount"
                            class="or3-mcp-test-result__detail"
                        >
                            Found {{ testResult.toolCount }} tool{{
                                testResult.toolCount === 1 ? '' : 's'
                            }}.
                        </p>
                        <ul
                            v-if="testResult.ok && testResult.tools?.length"
                            class="or3-mcp-test-result__tools"
                        >
                            <li
                                v-for="tool in testResult.tools"
                                :key="tool.name"
                            >
                                <code>{{ tool.name }}</code>
                                <span v-if="tool.description">{{
                                    tool.description
                                }}</span>
                            </li>
                        </ul>
                        <p
                            v-if="!testResult.ok && testResult.error"
                            class="or3-mcp-test-result__error"
                        >
                            {{ testResult.error }}
                        </p>
                    </div>

                    <div v-if="formError" class="or3-mcp-error">
                        <Icon name="i-pixelarticons-alert" class="size-4" />
                        <span>{{ formError }}</span>
                    </div>
                </div>

                <!-- Footer -->
                <footer class="or3-mcp-foot">
                    <p class="or3-mcp-foot__hint">
                        <Icon name="i-pixelarticons-shield" class="size-3.5" />
                        Changes are saved to your config. Restart or3-intern to
                        activate.
                    </p>
                    <div class="or3-mcp-foot__actions">
                        <UButton
                            color="neutral"
                            variant="ghost"
                            size="lg"
                            @click="cancel"
                            >Cancel</UButton
                        >
                        <UButton
                            v-if="isEdit"
                            variant="soft"
                            size="lg"
                            icon="i-pixelarticons-search"
                            :loading="testing"
                            @click="test"
                        >
                            Test
                        </UButton>
                        <UButton
                            color="primary"
                            variant="solid"
                            size="lg"
                            icon="i-pixelarticons-check"
                            class="or3-mcp-foot__cta"
                            :loading="saving"
                            @click="save"
                        >
                            {{ isEdit ? 'Save changes' : 'Add add-on' }}
                        </UButton>
                    </div>
                </footer>
            </div>
        </template>
    </USlideover>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import type {
    MCPServerConfig,
    MCPServerDetail,
    MCPServerTestResult,
} from '~/types/or3-api';
import McpInfoHint from '~/components/settings/McpInfoHint.vue';
import { useIsDesktop } from '~/composables/useViewport';
import { useSheetSwipeDismiss } from '~/composables/useSheetSwipeDismiss';

const props = defineProps<{
    open: boolean;
    server?: MCPServerDetail | null;
}>();

const emit = defineEmits<{
    'update:open': [value: boolean];
    save: [name: string, config: MCPServerConfig];
    test: [name: string];
    remove: [name: string];
}>();

const isDesktop = useIsDesktop();
const side = computed<'bottom' | 'right'>(() =>
    isDesktop.value ? 'right' : 'bottom',
);
const contentClass = computed(() =>
    side.value === 'bottom'
        ? 'or3-fb-sheet-shell or3-fb-sheet-shell--bottom h-[92dvh] rounded-t-3xl'
        : 'or3-fb-sheet-shell or3-fb-sheet-shell--side sm:max-w-xl',
);

const sheetRef = ref<HTMLElement | null>(null);
const handleRef = ref<HTMLElement | null>(null);
const swipeEnabled = computed(() => props.open && side.value === 'bottom');
useSheetSwipeDismiss({
    handle: handleRef,
    sheet: sheetRef,
    enabled: swipeEnabled,
    onDismiss: () => emit('update:open', false),
});

const formError = ref<string | null>(null);
const testResult = ref<MCPServerTestResult | null>(null);
const saving = ref(false);
const testing = ref(false);

const isEdit = computed(() => Boolean(props.server));

const form = reactive({
    name: '',
    connectionType: 'local' as 'local' | 'remote',
    enabled: true,
    command: '',
    args: '',
    url: '',
    allowInsecureHttp: false,
    env: '',
    headers: '',
    connectTimeoutSeconds: '10',
    toolTimeoutSeconds: '30',
});

function resetForm(server?: MCPServerDetail) {
    formError.value = null;
    testResult.value = null;
    saving.value = false;
    testing.value = false;

    const config = server?.config;
    form.name = server?.name ?? '';
    form.connectionType =
        config && config.transport !== 'stdio' ? 'remote' : 'local';
    form.enabled = config?.enabled ?? true;
    form.command = config?.command ?? '';
    form.args = (config?.args ?? []).join(' ');
    form.url = config?.url ?? '';
    form.allowInsecureHttp = Boolean(config?.allowInsecureHttp);
    form.env = mapToText(config?.env);
    form.headers = mapToText(config?.headers);
    form.connectTimeoutSeconds = String(config?.connectTimeoutSeconds ?? 10);
    form.toolTimeoutSeconds = String(config?.toolTimeoutSeconds ?? 30);
}

function mapToText(values?: Record<string, string>) {
    return Object.entries(values ?? {})
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
}

function textToMap(value: string) {
    const out: Record<string, string> = {};
    for (const raw of value.split(/\n/)) {
        const line = raw.trim();
        if (!line) continue;
        const idx = line.indexOf('=');
        if (idx > 0) {
            out[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
        }
    }
    return Object.keys(out).length ? out : undefined;
}

function headerTextToMap(value: string) {
    const out: Record<string, string> = {};
    for (const raw of value.split(/\n/)) {
        const line = raw.trim();
        if (!line) continue;
        const idx = line.indexOf(':');
        if (idx > 0) {
            out[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
        }
    }
    return Object.keys(out).length ? out : undefined;
}

function buildConfig(): MCPServerConfig {
    const isLocal = form.connectionType === 'local';
    return {
        enabled: form.enabled,
        transport: isLocal ? 'stdio' : 'streamablehttp',
        command: isLocal ? form.command.trim() : '',
        args: isLocal
            ? form.args
                  .split(/\s+/)
                  .map((p) => p.trim())
                  .filter(Boolean)
            : [],
        childEnvAllowlist: [],
        url: isLocal ? '' : form.url.trim(),
        allowInsecureHttp: !isLocal && form.allowInsecureHttp,
        env: textToMap(form.env),
        headers: headerTextToMap(form.headers),
        connectTimeoutSeconds: Number(form.connectTimeoutSeconds) || 10,
        toolTimeoutSeconds: Number(form.toolTimeoutSeconds) || 30,
    };
}

function validateForm(): string | null {
    if (!form.name.trim()) return 'Give this add-on a name.';
    if (form.connectionType === 'local' && !form.command.trim())
        return 'Enter the program to run.';
    if (form.connectionType === 'remote' && !form.url.trim())
        return 'Enter the server address.';
    if (form.connectionType === 'remote' && !form.url.trim().startsWith('http'))
        return 'The server address should start with https:// or http://.';
    return null;
}

async function save() {
    formError.value = null;
    const err = validateForm();
    if (err) {
        formError.value = err;
        return;
    }
    saving.value = true;
    try {
        emit('save', form.name.trim(), buildConfig());
    } finally {
        saving.value = false;
    }
}

async function test() {
    testing.value = true;
    testResult.value = null;
    try {
        emit('test', form.name.trim());
    } finally {
        testing.value = false;
    }
}

function cancel() {
    emit('update:open', false);
}

watch(
    () => props.open,
    (isOpen) => {
        if (!isOpen) return;
        if (props.server) {
            resetForm(props.server);
        } else {
            resetForm();
        }
    },
    { immediate: true },
);
</script>

<style scoped>
/* ── Sheet shell ────────────────────────────────────────────────── */
.or3-mcp-sheet {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
}

/* ── Drag handle (mobile) ───────────────────────────────────────── */
.or3-mcp-handle {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 1.6rem;
    padding: 0.55rem 0 0.4rem;
    cursor: grab;
    touch-action: none;
    user-select: none;
    flex-shrink: 0;
}
.or3-mcp-handle:active {
    cursor: grabbing;
}
.or3-mcp-handle span {
    display: block;
    width: 2.6rem;
    height: 5px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--or3-text-muted) 45%, transparent);
    transition:
        background 140ms ease,
        width 140ms ease;
}
.or3-mcp-handle:hover span {
    background: color-mix(in srgb, var(--or3-text-muted) 65%, transparent);
    width: 3rem;
}

/* ── Header ─────────────────────────────────────────────────────── */
.or3-mcp-head {
    display: flex;
    align-items: flex-start;
    gap: 0.85rem;
    padding: 0.5rem 1.35rem 1rem;
    border-bottom: 1px solid var(--or3-border);
    background: var(--or3-surface);
    flex-shrink: 0;
}
.or3-mcp-head__main {
    display: flex;
    align-items: flex-start;
    gap: 0.85rem;
    min-width: 0;
    flex: 1 1 auto;
}
.or3-mcp-head__icon {
    display: grid;
    place-items: center;
    width: 2.85rem;
    height: 2.85rem;
    flex-shrink: 0;
    border-radius: 1rem;
    background: var(--or3-green-soft);
    color: var(--or3-green-dark);
    border: 1px solid color-mix(in srgb, var(--or3-green) 22%, transparent);
    box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.6);
}
.or3-mcp-head__text {
    min-width: 0;
    flex: 1 1 auto;
}
.or3-mcp-head__eyebrow {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--or3-green-dark);
}
.or3-mcp-head__title {
    margin-top: 0.25rem;
    font-family: Georgia, 'Iowan Old Style', 'Times New Roman', serif;
    font-size: 1.35rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--or3-text);
    line-height: 1.15;
}
.or3-mcp-head__subtitle {
    margin-top: 0.35rem;
    font-size: 0.82rem;
    line-height: 1.5;
    color: var(--or3-text-muted);
    max-width: 44ch;
}
.or3-mcp-head__close {
    flex-shrink: 0;
}

/* ── Body (scrollable) ──────────────────────────────────────────── */
.or3-mcp-body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    padding: 1.1rem 1.35rem 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

/* ── Form grid ──────────────────────────────────────────────────── */
.or3-mcp-form {
    display: grid;
    gap: 0.85rem;
}
@media (min-width: 640px) {
    .or3-mcp-form {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.85rem 1rem;
    }
    .or3-mcp-field.sm\:col-span-2 {
        grid-column: span 2 / span 2;
    }
}

.or3-mcp-field {
    display: grid;
    gap: 0.35rem;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--or3-text);
    letter-spacing: -0.005em;
}

.or3-mcp-label-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
}

.or3-mcp-label {
    display: block;
    font-size: 0.82rem;
    font-weight: 650;
    color: var(--or3-text);
    cursor: default;
}

.or3-mcp-hint {
    font-size: 0.73rem;
    font-weight: 400;
    line-height: 1.45;
    color: var(--or3-text-muted);
    margin-bottom: 0.15rem;
}

.or3-mcp-input,
.or3-mcp-textarea {
    width: 100%;
    border-radius: var(--or3-radius-control);
    border: 1px solid var(--or3-border);
    background: rgb(255 255 255 / 0.85);
    padding: 0.7rem 0.85rem;
    font-family: inherit;
    font-size: 0.92rem;
    font-weight: 500;
    color: var(--or3-text);
    outline: none;
    transition:
        border-color 140ms ease,
        box-shadow 140ms ease,
        background 140ms ease;
    appearance: none;
}
.or3-mcp-input::placeholder,
.or3-mcp-textarea::placeholder {
    color: color-mix(in srgb, var(--or3-text-muted) 75%, transparent);
}
.or3-mcp-textarea {
    resize: vertical;
    line-height: 1.55;
    min-height: 4.5rem;
}
.or3-mcp-input:hover,
.or3-mcp-textarea:hover {
    border-color: color-mix(
        in srgb,
        var(--or3-green) 25%,
        var(--or3-border) 75%
    );
}
.or3-mcp-input:focus,
.or3-mcp-textarea:focus {
    border-color: var(--or3-green);
    background: white;
    box-shadow: 0 0 0 3px
        color-mix(in srgb, var(--or3-green-soft) 80%, transparent);
}

/* ── Connection type toggle ─────────────────────────────────────── */
.or3-mcp-type-toggle {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
    margin-top: 0.15rem;
}
.or3-mcp-type-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-radius: var(--or3-radius-control);
    border: 1px solid var(--or3-border);
    background: rgb(255 255 255 / 0.78);
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--or3-text-muted);
    cursor: pointer;
    transition:
        border-color 140ms ease,
        background 140ms ease,
        color 140ms ease,
        box-shadow 140ms ease;
}
.or3-mcp-type-btn:hover {
    border-color: color-mix(
        in srgb,
        var(--or3-green) 25%,
        var(--or3-border) 75%
    );
    background: rgb(255 255 255 / 0.95);
}
.or3-mcp-type-btn.active {
    border-color: var(--or3-green);
    background: var(--or3-green-soft);
    color: var(--or3-green-dark);
    box-shadow: 0 0 0 3px
        color-mix(in srgb, var(--or3-green-soft) 50%, transparent);
}

/* ── Toggle row ─────────────────────────────────────────────────── */
.or3-mcp-toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.85rem;
    border-radius: var(--or3-radius-control);
    border: 1px solid var(--or3-border);
    background: rgb(255 255 255 / 0.78);
    padding: 0.85rem 0.95rem;
    font-size: 0.82rem;
    font-weight: 500;
    color: var(--or3-text);
}

/* ── Divider ────────────────────────────────────────────────────── */
.or3-mcp-divider {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin: 0.5rem 0 0.25rem;
}
.or3-mcp-divider::before,
.or3-mcp-divider::after {
    content: '';
    flex: 1 1 auto;
    height: 1px;
    background: var(--or3-border);
}
.or3-mcp-divider span {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.66rem;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--or3-text-muted);
    flex-shrink: 0;
}

/* ── Test result ────────────────────────────────────────────────── */
.or3-mcp-test-result {
    border-radius: var(--or3-radius-control);
    border: 1px solid var(--or3-border);
    padding: 0.85rem 0.95rem;
    font-size: 0.82rem;
    line-height: 1.5;
}
.or3-mcp-test-result--ok {
    border-color: color-mix(
        in srgb,
        var(--or3-green) 30%,
        var(--or3-border) 70%
    );
    background: color-mix(
        in srgb,
        var(--or3-green-soft) 50%,
        rgb(255 255 255 / 0.85)
    );
}
.or3-mcp-test-result--fail {
    border-color: rgb(254 202 202);
    background: rgb(254 242 242 / 0.9);
}
.or3-mcp-test-result__header {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-weight: 600;
}
.or3-mcp-test-result--ok .or3-mcp-test-result__header {
    color: var(--or3-green-dark);
}
.or3-mcp-test-result--fail .or3-mcp-test-result__header {
    color: rgb(153 27 27);
}
.or3-mcp-test-result__detail {
    margin-top: 0.3rem;
    color: var(--or3-text-muted);
}
.or3-mcp-test-result__tools {
    margin-top: 0.5rem;
    list-style: none;
    padding: 0;
    display: grid;
    gap: 0.3rem;
}
.or3-mcp-test-result__tools li {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    font-size: 0.78rem;
}
.or3-mcp-test-result__tools code {
    font-weight: 600;
    color: var(--or3-green-dark);
}
.or3-mcp-test-result__tools span {
    color: var(--or3-text-muted);
}
.or3-mcp-test-result__error {
    margin-top: 0.3rem;
    color: rgb(153 27 27);
    word-break: break-word;
}

/* ── Error ──────────────────────────────────────────────────────── */
.or3-mcp-error {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    border-radius: var(--or3-radius-control);
    border: 1px solid rgb(254 202 202);
    background: rgb(254 242 242 / 0.9);
    padding: 0.75rem 0.9rem;
    font-size: 0.82rem;
    color: rgb(153 27 27);
}

/* ── Footer ─────────────────────────────────────────────────────── */
.or3-mcp-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
    padding: 0.85rem 1.35rem calc(env(safe-area-inset-bottom, 0px) + 1rem);
    border-top: 1px solid var(--or3-border);
    background: linear-gradient(
        180deg,
        color-mix(in srgb, var(--or3-surface) 88%, white 12%) 0%,
        var(--or3-surface) 100%
    );
    flex-shrink: 0;
}
.or3-mcp-foot__hint {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.74rem;
    line-height: 1.5;
    color: var(--or3-text-muted);
    flex: 1 1 16ch;
    min-width: 12ch;
}
.or3-mcp-foot__actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
    flex-shrink: 0;
    width: 100%;
}
.or3-mcp-foot__cta {
    box-shadow: 0 6px 18px color-mix(in srgb, var(--or3-green) 30%, transparent);
}
</style>
