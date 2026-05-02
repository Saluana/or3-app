import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { navigateTo } from '#app'

const apiRequest = vi.fn()
const retryWithAuth = vi.fn((handler: (onAuthChallenge: unknown) => Promise<unknown>) => handler(vi.fn()))
const readTextFile = vi.fn()
const writeTextFile = vi.fn()
const persist = vi.fn()
const draft = ref('')
const preferences: Record<string, unknown> = {}

vi.mock('../../app/composables/useOr3Api', () => ({
  useOr3Api: () => ({
    request: apiRequest,
  }),
}))

vi.mock('../../app/composables/useAuthSession', () => ({
  useAuthSession: () => ({
    retryWithAuth,
  }),
}))

vi.mock('../../app/composables/useActiveHost', () => ({
  useActiveHost: () => ({
    activeHost: ref({ id: 'host-1', name: 'Dev Host' }),
  }),
}))

vi.mock('../../app/composables/useLocalCache', () => ({
  useLocalCache: () => ({
    state: ref({ preferences }),
    persist,
  }),
}))

vi.mock('../../app/composables/useChatSessions', () => ({
  useChatSessions: () => ({
    draft,
    ensureSession: vi.fn(),
  }),
}))

vi.mock('../../app/composables/useComputerTextFiles', () => ({
  useComputerTextFiles: () => ({
    readTextFile,
    writeTextFile,
  }),
}))

import { createPromptSlug, extractPromptTitleAndPreview, usePromptFiles } from '../../app/composables/usePromptFiles'

describe('usePromptFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    draft.value = ''
    for (const key of Object.keys(preferences)) delete preferences[key]
    apiRequest.mockImplementation(async (path: string, init?: { body?: unknown }) => {
      if (path === '/internal/v1/files/roots') {
        return { items: [{ id: 'workspace', label: 'Workspace', writable: true }] }
      }
      if (path.startsWith('/internal/v1/files/stat')) {
        throw { status: 404, message: 'file unavailable' }
      }
      if (path === '/internal/v1/files/mkdir') {
        return { ok: true, body: init?.body }
      }
      if (path.startsWith('/internal/v1/files/list')) {
        return {
          root_id: 'workspace',
          path: '.prompts',
          entries: [
            { name: 'deploy-checklist.md', path: '.prompts/deploy-checklist.md', type: 'file', modified_at: '2026-01-02T00:00:00Z', size: 20 },
            { name: 'standup.md', path: '.prompts/standup.md', type: 'file', modified_at: '2026-01-01T00:00:00Z', size: 18 },
          ],
        }
      }
      throw new Error(`unexpected request: ${path}`)
    })
    readTextFile.mockImplementation(async ({ path }: { path: string }) => ({
      rootId: 'workspace',
      path,
      name: path.split('/').pop() || path,
      revision: `rev:${path}`,
      writable: true,
      content: path.includes('deploy')
        ? '# Deploy checklist\n\nVerify logs before release.'
        : '# Standup\n\nSummarize yesterday, today, and blockers.',
    }))
    writeTextFile.mockResolvedValue({
      root_id: 'workspace',
      path: '.prompts/new-prompt.md',
      status: 'created',
      revision: 'rev-new',
    })
  })

  it('extracts prompt titles/previews and creates safe slugs', () => {
    expect(extractPromptTitleAndPreview('# Weekly Review\n\nSummarize wins and risks.')).toEqual({
      title: 'Weekly Review',
      preview: 'Summarize wins and risks.',
    })
    expect(createPromptSlug('  Héllo, OR3!!!  ')).toBe('hello-or3')
    expect(createPromptSlug('!!!')).toBe('untitled-prompt')
  })

  it('ensures .prompts exists, lists prompt files, and searches body previews', async () => {
    const { listPromptFiles } = usePromptFiles()

    const prompts = await listPromptFiles('logs')

    expect(apiRequest).toHaveBeenCalledWith('/internal/v1/files/mkdir', expect.objectContaining({
      method: 'POST',
      body: { root_id: 'workspace', path: '.', name: '.prompts' },
    }))
    expect(prompts).toHaveLength(1)
    expect(prompts[0]).toMatchObject({
      path: '.prompts/deploy-checklist.md',
      title: 'Deploy checklist',
      preview: 'Verify logs before release.',
    })
  })

  it('rejects prompt creation when the workspace root is read-only', async () => {
    apiRequest.mockImplementation(async (path: string) => {
      if (path === '/internal/v1/files/roots') {
        return { items: [{ id: 'workspace', label: 'Workspace', writable: false }] }
      }
      throw new Error(`unexpected request: ${path}`)
    })

    const { ensurePromptFolder } = usePromptFiles()

    await expect(ensurePromptFolder()).rejects.toThrow('workspace root is read-only')
  })

  it('creates prompts with safe unique filenames', async () => {
    const { createPrompt } = usePromptFiles()

    const path = await createPrompt({ title: 'Deploy Checklist!' })

    expect(path).toBe('.prompts/deploy-checklist-2.md')
    expect(writeTextFile).toHaveBeenCalledWith({
      rootId: 'workspace',
      path: '.prompts/deploy-checklist-2.md',
      content: '# Deploy Checklist!\n\n',
      create: true,
    })
  })

  it('stores favorite/default preferences per host and inserts prompts into chat draft', async () => {
    const { preferences: promptPreferences, toggleFavorite, setDefaultPrompt, usePromptInChat } = usePromptFiles()

    toggleFavorite('.prompts/deploy-checklist.md')
    setDefaultPrompt('.prompts/deploy-checklist.md')
    await usePromptInChat('Run this prompt')

    expect(promptPreferences.value).toEqual({
      favorites: ['.prompts/deploy-checklist.md'],
      defaultPath: '.prompts/deploy-checklist.md',
    })
    expect(persist).toHaveBeenCalledTimes(2)
    expect(navigateTo).toHaveBeenCalledWith('/')
    expect(draft.value).toBe('Run this prompt')
  })
})
