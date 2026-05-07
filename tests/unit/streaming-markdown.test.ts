import { describe, expect, it } from 'vitest';
import { parseIncompleteMarkdown } from 'streamdown-vue';

import { shouldRepairIncompleteMarkdownForStatus } from '../../app/utils/streamingMarkdown';

function renderContentForStatus(status: 'streaming' | 'complete') {
    const content = 'The `invalid_grant` error we have seen before.';

    return shouldRepairIncompleteMarkdownForStatus(status)
        ? parseIncompleteMarkdown(content)
        : content;
}

describe('StreamingMarkdown', () => {
    it('does not append a fake trailing underscore for completed messages', () => {
        expect(renderContentForStatus('complete')).toBe(
            'The `invalid_grant` error we have seen before.',
        );
    });

    it('keeps repair enabled while a message is still streaming', () => {
        expect(renderContentForStatus('streaming')).toBe(
            'The `invalid_grant` error we have seen before._',
        );
    });
});
