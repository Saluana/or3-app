import type { Or3AppError } from '~/types/app-state'
import type { FileEntry, FileReadResponse, FileWriteRequest, FileWriteResponse } from '~/types/or3-api'
import { useAuthSession } from './useAuthSession'
import { useComputerFiles } from './useComputerFiles'
import { useOr3Api } from './useOr3Api'

const EDITABLE_FILE_PATTERN = /\.(md|markdown|txt|text|json|jsonc|ya?ml|toml|ini|cfg|conf|env|csv|ts|tsx|js|jsx|mjs|cjs|vue|go|py|rb|php|java|kt|swift|sql|html|css|scss|sass|sh|zsh|bash|xml)$/i
const INLINE_TEXT_FILE_LIMIT = 1024 * 1024

export interface ReadTextFileOptions {
  rootId: string
  path: string
}

export interface WriteTextFileOptions extends ReadTextFileOptions {
  content: string
  expectedRevision?: string
  create?: boolean
}

export interface ComputerTextFileDocument {
  rootId: string
  path: string
  name: string
  mimeType?: string
  size?: number
  modifiedAt?: string
  revision: string
  writable: boolean
  content: string
}

function createFileError(code: Or3AppError['code'], message: string, status?: number, extras: Record<string, unknown> = {}) {
  return {
    code,
    message,
    status,
    ...extras,
  } satisfies Or3AppError & Record<string, unknown>
}

function normalizeFileError(error: any): Or3AppError {
  const status = typeof error?.status === 'number' ? error.status : undefined
  const message = String(error?.message || error?.error || 'File request failed.')
  const rawCode = String(error?.code || '').trim().toLowerCase()

  if (rawCode === 'file_not_found' || status === 404) {
    return createFileError('file_not_found', 'That file could not be found on this computer.', status)
  }
  if (status === 403 || /read-only/i.test(message)) {
    return createFileError('file_read_only', 'This location is read-only, so OR3 cannot save changes there.', status)
  }
  if (status === 409) {
    return createFileError('file_conflict', 'This file changed on disk before your save finished.', status, {
      currentRevision: error?.current_revision,
      modifiedAt: error?.modified_at,
    })
  }
  if (/too large/i.test(message)) {
    return createFileError('file_too_large', 'This file is too large for the inline editor right now.', status)
  }
  if (/supported text/i.test(message) || /not a supported text/i.test(message)) {
    return createFileError('file_unsupported', 'This file type is not supported by the editor yet.', status)
  }
  if (/not a file/i.test(message) || /directory/i.test(message)) {
    return createFileError('invalid_file_target', 'Choose a file instead of a folder to open the editor.', status)
  }

  return createFileError(error?.code || 'unknown', message, status)
}

export function canEditFile(entry: Pick<FileEntry, 'name' | 'mime_type' | 'type' | 'size'> | null | undefined) {
  if (!entry || entry.type !== 'file') return false
  if (typeof entry.size === 'number' && entry.size > INLINE_TEXT_FILE_LIMIT) return false
  const mimeType = entry.mime_type?.toLowerCase() || ''
  if (mimeType.startsWith('text/')) return true
  if (mimeType.includes('json') || mimeType.includes('xml') || mimeType.includes('javascript')) return true
  return EDITABLE_FILE_PATTERN.test(entry.name)
}

export function useComputerTextFiles() {
  const api = useOr3Api()
  const authSession = useAuthSession()
  const { downloadFile, statPath } = useComputerFiles()

  async function readTextFile(options: ReadTextFileOptions): Promise<ComputerTextFileDocument> {
    const params = new URLSearchParams({ root_id: options.rootId, path: options.path })

    try {
      const response = await authSession.retryWithAuth((onAuthChallenge) => api.request<FileReadResponse>(`/internal/v1/files/read?${params.toString()}`, {
        onAuthChallenge,
      }), 'files-read')

      return {
        rootId: response.root_id,
        path: response.path,
        name: response.name,
        mimeType: response.mime_type,
        size: response.size,
        modifiedAt: response.modified_at,
        revision: response.revision,
        writable: response.writable,
        content: response.content,
      }
    } catch (error: any) {
      const normalized = normalizeFileError(error)
      const canFallback = normalized.code === 'file_not_found'
        ? false
        : normalized.status === 404 || normalized.status === 405 || normalized.status === 501

      if (!canFallback) throw normalized

      try {
        const [blob, info] = await Promise.all([
          downloadFile({ path: options.path }, options.rootId),
          statPath(options.rootId, options.path),
        ])
        if (!canEditFile(info)) {
          throw createFileError('file_unsupported', 'This file type is not supported by the editor yet.')
        }
        const content = await blob.text()
        return {
          rootId: options.rootId,
          path: options.path,
          name: info?.name || options.path.split('/').filter(Boolean).pop() || options.path,
          mimeType: info?.mime_type,
          size: info?.size,
          modifiedAt: info?.modified_at,
          revision: `${info?.modified_at || ''}:${info?.size || 0}`,
          writable: true,
          content,
        }
      } catch (fallbackError: any) {
        throw normalizeFileError(fallbackError)
      }
    }
  }

  async function writeTextFile(options: WriteTextFileOptions): Promise<FileWriteResponse> {
    const payload: FileWriteRequest = {
      root_id: options.rootId,
      path: options.path,
      content: options.content,
      expected_revision: options.expectedRevision,
      create: options.create,
    }

    try {
      return await authSession.retryWithAuth((onAuthChallenge) => api.request<FileWriteResponse>('/internal/v1/files/write', {
        method: 'PUT',
        body: payload,
        onAuthChallenge,
      }), options.create ? 'files-create' : 'files-write')
    } catch (error: any) {
      throw normalizeFileError(error)
    }
  }

  return {
    canEditFile,
    readTextFile,
    writeTextFile,
  }
}