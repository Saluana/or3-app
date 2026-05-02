import { ref } from 'vue'
import type { FileSearchItem } from '~/types/or3-api'
import { useComputerFiles } from './useComputerFiles'

export interface FileMentionSuggestionItem extends FileSearchItem {
  id: string
  label: string
}

export function useFileMentionSuggestions() {
  const { searchWorkspaceFiles } = useComputerFiles()
  const loading = ref(false)
  const error = ref<string | null>(null)
  const results = ref<FileMentionSuggestionItem[]>([])

  let requestId = 0
  let timer: ReturnType<typeof setTimeout> | null = null

  async function search(query: string, limit = 12) {
    const trimmed = query.trim()
    requestId += 1
    const activeRequestId = requestId

    if (timer) clearTimeout(timer)

    if (!trimmed) {
      results.value = []
      error.value = null
      loading.value = false
      return []
    }

    return await new Promise<FileMentionSuggestionItem[]>((resolve) => {
      timer = setTimeout(async () => {
        loading.value = true
        error.value = null
        try {
          const items = await searchWorkspaceFiles(trimmed, limit)
          if (activeRequestId !== requestId) {
            resolve([])
            return
          }
          const nextResults = items.map((item) => ({
            ...item,
            id: `${item.root_id}:${item.path}`,
            label: item.name,
          }))
          results.value = nextResults
          resolve(nextResults)
        } catch (nextError: any) {
          if (activeRequestId !== requestId) {
            resolve([])
            return
          }
          error.value = nextError?.message || 'Could not search files right now.'
          results.value = []
          resolve([])
        } finally {
          if (activeRequestId === requestId) loading.value = false
        }
      }, 120)
    })
  }

  function reset() {
    if (timer) clearTimeout(timer)
    loading.value = false
    error.value = null
    results.value = []
  }

  return {
    loading,
    error,
    results,
    search,
    reset,
  }
}