# wingertjp/skills

[![skills.sh](https://skills.sh/b/wingertjp/skills)](https://skills.sh/wingertjp/skills)

Agent skills by wingertjp, for Claude Code, Codex, Copilot, Cursor and any agent that reads the [Agent Skills](https://agentskills.io) format.

## Install

Pick one route. The plugin is a read-only bundle you subscribe to; skills.sh copies files you own and can edit. Installing both gives you every skill twice.

### Claude Code

```bash
claude plugin marketplace add wingertjp/skills
claude plugin install wingertjp-skills@wingertjp
```

Third-party marketplaces do not update automatically by default: turn on auto-update for `wingertjp` in `/plugin`, under Marketplaces.

### Codex

```bash
codex plugin marketplace add wingertjp/skills
codex plugin add wingertjp-skills@wingertjp
```

Updates itself at startup.

### GitHub Copilot (CLI and VS Code)

```bash
copilot plugin marketplace add wingertjp/skills
copilot plugin install wingertjp-skills@wingertjp
```

To update automatically, add once to `~/.copilot/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "wingertjp": { "source": { "source": "github", "repo": "wingertjp/skills" }, "autoUpdate": true }
  }
}
```

In VS Code, run **Chat: Install Plugin From Source** and enter `https://github.com/wingertjp/skills`.

### Every other agent (skills.sh)

```bash
npx skills@latest add wingertjp/skills
```

Manual updates: run `npx skills@latest update`, and re-run `add` to pick up new skills.

## Skills

### Model-invoked

- [architect](skills/engineering/architect/SKILL.md): live viewer for a project's draw.io diagrams, in the agent's built-in browser or yours.

## The draw.io viewer without an agent

`architect`'s viewer also runs on its own (Node 18+):

```bash
npx github:wingertjp/skills
```

It serves the `.drawio` files of the current folder and opens your browser. `npx github:wingertjp/skills --help` lists the other commands (`list`, `start`, `stop`, `status`).

## License

[MIT](LICENSE)
