import { describe, expect, it } from 'vitest';
import {
  envTextToMap,
  headerTextToMap,
  mapToEnvText,
  mapToHeaderText,
  splitCommandArgs,
} from '../../app/utils/mcpFormParsing';

describe('MCP form parsing', () => {
  it('round-trips env and header maps with their own delimiters', () => {
    expect(mapToEnvText({ API_KEY: 'configured' })).toBe('API_KEY=configured');
    expect(envTextToMap('API_KEY=configured')).toEqual({ API_KEY: 'configured' });

    expect(mapToHeaderText({ Authorization: 'configured' })).toBe('Authorization: configured');
    expect(headerTextToMap('Authorization: configured')).toEqual({ Authorization: 'configured' });
  });

  it('keeps quoted local MCP arguments together', () => {
    expect(splitCommandArgs('-y "@modelcontextprotocol/server-filesystem" "/Users/me/My Project"')).toEqual([
      '-y',
      '@modelcontextprotocol/server-filesystem',
      '/Users/me/My Project',
    ]);
  });
});
