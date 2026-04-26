import type { Or3SseEvent } from '~/types/or3-api'

export function parseSseChunk(chunk: string): Or3SseEvent[] {
  return chunk
    .split(/(?:\r?\n){2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map(parseSseBlock)
}

export function parseSseBlock(block: string): Or3SseEvent {
  const lines = block.split(/\r?\n/)
  const data: string[] = []
  const event: Or3SseEvent = { data: '' }

  for (const line of lines) {
    if (!line || line.startsWith(':')) continue
    const separator = line.indexOf(':')
    const field = separator === -1 ? line : line.slice(0, separator)
    const rawValue = separator === -1 ? '' : line.slice(separator + 1)
    const value = rawValue.startsWith(' ') ? rawValue.slice(1) : rawValue

    if (field === 'event') event.event = value
    if (field === 'id') event.id = value
    if (field === 'retry') event.retry = Number(value)
    if (field === 'data') data.push(value)
  }

  event.data = data.join('\n')

  if (event.data) {
    try {
      event.json = JSON.parse(event.data)
    } catch {
      event.json = undefined
    }
  }

  return event
}

export async function* readSseStream(stream: ReadableStream<Uint8Array>): AsyncIterable<Or3SseEvent> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split(/(?:\r?\n){2,}/)
      buffer = parts.pop() ?? ''
      for (const part of parts) {
        if (part.trim()) yield parseSseBlock(part)
      }
    }

    buffer += decoder.decode()
    if (buffer.trim()) yield parseSseBlock(buffer)
  } finally {
    reader.releaseLock()
  }
}
