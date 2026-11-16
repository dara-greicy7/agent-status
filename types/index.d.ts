export type AgentCard = {
  id: string
  name: string
  kind: string
  status: 'running' | 'done' | 'failed'
  skill: string | null
  currentTool: string | null
  toolCalls: number
  startedAt: number
  endedAt: number | null
}

declare module 'claude-code' {
  interface PluginState {
    'agent-status': { cards: Shaped<AgentCard[]>; now: number }
  }
}
