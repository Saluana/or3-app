import { Capacitor } from '@capacitor/core'
import { Keyboard } from '@capacitor/keyboard'
import type { PluginListenerHandle } from '@capacitor/core'

let keyboardOpenListenersStarted = false

function getFocusedEditable() {
  if (!import.meta.client) return null

  const active = document.activeElement as HTMLElement | null
  if (!active) return null

  const tagName = active.tagName.toLowerCase()

  if (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    active.isContentEditable ||
    active.closest('[contenteditable="true"], .ProseMirror')
  ) {
    return active
  }

  return null
}

function isEditableFocused() {
  return Boolean(getFocusedEditable())
}

function isLikelyIOSWeb() {
  if (!import.meta.client) return false

  const platform = navigator.platform || ''
  const userAgent = navigator.userAgent || ''
  const iPadOS = platform === 'MacIntel' && navigator.maxTouchPoints > 1

  return /iPad|iPhone|iPod/.test(userAgent) || iPadOS
}

export function useKeyboardOpen() {
  const isKeyboardOpen = useState('or3-keyboard-open', () => false)
  const keyboardHeight = useState('or3-keyboard-height', () => 0)

  if (import.meta.client) {
    watch(
      isKeyboardOpen,
      (open) => {
        document.documentElement.classList.toggle('or3-keyboard-open', open)
      },
      { immediate: true },
    )

    onMounted(async () => {
      if (keyboardOpenListenersStarted) return
      keyboardOpenListenersStarted = true

      let willShowHandle: PluginListenerHandle | undefined
      let didShowHandle: PluginListenerHandle | undefined
      let willHideHandle: PluginListenerHandle | undefined
      let didHideHandle: PluginListenerHandle | undefined
      let blurTimer: number | undefined
      let focusTimer: number | undefined
      let lastViewportHeight = window.visualViewport?.height ?? window.innerHeight
      const likelyIOSWeb = isLikelyIOSWeb() && !Capacitor.isNativePlatform()

      const setOpen = (open: boolean, height = 0) => {
        isKeyboardOpen.value = open
        keyboardHeight.value = open ? Math.max(0, Math.round(height)) : 0
        document.documentElement.style.setProperty('--or3-keyboard-height', `${keyboardHeight.value}px`)
      }

      if (Capacitor.isNativePlatform()) {
        willShowHandle = await Keyboard.addListener('keyboardWillShow', () => setOpen(true))
        didShowHandle = await Keyboard.addListener('keyboardDidShow', () => setOpen(true))
        willHideHandle = await Keyboard.addListener('keyboardWillHide', () => setOpen(false))
        didHideHandle = await Keyboard.addListener('keyboardDidHide', () => setOpen(false))
      }

      const updateFromViewport = () => {
        const viewport = window.visualViewport
        const editableFocused = isEditableFocused()

        if (!viewport) {
          setOpen(editableFocused, 0)
          return
        }

        const currentHeight = viewport.height
        const viewportShrink = Math.max(0, lastViewportHeight - currentHeight)
        const keyboardOverlap = Math.max(0, window.innerHeight - currentHeight - viewport.offsetTop)
        const detectedKeyboardHeight = Math.max(keyboardOverlap, viewportShrink)
        const open = editableFocused && detectedKeyboardHeight > 80

        setOpen(open, detectedKeyboardHeight)

        if (!editableFocused || !open) {
          lastViewportHeight = Math.max(lastViewportHeight, currentHeight)
        }
      }

      const updateFromFocus = () => {
        if (focusTimer) window.clearTimeout(focusTimer)
        focusTimer = window.setTimeout(() => {
          updateFromViewport()

          // iOS Safari can delay visualViewport resize until after focus. If an
          // editable is focused, hide the nav optimistically so it never rides
          // above the keyboard during that awkward first animation frame.
          if (likelyIOSWeb && isEditableFocused()) {
            const viewport = window.visualViewport
            const keyboardOverlap = viewport ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0
            setOpen(true, keyboardOverlap)
          }
        }, 30)
      }

      const handleFocusOut = () => {
        if (blurTimer) window.clearTimeout(blurTimer)
        blurTimer = window.setTimeout(updateFromViewport, 160)
      }

      // Keep the browser/PWA path active even in native shells. It is a useful
      // fallback on Android WebView versions that occasionally skip will-hide.
      window.visualViewport?.addEventListener('resize', updateFromViewport)
      window.visualViewport?.addEventListener('scroll', updateFromViewport)
      window.addEventListener('resize', updateFromViewport)
      window.addEventListener('focusin', updateFromFocus)
      window.addEventListener('focusout', handleFocusOut)

      updateFromViewport()

      onBeforeUnmount(() => {
        if (blurTimer) window.clearTimeout(blurTimer)
        if (focusTimer) window.clearTimeout(focusTimer)
        window.visualViewport?.removeEventListener('resize', updateFromViewport)
        window.visualViewport?.removeEventListener('scroll', updateFromViewport)
        window.removeEventListener('resize', updateFromViewport)
        window.removeEventListener('focusin', updateFromFocus)
        window.removeEventListener('focusout', handleFocusOut)
        void willShowHandle?.remove()
        void didShowHandle?.remove()
        void willHideHandle?.remove()
        void didHideHandle?.remove()
        document.documentElement.classList.remove('or3-keyboard-open')
        document.documentElement.style.removeProperty('--or3-keyboard-height')
        keyboardOpenListenersStarted = false
      })
    })
  }

  return { isKeyboardOpen }
}
