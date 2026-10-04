import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_CONFIG } from "../autonomous/config.ts";
import { finalizeWorkspace } from "./finalization.ts";

/* Real gate/orchestration, Git tree snapshots and process runner. Fixed fixture
 * commands replace the expensive byte/build oracles, not their acceptance order. */
function fixture(t: { after: (f: () => void) => void }, scenario: Record<string, unknown> = {}) {
  const root = mkdtempSync(join(tmpdir(), "finalization-sequence-"));
  const oldPath = process.env.PATH;
  for (const dir of ["src", "include", "configs", "build", "bin"]) mkdirSync(join(root, dir));
  writeFileSync(join(root, "src/f.c"), "void f(void) {}\n");
  writeFileSync(join(root, "include/functions.h"), "/* before export */\n");
  writeFileSync(join(root, "configs/flag_overrides.mk"), "");
  writeFileSync(join(root, "build/callGraph.json"), JSON.stringify({ functions: [{ name: "f", vram: "0x80010000", container: "exe", source: "src/f.c", dead: false, calls: [], calledBy: [] }] }));
  writeFileSync(join(root, "scenario.json"), JSON.stringify(scenario));
  const script = `#!${process.execPath}
const fs=require('node:fs'),path=require('node:path');
const root=process.cwd(),s=JSON.parse(fs.readFileSync('scenario.json','utf8'));
const events=fs.existsSync('events')?fs.readFileSync('events','utf8').trim().split('\\n'):[];
const isMake=path.basename(process.argv[1])==='make';
let kind=isMake?'build':process.argv.some(a=>a.includes('contextExport.ts'))?'export':'diff';
const count=events.filter(e=>e.startsWith(kind+':')).length+1;
const label=kind+':'+count;fs.appendFileSync('events',label+'\\n');
if(s.pause===label) { fs.writeFileSync('paused',label);setInterval(()=>{},1000); }
else if(kind==='diff') { console.log('Match: 1/1 words (100.0%)\\nVERDICT: '+(s.diffFailure&&count===1?'UNDETERMINED':'MATCH')); }
else if(kind==='build') { if(s.buildFailure===count) process.exitCode=8; }
else if(kind==='export') { if(s.exportFailure) process.exitCode=9;else {fs.writeFileSync('include/functions.h','void f(void);\\n');if(s.policyAfterExport) fs.writeFileSync('src/f.c','void f(void) { __asm__("nop"); }\\n');} }
`;
  for (const command of ["npx", "make"]) writeFileSync(join(root, "bin", command), script, { mode: 0o755 });
  execFileSync("git", ["init", "-q"], { cwd: root }); execFileSync("git", ["add", "src", "include", "configs"], { cwd: root });
  const tree = execFileSync("git", ["write-tree"], { cwd: root, encoding: "utf8" }).trim();
  const revision = execFileSync("git", ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.test", "commit-tree", tree, "-m", "fixture"], { cwd: root, encoding: "utf8" }).trim();
  execFileSync("git", ["update-ref", "HEAD", revision], { cwd: root });
  process.env.PATH = join(root, "bin") + ":" + oldPath;
  t.after(() => { process.env.PATH = oldPath; rmSync(root, { recursive: true, force: true }); });
  const config = structuredClone(DEFAULT_CONFIG);
  const options = { projectRoot: root, config, functionName: "f", changedFiles: ["src/f.c"], patch: "" };
  const events = () => existsSync(join(root, "events")) ? readFileSync(join(root, "events"), "utf8").trim().split("\n") : [];
  return { root, options, events };
}

test("the shared route gates, exports and re-gates integrated inputs in order", async (t) => {
  const f = fixture(t); const result = await finalizeWorkspace(f.options);
  assert.equal(result.pass, true); assert.deepEqual(f.events(), ["diff:1", "build:1", "export:1", "diff:2", "build:2"]);
  assert.equal(readFileSync(join(f.root, "include/functions.h"), "utf8"), "void f(void);\n");
});
for (const [name, scenario] of [["relocation-undetermined", { diffFailure: true }], ["full build", { buildFailure: 1 }], ["publication", { exportFailure: true }], ["second build", { buildFailure: 2 }], ["second policy", { policyAfterExport: true }]] as const) {
  test(`${name} failure cannot be finalized`, async (t) => {
    const f = fixture(t, scenario); const result = await finalizeWorkspace(f.options);
    assert.equal(result.pass, false); assert.ok(result.failures.length > 0);
    if (name === "relocation-undetermined" || name === "full build") assert.ok(!f.events().includes("export:1"));
    if (name === "publication") assert.ok(!f.events().includes("diff:2"));
  });
}
for (const reason of ["policy", "scope"] as const) {
  test(`${reason} failure prevents context export even if byte/build commands pass`, async (t) => {
    const f = fixture(t);
    if (reason === "policy") writeFileSync(join(f.root, "src/f.c"), 'void f(void) { __asm__("nop"); }\n');
    else f.options.changedFiles.push("unrelated.txt");
    const result = await finalizeWorkspace(f.options);
    assert.equal(result.pass, false); assert.ok(!f.events().includes("export:1"));
  });
}
test("already-cancelled finalization launches no command", async (t) => {
  const f = fixture(t), abort = new AbortController(); abort.abort();
  await assert.rejects(finalizeWorkspace({ ...f.options, signal: abort.signal })); assert.deepEqual(f.events(), []);
});
for (const boundary of ["diff:1", "build:1", "export:1", "diff:2", "build:2"]) {
  test(`cancellation at ${boundary} stops the current command and never starts the next boundary`, async (t) => {
    const f = fixture(t, { pause: boundary }), abort = new AbortController();
    const task = finalizeWorkspace({ ...f.options, signal: abort.signal }).then((gate) => gate.pass, () => false);
    try {
      const end = Date.now() + 8000;
      while (!existsSync(join(f.root, "paused")) && Date.now() < end) await new Promise((r) => setTimeout(r, 10));
      assert.equal(existsSync(join(f.root, "paused")), true);
      abort.abort(); assert.equal(await task, false); assert.equal(f.events().at(-1), boundary);
    } finally { abort.abort(); await task; }
  });
}
