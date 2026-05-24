import { useShikiHighlighter } from 'streamdown-vue';

import { or3LightShikiTheme } from '~/utils/or3ShikiTheme';

export default defineNuxtPlugin(async () => {
    const highlighter = await useShikiHighlighter();
    await highlighter.loadTheme(or3LightShikiTheme);
});
