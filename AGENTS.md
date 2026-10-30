# Working on this repo

## Layout

Skills live in bucket folders under `skills/`:

- `engineering/`: daily code work
- `productivity/`: daily non-code workflow tools
- `in-progress/`: drafts, public on purpose; set `metadata.internal: true` so skills.sh hides them
- `misc/`: kept around but rarely used
- `deprecated/`: no longer used

`engineering/` and `productivity/` are the **promoted** buckets. Create the others when a skill needs one.

## Rules

- Every promoted skill has an entry in `.claude-plugin/plugin.json`'s `skills` array, a line in the top-level `README.md` and a line in its bucket's `README.md`, each linking the skill's `SKILL.md`. Skills in other buckets appear in none of them. README lines are grouped under **Model-invoked** or **User-invoked**.
- A `SKILL.md`'s `name` equals its folder name.
- Code a skill runs lives in the skill's own folder (`scripts/`) and runs on Node 18+ with no dependencies, so skills.sh and the plugin ship it as is.
- English everywhere: skills, scripts, docs, commit messages.
- Install commands live in `README.md` only.

`npm run check` enforces the first two rules and the version rule below.

## Release

Work happens on `main`, with no release branch. Unreleased commits there reach nobody on their own: managed installs (the Claude Code, Codex and Copilot plugin routes) update only when the plugin version changes, and skills.sh installs only on `npx skills update`.

1. Bump `version` in `package.json` and `.claude-plugin/plugin.json` together.
2. Add the release to `CHANGELOG.md`.
3. Run `npm test`, `npm run check` and `claude plugin validate .`. Its one expected warning is that the root `CLAUDE.md` is not loaded by the plugin: that file is for contributors.
4. Commit, tag `vX.Y.Z`, push `main` and the tag.

To try a change the way a stranger would, push it to `main` and install it in a fresh folder, then start a new agent session there:

```bash
npx skills@latest add wingertjp/skills -a claude-code -y
```

## Local development

`scripts/link-skills.sh` links every skill outside `misc/` and `deprecated/` into `~/.claude/skills` and `~/.agents/skills`, so edits here are live everywhere. Re-run it after adding, removing or renaming a skill.
