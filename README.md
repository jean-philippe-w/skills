# jean-philippe-w/skills

[![skills.sh](https://skills.sh/b/jean-philippe-w/skills)](https://skills.sh/jean-philippe-w/skills)

Agent skills by jean-philippe-w, for Claude Code, Codex, Copilot, Cursor and any agent that reads the [Agent Skills](https://agentskills.io) format.

## Install

Pick one route. The plugin is a read-only bundle you subscribe to; skills.sh copies files you own and can edit. Installing both gives you every skill twice.

### Claude Code

```bash
claude plugin marketplace add jean-philippe-w/skills
claude plugin install jean-philippe-w-skills@jean-philippe-w
```

Third-party marketplaces do not update automatically by default: turn on auto-update for `jean-philippe-w` in `/plugin`, under Marketplaces.

### Codex

```bash
codex plugin marketplace add jean-philippe-w/skills
codex plugin add jean-philippe-w-skills@jean-philippe-w
```

Updates itself at startup.

### GitHub Copilot (CLI and VS Code)

```bash
copilot plugin marketplace add jean-philippe-w/skills
copilot plugin install jean-philippe-w-skills@jean-philippe-w
```

To update automatically, add once to `~/.copilot/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "jean-philippe-w": { "source": { "source": "github", "repo": "jean-philippe-w/skills" }, "autoUpdate": true }
  }
}
```

In VS Code, run **Chat: Install Plugin From Source** and enter `https://github.com/jean-philippe-w/skills`.

### Every other agent (skills.sh)

```bash
npx skills@latest add jean-philippe-w/skills
```

Manual updates: run `npx skills@latest update`, and re-run `add` to pick up new skills.

## Skills

### Model-invoked

- [architect](skills/engineering/architect/SKILL.md): live viewer for a project's draw.io diagrams, in the agent's built-in browser or yours.

## The draw.io viewer without an agent

`architect`'s viewer also runs on its own (Node 18+):

```bash
npx github:jean-philippe-w/skills
```

It serves the `.drawio` files of the current folder and opens your browser. `npx github:jean-philippe-w/skills --help` lists the other commands (`list`, `start`, `stop`, `status`).

## License

[MIT](LICENSE)
