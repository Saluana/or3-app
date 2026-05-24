import githubLight from '@shikijs/themes/github-light';
import type { ThemeRegistration } from 'shiki';

/** Swap GitHub-blue syntax colors for the or3 warm green palette. */
const FOREGROUND_REMAP: Record<string, string> = {
    '#005cc5': '#28623b',
    '#0366d6': '#487140',
    '#032f62': '#355431',
    '#2188ff': '#71a75f',
    '#6a737d': '#6f6a60',
};

function remapColor(color: string | undefined): string | undefined {
    if (!color) return color;
    return FOREGROUND_REMAP[color.toLowerCase()] ?? color;
}

function remapTokenColors(
    tokenColors: ThemeRegistration['tokenColors'],
): ThemeRegistration['tokenColors'] {
    return tokenColors.map((entry) => {
        const foreground = entry.settings?.foreground;
        if (!foreground || typeof foreground !== 'string') return entry;
        const next = remapColor(foreground);
        if (next === foreground) return entry;
        return {
            ...entry,
            settings: { ...entry.settings, foreground: next },
        };
    });
}

function remapThemeColors(
    colors: ThemeRegistration['colors'],
): ThemeRegistration['colors'] {
    const next = { ...colors };
    for (const key of Object.keys(next)) {
        const value = next[key];
        if (typeof value === 'string') {
            const remapped = remapColor(value);
            if (remapped) next[key] = remapped;
        }
    }
    next['editor.background'] = '#fffcf5';
    next['editor.foreground'] = '#24241f';
    return next;
}

/** Shiki theme aligned with or3-app cream + green branding. */
export const or3LightShikiTheme: ThemeRegistration = {
    ...githubLight,
    name: 'or3-light',
    displayName: 'OR3 Light',
    colors: remapThemeColors(githubLight.colors),
    tokenColors: remapTokenColors(githubLight.tokenColors ?? []),
};
