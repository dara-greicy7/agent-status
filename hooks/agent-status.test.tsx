import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'agent-status',
  component: 'Pane',
  requestId: 'agent-status',
  props: { title: 'Agents', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
} as const

test('prompt opens the pane, subagent runs, uses a skill, finishes at 100%', async ($, on) => {
  let opened = 0
  let closed = 0
  let t = 1000
  on('clock.now', () => ({ value: (t += 1000) }))
  on('ui.status', () => ({ value: undefined }))
  on('clock.every', () => ({ value: {} }))
  on('command.register', () => ({ value: { command: 'agent-status' } }))
  on('ui.open', () => { opened++; return { value: { isPlaced: true } } })
  on('ui.close', () => { closed++; return { value: undefined } })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('agent.spawn', () => ({ model: 'm', agentId: 'a1' }))
  on('tool.call', () => ({ result: {} }))
  on('turn.complete', () => ({ text: '' }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.prompt.submit({ text: 'do the thing' })
  expect(opened).toBe(1)

  await $.agent.spawn({ prompt: 'find docs', description: 'find mod docs', subagentType: 'Explore' })
  await $.tool.call({ tool: 'Skill', skill: 'plugin-authoring' }, { agentId: 'a1' } as never)

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /Explore · find mod docs/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /RUNNING/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Skill: plugin-authoring/ })).toBeDefined()
    await ui.unmount()
  }

  await $.turn.complete({ agentId: 'a1', reason: 'answer', answer: 'ok', turnId: 't', isAborted: false } as never)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /✓ DONE/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /100%/ })).toBeDefined()
  await ui.press({ key: 'quit' })
  expect(closed).toBe(1)
  await ui.unmount()
})

test('/agent-status reopens the pane', async ($, on) => {
  let opened = 0
  on('command.register', () => ({ value: { command: 'agent-status' } }))
  on('ui.open', () => { opened++; return { value: { isPlaced: true } } })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const res = await $.command.run({ command: 'agent-status', args: '' } as never)
  expect(opened).toBe(1)
  expect(JSON.stringify(res)).toMatch(/opened/)
})
