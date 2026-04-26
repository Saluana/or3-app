import { describe, expect, it } from 'vitest'
import { parseSseChunk } from '../../app/utils/or3/sse'

describe('parseSseChunk', () => {
  it('parses event metadata and JSON data', () => {
    const [event] = parseSseChunk('event: update\nid: 42\ndata: {"delta":"hi"}\n\n')

    expect(event.event).toBe('update')
    expect(event.id).toBe('42')
    expect(event.json).toEqual({ delta: 'hi' })
  })

  it('splits CRLF-delimited events', () => {
    const events = parseSseChunk('event: first\r\ndata: {"delta":"a"}\r\n\r\nevent: second\r\ndata: {"delta":"b"}\r\n\r\n')

    expect(events).toHaveLength(2)
    expect(events[0]?.event).toBe('first')
    expect(events[0]?.json).toEqual({ delta: 'a' })
    expect(events[1]?.event).toBe('second')
    expect(events[1]?.json).toEqual({ delta: 'b' })
  })
})
