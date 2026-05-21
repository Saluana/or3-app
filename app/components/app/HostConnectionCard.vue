<template>
    <SurfaceCard class-name="space-y-4">
        <div class="flex items-start gap-3">
            <RetroIcon name="i-pixelarticons-link" />
            <div class="min-w-0 flex-1">
                <p class="font-mono text-base font-semibold text-(--or3-text)">
                    Connect with code
                </p>
                <p class="mt-1 text-sm leading-6 text-(--or3-text-muted)">
                    Use the exact service address from or3-intern, then finish
                    pairing with a CLI code first. The older short-code
                    compatibility flow is still available lower on this card.
                </p>
            </div>
        </div>

        <DangerCallout
            v-if="isPaired"
            :tone="isConnected ? 'tip' : 'caution'"
            :title="isConnected ? 'Connected' : 'Saved pairing'"
        >
            <template v-if="isConnected">
                This app is connected to
                <span class="font-semibold">{{
                    activeHost?.name || 'your computer'
                }}</span>
                at
                <span class="font-mono">{{ activeHost?.baseUrl }}</span
                >.
            </template>
            <template v-else>
                This app still has a saved pairing for
                <span class="font-semibold">{{
                    activeHost?.name || 'your computer'
                }}</span>
                at
                <span class="font-mono">{{ activeHost?.baseUrl }}</span
                >, but it cannot reach that computer right now.
            </template>
            <template #actions>
                <UButton
                    label="Disconnect this app"
                    icon="i-pixelarticons-close"
                    color="neutral"
                    variant="soft"
                    size="sm"
                    @click="disconnect"
                />
            </template>
        </DangerCallout>

        <UForm :state="formState" class="space-y-4" @submit.prevent="start">
            <div class="space-y-3">
                <UFormField
                    label="Your computer's address"
                    name="baseUrl"
                    description="Use the exact address printed by or3-intern service. Localhost only works when the service is listening on localhost on this same device."
                >
                    <UInput
                        v-model="formState.baseUrl"
                        class="w-full font-mono"
                        placeholder="http://127.0.0.1:9100"
                        inputmode="url"
                        autocapitalize="off"
                        autocorrect="off"
                    />
                </UFormField>
                <p
                    v-if="isLoopbackServiceUrl"
                    class="text-xs leading-5 text-(--or3-text-muted)"
                >
                    If the service says it is listening on a LAN or Tailscale
                    address, enter that address here instead of 127.0.0.1.
                </p>
                <UFormField
                    label="A friendly name for the computer"
                    name="displayName"
                    description="So you can tell it apart later. Example: 'Studio Mac' or 'Office PC'."
                >
                    <UInput
                        v-model="formState.displayName"
                        class="w-full"
                        placeholder="Studio Mac"
                    />
                </UFormField>
                <UFormField
                    label="What should we call this phone?"
                    name="deviceName"
                    description="Shown in the trusted devices list on your computer."
                >
                    <UInput
                        v-model="formState.deviceName"
                        class="w-full"
                        placeholder="Brendon's iPhone"
                    />
                </UFormField>
            </div>

            <div
                class="rounded-2xl border border-(--or3-border) bg-white/65 p-4"
            >
                <div class="flex items-start gap-3">
                    <RetroIcon name="i-pixelarticons-terminal" size="sm" />
                    <div class="min-w-0 flex-1">
                        <p
                            class="font-mono text-sm font-semibold text-(--or3-text)"
                        >
                            Connect with a CLI code
                        </p>
                        <p
                            class="mt-1 text-xs leading-5 text-(--or3-text-muted)"
                        >
                            Run
                            <span class="font-mono"
                                >or3-intern connect-device</span
                            >
                            on your computer, then enter the request ID and code
                            it prints here. This path exchanges the CLI code
                            directly.
                        </p>
                    </div>
                </div>
                <div class="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                    <UFormField label="Request ID" name="cliRequestId">
                        <UInput
                            v-model="cliFormState.requestId"
                            class="w-full font-mono"
                            inputmode="numeric"
                            placeholder="42"
                        />
                    </UFormField>
                    <UFormField label="Code" name="cliCode">
                        <UInput
                            v-model="cliFormState.code"
                            class="w-full font-mono"
                            inputmode="numeric"
                            placeholder="123-456"
                        />
                    </UFormField>
                    <UButton
                        label="Connect"
                        icon="i-pixelarticons-check"
                        color="primary"
                        type="button"
                        class="self-end"
                        :loading="loading"
                        @click="connectWithCliCode"
                    />
                </div>
            </div>

            <DangerCallout tone="caution" title="Legacy compatibility fallback">
                This creates the older bearer-token pairing. Use it only when
                you need the legacy short-code bootstrap path, then finish
                secure QR enrollment above.
            </DangerCallout>

            <UButton
                label="Get legacy pairing code"
                icon="i-pixelarticons-lock"
                type="submit"
                size="lg"
                block
                :loading="loading"
            />
        </UForm>

        <div
            v-if="pendingPairing"
            class="rounded-2xl border border-(--or3-green)/40 bg-(--or3-green-soft) p-4"
        >
            <p
                class="text-xs font-semibold uppercase tracking-wide text-(--or3-green-dark)"
            >
                Your pairing code
            </p>
            <p
                class="mt-1 font-mono text-3xl font-bold tracking-[0.3em] text-(--or3-green-dark)"
            >
                {{ pendingPairing.code }}
            </p>
            <p class="mt-2 text-sm text-(--or3-text-muted)">
                On your computer, run:
            </p>
            <p
                class="mt-2 rounded-xl bg-white/70 px-3 py-2 font-mono text-sm text-(--or3-green-dark)"
            >
                or3-intern pairing approve-code {{ pendingPairing.code }}
            </p>
            <p class="mt-2 text-sm text-(--or3-text-muted)">
                Leave this screen open. After you approve it, this app will
                connect automatically so you can finish secure enrollment.
            </p>
            <div
                class="mt-3 flex items-center gap-2 text-sm font-semibold text-(--or3-green-dark)"
            >
                <span class="or3-live-dot" />
                Waiting for approval...
            </div>
            <UButton
                label="Try now"
                icon="i-pixelarticons-check"
                color="primary"
                variant="soft"
                class="mt-3"
                block
                :loading="loading"
                @click="exchange"
            />
        </div>
    </SurfaceCard>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useToast } from '@nuxt/ui/composables';
