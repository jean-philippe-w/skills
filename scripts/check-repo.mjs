#!/usr/bin/env node
// Checks the repo rules from AGENTS.md: every promoted skill is in the plugin
// manifest and both READMEs, names match folders, and versions agree.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROMOTED = new Set(["engineering", "productivity"]);
const problems = [];

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const readJson = (rel) => JSON.parse(read(rel));

function frontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const fields = {};
  for (const line of match ? match[1].split(/\r?\n/) : []) {
    const field = line.match(/^([\w-]+):\s*(.*)$/);
    if (field) fields[field[1]] = field[2].trim();
  }
  return fields;
}

const skills = [];
for (const bucket of fs.readdirSync(path.join(ROOT, "skills"), { withFileTypes: true })) {
  if (!bucket.isDirectory()) continue;
  for (const skill of fs.readdirSync(path.join(ROOT, "skills", bucket.name), { withFileTypes: true })) {
    const rel = `skills/${bucket.name}/${skill.name}`;
    if (skill.isDirectory() && fs.existsSync(path.join(ROOT, rel, "SKILL.md"))) {
      skills.push({ bucket: bucket.name, name: skill.name, rel });
    }
  }
}

const plugin = readJson(".claude-plugin/plugin.json");
const marketplace = readJson(".claude-plugin/marketplace.json");
const pkg = readJson("package.json");
const readme = read("README.md");
const listed = new Set(plugin.skills.map((s) => s.replace(/^\.\//, "")));

if (plugin.version !== pkg.version) {
  problems.push(`plugin.json version ${plugin.version} differs from package.json version ${pkg.version}`);
}
if (!marketplace.plugins.some((p) => p.name === plugin.name)) {
  problems.push(`marketplace.json does not list the plugin ${plugin.name}`);
}
for (const entry of listed) {
  if (!skills.some((s) => s.rel === entry)) problems.push(`plugin.json lists ${entry}, which has no SKILL.md`);
}

for (const skill of skills) {
  const fields = frontmatter(read(`${skill.rel}/SKILL.md`));
  if (fields.name !== skill.name) problems.push(`${skill.rel}: name "${fields.name}" differs from its folder`);
  if (!fields.description) problems.push(`${skill.rel}: no description`);
  else if (fields.description.length > 1024) problems.push(`${skill.rel}: description over 1024 characters`);

  const isPromoted = PROMOTED.has(skill.bucket);
  const inReadme = readme.includes(`(${skill.rel}/SKILL.md)`);
  if (isPromoted !== listed.has(skill.rel)) {
    problems.push(`${skill.rel}: ${isPromoted ? "missing from" : "must not be in"} plugin.json`);
  }
  if (isPromoted !== inReadme) {
    problems.push(`${skill.rel}: ${isPromoted ? "missing from" : "must not be in"} README.md`);
  }
  const bucketReadme = path.join(ROOT, "skills", skill.bucket, "README.md");
  if (isPromoted && !(fs.existsSync(bucketReadme) && fs.readFileSync(bucketReadme, "utf8").includes(`(./${skill.name}/SKILL.md)`))) {
    problems.push(`${skill.rel}: missing from skills/${skill.bucket}/README.md`);
  }
}

if (problems.length > 0) {
  console.error(problems.map((p) => `- ${p}`).join("\n"));
  process.exit(1);
}
console.log(`OK: ${skills.length} skill(s), version ${pkg.version}`);
