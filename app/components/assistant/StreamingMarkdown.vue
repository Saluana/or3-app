<template>
    <StreamMarkdown
        :content="renderedContent"
        class-name="or3-prose"
        shiki-theme="or3-light"
        :parse-incomplete-markdown="false"
        :code-block-show-line-numbers="false"
    />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { StreamMarkdown } from 'streamdown-vue';

import { repairStreamingMarkdownContent } from '../../utils/streamingMarkdown';

const props = withDefaults(
    defineProps<{
        content: string;
        repairIncompleteMarkdown?: boolean;
    }>(),
    {
        repairIncompleteMarkdown: true,
    },
);

const renderedContent = computed(() =>
    repairStreamingMarkdownContent(
        props.content,
        props.repairIncompleteMarkdown,
    ),
);
</script>
