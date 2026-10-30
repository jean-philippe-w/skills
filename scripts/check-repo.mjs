#!/usr/bin/env node
// Checks the repo rules from AGENTS.md: every promoted skill is listed in both
// READMEs, and every SKILL.md is named after its folder and has a description.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROMOTED = new Set(["engineering", "productivity"]);
const problems = [];

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

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

const readme = read("README.md");
for (const skill of skills) {
  const fields = frontmatter(read(`${skill.rel}/SKILL.md`));
  if (fields.name !== skill.name) problems.push(`${skill.rel}: name "${fields.name}" differs from its folder`);
  if (!fields.description) problems.push(`${skill.rel}: no description`);
  else if (fields.description.length > 1024) problems.push(`${skill.rel}: description over 1024 characters`);

  const isPromoted = PROMOTED.has(skill.bucket);
  if (isPromoted !== readme.includes(`(${skill.rel}/SKILL.md)`)) {
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
console.log(`OK: ${skills.length} skill(s)`);
