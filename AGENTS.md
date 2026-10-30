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

- Every promoted skill has a line in the top-level `README.md` and a line in its bucket's `README.md`, each linking the skill's `SKILL.md`. Skills in other buckets appear in neither. README lines are grouped under **Model-invoked** or **User-invoked**.
- A `SKILL.md`'s `name` equals its folder name.
- Code a skill runs lives in the skill's own folder (`scripts/`) and runs on Node 18+ with no dependencies, so skills.sh ships it as is.
- English everywhere: skills, scripts, docs, commit messages.
- skills.sh is the only install route, and its commands live in `README.md` only.

`npm run check` enforces the first two rules.

## Release

Work happens on `main`, with no release branch. `main` is what users get when they run `npx skills update`, so push only what works.

1. Try the change the way a stranger would: install the working copy in a fresh folder, then start a new agent session there.

   ```bash
   npx skills@latest add <path to this repo> -a claude-code -y
   ```

2. Run `npm test` and `npm run check`.
3. For a release, bump `version` in `package.json`, add it to `CHANGELOG.md` and tag `vX.Y.Z`.
4. Push `main` (and the tag).
