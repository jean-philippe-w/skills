import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

const VIEWER = fileURLToPath(new URL("../skills/engineering/architect/scripts/viewer.mjs", import.meta.url));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "architect-test-"));
fs.mkdirSync(path.join(tmp, "project"));
// The viewer reports real paths (macOS's tmpdir is behind a symlink).
const project = fs.realpathSync(path.join(tmp, "project"));
const empty = path.join(tmp, "empty");
// A port range of its own, so the tests never meet a viewer the user runs.
const env = {
  ...process.env,
  ARCHITECT_FIRST_PORT: String(20000 + Math.floor(Math.random() * 20000)),
  XDG_CACHE_HOME: path.join(tmp, "cache"),
  LOCALAPPDATA: path.join(tmp, "cache"),
};

const run = (...args) => spawnSync(process.execPath, [VIEWER, ...args], { env, encoding: "utf8" });

function request(url, { method = "GET", headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method, headers }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolve({ status: res.statusCode, body }));
    });
    req.on("error", reject);
    req.end();
  });
}

before(() => {
  const diagram = '<mxfile><diagram id="d" name="Page-1"><mxGraphModel><root><mxCell id="0"/></root></mxGraphModel></diagram></mxfile>';
  for (const rel of ["a.drawio", "docs/b.drawio", "node_modules/c.drawio", ".git/d.drawio", "notes.md"]) {
    fs.mkdirSync(path.dirname(path.join(project, rel)), { recursive: true });
    fs.writeFileSync(path.join(project, rel), diagram);
  }
  fs.mkdirSync(empty);
});

after(() => {
  run("stop", "--all");
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("list finds the diagrams and skips hidden and dependency folders", () => {
  const { status, stdout } = run("list", project);
  assert.equal(status, 0);
  assert.match(stdout, /^2 \.drawio file\(s\)/);
  assert.match(stdout, /a\.drawio/);
  assert.match(stdout, /docs\/b\.drawio/);
  assert.doesNotMatch(stdout, /c\.drawio|d\.drawio/);
});

test("list says so when a folder has no diagram", () => {
  assert.match(run("list", empty).stdout, /^No \.drawio file/);
});

test("a missing folder is an error", () => {
  assert.equal(run("list", path.join(tmp, "missing")).status, 2);
});

test("start serves the folder, reuses its viewer, and stop ends it", async () => {
  const started = run("start", project);
  assert.equal(started.status, 0, started.stderr);
  const url = started.stdout.trim();
  assert.match(url, /^http:\/\/localhost:\d+\/$/);
  const base = url.replace("localhost", "127.0.0.1");

  const info = JSON.parse((await request(`${base}api/info`)).body);
  assert.equal(info.app, "architect");
  assert.equal(info.root, project);

  const files = JSON.parse((await request(`${base}api/files`)).body).files.map((f) => f.path);
  assert.deepEqual(files.sort(), ["a.drawio", "docs/b.drawio"]);
  assert.equal((await request(`${base}diagram?file=docs/b.drawio`)).status, 200);
  assert.match((await request(`${base}`)).body, /<title>architect<\/title>/);

  assert.equal(run("start", project).stdout.trim(), url, "a second start reuses the viewer");
  assert.match(run("status").stdout, new RegExp(project.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&")));

  assert.equal((await request(`${base}api/files`, { headers: { Host: "evil.example" } })).status, 403);
  assert.equal((await request(`${base}diagram?file=../../etc/passwd.drawio`)).status, 404);
  assert.equal((await request(`${base}api/shutdown`, { method: "POST" })).status, 403);

  assert.match(run("stop", project).stdout, /^Stopped: /);
  assert.match(run("status").stdout, /No architect viewer is running/);
});
