#!/usr/bin/env bash
set -euo pipefail

# Links every skill of this repo, except misc/ and deprecated/, into the local
# skill folders of each agent:
#   - ~/.claude/skills: Claude Code
#   - ~/.agents/skills: Codex and other Agent Skills agents
# Each entry is a symlink into this repo, so edits and `git pull` are live.
# An entry that exists and is not a symlink is left alone, with a warning.

REPO="$(cd "$(dirname "$0")/.." && pwd)"
DESTS=("$HOME/.claude/skills" "$HOME/.agents/skills")

while IFS= read -r -d '' skill_md; do
  src="$(dirname "$skill_md")"
  name="$(basename "$src")"
  for dest in "${DESTS[@]}"; do
    mkdir -p "$dest"
    link="$dest/$name"
    if [ -e "$link" ] && [ ! -L "$link" ]; then
      echo "skip $link: exists and is not a symlink" >&2
      continue
    fi
    ln -sfn "$src" "$link"
    echo "$link -> $src"
  done
done < <(find "$REPO/skills" -name SKILL.md -not -path '*/misc/*' -not -path '*/deprecated/*' -print0)
