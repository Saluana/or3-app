import { describe, expect, it } from 'vitest';
import {
  buildServiceRestartCommand,
  selectServiceRestartRoot,
} from '../../app/utils/or3/service-restart';

describe('service restart helpers', () => {
  it('prefers an or3-intern root when it is available', () => {
    const selected = selectServiceRestartRoot([
      { id: 'home', label: 'Home', path: '/Users/me', writable: true },
      { id: 'workspace', label: 'Workspace', path: '/Users/me/or3/or3-app', writable: true },
      { id: 'cwd', label: 'Current folder', path: '/Users/me/or3/or3-intern', writable: true },
    ]);

    expect(selected?.id).toBe('cwd');
  });

  it('falls back to a writable workspace root before home', () => {
    const selected = selectServiceRestartRoot([
      { id: 'home', label: 'Home', path: '/Users/me', writable: true },
      { id: 'workspace', label: 'Workspace', path: '/Users/me/or3', writable: true },
    ]);

    expect(selected?.id).toBe('workspace');
  });

  it('builds a shell command that checks the known nearby repo layouts', () => {
    const command = buildServiceRestartCommand();

    expect(command).toContain('../or3-intern');
    expect(command).toContain('or3-intern');
    expect(command).toContain('scripts/restart-service.sh restart');
  });
});
