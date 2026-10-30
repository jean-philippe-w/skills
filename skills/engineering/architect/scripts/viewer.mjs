#!/usr/bin/env node
// architect viewer: a read-only, live viewer for the draw.io diagrams of a folder.
//
//   viewer.mjs [dir]                     start the viewer on dir (default .) and open the browser
//   viewer.mjs list   [dir]              list the .drawio files
//   viewer.mjs start  [dir] [--open]     start the viewer in the background and print its URL
//   viewer.mjs stop   [dir] [--all]      stop the viewer of dir (or every viewer)
//   viewer.mjs status                    list the running viewers
//   viewer.mjs serve  [dir] --port N     serve in the foreground (what start launches)
//
// The page draws the diagrams with viewer-static.min.js, draw.io's own renderer,
// and reloads the shown file as soon as it changes. Node 18+, no dependencies.

import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SELF = fileURLToPath(import.meta.url);
const HERE = path.dirname(SELF);
const APP = "architect";
const FIRST_PORT = Number(process.env.ARCHITECT_FIRST_PORT) || 8766;
const PORTS = Array.from({ length: 20 }, (_, i) => FIRST_PORT + i);
const SKIP_DIRS = new Set(["node_modules", "venv", "__pycache__", "dist", "build"]);
const VIEWER_CDN = "https://viewer.diagrams.net/js/viewer-static.min.js";
const ASAR_ENTRY = "drawio/src/main/webapp/js/viewer-static.min.js";
const COMMANDS = new Set(["list", "start", "stop", "status", "serve"]);

const USAGE = `Usage: viewer.mjs [command] [dir] [options]

  [dir]                  start the viewer on dir (default .) and open the browser
  list   [dir]           list the .drawio files
  start  [dir] [--open]  start the viewer in the background and print its URL
  stop   [dir] [--all]   stop the viewer of dir (or every viewer)
  status                 list the running viewers
  serve  [dir] --port N  serve in the foreground`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const urlOf = (port) => `http://localhost:${port}/`;

// --- viewer-static.min.js ------------------------------------------------

function cacheDir() {
  const base = process.platform === "win32"
    ? process.env.LOCALAPPDATA || os.homedir()
    : process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache");
  const dir = path.join(base, APP);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Usual locations of draw.io desktop's app.asar, which ships the renderer.
function* asarCandidates() {
  const home = os.homedir();
  const flatpak = "app/com.jgraph.drawio.desktop/current/active/files/main/resources/app.asar";
  yield path.join("/var/lib/flatpak", flatpak);
  yield path.join(home, ".local/share/flatpak", flatpak);
  yield "/opt/drawio/resources/app.asar";
  yield "/snap/drawio/current/opt/drawio/resources/app.asar";
  yield "/Applications/draw.io.app/Contents/Resources/app.asar";
  yield path.join(home, "Applications/draw.io.app/Contents/Resources/app.asar");
  if (process.env.LOCALAPPDATA) {
    yield path.join(process.env.LOCALAPPDATA, "Programs", "draw.io", "resources", "app.asar");
  }
  if (process.env.ProgramFiles) {
    yield path.join(process.env.ProgramFiles, "draw.io", "resources", "app.asar");
  }
}

function readAsarEntry(asar, entry) {
  const fd = fs.openSync(asar, "r");
  try {
    const head = Buffer.alloc(16);
    fs.readSync(fd, head, 0, 16, 0);
    const pickleSize = head.readUInt32LE(4);
    const headerSize = head.readUInt32LE(12);
    const header = Buffer.alloc(headerSize);
    fs.readSync(fd, header, 0, headerSize, 16);
    let node = JSON.parse(header.toString("utf8"));
    for (const part of entry.split("/")) node = node.files[part];
    const data = Buffer.alloc(node.size);
    fs.readSync(fd, data, 0, node.size, 8 + pickleSize + Number(node.offset));
    return data;
  } finally {
    fs.closeSync(fd);
  }
}

// A local copy of viewer-static.min.js, extracted from draw.io desktop (again
// when draw.io was updated); null when draw.io desktop is not installed.
function viewerJs() {
  const target = path.join(cacheDir(), "viewer-static.min.js");
  const have = fs.existsSync(target) ? fs.statSync(target).mtimeMs : null;
  for (const asar of asarCandidates()) {
    if (!fs.existsSync(asar)) continue;
    if (have !== null && have >= fs.statSync(asar).mtimeMs) return target;
    try {
      fs.writeFileSync(`${target}.tmp`, readAsarEntry(asar, ASAR_ENTRY));
      fs.renameSync(`${target}.tmp`, target);
      return target;
    } catch {
      // not a readable asar, or no renderer inside: try the next one
    }
  }
  return have !== null ? target : null;
}

// --- server --------------------------------------------------------------

function listDiagrams(root) {
  const found = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith(".") && !SKIP_DIRS.has(entry.name)) walk(full);
      } else if (entry.isFile() && entry.name.endsWith(".drawio")) {
        const st = fs.statSync(full);
        found.push({
          path: path.relative(root, full).split(path.sep).join("/"),
          mtime: st.mtimeMs / 1000,
          version: `${st.mtimeMs}-${st.size}`,
        });
      }
    }
  };
  walk(root);
  return found.sort((a, b) => b.mtime - a.mtime);
}

