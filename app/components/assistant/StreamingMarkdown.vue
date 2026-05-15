<template>
    <StreamMarkdown
        :content="renderedContent"
        class-name="prose prose-stone max-w-none text-sm leading-6 prose-ul:list-disc prose-ul:pl-6 prose-ul:my-3 prose-ol:list-decimal prose-ol:pl-6 prose-ol:my-3 prose-li:my-1 prose-li:marker:text-(--or3-text-muted) prose-pre:rounded-2xl prose-pre:border prose-pre:border-stone-200 prose-pre:bg-stone-950"
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
