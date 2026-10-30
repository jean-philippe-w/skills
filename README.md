# jean-philippe-w/skills

[![skills.sh](https://skills.sh/b/jean-philippe-w/skills)](https://skills.sh/jean-philippe-w/skills)

Agent skills by jean-philippe-w, for Claude Code, Codex, Cursor and any agent that reads the [Agent Skills](https://agentskills.io) format.

## Install

With [skills.sh](https://skills.sh):

```bash
npx skills@latest add jean-philippe-w/skills -g
```

`-g` installs for every project; leave it out to install in the current project only. The installer asks which agents to install for; `-a claude-code` picks one.

To update, run `npx skills@latest update -g` (without `-g` for a project install), and re-run `add` to pick up new skills.

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
