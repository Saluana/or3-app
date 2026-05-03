import { onBeforeUnmount, watch, type Ref } from 'vue'

interface Options {
  /** Element that owns the gesture (handle area on mobile). */
  handle: Ref<HTMLElement | null>
  /** Element that visually moves while dragging (the whole sheet). */
  sheet: Ref<HTMLElement | null>
  /** Whether dismiss-on-drag is currently allowed (e.g. only when side === 'bottom'). */
  enabled: Ref<boolean>
  /** Called once the threshold is passed and the sheet should close. */
  onDismiss: () => void
  /** Pixels of vertical drag required to commit a dismiss. Default 110. */
  threshold?: number
}

/**
 * Pointer-driven swipe-to-dismiss for a bottom slideover.
 * - Engages only on downward drags from the handle area.
 * - Translates the sheet element in real time for an interactive feel.
 * - Snaps back with a transition if the user releases before the threshold.
 */
export function useSheetSwipeDismiss(opts: Options) {
  const threshold = opts.threshold ?? 110
  let startY = 0
  let currentDelta = 0
  let active = false
  let pointerId: number | null = null

  function applyTransform(delta: number) {
    const el = opts.sheet.value
    if (!el) return
    el.style.transition = 'none'
    el.style.transform = delta > 0 ? `translate3d(0, ${delta}px, 0)` : 'translate3d(0,0,0)'
    el.style.willChange = 'transform'
  }

  function reset(animated: boolean) {
    const el = opts.sheet.value
    if (!el) return
    el.style.transition = animated ? 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)' : 'none'
    el.style.transform = 'translate3d(0,0,0)'
    if (animated) {
      window.setTimeout(() => {
        if (!opts.sheet.value) return
        opts.sheet.value.style.transition = ''
        opts.sheet.value.style.transform = ''
        opts.sheet.value.style.willChange = ''
      }, 240)
    } else {
      el.style.transition = ''
      el.style.willChange = ''
    }
  }

  function onDown(event: PointerEvent) {
    if (!opts.enabled.value) return
    if (event.button !== undefined && event.button !== 0) return
    active = true
    pointerId = event.pointerId
    startY = event.clientY
    currentDelta = 0
    try {
      ;(event.target as Element | null)?.setPointerCapture?.(event.pointerId)
    } catch {
      /* noop */
    }
  }

  function onMove(event: PointerEvent) {
    if (!active || event.pointerId !== pointerId) return
    const delta = event.clientY - startY
    if (delta <= 0) {
      currentDelta = 0
      applyTransform(0)
      return
    }
    // Soft resistance after a short distance for a natural feel
    currentDelta = delta < 200 ? delta : 200 + (delta - 200) * 0.4
    applyTransform(currentDelta)
    event.preventDefault()
  }

  function onUp(event: PointerEvent) {
    if (!active || event.pointerId !== pointerId) return
    active = false
    pointerId = null
    if (currentDelta >= threshold) {
      // Animate fully out, then dismiss
      const el = opts.sheet.value
      if (el) {
        el.style.transition = 'transform 180ms cubic-bezier(0.4, 0, 1, 1)'
        el.style.transform = `translate3d(0, ${Math.max(currentDelta, 280)}px, 0)`
      }
      window.setTimeout(() => {
        opts.onDismiss()
        reset(false)
      }, 160)
    } else {
      reset(true)
    }
    currentDelta = 0
  }

  function bind() {
    const el = opts.handle.value
    if (!el) return
    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  function unbind() {
    const el = opts.handle.value
    if (el) el.removeEventListener('pointerdown', onDown)
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
  }

  watch(
    () => [opts.handle.value, opts.enabled.value] as const,
    (curr, prev, onCleanup) => {
      unbind()
      if (curr[0] && curr[1]) bind()
      onCleanup(() => unbind())
    },
    { immediate: true, flush: 'post' },
  )

  onBeforeUnmount(() => {
    unbind()
    reset(false)
  })
}
