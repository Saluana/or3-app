import { computed, reactive } from 'vue'
import type { ComputedRef } from 'vue'

export interface ComposerActionContext {
  text?: string
  isStreaming?: boolean
  setText?: (value: string) => void
  send?: () => void | Promise<void>
  [key: string]: unknown
}

export interface ComposerAction {
  id: string
  icon: string
  label?: string
  tooltip?: string
  order?: number
  handler: (context: ComposerActionContext) => void | Promise<void>
  visible?: (context: ComposerActionContext) => boolean
  disabled?: (context: ComposerActionContext) => boolean
}

export interface ComposerActionEntry {
  action: ComposerAction
  disabled: boolean
}

const registry = reactive<{ actions: ComposerAction[] }>({ actions: [] })

export function registerComposerAction(action: ComposerAction) {
  unregisterComposerAction(action.id)
  registry.actions.push(Object.freeze({ ...action }))
}

export function unregisterComposerAction(id: string) {
  const index = registry.actions.findIndex((action) => action.id === id)
  if (index >= 0) registry.actions.splice(index, 1)
}

export function listRegisteredComposerActionIds() {
  return registry.actions.map((action) => action.id)
}

export function useComposerActions(context: () => ComposerActionContext = () => ({})): ComputedRef<ComposerActionEntry[]> {
  return computed(() => {
    const current = context()
    return registry.actions
      .filter((action) => !action.visible || action.visible(current))
      .sort((a, b) => (a.order ?? 200) - (b.order ?? 200))
      .map((action) => ({ action, disabled: action.disabled ? action.disabled(current) : false }))
  })
}

if (!listRegisteredComposerActionIds().length) {
  registerComposerAction({
    id: 'or3:note',
    icon: 'i-pixelarticons-notebook',
    label: 'Note',
    tooltip: 'Start a note',
    order: 10,
    handler: ({ setText }) => setText?.('Save this as a memory: '),
  })

  registerComposerAction({
    id: 'or3:agent',
    icon: 'i-pixelarticons-robot',
    label: 'Agent',
    tooltip: 'Ask an agent to work',
    order: 20,
    handler: ({ setText }) => setText?.('Create an agent task to '),
  })
}
