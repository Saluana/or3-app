import { describe, expect, it } from 'vitest';
import { parseIncompleteMarkdown } from 'streamdown-vue';

import { shouldRepairIncompleteMarkdownForStatus } from '../../app/utils/streamingMarkdown';

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
});
