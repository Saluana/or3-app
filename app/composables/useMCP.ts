import { ref } from 'vue'
import type {
    MCPServerConfig,
    MCPServerDetail,
    MCPServerSaveResponse,
    MCPServerTestResult,
    MCPServersResponse,
} from '~/types/or3-api'
import { useOr3Api } from './useOr3Api'

const mcpServers = ref<MCPServerDetail[]>([])
const mcpLoading = ref(false)
const mcpSaving = ref<Record<string, boolean>>({})
const mcpTesting = ref<Record<string, boolean>>({})
const mcpError = ref<string | null>(null)
const mcpRestartRequired = ref(false)

export function useMCP() {
    const api = useOr3Api()

    async function loadMCPServers() {
        mcpLoading.value = true
        mcpError.value = null
        try {
            const response = await api.request<MCPServersResponse>('/internal/v1/mcp/servers')
            mcpServers.value = response.servers ?? []
            return response
        } catch (error: any) {
            mcpError.value = error?.message ?? 'Unable to load MCP servers.'
            throw error
        } finally {
            mcpLoading.value = false
        }
    }

    async function saveMCPServer(name: string, config: MCPServerConfig) {
        const key = name.trim()
        mcpSaving.value = { ...mcpSaving.value, [key]: true }
        mcpError.value = null
        try {
            const response = await api.request<MCPServerSaveResponse>('/internal/v1/mcp/servers', {
                method: 'POST',
                body: { name: key, config },
            })
            mcpRestartRequired.value = Boolean(response.restartRequired)
            await loadMCPServers()
            return response
        } catch (error: any) {
            mcpError.value = error?.message ?? 'Unable to save MCP server.'
            throw error
        } finally {
            mcpSaving.value = { ...mcpSaving.value, [key]: false }
        }
    }

    async function deleteMCPServer(name: string) {
        const key = name.trim()
        mcpSaving.value = { ...mcpSaving.value, [key]: true }
        mcpError.value = null
        try {
            const response = await api.request<MCPServerSaveResponse>(
                `/internal/v1/mcp/servers/${encodeURIComponent(key)}`,
                { method: 'DELETE' },
            )
            mcpRestartRequired.value = Boolean(response.restartRequired)
            mcpServers.value = mcpServers.value.filter((server) => server.name !== key)
            return response
        } catch (error: any) {
            mcpError.value = error?.message ?? 'Unable to remove MCP server.'
            throw error
        } finally {
            mcpSaving.value = { ...mcpSaving.value, [key]: false }
        }
    }

    async function testMCPServer(name: string) {
        const key = name.trim()
        mcpTesting.value = { ...mcpTesting.value, [key]: true }
        mcpError.value = null
        try {
            return await api.request<MCPServerTestResult>(
                `/internal/v1/mcp/servers/${encodeURIComponent(key)}/test`,
                { method: 'POST', body: {} },
            )
        } catch (error: any) {
            mcpError.value = error?.message ?? 'Unable to test MCP server.'
            throw error
        } finally {
            mcpTesting.value = { ...mcpTesting.value, [key]: false }
        }
    }

    function resetMCPServers() {
        mcpServers.value = []
        mcpLoading.value = false
        mcpSaving.value = {}
        mcpTesting.value = {}
        mcpError.value = null
        mcpRestartRequired.value = false
    }

    return {
        mcpServers,
        mcpLoading,
        mcpSaving,
        mcpTesting,
        mcpError,
        mcpRestartRequired,
        loadMCPServers,
        saveMCPServer,
        deleteMCPServer,
        testMCPServer,
        resetMCPServers,
    }
}
