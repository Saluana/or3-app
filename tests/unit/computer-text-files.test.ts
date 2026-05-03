import { beforeEach, describe, expect, it, vi } from 'vitest'

const apiRequest = vi.fn()
const retryWithAuth = vi.fn((handler: (onAuthChallenge: unknown) => Promise<unknown>) => handler(vi.fn()))
const downloadFile = vi.fn()
const statPath = vi.fn()

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

vi.mock('../../app/composables/useComputerFiles', () => ({
  useComputerFiles: () => ({
    downloadFile,
    statPath,
  }),
}))

import { canEditFile, useComputerTextFiles } from '../../app/composables/useComputerTextFiles'

describe('useComputerTextFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('falls back to download/stat reads when the text read endpoint is unavailable', async () => {
    apiRequest.mockRejectedValueOnce({ status: 404, message: 'file route not found' })
    downloadFile.mockResolvedValueOnce(new Blob(['# Draft\n']))
    statPath.mockResolvedValueOnce({
      name: 'draft.md',
      path: 'docs/draft.md',
      type: 'file',
      size: 8,
      modified_at: '2026-01-01T00:00:00Z',
      mime_type: 'text/markdown',
    })

    const { readTextFile } = useComputerTextFiles()
    const document = await readTextFile({ rootId: 'workspace', path: 'docs/draft.md' })

    expect(apiRequest).toHaveBeenCalledWith('/internal/v1/files/read?root_id=workspace&path=docs%2Fdraft.md', expect.any(Object))
    expect(downloadFile).toHaveBeenCalledWith({ path: 'docs/draft.md' }, 'workspace')
    expect(statPath).toHaveBeenCalledWith('workspace', 'docs/draft.md')
    expect(document).toMatchObject({
      rootId: 'workspace',
      path: 'docs/draft.md',
      name: 'draft.md',
      content: '# Draft\n',
      writable: true,
    })
  })

  it('sends root-scoped write payloads through the text write endpoint', async () => {
    apiRequest.mockResolvedValueOnce({
      root_id: 'workspace',
      path: 'docs/draft.md',
      status: 'written',
      modified_at: '2026-01-01T00:00:01Z',
      revision: 'rev2',
    })

    const { writeTextFile } = useComputerTextFiles()
    await writeTextFile({
      rootId: 'workspace',
      path: 'docs/draft.md',
      content: '# Updated\n',
      expectedRevision: 'rev1',
      create: false,
    })

    expect(apiRequest).toHaveBeenCalledWith('/internal/v1/files/write', expect.objectContaining({
      method: 'PUT',
      body: {
        root_id: 'workspace',
        path: 'docs/draft.md',
        content: '# Updated\n',
        expected_revision: 'rev1',
        create: false,
      },
    }))
  })

  it('maps write conflicts to file_conflict with current metadata', async () => {
    apiRequest.mockRejectedValueOnce({
      status: 409,
      message: 'file has changed on disk',
      current_revision: 'rev2',
      modified_at: '2026-01-01T00:00:02Z',
    })

    const { writeTextFile } = useComputerTextFiles()

    await expect(writeTextFile({
      rootId: 'workspace',
      path: 'docs/draft.md',
      content: '# Updated\n',
      expectedRevision: 'rev1',
    })).rejects.toMatchObject({
      code: 'file_conflict',
      currentRevision: 'rev2',
      modifiedAt: '2026-01-01T00:00:02Z',
    })
  })

  it('detects editable text extensions and rejects oversized or unsupported files', () => {
    expect(canEditFile({ name: 'notes.md', type: 'file', size: 100 })).toBe(true)
    expect(canEditFile({ name: 'config.json', type: 'file', size: 100 })).toBe(true)
    expect(canEditFile({ name: 'image.png', type: 'file', size: 100, mime_type: 'image/png' })).toBe(false)
    expect(canEditFile({ name: 'large.md', type: 'file', size: 1024 * 1024 + 1 })).toBe(false)
    expect(canEditFile({ name: 'docs', type: 'directory', size: 0 })).toBe(false)
  })
})
