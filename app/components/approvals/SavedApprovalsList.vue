<template>
    <section class="or3-saved-block">
        <header class="flex items-center justify-between">
            <p
                class="font-mono text-[0.95rem] font-semibold tracking-tight text-(--or3-text)"
            >
                Saved approvals
            </p>
            <button
                v-if="!showSectionHeader"
                type="button"
                class="text-sm font-medium text-(--or3-green-dark) hover:underline"
                @click="$emit('manage')"
            >
                Manage
            </button>
        </header>

        <p
            v-if="showSectionHeader"
            class="mt-1 text-sm leading-6 text-(--or3-text-muted)"
        >
            or3-intern won't ask again for actions you've already remembered.
            Remove a rule to start being asked again.
        </p>

        <div v-if="!items.length" class="or3-saved-block__empty">
            <Icon name="i-lucide-bookmark" class="size-5 text-(--or3-text-muted)" />
            <p class="mt-2 font-mono text-sm font-semibold text-(--or3-text)">
                Nothing saved yet
            </p>
            <p
                class="mx-auto mt-1 max-w-xs text-xs leading-5 text-(--or3-text-muted)"
            >
                When you tap "Approve &amp; remember" on a request, it will
                show up here.
            </p>
        </div>

        <ul v-else class="mt-3 space-y-2">
            <li v-for="item in items" :key="String(item.id)">
                <div class="or3-saved-row">
                    <span class="or3-saved-row__icon">
                        <Icon
                            :name="iconFor(item)"
                            class="size-4 text-(--or3-text)"
                        />
                    </span>
                    <div class="min-w-0 flex-1">
                        <p
                            class="font-mono text-[0.92rem] font-semibold text-(--or3-text) truncate"
                        >
                            {{ titleFor(item) }}
                        </p>
                        <p
                            class="mt-0.5 font-mono text-[0.78rem] text-(--or3-text-muted) truncate"
                        >
                            {{ subtitleFor(item) }}
                        </p>
                    </div>
                    <div class="flex items-center gap-1">
                        <span
                            class="text-xs font-medium text-(--or3-text-muted) whitespace-nowrap"
                        >
                            Always approve
                        </span>
                        <Icon
                            name="i-lucide-chevron-right"
                            class="size-4 text-(--or3-text-muted)"
                        />
                    </div>
                </div>
                <button
                    v-if="showSectionHeader"
                    type="button"
                    class="mt-1 text-xs font-medium text-(--or3-danger) hover:underline"
                    @click="$emit('remove', item.id)"
                >
                    Remove rule
                </button>
            </li>
        </ul>
    </section>
</template>

<script setup lang="ts">
import type { ApprovalAllowlist } from '~/types/or3-api';

withDefaults(
    defineProps<{
        items: ApprovalAllowlist[];
        showSectionHeader?: boolean;
    }>(),
    { showSectionHeader: false },
);

defineEmits<{
    remove: [id: ApprovalAllowlist['id']];
    manage: [];
}>();

function iconFor(item: ApprovalAllowlist): string {
    const domain = (item.domain || '').toLowerCase();
    if (domain.includes('exec') || domain.includes('shell') || domain.includes('command'))
        return 'i-lucide-terminal';
    if (domain.includes('file') || domain.includes('write') || domain.includes('doc'))
        return 'i-lucide-file-text';
    if (domain.includes('net') || domain.includes('http')) return 'i-lucide-globe';
    return 'i-lucide-bookmark';
}

function titleFor(item: ApprovalAllowlist): string {
    const m = (item.matcher ?? {}) as Record<string, unknown>;
    const s = (item.scope ?? {}) as Record<string, unknown>;
    return (
        (m.label as string) ||
        (m.title as string) ||
        (s.label as string) ||
        prettyDomain(item.domain) ||
        'Saved approval'
    );
}

function subtitleFor(item: ApprovalAllowlist): string {
    const m = (item.matcher ?? {}) as Record<string, unknown>;
    const s = (item.scope ?? {}) as Record<string, unknown>;
    const candidate =
        (m.pattern as string) ||
        (m.command as string) ||
        (m.path as string) ||
        (s.pattern as string) ||
        (s.path as string) ||
        '';
    if (candidate) return candidate;
    if (item.matcher && typeof item.matcher === 'object') {
        try {
            const parts = Object.entries(item.matcher)
                .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
                .slice(0, 2);
            return parts.join(' · ');
        } catch {
            /* ignore */
        }
    }
    return item.domain || '';
}

function prettyDomain(domain?: string): string {
    if (!domain) return '';
    if (domain === 'exec') return 'Allow safe install commands';
    if (domain === 'file_write') return 'Docs updates';
    if (domain === 'network') return 'Allow trusted endpoints';
    return domain.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
</script>

<style scoped>
.or3-saved-block {
    padding: 0.25rem 0.25rem 0;
}

.or3-saved-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.7rem 0.85rem;
    background: var(--or3-surface);
    border: 1px solid var(--or3-border);
    border-radius: 16px;
    box-shadow: var(--or3-shadow-soft);
}

.or3-saved-row__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--or3-surface-soft) 70%, white 30%);
    border: 1px solid var(--or3-border);
    flex-shrink: 0;
}

.or3-saved-block__empty {
    margin-top: 0.75rem;
    padding: 1.25rem 1rem;
    text-align: center;
    border: 1px dashed var(--or3-border);
    border-radius: 16px;
    background: color-mix(in srgb, var(--or3-surface) 80%, white 20%);
}
</style>
