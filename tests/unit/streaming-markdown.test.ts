import { describe, expect, it } from 'vitest';
import { parseIncompleteMarkdown } from 'streamdown-vue';

import {
    buildAssistantRenderBlocks,
    fixMarkdownTableSeparators,
    normalizeMarkdownForDisplay,
    shouldRepairIncompleteMarkdownForStatus,
    splitConcatenatedTableRows,
} from '../../app/utils/streamingMarkdown';

describe('StreamingMarkdown', () => {
    it('lets streamdown-vue repair incomplete markdown without corrupting inline code', () => {
        expect(
            parseIncompleteMarkdown(
                'The `invalid_grant` error we have seen before.',
            ),
        ).toBe('The `invalid_grant` error we have seen before.');
    });

    it('keeps streamdown-vue incomplete emphasis repair working', () => {
        expect(parseIncompleteMarkdown('This is *unfinished')).toBe(
            'This is *unfinished*',
        );
    });

    it('only asks streamdown-vue to repair messages while they are streaming', () => {
        expect(shouldRepairIncompleteMarkdownForStatus('streaming')).toBe(true);
        expect(shouldRepairIncompleteMarkdownForStatus('complete')).toBe(false);
    });

    it('splits table rows glued together on one line', () => {
        const input =
            '| Directory | Description | |---| | cmd/ | CLI entrypoint | | internal/ | Core packages |';
        const output = splitConcatenatedTableRows(input);
        expect(output).toContain('| Directory | Description |\n|---|');
        expect(output).toContain('\n| cmd/ | CLI entrypoint |');
    });

    it('splits rows that use double pipes between cells', () => {
        const input = '| one | two || | three | four |';
        const output = splitConcatenatedTableRows(input);
        expect(output).toMatch(/one \| two/);
        expect(output).toContain('| three | four |');
        expect(output.split('\n').length).toBeGreaterThan(1);
    });

    it('expands a one-column separator to match the header width', () => {
        const input = [
            '| File | Type | Size | Description |',
            '|---|',
            '| README.md | Doc | 8.6 KB | Project readme |',
        ].join('\n');
        expect(fixMarkdownTableSeparators(input)).toContain(
            '|---|---|---|---|',
        );
    });

    it('normalizes markdown end-to-end for display', () => {
        const input =
            '| A | B |\n|---|\n| one | two || | three | four |';
        const normalized = normalizeMarkdownForDisplay(input);
        expect(normalized).toContain('|---|---|');
        expect(normalized).toContain('| three | four |');
        expect(normalized.split('\n').length).toBeGreaterThanOrEqual(3);
    });

    it('merges consecutive text parts so tables are not split across renderers', () => {
        const blocks = buildAssistantRenderBlocks({
            status: 'complete',
            content: '| A | B |\n|---|---|\n| 1 | 2 |',
            parts: [
                { id: 'text:1', type: 'text', content: '| A | B |\n|---|\n' },
                {
                    id: 'tool:1',
                    type: 'tool',
                    name: 'read_file',
                    toolCallId: 'call_1',
                    status: 'complete',
                },
                { id: 'text:2', type: 'text', content: '| 1 | 2 |' },
            ],
        });
        expect(blocks).toHaveLength(3);
        expect(blocks[0]).toMatchObject({ kind: 'markdown' });
        expect((blocks[0] as { content: string }).content).toContain('|---|');
        expect((blocks[0] as { content: string }).content).not.toContain('| 1 | 2 |');
        expect(blocks[2]).toMatchObject({
            kind: 'markdown',
            content: '| 1 | 2 |',
        });
    });

    it('uses full message content when there are no tool parts', () => {
        const blocks = buildAssistantRenderBlocks({
            status: 'complete',
            content: '| A | B |\n|---|---|\n| 1 | 2 |',
            parts: [
                { id: 'text:1', type: 'text', content: '| A | B |\n|---|\n' },
                { id: 'text:2', type: 'text', content: '| 1 | 2 |' },
            ],
        });
        expect(blocks).toHaveLength(1);
        expect((blocks[0] as { content: string }).content).toBe(
            '| A | B |\n|---|---|\n| 1 | 2 |',
        );
    });
});
