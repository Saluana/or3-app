import type { RouteLocationNormalizedLoaded, RouteLocationRaw } from 'vue-router'

export interface ComputerEditorRouteState {
  rootId: string
  path: string
  returnRootId: string
  returnPath: string
}

function queryString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value : fallback
}

export function buildComputerEditorRoute(state: {
  rootId: string
  path: string
  returnRootId?: string
  returnPath?: string
}): RouteLocationRaw {
  return {
    path: '/computer/edit',
    query: {
      root: state.rootId,
      path: state.path,
      returnRoot: state.returnRootId || state.rootId,
      returnPath: state.returnPath || '.',
    },
  }
}

export function readComputerEditorRoute(route: Pick<RouteLocationNormalizedLoaded, 'query'>): ComputerEditorRouteState {
  const rootId = queryString(route.query.root)
  const path = queryString(route.query.path)
  const returnRootId = queryString(route.query.returnRoot, rootId)
  const returnPath = queryString(route.query.returnPath, '.')

  return {
    rootId,
    path,
    returnRootId,
    returnPath,
  }
}

export function buildComputerFilesReturnRoute(rootId: string, path: string): RouteLocationRaw {
  return {
    path: '/computer/files',
    query: {
      root: rootId,
      path,
    },
  }
}