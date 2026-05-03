import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * Tiny matchMedia composable shared across the app for
 * "should I render the desktop layout?" decisions.
 *
 * Uses the Tailwind `md` breakpoint (768px) by default.
 * SSR-safe: returns false on the server.
 */
export function useViewport(query = '(min-width: 768px)') {
  const matches = ref(false)
  let mql: MediaQueryList | null = null
  let listener: ((event: MediaQueryListEvent) => void) | null = null

  onMounted(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    mql = window.matchMedia(query)
    matches.value = mql.matches
    listener = (event) => {
      matches.value = event.matches
    }
    mql.addEventListener('change', listener)
  })

  onBeforeUnmount(() => {
    if (mql && listener) mql.removeEventListener('change', listener)
    mql = null
    listener = null
  })

  return { matches }
}

/** Convenience: true once the viewport is at the Tailwind `md` breakpoint or wider. */
export function useIsDesktop() {
  const { matches } = useViewport('(min-width: 768px)')
  return matches
}
