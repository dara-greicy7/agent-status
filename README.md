# agent-status

A Claude Code mod that shows a live card for every working agent: its status, an estimated progress bar, the skill it is using, the tool it is running and elapsed time. The pane opens by itself when you send a task, marks each agent ✓ DONE at 100% (or ✗ FAILED) when it ends, has a Quit button, and comes back with `/agent-status`.

Progress is an estimate from tool-call activity (Claude Code reports no real percentage), capped at 90% until the agent finishes.

## Install

At the prompt of a terminal session:

```
/plugin install agent-status --marketplace dara-greicy7/agent-status
```

Answer `y` to add the marketplace, then pick a scope.

From a shell:

```
claude plugin install agent-status --marketplace dara-greicy7/agent-status
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `dara-greicy7/agent-status`, then Add plugin.
