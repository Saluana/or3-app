import { computed, type Ref } from 'vue';
import type { useConfigure } from '~/composables/useConfigure';

export type RawConfigureFilterKey =
    | 'connection'
    | 'security'
    | 'safety'
    | 'agent-behavior'
    | 'knowledge'
    | 'advanced';

export const RAW_CONFIGURE_FILTERS: Array<{
    key: RawConfigureFilterKey;
    label: string;
}> = [
    { key: 'connection', label: 'Connection' },
    { key: 'security', label: 'Security' },
    { key: 'safety', label: 'Safety' },
    { key: 'agent-behavior', label: 'Agent behavior' },
    { key: 'knowledge', label: 'Knowledge' },
    { key: 'advanced', label: 'Advanced' },
];

export const RAW_CONFIGURE_GROUPS = [
    {
        key: 'connection',
        label: 'Connection',
        description:
            'Pair devices, review the current computer, and jump back into device trust.',
        icon: 'i-pixelarticons-link',
        route: '/settings/pair',
    },
    {
        key: 'security',
        label: 'Security',
        description:
            'Manage passkeys, signed-in sessions, and owner verification state.',
        icon: 'i-pixelarticons-shield',
        route: '/settings/security',
    },
    {
        key: 'safety',
        label: 'Safety',
        description:
            'Control hardening, session posture, and host protection behavior.',
        icon: 'i-pixelarticons-shield',
        route: null,
    },
    {
        key: 'agent-behavior',
        label: 'Agent Behavior',
        description:
            'Tune providers, runtime behavior, tools, skills, and automation.',
        icon: 'i-pixelarticons-robot',
        route: null,
    },
    {
        key: 'knowledge',
        label: 'Knowledge',
        description:
            'Adjust workspace, storage, indexing, and context-related settings.',
        icon: 'i-pixelarticons-book-open',
        route: null,
    },
    {
        key: 'advanced',
        label: 'Advanced',
        description:
            'Open the low-level section editor when you need direct host controls.',
        icon: 'i-pixelarticons-settings-cog-2',
        route: '/settings/service',
    },
] satisfies Array<{
    key: RawConfigureFilterKey;
    label: string;
    description: string;
    icon: string;
    route: string | null;
}>;

const QUICK_KEYS: Record<RawConfigureFilterKey, string[]> = {
    connection: ['workspace', 'storage', 'service'],
    security: ['security', 'session', 'service'],
    safety: ['security', 'session'],
    'agent-behavior': ['provider', 'runtime', 'skills', 'automation'],
    knowledge: ['workspace', 'storage', 'context'],
    advanced: ['context', 'service'],
};

const FILTER_MAP: Record<RawConfigureFilterKey, string[] | null> = {
    connection: ['workspace', 'storage', 'service', 'session'],
    security: ['security', 'session', 'service'],
    safety: ['security', 'session', 'service'],
    'agent-behavior': [
        'provider',
        'runtime',
        'context',
        'skills',
        'automation',
        'channels',
    ],
    knowledge: ['workspace', 'storage', 'context'],
    advanced: ['context', 'service'],
};

const ICON_MAP: Record<string, string> = {
    provider: 'i-pixelarticons-cpu',
    workspace: 'i-pixelarticons-folder',
    storage: 'i-pixelarticons-database',
    security: 'i-pixelarticons-shield',
    channels: 'i-pixelarticons-message-text',
    automation: 'i-pixelarticons-zap',
    runtime: 'i-pixelarticons-analytics',
    skills: 'i-pixelarticons-sparkle',
    session: 'i-pixelarticons-users',
    service: 'i-pixelarticons-monitor',
    context: 'i-pixelarticons-card-stack',
};

const FIELD_MATCH_LIMIT = 25;

export function iconForRawConfigureSection(key: string) {
    return ICON_MAP[key] ?? 'i-pixelarticons-settings-cog-2';
}

export function riskToneForField(
    risk?: string,
): 'green' | 'amber' | 'danger' | 'neutral' {
    if (risk === 'safe') return 'green';
    if (risk === 'warning' || risk === 'danger') return 'danger';
    if (risk === 'notice') return 'amber';
    return 'neutral';
}

type ConfigureApi = ReturnType<typeof useConfigure>;

export function useSettingsRawConfigureSearch(
    configure: ConfigureApi,
    searchTerm: Ref<string>,
    activeFilter: Ref<RawConfigureFilterKey>,
) {
    const { sections, fieldsBySection } = configure;

    function matchesSearch(text: string | undefined | null) {
        const query = searchTerm.value.trim().toLowerCase();
        if (!query) return true;
        return String(text ?? '')
            .toLowerCase()
            .includes(query);
    }

    const filteredSections = computed(() => {
        const allow = FILTER_MAP[activeFilter.value];
        return sections.value.filter((section) => {
            if (allow && !allow.includes(section.key)) return false;
            return [section.label, section.description, section.status].some(
                matchesSearch,
            );
        });
    });

    const quickSections = computed(() => {
        if (searchTerm.value.trim()) return [];
        return filteredSections.value.filter((section) =>
            QUICK_KEYS[activeFilter.value]?.includes(section.key),
        );
    });

    const activeFilterLabel = computed(
        () =>
            RAW_CONFIGURE_FILTERS.find(
                (filter) => filter.key === activeFilter.value,
            )?.label ?? 'Selected',
    );

    const listSections = computed(() => {
        const quickKeys = new Set(
            quickSections.value.map((section) => section.key),
        );
        return filteredSections.value.filter(
            (section) => !quickKeys.has(section.key),
        );
    });

    const fieldMatches = computed(() => {
        const query = searchTerm.value.trim().toLowerCase();
        if (!query) return [];
        const sectionLookup = new Map(
            sections.value.map((section) => [section.key, section]),
        );
        const allowedSectionKeys = FILTER_MAP[activeFilter.value];
        const results: Array<{
            sectionKey: string;
            sectionLabel: string;
            field: (typeof fieldsBySection.value)[string][number];
        }> = [];
        for (const [sectionKey, sectionFields] of Object.entries(
            fieldsBySection.value,
        )) {
            if (allowedSectionKeys && !allowedSectionKeys.includes(sectionKey)) {
                continue;
            }
            const sectionLabel =
                sectionLookup.get(sectionKey)?.label ?? sectionKey;
            for (const field of sectionFields) {
                const haystack = [
                    field.label,
                    field.description,
                    field.key,
                    field.placeholder,
                    field.emptyHint,
                ]
                    .map((value) => String(value ?? '').toLowerCase())
                    .join(' \u0001 ');
                if (haystack.includes(query)) {
                    results.push({ sectionKey, sectionLabel, field });
                    if (results.length >= FIELD_MATCH_LIMIT) return results;
                }
            }
        }
        return results;
    });

    return {
        filteredSections,
        quickSections,
        activeFilterLabel,
        listSections,
        fieldMatches,
    };
}
