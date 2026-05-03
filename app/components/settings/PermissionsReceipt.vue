<template>
    <SurfaceCard class-name="space-y-3">
        <div class="flex items-start gap-3">
            <RetroIcon name="i-pixelarticons-shield" size="sm" />
            <div class="min-w-0 flex-1">
                <p class="font-mono text-base font-semibold text-(--or3-text)">What OR3 can access</p>
                <p class="mt-1 text-xs leading-5 text-(--or3-text-muted)">
                    Plain-text receipt of the permissions OR3 currently has, based on your settings.
                </p>
            </div>
        </div>

        <ul class="space-y-2">
            <li
                v-for="(item, index) in items"
                :key="index"
                class="flex items-start gap-2 rounded-xl border border-(--or3-border) bg-white/70 px-3 py-2 text-sm leading-5"
            >
                <Icon
                    :name="item.allowed ? 'i-pixelarticons-check' : 'i-pixelarticons-close'"
                    class="mt-0.5 size-4 shrink-0"
                    :class="item.allowed ? 'text-(--or3-green-dark)' : 'text-(--or3-text-muted)'"
                />
                <span :class="item.allowed ? 'text-(--or3-text)' : 'text-(--or3-text-muted)'">{{ item.text }}</span>
            </li>
        </ul>
    </SurfaceCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ valueIndex: Record<string, unknown> }>()

interface Item {
    allowed: boolean
    text: string
}

const items = computed<Item[]>(() => {
    const v = props.valueIndex
    const list: Item[] = []

    const ws = String(v['workspace.workspaceDir'] ?? '').trim()
    if (ws) {
        list.push({ allowed: true, text: `OR3 can read files inside ${ws}.` })
        list.push({ allowed: true, text: `OR3 can write files inside ${ws}.` })
    } else {
        list.push({ allowed: false, text: 'No workspace folder is set.' })
    }

    const restrict = Boolean(v['tools.restrictToWorkspace'])
    list.push({
        allowed: restrict,
        text: restrict
            ? 'OR3 cannot access files outside the workspace.'
            : 'OR3 may access files outside the workspace.',
    })

    const network = Boolean(v['hardening.enableNetwork'])
    list.push({
        allowed: network,
        text: network ? 'OR3 can use the network and web tools.' : 'OR3 cannot reach the network.',
    })

    const exec = Boolean(v['hardening.enableExecShell'])
    list.push({
        allowed: exec,
        text: exec ? 'OR3 can run terminal commands when approved.' : 'OR3 cannot run terminal commands.',
    })

    for (const ch of ['telegram', 'slack', 'discord', 'whatsapp', 'email'] as const) {
        const enabled = Boolean(v[`channels.${ch}.enabled`])
        list.push({
            allowed: enabled,
            text: enabled
                ? `OR3 can send and receive messages on ${ch}.`
                : `OR3 cannot use ${ch}.`,
        })
    }

    const cron = Boolean(v['cron.enabled'])
    list.push({
        allowed: cron,
        text: cron ? 'OR3 may run scheduled tasks on its own.' : 'OR3 will not run scheduled tasks.',
    })

    const audit = Boolean(v['security.audit.enabled'])
    list.push({
        allowed: audit,
        text: audit ? 'OR3 keeps a tamper-evident safety log.' : 'OR3 is not keeping a safety log.',
    })

    return list
})
</script>
