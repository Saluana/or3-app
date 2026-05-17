import {
  rejectSensitiveDeepLink,
  shouldRekeySecureSession,
  type SecureSessionClaims,
} from "~/utils/or3/secure-connections";
import type { Ref } from "vue";

export function useSecureConnectionLifecycle(options: {
  claims?: Ref<SecureSessionClaims | null>;
  pause?: () => void | Promise<void>;
  rekey?: () => void | Promise<void>;
}) {
  const isPaused = ref(false);
  const lastResumeAtUnixMs = ref(0);

  const pause = async () => {
    isPaused.value = true;
    await options.pause?.();
  };
  const resume = async () => {
    isPaused.value = false;
    lastResumeAtUnixMs.value = Date.now();
    const claims = options.claims?.value;
    if (claims && shouldRekeySecureSession(claims, { appResumed: true }))
      await options.rekey?.();
  };
  const handleVisibility = () => {
    if (!import.meta.client) return;
    if (document.visibilityState === "hidden") void pause();
    if (document.visibilityState === "visible") void resume();
  };
  const handleDeepLink = (event: Event) => {
    const custom = event as CustomEvent<{ url?: string }>;
    const url = custom.detail?.url;
    if (url && rejectSensitiveDeepLink(url)) {
      event.preventDefault();
      throw new Error(
        "Sensitive secure-connection material is not accepted through app links.",
      );
    }
  };

  onMounted(() => {
    if (!import.meta.client) return;
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("or3-app-url-open", handleDeepLink);
  });
  onBeforeUnmount(() => {
    if (!import.meta.client) return;
    document.removeEventListener("visibilitychange", handleVisibility);
    window.removeEventListener("or3-app-url-open", handleDeepLink);
  });

  return { isPaused, lastResumeAtUnixMs, pause, resume };
}
