import type { FileRoot } from '~/types/or3-api'

function normalizedPath(path?: string) {
  return (path || '').replace(/\/+$/, '')
}

function rootScore(root: FileRoot) {
  const path = normalizedPath(root.path)
  let score = 0

  if (path.endsWith('/or3-intern')) score += 120
  else if (path.endsWith('/or3')) score += 110
  else if (path.endsWith('/or3-app')) score += 100

  if (root.id === 'workspace') score += 30
  else if (root.id === 'cwd') score += 25
  else if (root.id === 'home') score += 15

  if (root.writable !== false) score += 5
  return score
}

export function selectServiceRestartRoot(roots: FileRoot[]) {
  return [...roots]
    .filter((root) => root.writable !== false)
    .sort((left, right) => rootScore(right) - rootScore(left))[0] ?? null
}

export function buildServiceRestartCommand() {
  return [
    'set -eu',
    'for dir in . ../or3-intern or3-intern; do',
    '  if [ -x "$dir/scripts/restart-service.sh" ]; then',
    '    cd "$dir"',
    '    scripts/restart-service.sh restart',
    '    exit 0',
    '  fi',
    'done',
    'echo "Could not find scripts/restart-service.sh from $PWD or nearby sibling folders." >&2',
    'exit 1',
  ].join('\n')
}
