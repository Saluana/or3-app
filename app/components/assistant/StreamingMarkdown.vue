<template>
    <StreamMarkdown
        :content="content"
        class-name="or3-prose"
        shiki-theme="or3-light"
        :parse-incomplete-markdown="repairIncompleteMarkdown"
        :code-block-show-line-numbers="false"
    />
</template>

<script setup lang="ts">
import { StreamMarkdown } from 'streamdown-vue';

withDefaults(
    defineProps<{
        content: string;
        repairIncompleteMarkdown?: boolean;
    }>(),
    {
        repairIncompleteMarkdown: true,
    },
);
</script>
