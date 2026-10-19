#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const skill=read(".agents/skills/paper-reading-tutor/SKILL.md");
const rubric=read(".agents/skills/paper-reading-tutor/references/quiz-rubric.md");
const template=read(".agents/skills/paper-reading-tutor/assets/learning-notes-template.md");
const memory=read("data/project-memory/paper-reading-workflow_zh.md");
assert.match(skill,/^---\nname: paper-reading-tutor\ndescription: .+\n---\n/);
for(const s of ["原文","一次一題","等使用者回答","補考","教授","GitHub","canonical thesis repo"]) assert.ok(skill.includes(s),"missing skill contract: "+s);
for(const s of ["0–10","只問一題","補考"]) assert.ok(rubric.includes(s),"missing rubric contract: "+s);
for(const s of ["未核對","狀態","補考","教授"]) assert.ok(template.includes(s),"missing note template: "+s);
for(const s of ["一次只問一題","Kalman","不捏造"]) assert.ok(memory.includes(s),"missing durable memory: "+s);
for(const [p,s] of [["AGENTS.md","paper-reading-tutor/SKILL.md"],["README.md","paper-reading-tutor/SKILL.md"],["data/project-memory/README.md","paper-reading-workflow_zh.md"],["docs/tooling.md","paper-reading-tutor/"],["scripts/validate-all.mjs","validate-paper-reading-skill.mjs"]]) assert.ok(read(p).includes(s),"missing registry "+p);
console.log("Paper Reading Tutor Skill contract OK");