// The absolute path of a requested diagram, or null when it leaves the folder.
function resolveDiagram(root, rel) {
  if (!rel.endsWith(".drawio")) return null;
  let real;
  try {
    real = fs.realpathSync(path.resolve(root, rel));
  } catch {
    return null;
  }
  return real.startsWith(root + path.sep) && fs.statSync(real).isFile() ? real : null;
}

function serve(root, port) {
  const viewer = viewerJs();
  // Only these Host headers are served: a page from another site that aims
  // at localhost through DNS rebinding gets a 403.
  const hosts = new Set([`localhost:${port}`, `127.0.0.1:${port}`, `[::1]:${port}`]);
  const send = (res, status, body, type, cache = "no-store") => {
    res.writeHead(status, {
      "Content-Type": type,
      "Cache-Control": cache,
      "Content-Length": Buffer.byteLength(body),
    });
    res.end(body);
  };
  const json = (res, status, payload) => send(res, status, JSON.stringify(payload), "application/json");

  const server = http.createServer((req, res) => {
    if (!hosts.has(req.headers.host)) return json(res, 403, { error: "host not allowed" });
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === "POST") {
      // The custom header forces a CORS preflight this server never approves:
      // only a local client (viewer.mjs stop) can shut it down.
      if (url.pathname !== "/api/shutdown" || req.headers["x-architect"] !== "stop") {
        return json(res, 403, { error: "refused" });
      }
      res.on("finish", () => process.exit(0));
      return json(res, 200, { stopped: true });
    }
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return send(res, 200, fs.readFileSync(path.join(HERE, "index.html")), "text/html; charset=utf-8");
    }
    if (url.pathname === "/viewer-static.min.js") {
      if (viewer === null) {
        res.writeHead(302, { Location: VIEWER_CDN });
        return res.end();
      }
      return send(res, 200, fs.readFileSync(viewer), "text/javascript; charset=utf-8", "max-age=86400");
    }
    if (url.pathname === "/api/info") return json(res, 200, { app: APP, root, pid: process.pid });
    if (url.pathname === "/api/files") return json(res, 200, { root, files: listDiagrams(root) });
    if (url.pathname === "/diagram") {
      const file = resolveDiagram(root, url.searchParams.get("file") || "");
      if (file === null) return json(res, 404, { error: "file not found" });
      return send(res, 200, fs.readFileSync(file), "application/xml; charset=utf-8");
    }
    return json(res, 404, { error: "not found" });
  });
  server.listen(port, "127.0.0.1", () => console.log(`architect: ${urlOf(port)}  (${root})`));
}

// --- commands ------------------------------------------------------------

function portInUse(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", () => resolve(true));
    probe.listen(port, "127.0.0.1", () => probe.close(() => resolve(false)));
  });
}

// The info of the architect viewer listening on port, or null.
function probe(port) {
  return new Promise((resolve) => {
    const req = http.get({ host: "127.0.0.1", port, path: "/api/info", timeout: 2000 }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const info = JSON.parse(body);
          resolve(info && info.app === APP ? info : null);
        } catch {
          resolve(null);
        }
      });
    });
    req.on("timeout", () => req.destroy());
    req.on("error", () => resolve(null));
  });
}

// [[port, info]] of the running architect viewers.
async function running() {
  const servers = [];
  for (const port of PORTS) {
    const info = (await portInUse(port)) ? await probe(port) : null;
    if (info !== null) servers.push([port, info]);
  }
  return servers;
}

function shutdown(port) {
  return new Promise((resolve) => {
    const req = http.request(
      { host: "127.0.0.1", port, path: "/api/shutdown", method: "POST", headers: { "X-Architect": "stop" }, timeout: 2000 },
      (res) => {
        res.resume();
        res.on("end", () => resolve(res.statusCode === 200));
      },
    );
    req.on("timeout", () => req.destroy());
    req.on("error", () => resolve(false));
    req.end();
  });
}

