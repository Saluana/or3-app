import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const apiRequest = vi.fn()
const retryWithAuth = vi.fn((handler: (onAuthChallenge: unknown) => Promise<unknown>) => handler(vi.fn()))
const fetchMock = vi.fn()

vi.mock('../../app/composables/useOr3Api', () => ({
  useOr3Api: () => ({
    request: apiRequest,
    buildUrl: (path: string) => `http://example.test${path}`,
  }),
}))

vi.mock('../../app/composables/useAuthSession', () => ({
  useAuthSession: () => ({
    retryWithAuth,
  }),
}))

vi.mock('../../app/composables/useActiveHost', () => ({
  useActiveHost: () => ({
    activeHost: ref({ id: 'host-1' }),
  }),
}))

vi.mock('../../app/composables/useSecureHostTokens', () => ({
  resolveHostAuthTokens: () => ({
    authToken: 'token-1',
    sessionToken: 'session-1',
  }),
}))

import { useComputerFiles } from '../../app/composables/useComputerFiles'

describe('useComputerFiles targeted helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', fetchMock)
  })

  it('creates nested directories without changing shared browser path state', async () => {
    apiRequest.mockImplementation(async (path: string, init?: { body?: any }) => {
      if (path.startsWith('/internal/v1/files/stat?')) {
        const url = new URL(`http://example.test${path}`)
        const targetPath = url.searchParams.get('path')
        if (targetPath === '.uploads' || targetPath === '.uploads/session-1') {
          throw new Error('missing')
        }
      }
      if (path === '/internal/v1/files/mkdir') {
        return {
          root_id: init?.body?.root_id,
          path: init?.body?.path,
          status: 'created',
        }
      }
      throw new Error(`unexpected request: ${path}`)
    })

    const files = useComputerFiles()
    files.currentRootId.value = 'allowed'
    files.currentPath.value = 'notes'

    const result = await files.ensureDirectoryPath('.uploads/session-1', 'workspace')

    expect(result).toEqual({ rootId: 'workspace', path: '.uploads/session-1' })
    expect(apiRequest).toHaveBeenCalledWith('/internal/v1/files/mkdir', expect.objectContaining({
      method: 'POST',
      body: { root_id: 'workspace', path: '.', name: '.uploads' },
    }))
    expect(apiRequest).toHaveBeenCalledWith('/internal/v1/files/mkdir', expect.objectContaining({
      method: 'POST',
      body: { root_id: 'workspace', path: '.uploads', name: 'session-1' },
    }))
    expect(files.currentRootId.value).toBe('allowed')
    expect(files.currentPath.value).toBe('notes')
  })

  it('uploads files to an explicit target path without mutating current browsing state', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ root_id: 'workspace', path: '.uploads/session-1/diagram.png', status: 'uploaded' }),
    })

    const files = useComputerFiles()
    files.currentRootId.value = 'allowed'
    files.currentPath.value = 'notes'

    const payload = new File(['image-bytes'], 'diagram.png', { type: 'image/png' })
    const uploaded = await files.uploadFilesToPath([payload], 'workspace', '.uploads/session-1')

    expect(uploaded).toEqual([
      { root_id: 'workspace', path: '.uploads/session-1/diagram.png', status: 'uploaded' },
    ])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, init] = fetchMock.mock.calls[0] as [string, { body: FormData; headers: Record<string, string> }]
    expect(init.headers.Authorization).toBe('Bearer token-1')
    expect(init.headers['X-Or3-Session']).toBe('session-1')
    expect(init.body.get('root_id')).toBe('workspace')
    expect(init.body.get('path')).toBe('.uploads/session-1')
    expect((init.body.get('file') as File)?.name).toBe('diagram.png')
    expect(files.currentRootId.value).toBe('allowed')
    expect(files.currentPath.value).toBe('notes')
  })
})
