<template>
    <StreamMarkdown
        :content="content"
        class-name="prose prose-stone max-w-none text-sm leading-6 prose-pre:rounded-2xl prose-pre:border prose-pre:border-stone-200 prose-pre:bg-stone-950"
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