function openBrowser(url) {
  const [command, args] = process.platform === "darwin" ? ["open", [url]]
    : process.platform === "win32" ? ["cmd", ["/c", "start", "", url]]
    : ["xdg-open", [url]];
  // The URL is printed either way, so a missing opener is not an error.
  spawn(command, args, { detached: true, stdio: "ignore" }).on("error", () => {}).unref();
}

function cmdList(root) {
  const files = listDiagrams(root).sort((a, b) => a.path.localeCompare(b.path));
  if (files.length === 0) {
    console.log(`No .drawio file in ${root}`);
    return 0;
  }
  console.log(`${files.length} .drawio file(s) in ${root}:`);
  for (const f of files) {
    const when = new Date(f.mtime * 1000).toISOString().slice(0, 16).replace("T", " ");
    console.log(`  ${f.path}  (modified ${when} UTC)`);
  }
  return 0;
}

async function cmdStart(root, shouldOpen) {
  let url = (await running()).find(([, info]) => info.root === root)?.[0];
  url = url === undefined ? null : urlOf(url);
  if (url === null) {
    let port = null;
    for (const candidate of PORTS) {
      if (!(await portInUse(candidate))) {
        port = candidate;
        break;
      }
    }
    if (port === null) {
      console.error(`No free port between ${PORTS[0]} and ${PORTS.at(-1)}`);
      return 1;
    }
    const logPath = path.join(cacheDir(), `serve-${port}.log`);
    const log = fs.openSync(logPath, "w");
    const child = spawn(process.execPath, [SELF, "serve", root, "--port", String(port)], {
      detached: true,
      stdio: ["ignore", log, log],
      windowsHide: true,
    });
    fs.closeSync(log);
    let hasExited = false;
    child.on("exit", () => (hasExited = true));
    child.unref();
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline && !hasExited) {
      const info = await probe(port);
      if (info !== null && info.root === root) {
        url = urlOf(port);
        break;
      }
      await sleep(200);
    }
    if (url === null) {
      const tail = fs.readFileSync(logPath, "utf8").slice(-800).trim();
      console.error(`The viewer did not start.\n${tail}`);
      return 1;
    }
  }
  console.log(url);
  if (shouldOpen) openBrowser(url);
  return 0;
}

async function cmdStop(root, stopAll) {
  const stopped = [];
  for (const [port, info] of await running()) {
    if ((stopAll || info.root === root) && (await shutdown(port))) stopped.push([port, info.root]);
  }
  for (const [port] of stopped) {
    for (let i = 0; i < 30 && (await portInUse(port)); i++) await sleep(100);
  }
  if (stopped.length === 0) {
    console.log(`No architect viewer to stop${stopAll ? "" : ` for ${root}`}`);
  }
  for (const [port, served] of stopped) console.log(`Stopped: ${urlOf(port)}  (${served})`);
  return 0;
}

async function cmdStatus() {
  const servers = await running();
  if (servers.length === 0) console.log("No architect viewer is running");
  for (const [port, info] of servers) console.log(`${urlOf(port)}  ${info.root}`);
  return 0;
}

function parseArgs(argv) {
  const positional = [];
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--port") options.port = Number(argv[++i]);
    else if (arg === "-h" || arg === "--help") options.help = true;
    else if (arg.startsWith("--")) options[arg.slice(2)] = true;
    else positional.push(arg);
  }
  return { positional, options };
}

async function main() {
  const { positional, options } = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(USAGE);
    return 0;
  }
  let [command, dir] = positional;
  if (!COMMANDS.has(command)) {
    // `viewer.mjs` or `viewer.mjs <dir>`: the one-command use, for people.
    [command, dir, options.open] = ["start", command, true];
  }
  let root;
  try {
    root = fs.realpathSync(path.resolve(dir ?? "."));
    if (!fs.statSync(root).isDirectory()) throw new Error();
  } catch {
    console.error(`Folder not found: ${path.resolve(dir ?? ".")}\n\n${USAGE}`);
    return 2;
  }
  if (command === "list") return cmdList(root);
  if (command === "start") return cmdStart(root, options.open === true);
  if (command === "stop") return cmdStop(root, options.all === true);
  if (command === "status") return cmdStatus();
  serve(root, options.port || PORTS[0]);
  return null;
}

const code = await main();
if (code !== null) process.exit(code);
