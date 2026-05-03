import type { FileRoot } from '~/types/or3-api';

function normalizedPath(path?: string) {
    return (path || '').replace(/\/+$/, '');
}

function rootScore(root: FileRoot) {
    const path = normalizedPath(root.path);
    let score = 0;

    if (path.endsWith('/or3-intern')) score += 120;
    else if (path.endsWith('/or3')) score += 110;
    else if (path.endsWith('/or3-app')) score += 100;

    if (root.id === 'workspace') score += 30;
    else if (root.id === 'cwd') score += 25;
    else if (root.id === 'home') score += 15;

    if (root.writable !== false) score += 5;
    return score;
}

export function selectServiceRestartRoot(roots: FileRoot[]) {
    return (
        [...roots]
            .filter((root) => root.writable !== false)
            .sort((left, right) => rootScore(right) - rootScore(left))[0] ??
        null
    );
}

export function buildServiceRestartCommand() {
    return [
        'set -eu',
        'try_restart_from_dir() {',
        '  dir="$1"',
        '  if [ -x "$dir/scripts/restart-service.sh" ]; then',
        '    cd "$dir"',
        '    scripts/restart-service.sh restart',
        '    exit 0',
        '  fi',
        '}',
        'for dir in . ../or3-intern or3-intern; do',
        '  try_restart_from_dir "$dir"',
        'done',
        'if command -v pgrep >/dev/null 2>&1 && command -v ps >/dev/null 2>&1; then',
        '  pid="$(pgrep -f "[o]r3-intern.* service|[g]o run ./cmd/or3-intern service" | head -n 1 || true)"',
        '  if [ -n "$pid" ]; then',
        '    bin=""',
        '    if [ -e "/proc/$pid/exe" ]; then',
        '      bin="$(readlink "/proc/$pid/exe" || true)"',
        '    fi',
        '    if [ -z "$bin" ] && command -v lsof >/dev/null 2>&1; then',
        '      bin="$(lsof -a -p "$pid" -d txt -Fn 2>/dev/null | sed -n "s/^n//p" | head -n 1 || true)"',
        '    fi',
        '    if [ -z "$bin" ]; then',
        '      bin="$(ps -ww -p "$pid" -o comm= | sed -n "1p" || true)"',
        '    fi',
        '    if [ -n "$bin" ] && [ ! -e "$bin" ]; then',
        '      resolved="$(command -v "$bin" 2>/dev/null || true)"',
        '      if [ -n "$resolved" ]; then',
        '        bin="$resolved"',
        '      fi',
        '    fi',
        '    if [ -n "$bin" ]; then',
        '      try_restart_from_dir "$(dirname "$bin")"',
        '    fi',
        '  fi',
        'fi',
        'echo "Could not find scripts/restart-service.sh from $PWD or nearby sibling folders." >&2',
        'exit 1',
    ].join('\n');
}
