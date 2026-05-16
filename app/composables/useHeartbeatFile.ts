import type { FileRoot } from '~/types/or3-api'
import type { ComputerTextFileDocument } from './useComputerTextFiles'
import { useComputerFiles } from './useComputerFiles'
import { useComputerTextFiles } from './useComputerTextFiles'

export const HEARTBEAT_ROOT_ID = 'workspace'
export const HEARTBEAT_CANDIDATE_PATHS = ['HEARTBEAT.md', 'heartbeat.md'] as const

export const HEARTBEAT_STARTER_TEMPLATE = `# Heartbeat

Use this note for the standing work OR3 should review every time it checks in.

## Keep an eye on
- Review the most important open work and anything overdue.
- Look for blockers, urgent issues, or follow-ups that need attention.
- Surface the clearest next steps when something important changes.

## How to work
- Keep updates short, practical, and easy to act on.
- Ignore anything already finished or no longer relevant.
- If there is nothing important to do, stay quiet.
`

export interface HeartbeatDocument extends ComputerTextFileDocument {
  exists: boolean
}

export function useHeartbeatFile() {
  const { readTextFile, writeTextFile } = useComputerTextFiles()
  const computerFiles = useComputerFiles()

  async function getWorkspaceRoot(): Promise<FileRoot> {
    const roots = await computerFiles.loadRoots()
    const workspaceRoot = roots.find((root) => root.id === HEARTBEAT_ROOT_ID)
    if (!workspaceRoot) {
      throw new Error('This computer does not expose a workspace root, so OR3 cannot set up heartbeat notes here yet.')
    }
    return workspaceRoot
  }

  async function resolveHeartbeatPath() {
    const workspaceRoot = await getWorkspaceRoot()
    for (const candidatePath of HEARTBEAT_CANDIDATE_PATHS) {
      const item = await computerFiles.statPath(workspaceRoot.id, candidatePath)
      if (item?.type === 'file') {
        return {
          rootId: workspaceRoot.id,
          path: candidatePath,
          exists: true,
        }
      }
    }
    return {
      rootId: workspaceRoot.id,
      path: HEARTBEAT_CANDIDATE_PATHS[0],
      exists: false,
    }
  }

  async function loadHeartbeatFile(): Promise<HeartbeatDocument> {
    const resolved = await resolveHeartbeatPath()
    if (resolved.exists) {
      const document = await readTextFile({
        rootId: resolved.rootId,
        path: resolved.path,
      })
      return {
        ...document,
        exists: true,
      }
    }

    const workspaceRoot = await getWorkspaceRoot()
    return {
      rootId: workspaceRoot.id,
      path: resolved.path,
      name: HEARTBEAT_CANDIDATE_PATHS[0],
      revision: '',
      writable: Boolean(workspaceRoot.writable),
      content: HEARTBEAT_STARTER_TEMPLATE,
      exists: false,
    }
  }

  async function saveHeartbeatFile(document: HeartbeatDocument, content: string) {
    const response = await writeTextFile({
      rootId: document.rootId,
      path: document.path,
      content,
      expectedRevision: document.exists ? document.revision : undefined,
      create: !document.exists,
    })

    return {
      ...document,
      content,
      exists: true,
      revision: response.revision,
      modifiedAt: response.modified_at || new Date().toISOString(),
    } satisfies HeartbeatDocument
  }

  return {
    loadHeartbeatFile,
    saveHeartbeatFile,
  }
}