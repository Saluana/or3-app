<template>
  <div class="or3-terminal-screen-wrap">
    <div ref="mountRef" class="or3-terminal-screen" aria-label="Terminal output" />
    <div v-if="!session" class="or3-terminal-placeholder">
      <RetroIcon name="i-pixelarticons-terminal" class="text-(--or3-green)" />
      <p class="mt-2 text-sm text-(--or3-text-muted)">Pick an area above and tap "Open terminal" to start a shell.</p>
    </div>
    <div v-else class="or3-terminal-badge">
      <RetroIcon name="i-pixelarticons-shield" />
      <span>This is your real computer</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Terminal } from '@xterm/xterm'
import type { FitAddon } from '@xterm/addon-fit'
import type { TerminalSessionSnapshot } from '~/types/or3-api'

const props = defineProps<{
  session: TerminalSessionSnapshot | null
  chunks: { id: number; data: string }[]
  fontSize: number
}>()

const emit = defineEmits<{
  data: [bytes: string]
  resize: [rows: number, cols: number]
}>()

const mountRef = ref<HTMLDivElement | null>(null)
let term: Terminal | null = null
let fit: FitAddon | null = null
let resizeObserver: ResizeObserver | null = null
let lastWrittenId = 0
let lastReportedRows = 0
let lastReportedCols = 0

async function setup() {
  if (!mountRef.value) return
  // xterm + addons are dynamically imported to keep them out of SSR/static bundles.
  const [{ Terminal: TerminalCtor }, { FitAddon: FitCtor }, { WebLinksAddon }] = await Promise.all([
    import('@xterm/xterm'),
    import('@xterm/addon-fit'),
    import('@xterm/addon-web-links'),
  ])
  // Inject xterm CSS once. We do this manually so build pipelines that strip
  // CSS imports from .vue files don't lose it.
  if (!document.getElementById('or3-xterm-css')) {
    const link = document.createElement('link')
    link.id = 'or3-xterm-css'
    link.rel = 'stylesheet'
    link.href = new URL('@xterm/xterm/css/xterm.css', import.meta.url).href
    document.head.appendChild(link)
  }
  term = new TerminalCtor({
    cursorBlink: true,
    fontFamily: '"JetBrains Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: props.fontSize,
    lineHeight: 1.2,
    convertEol: true,
    scrollback: 4000,
    theme: {
      background: '#161a14',
      foreground: '#dde7cf',
      cursor: '#7ad58e',
      cursorAccent: '#161a14',
      selectionBackground: 'rgba(122, 213, 142, 0.32)',
      black: '#1a1f17',
      red: '#e07b6b',
      green: '#7ad58e',
      yellow: '#e5c87a',
      blue: '#7fb3e6',
      magenta: '#c89be0',
      cyan: '#7be0d2',
      white: '#dde7cf',
      brightBlack: '#4f5a47',
      brightRed: '#f29585',
      brightGreen: '#9ce6ad',
      brightYellow: '#f4d99a',
      brightBlue: '#9fc8ee',
      brightMagenta: '#dab5ee',
      brightCyan: '#9aece2',
      brightWhite: '#f0f6e6',
    },
  })
  fit = new FitCtor()
  term.loadAddon(fit)
  term.loadAddon(new WebLinksAddon())
  term.open(mountRef.value)
  term.onData((data) => emit('data', data))

  // Replay any chunks that arrived before mount.
  for (const chunk of props.chunks) {
    term.write(chunk.data)
    lastWrittenId = chunk.id
  }
  scheduleFit()

  resizeObserver = new ResizeObserver(() => scheduleFit())
  resizeObserver.observe(mountRef.value)
}

let fitTimer: number | null = null
function scheduleFit() {
  if (fitTimer != null) window.clearTimeout(fitTimer)
  fitTimer = window.setTimeout(() => {
    fitTimer = null
    if (!term || !fit) return
    try {
      fit.fit()
      const rows = term.rows
      const cols = term.cols
      if (rows > 0 && cols > 0 && (rows !== lastReportedRows || cols !== lastReportedCols)) {
        lastReportedRows = rows
        lastReportedCols = cols
        emit('resize', rows, cols)
      }
    } catch {
      // fit can throw if the container is hidden; ignore.
    }
  }, 60)
}

watch(
  () => props.chunks,
  (next) => {
    if (!term) return
    for (const chunk of next) {
      if (chunk.id <= lastWrittenId) continue
      term.write(chunk.data)
      lastWrittenId = chunk.id
    }
  },
  { deep: false },
)

watch(
  () => props.fontSize,
  (size) => {
    if (!term) return
    term.options.fontSize = size
    scheduleFit()
  },
)

watch(
  () => props.session?.session_id,
  (id, prev) => {
    // New session → wipe the screen so we don't mix histories.
    if (id !== prev && term) {
      term.reset()
      lastWrittenId = 0
      lastReportedRows = 0
      lastReportedCols = 0
    }
  },
)

onMounted(() => {
  void setup()
})

onBeforeUnmount(() => {
  if (fitTimer != null) window.clearTimeout(fitTimer)
  resizeObserver?.disconnect()
  term?.dispose()
  term = null
  fit = null
})

defineExpose({
  focus() {
    term?.focus()
  },
  fit: scheduleFit,
})
</script>

<style scoped>
.or3-terminal-screen-wrap {
  position: relative;
  border-radius: var(--or3-radius-card);
  overflow: hidden;
  background: #161a14;
  border: 1px solid #2a3127;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), var(--or3-shadow);
  min-height: 320px;
}

.or3-terminal-screen {
  position: absolute;
  inset: 12px 8px 12px 12px;
  /* xterm requires explicit dimensions to fit. The wrap supplies height via min-height + flex. */
}

.or3-terminal-screen :deep(.xterm),
.or3-terminal-screen :deep(.xterm-viewport),
.or3-terminal-screen :deep(.xterm-screen) {
  background: transparent !important;
}

.or3-terminal-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--or3-text-muted);
  pointer-events: none;
  background: linear-gradient(180deg, rgba(22, 26, 20, 0.0), rgba(22, 26, 20, 0.6));
}

.or3-terminal-badge {
  position: absolute;
  bottom: 10px;
  right: 10px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(22, 26, 20, 0.85);
  color: #cfe6c8;
  border: 1px solid rgba(122, 213, 142, 0.3);
  font-size: 11px;
  letter-spacing: 0.02em;
  pointer-events: none;
  backdrop-filter: blur(6px);
}
</style>