import { PairingRequestError, usePairing } from '../../composables/usePairing';
import { useActiveHost } from '../../composables/useActiveHost';

const {
    pendingPairing,
    pairingError,
    pairingFailureDetails,
    startPairing,
    exchangeExistingPairing,
    exchangeCode,
    verifyActiveHost,
} = usePairing();
const { activeHost, isConnected, isPaired, disconnectActiveHost } =
    useActiveHost();
const toast = useToast();
let autoFinishTimer: ReturnType<typeof setInterval> | null = null;
function isLoopbackHost(hostname: string) {
    const host = hostname.trim().toLowerCase();
    return (
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host === '::1' ||
        host === '[::1]'
    );
}

function defaultServiceBaseUrl() {
    if (typeof window === 'undefined') return 'http://127.0.0.1:9100';
    const { protocol, hostname } = window.location;
    if (!hostname || isLoopbackHost(hostname)) return 'http://127.0.0.1:9100';
    return `${protocol}//${hostname}:9100`;
}

const formState = reactive({
    baseUrl: defaultServiceBaseUrl(),
    displayName: 'My Computer',
    deviceName: 'or3-app',
});
const cliFormState = reactive({
    requestId: '',
    code: '',
});
const loading = ref(false);
const suggestedBaseUrl = computed(defaultServiceBaseUrl);
const isLoopbackServiceUrl = computed(() => {
    try {
        return isLoopbackHost(new URL(formState.baseUrl).hostname);
    } catch {
        return false;
    }
});

