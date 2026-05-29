<template>
    <StreamMarkdown
        :content="displayContent"
        class-name="or3-prose"
        shiki-theme="or3-light"
        :parse-incomplete-markdown="repairIncompleteMarkdown"
        :code-block-show-line-numbers="false"
    />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { StreamMarkdown } from 'streamdown-vue';
import { normalizeMarkdownForDisplay } from '~/utils/streamingMarkdown';

const props = withDefaults(
    defineProps<{
        content: string;
        repairIncompleteMarkdown?: boolean;
    }>(),
    {
        repairIncompleteMarkdown: true,
    },
);

const displayContent = computed(() =>
    normalizeMarkdownForDisplay(props.content),
);
</script>
