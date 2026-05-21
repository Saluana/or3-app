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
  let transitionPromise: Promise<void> = Promise.resolve();

  const pause = async () => {
    transitionPromise = transitionPromise.then(async () => {
      isPaused.value = true;
      try {
        await options.pause?.();
      } catch {
        // Pause errors are non-fatal; log but don't propagate.
      }
    });
    await transitionPromise;
  };

  const resume = async () => {
    transitionPromise = transitionPromise.then(async () => {
      isPaused.value = false;
      lastResumeAtUnixMs.value = Date.now();
      const claims = options.claims?.value;
      if (claims && shouldRekeySecureSession(claims, { appResumed: true })) {
        try {
          await options.rekey?.();
        } catch {
          // Rekey failure on resume: session may be stale; the expiry timer
          // in useSecureConnectionSession will clear it.
        }
      }
    });
    await transitionPromise;
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
      // Log instead of throwing — throwing in an event handler crashes the app.
      console.warn(
        "[secure-connections] Blocked deep link containing sensitive material.",
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