function describePairingToast(error: unknown) {
    const failure = pairingFailureDetails.value;
    const message =
        failure?.message ||
        pairingError.value ||
        (error instanceof Error && error.message) ||
        'Something went wrong while contacting your computer.';
    const details: string[] = [];

    if (failure) {
        if (failure.status)
            details.push(
                `HTTP ${failure.status}${failure.statusText ? ` ${failure.statusText}` : ''}`,
            );
        if (failure.url) details.push(failure.url);
        if (failure.responseBody)
            details.push(`Response: ${failure.responseBody.slice(0, 240)}`);
        if (failure.cause instanceof Error && failure.cause.message)
            details.push(`Cause: ${failure.cause.message}`);
    } else if (error instanceof PairingRequestError) {
        if (error.status)
            details.push(
                `HTTP ${error.status}${error.statusText ? ` ${error.statusText}` : ''}`,
            );
        if (error.url) details.push(error.url);
        if (error.responseBody)
            details.push(`Response: ${error.responseBody.slice(0, 240)}`);
        if (error.cause instanceof Error && error.cause.message)
            details.push(`Cause: ${error.cause.message}`);
    }

    return details.length ? `${message}\n\n${details.join('\n')}` : message;
}

function showPairingToast(title: string, error: unknown) {
    toast.add({
        title,
        description: describePairingToast(error),
        color: 'error',
        icon: 'i-pixelarticons-warning-box',
        duration: 15000,
        close: true,
    });
}

async function start() {
    loading.value = true;
    try {
        await startPairing({
            baseUrl: formState.baseUrl,
            displayName: formState.displayName,
            deviceName: formState.deviceName,
        });
        startAutoFinish();
    } catch (error) {
        showPairingToast('Could not get pairing code', error);
    } finally {
        loading.value = false;
    }
}

async function exchange() {
    loading.value = true;
    try {
        await exchangeCode();
        stopAutoFinish();
        toast.add({
            title: 'Connected',
            description:
                'This device is paired. You can use chat and computer tools now.',
            color: 'success',
            icon: 'i-pixelarticons-check',
            duration: 6000,
        });
    } catch (error) {
        showPairingToast('Could not finish pairing', error);
    } finally {
        loading.value = false;
    }
}

async function connectWithCliCode() {
    loading.value = true;
    try {
        await exchangeExistingPairing({
            baseUrl: formState.baseUrl,
            displayName: formState.displayName,
            deviceName: formState.deviceName,
            requestId: cliFormState.requestId,
            code: cliFormState.code,
        });
        stopAutoFinish();
        toast.add({
            title: 'Connected',
            description:
                'This device is paired. You can use chat and computer tools now.',
            color: 'success',
            icon: 'i-pixelarticons-check',
            duration: 6000,
        });
    } catch (error) {
        showPairingToast('Could not finish CLI pairing', error);
    } finally {
        loading.value = false;
    }
}

function disconnect() {
    if (!disconnectActiveHost()) return;
    stopAutoFinish();
    toast.add({
        title: 'Disconnected',
        description:
            'This app forgot the saved computer. Any trusted device records on the computer stay there until you revoke them.',
        color: 'neutral',
        icon: 'i-pixelarticons-close',
        duration: 7000,
    });
}

function startAutoFinish() {
    stopAutoFinish();
    autoFinishTimer = setInterval(async () => {
        if (!pendingPairing.value) {
            stopAutoFinish();
            return;
        }
        try {
            await exchangeCode(undefined, { quietPending: true });
            stopAutoFinish();
        } catch {
            // Still waiting for the computer to approve the code.
        }
    }, 2500);
}

function stopAutoFinish() {
    if (!autoFinishTimer) return;
    clearInterval(autoFinishTimer);
    autoFinishTimer = null;
}

onMounted(() => {
    const suggested = suggestedBaseUrl.value;
    if (!suggested) return;
    let host = formState.baseUrl;
    try {
        host = new URL(formState.baseUrl).hostname;
    } catch {}
    if (isLoopbackHost(host) || !formState.baseUrl) {
        formState.baseUrl = suggested;
    }
    if (isPaired.value) {
        void verifyActiveHost().catch(() => {});
    }
});

onBeforeUnmount(stopAutoFinish);
</script>
