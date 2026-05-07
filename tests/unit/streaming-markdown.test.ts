import { describe, expect, it } from 'vitest';

import {
    repairStreamingMarkdownContent,
    shouldRepairIncompleteMarkdownForStatus,
} from '../../app/utils/streamingMarkdown'

describe('StreamingMarkdown', () => {
    it('does not append a fake trailing underscore for completed messages', () => {
        expect(
            repairStreamingMarkdownContent(
                'The `invalid_grant` error we have seen before.',
                shouldRepairIncompleteMarkdownForStatus('complete'),
            ),
        ).toBe(
            'The `invalid_grant` error we have seen before.',
        );
    });

    it('preserves inline code with underscores while a message is still streaming', () => {
        expect(
            repairStreamingMarkdownContent(
                'The `invalid_grant` error we have seen before.',
                shouldRepairIncompleteMarkdownForStatus('streaming'),
            ),
        ).toBe(
            'The `invalid_grant` error we have seen before.',
        )
    })

    it('still repairs incomplete emphasis while streaming', () => {
        expect(repairStreamingMarkdownContent('This is *unfinished', true)).toBe(
            'This is *unfinished*',
        )
    })

    it('closes an open fenced code block while streaming', () => {
        expect(
            repairStreamingMarkdownContent('```ts\nconst value = 1', true),
        ).toBe(
            '```ts\nconst value = 1\n```',
        );
    });
});
