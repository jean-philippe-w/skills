---
name: architect
description: Live viewer for the draw.io (.drawio) diagrams of a project. Scans the folder, starts a small local read-only server and shows the diagrams in the agent's built-in browser or the user's browser. Use when the user wants to see, preview or open .drawio diagrams, and right after creating or editing a .drawio file so they can see it.
license: MIT
---

# architect

A local web page that draws a folder's `.drawio` files with draw.io's own renderer (viewer-static): diagram list, zoom, pages, layers, fullscreen. It re-reads the shown file every second, so an edit appears without a reload. Read-only.

The viewer is `scripts/viewer.mjs` in this skill's folder: Node 18+, no dependencies.

## Show the diagrams

1. **Scan**: `node <skill>/scripts/viewer.mjs list <project>`. With no `.drawio` file, tell the user and stop there.
2. **Start**: `node <skill>/scripts/viewer.mjs start <project>`. It returns as soon as the server answers and prints its URL (`http://localhost:8766/` or the next free port), reusing the viewer that already serves this folder.
3. **Show** the URL:
   - with a built-in browser (the agent's own browser tool, Claude Desktop's Browser pane), open it there;
   - otherwise `start <project> --open` opens it in the user's default browser.

   Done when the diagram is on screen or the user has the URL.

The page follows the last modified `.drawio`: after editing a diagram, the page already open shows it. To pin one, add `?file=<path relative to the project>` to the URL.

## Stop

The viewer runs in the background until stopped, even after the session ends.

- `viewer.mjs stop <project>` stops this folder's viewer; `stop --all` stops every viewer.
- `viewer.mjs status` lists the running viewers.

draw.io's renderer comes from a local copy extracted from draw.io desktop when it is installed (works offline), otherwise from `viewer.diagrams.net`.
