import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const resolvers = new Map<string, (items: any[]) => void>()
const searchWorkspaceFiles = vi.fn((query: string) => {
  return new Promise<any[]>((resolve) => {
    resolvers.set(query, resolve)
  })
})

vi.mock('../../app/composables/useComputerFiles', () => ({
  useComputerFiles: () => ({
    searchWorkspaceFiles,
  }),
}))

import { useFileMentionSuggestions } from '../../app/composables/useFileMentionSuggestions'

describe('useFileMentionSuggestions', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    searchWorkspaceFiles.mockClear()
    resolvers.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('debounces searches and maps suggestion ids', async () => {
    const suggestions = useFileMentionSuggestions()

    const pending = suggestions.search('notes')
    await vi.advanceTimersByTimeAsync(120)
    resolvers.get('notes')?.([
      {
        root_id: 'workspace',
        root_label: 'Workspace',
        path: 'docs/notes.md',
        name: 'notes.md',
      },
    ])

    const results = await pending

    expect(searchWorkspaceFiles).toHaveBeenCalledWith('notes', 12)
    expect(results[0]).toMatchObject({
      id: 'workspace:docs/notes.md',
      label: 'notes.md',
      path: 'docs/notes.md',
    })
    expect(suggestions.results.value[0]?.id).toBe('workspace:docs/notes.md')
  })

  it('ignores stale responses from older searches', async () => {
    const suggestions = useFileMentionSuggestions()

    const first = suggestions.search('first')
    await vi.advanceTimersByTimeAsync(120)

    const second = suggestions.search('second')
    await vi.advanceTimersByTimeAsync(120)

    resolvers.get('second')?.([
      {
        root_id: 'workspace',
        root_label: 'Workspace',
        path: 'docs/second.md',
        name: 'second.md',
      },
    ])
    await second

    resolvers.get('first')?.([
      {
        root_id: 'workspace',
        root_label: 'Workspace',
        path: 'docs/first.md',
        name: 'first.md',
      },
    ])
    await first

    expect(suggestions.results.value).toHaveLength(1)
    expect(suggestions.results.value[0]?.path).toBe('docs/second.md')
  })

  it('resolves canceled debounce searches without calling the API', async () => {
    const suggestions = useFileMentionSuggestions()

    const first = suggestions.search('first')
    const second = suggestions.search('second')
    await vi.advanceTimersByTimeAsync(120)
    resolvers.get('second')?.([])

    await expect(first).resolves.toEqual([])
    await expect(second).resolves.toEqual([])
    expect(searchWorkspaceFiles).toHaveBeenCalledTimes(1)
    expect(searchWorkspaceFiles).toHaveBeenCalledWith('second', 12)
  })

  it('does not repopulate results from an in-flight search after reset', async () => {
    const suggestions = useFileMentionSuggestions()

    const pending = suggestions.search('drafts')
    await vi.advanceTimersByTimeAsync(120)
    suggestions.reset()
    resolvers.get('drafts')?.([
      {
        root_id: 'workspace',
        root_label: 'Workspace',
        path: 'docs/drafts.md',
        name: 'drafts.md',
      },
    ])

    await expect(pending).resolves.toEqual([])
    expect(suggestions.results.value).toEqual([])
  })

  it('resets state immediately', async () => {
    const suggestions = useFileMentionSuggestions()
    void suggestions.search('drafts')

    suggestions.reset()
    await vi.advanceTimersByTimeAsync(120)

    expect(suggestions.loading.value).toBe(false)
    expect(suggestions.error.value).toBeNull()
    expect(suggestions.results.value).toEqual([])
    expect(searchWorkspaceFiles).not.toHaveBeenCalled()
  })
})
