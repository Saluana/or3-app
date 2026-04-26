interface ChatInputImperativeApi {
  setText: (value: string) => void
  triggerSend: () => void | Promise<void>
}

const registry = new Map<string, ChatInputImperativeApi>()

export function registerPaneInput(paneId: string, api: ChatInputImperativeApi) {
  registry.set(paneId, api)
}

export function unregisterPaneInput(paneId: string) {
  registry.delete(paneId)
}

export function hasPane(paneId: string) {
  return registry.has(paneId)
}

export async function programmaticSend(paneId: string, text: string) {
  const api = registry.get(paneId)
  if (!api) return false
  api.setText(text)
  await api.triggerSend()
  return true
}
