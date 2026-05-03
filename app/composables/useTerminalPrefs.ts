import { ref, watch } from 'vue'

const STORAGE_KEY = 'or3:terminal:prefs'
const FONT_SIZE_MIN = 9
const FONT_SIZE_MAX = 18
const FONT_SIZE_DEFAULT = 12

interface TerminalPrefs {
  fontSize: number
}

function isClient() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
}

function loadPrefs(): TerminalPrefs {
  if (!isClient()) return { fontSize: FONT_SIZE_DEFAULT }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { fontSize: FONT_SIZE_DEFAULT }
    const parsed = JSON.parse(raw) as Partial<TerminalPrefs>
    const fontSize = Number(parsed.fontSize)
    if (!Number.isFinite(fontSize)) return { fontSize: FONT_SIZE_DEFAULT }
    return { fontSize: clamp(fontSize, FONT_SIZE_MIN, FONT_SIZE_MAX) }
  } catch {
    return { fontSize: FONT_SIZE_DEFAULT }
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)))
}

const fontSize = ref<number>(loadPrefs().fontSize)
let watcherInstalled = false

export function useTerminalPrefs() {
  if (!watcherInstalled && isClient()) {
    watcherInstalled = true
    watch(fontSize, (next) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ fontSize: next }))
      } catch {
        // best-effort persistence
      }
    })
  }

  function setFontSize(value: number) {
    fontSize.value = clamp(value, FONT_SIZE_MIN, FONT_SIZE_MAX)
  }

  function bumpFontSize(delta: number) {
    setFontSize(fontSize.value + delta)
  }

  return {
    fontSize,
    fontSizeMin: FONT_SIZE_MIN,
    fontSizeMax: FONT_SIZE_MAX,
    setFontSize,
    bumpFontSize,
  }
}
