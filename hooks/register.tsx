import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { AgentCard } from '../types'

const PANE = 'agent-status'
const MAIN = 'main'
const cards = atom({ plugin: 'agent-status', key: 'cards' } as const, [], { shape: 'cards-1' })
const now = atom({ plugin: 'agent-status', key: 'now' } as const, 0)

// The engine reports no real percentage: this curve rises with activity and
// stops at 90 so only a finished agent ever reads 100.
export const estimate = (c: AgentCard): number =>
  c.status === "done" ? 100 : Math.round(90 * (1 - Math.exp(-c.toolCalls / 8)))

export const bar = (pct: number): string => {
  const filled = Math.round(pct / 5)
  return '█'.repeat(filled) + '░'.repeat(20 - filled)
}

const elapsed = (c: AgentCard, at: number): string => {
  const s = Math.max(0, Math.floor(((c.endedAt ?? at) - c.startedAt) / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

let ticker: { cancel: () => void } | undefined

const syncStatus = async ($: EngineInterface): Promise<void> => {
  const list = await read($, cards)
  const running = list.filter(c => c.status === 'running').length
  const done = list.length - running
  if (running === 0) {
    ticker?.cancel()
    ticker = undefined
    $.ui.status(undefined)
    return
  }
  $.ui.status(`agents: ${running} running · ${done} done`)
  if (!ticker) {
    ticker = $.clock.every(1000, () => {
      void (async () => { const t = await $.clock.now(); await update($, now, () => t) })()
    })
  }
}

const patch = async ($: EngineInterface, id: string, fn: (c: AgentCard) => AgentCard): Promise<void> => {
  await update($, cards, list => list.map(c => (c.id === id ? fn(c) : c)))
}

const open = ($: EngineInterface) => $.ui.open({ id: PANE, title: 'Agents' })

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'agent-status', description: 'Show live agent cards' })
    return next(e)
  })

  on('command.run', { command: 'agent-status' }, async $ => {
    await open($)
    return { text: 'Agent status pane opened.' }
  })

  on('prompt.submit', async ($, e, next) => {
    if (e.command) return next(e)
    const at = await $.clock.now()
    await update($, now, () => at)
    const first: AgentCard = { id: MAIN, name: 'Main', kind: 'main', status: 'running', skill: null, currentTool: null, toolCalls: 0, startedAt: at, endedAt: null }
    await update($, cards, () => [first])
    void open($)
    await syncStatus($)
    return next(e)
  })

  on('agent.spawn', async ($, e, next) => {
    const res = await next(e)
    if (res.agentId) {
      const at = await $.clock.now()
      const card: AgentCard = {
        id: res.agentId,
        name: e.name ?? e.description,
        kind: e.subagentType,
        status: 'running',
        skill: null,
        currentTool: null,
        toolCalls: 0,
        startedAt: at,
        endedAt: null,
      }
      await update($, cards, list => [...list.filter(c => c.id !== card.id), card])
      await syncStatus($)
    }
    return res
  })

  on('tool.call', async ($, e, next) => {
    const id = e.agentId ?? MAIN
    const skill = e.tool === 'Skill' && 'skill' in e && typeof e.skill === 'string' ? e.skill : undefined
    await patch($, id, c => ({ ...c, toolCalls: c.toolCalls + 1, currentTool: e.tool, skill: skill ?? c.skill }))
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const id = e.agentId ?? MAIN
    const at = await $.clock.now()
    const failed = e.reason === 'error' || e.reason === 'refusal' || e.reason === 'aborted'
    await patch($, id, c =>
      c.status === 'running' ? { ...c, status: failed ? 'failed' : 'done', currentTool: null, endedAt: at } : c,
    )
    await syncStatus($)
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const list = await read($, cards)
    const at = Math.max(await read($, now), ...list.map(c => c.endedAt ?? c.startedAt))
    const order = { running: 0, failed: 1, done: 2 } as const
    const sorted = [...list].sort((a, b) => order[a.status] - order[b.status] || b.startedAt - a.startedAt)
    const running = list.filter(c => c.status === 'running').length

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" justifyContent="space-between">
          <Text bold>{`${running} running · ${list.length - running} done`}</Text>
          <Button key="quit" role="dismiss" onPress={() => void $.ui.close({ id: PANE })}>Quit</Button>
        </Box>
        {list.length === 0 && <Text dimColor>No agents yet. Send a task to start.</Text>}
        {sorted.map(c => {
          const pct = estimate(c)
          const color = c.status === 'done' ? 'green' : c.status === 'failed' ? 'red' : 'cyan'
          const label = c.status === 'done' ? '✓ DONE' : c.status === 'failed' ? '✗ FAILED' : 'RUNNING'
          return (
            <Box key={c.id} flexDirection="column" borderStyle="round" borderColor={color} paddingX={1}>
              <Box flexDirection="row" justifyContent="space-between">
                <Text bold>{`${c.kind} · ${c.name}`}</Text>
                <Text color={color}>{label}</Text>
              </Box>
              <Text color={color}>{`${bar(pct)} ${pct}%${c.status === 'done' ? '' : ' est.'}  ${elapsed(c, at)}`}</Text>
              <Text dimColor>{`Skill: ${c.skill ?? '—'}   Tool: ${c.currentTool ?? '—'}   calls: ${c.toolCalls}`}</Text>
            </Box>
          )
        })}
      </Box>
    )
  })
}
