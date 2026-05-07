import { parseIncompleteMarkdown } from 'streamdown-vue'

import type { ChatMessage } from '../types/app-state'

export function shouldRepairIncompleteMarkdownForStatus(
    status: ChatMessage['status'] | null | undefined,
): boolean {
    return status === 'streaming'
}

function maskBalancedCodeSpans(content: string) {
    const codeSpans: string[] = []
    const masked = content.replace(/(`+)([^\n]*?)\1/g, (segment) => {
        const index = codeSpans.push(segment) - 1
        return `OR3CODETOKEN${index}X`
    })

    return { masked, codeSpans }
}

function restoreBalancedCodeSpans(content: string, codeSpans: string[]) {
    return codeSpans.reduce(
        (result, segment, index) =>
            result.replaceAll(`OR3CODETOKEN${index}X`, segment),
        content,
    )
}

function closeOpenCodeFence(content: string) {
    const lines = content.replace(/\r\n?/g, '\n').split('\n')
    const fences = lines
        .map((line) => line.match(/^\s*([`~]{3,})/))
        .filter((match): match is RegExpMatchArray => Boolean(match))

    if (fences.length % 2 === 0) return content

    const closingFence = fences.at(-1)?.[1] ?? '```'

    return `${content}${content.endsWith('\n') ? '' : '\n'}${closingFence}`
}

export function repairStreamingMarkdownContent(
    content: string,
    repairIncompleteMarkdown: boolean,
): string {
    if (!repairIncompleteMarkdown || !content) return content

    const closedContent = closeOpenCodeFence(content)
    const { masked, codeSpans } = maskBalancedCodeSpans(closedContent)
    const repaired = parseIncompleteMarkdown(masked)
    const restored = restoreBalancedCodeSpans(repaired, codeSpans)

    return restored
}
