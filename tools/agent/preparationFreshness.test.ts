import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, cpSync, symlinkSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { packetIsFresh, hashFile } from "./prepareFunction.js";
import { configuredToolchainIdentity, ROOT } from "./decompToolchain.js";
import type { PreparationPacket } from "./campaign/packet.js";

test("packet freshness separates ledger diagnostics while checking artifacts and discovery membership", (t) => {
  const root = mkdtempSync(join(tmpdir(), "preparation-freshness-")); t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const dir of ["src", "build", "include"]) mkdirSync(join(root, dir));
  for (const [p, value] of [["src/f.c", "void f(void) {}\n"], ["include/common.h", "/* input */"], ["build/draft.c", "void f(void) { }\n"],
    ["build/raw.c", "void f(void) { }\n"], ["build/f.i", "cpp"], ["build/f.s", "assembly"], ["build/f.o", "object"]]) writeFileSync(join(root, p!), value!);
  const artifact = (path: string) => ({ path, sha256: hashFile(join(root, path)) });
  const packet = { schemaVersion: 1, identity: { inputs: { "src/f.c": hashFile(join(root, "src/f.c")), "include/common.h": hashFile(join(root, "include/common.h")) },
    memberships: { src: ["src/f.c"] }, tools: configuredToolchainIdentity() },
    primary: { ...artifact("build/draft.c"), text: readFileSync(join(root, "build/draft.c"), "utf8"), origin: "m2c" },
    compilation: { preprocessed: artifact("build/f.i"), assembly: artifact("build/f.s"), object: artifact("build/f.o") },
    generation: { raw: "build/raw.c", rawHash: hashFile(join(root, "build/raw.c")) } } as unknown as PreparationPacket;
  assert.equal(packetIsFresh(packet, root), true);
  assert.equal(packetIsFresh({} as PreparationPacket, root), false);
  writeFileSync(join(root, "build/ledger.jsonl"), "new diagnostic\n"); assert.equal(packetIsFresh(packet, root), true);
  writeFileSync(join(root, "src/newly-available.c"), "void other(void) {}\n"); assert.equal(packetIsFresh(packet, root), false);
  rmSync(join(root, "src/newly-available.c")); assert.equal(packetIsFresh(packet, root), true);
  for (const path of ["src/f.c", "include/common.h", "build/draft.c", "build/raw.c", "build/f.i", "build/f.s", "build/f.o"]) {
    const previous = readFileSync(join(root, path)); writeFileSync(join(root, path), "changed");
    assert.equal(packetIsFresh(packet, root), false, path); writeFileSync(join(root, path), previous);
  }
});

test("isolated preparation reuses evidence, preserves repeated draft edits, and rejects interrupted/cancelled work", { timeout: 150_000 }, (t) => {
  const root = mkdtempSync(join(tmpdir(), "preparation-integration-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const path of ["src", "include", "configs", ".pi/extensions/psx-decomp", "tools/agent", "tools/build", "tools/lib", "tools/diagnostics"])
    cpSync(join(ROOT, path), join(root, path), { recursive: true });
  for (const path of ["Makefile", "package.json", "package-lock.json", ".pi/autodecomp.json"]) cpSync(join(ROOT, path), join(root, path));
  for (const path of ["node_modules", "tools/vendor", "lib", "extracted"]) symlinkSync(join(ROOT, path), join(root, path));
  mkdirSync(join(root, "build"));
  const mk = readFileSync(join(ROOT, "Makefile"), "utf8"), base = mk.match(/^BASENAME\s*:=\s*(\S+)/m)![1]!;
  for (const path of ["asm", "engine_syms.txt", "dep_syms.txt", "lib_bss_syms.txt", "undefined_funcs_auto.txt", "undefined_syms_auto.txt",
    "callGraph.json", "functions.csv", "sectionLayout.json", base + ".ld"])
    symlinkSync(join(ROOT, "build", path), join(root, "build", path));
  for (const container of JSON.parse(readFileSync(join(ROOT, "configs/overlays.json"), "utf8")).members) {
    const id = container.id as string;
    if (!existsSync(join(ROOT, "build", id))) continue;
    mkdirSync(join(root, "build", id));
    for (const path of ["asm", id + ".ld", "functions.csv", "sectionLayout.json", "undefined_funcs_auto.txt", "undefined_syms_auto.txt"])
      symlinkSync(join(ROOT, "build", id, path), join(root, "build", id, path));
  }
  /* A frozen baseline graph checks semantic equality, independently of the new
     freshness bookkeeping. No live sources or generated headers are modified. */
  writeFileSync(join(root, "tools/agent/type-propagation/baseline-graph.ts"), execFileSync("git", ["show", "HEAD:tools/agent/type-propagation/graph.ts"], { cwd: ROOT, encoding: "utf8" }));
  writeFileSync(join(root, "test-preparation.ts"), PREPARATION_INTEGRATION);
  const output = execFileSync(join(ROOT, "node_modules/.bin/tsx"), ["test-preparation.ts"], { cwd: root, encoding: "utf8", timeout: 145_000, maxBuffer: 16 * 1024 * 1024 });
  assert.match(output, /PREPARATION_INTEGRATION_PASSED/);
  console.log(output.trim());
});

const PREPARATION_INTEGRATION = String.raw`
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {prepareFunction,packetIsFresh} from './tools/agent/prepareFunction.ts';
import {seedOracle} from './tools/agent/type-propagation/seeds.ts';
import {buildEvidenceGraph} from './tools/agent/type-propagation/graph.ts';
import {buildEvidenceGraph as baselineGraph} from './tools/agent/type-propagation/baseline-graph.ts';
import {discoverStatic} from './tools/agent/staticDiscovery.ts';
import {withSymbolMetadata} from './tools/lib/symbolIndex.ts';
const root=process.cwd(), name='func_80017EA0';
const cache=(packet,phase)=>packet.performance.phases.find(p=>p.phase===phase)?.cache;
const first=await prepareFunction(name), warm=await prepareFunction(name);
assert.equal(warm.path,first.path);assert.equal(warm.packet.performance.cache,'hit');
assert.equal(first.packet.compilation.status,'succeeded');
assert.equal(first.packet.discovery.propagation.visited,1);
writeFileSync('src/CopyVec3.c',readFileSync('src/CopyVec3.c','utf8')+'\n/* unrelated edit */\n');
const unrelated=await prepareFunction(name);
assert.equal(cache(unrelated.packet,'analysis-cache'),'hit');
assert.equal(cache(unrelated.packet,'generation-cache'),'hit');
assert.equal(unrelated.packet.generation.raw,first.packet.generation.raw);
mkdirSync('build/experimentLedger',{recursive:true});writeFileSync('build/experimentLedger/'+name+'.jsonl','');
const ledger=await prepareFunction(name);
assert.equal(ledger.path,unrelated.path);assert.equal(ledger.packet.performance.cache,'hit');
assert.equal(ledger.packet.discovery.preflight.length,unrelated.packet.discovery.preflight.length+1);
assert.deepEqual(ledger.packet.compilation,unrelated.packet.compilation);
assert.match(readFileSync(ledger.packet.discovery.preflight.at(-1).stderr,'utf8'),/triage compilation: cache hit/);
const draft=ledger.packet.primary.path, edited=readFileSync(draft,'utf8')+'\n/* retained user draft edit */\n';
writeFileSync(draft,edited);
const resumed=await prepareFunction(name);
assert.equal(resumed.packet.primary.text,edited);assert.equal(readFileSync(draft,'utf8'),edited);
assert.notEqual(resumed.packet.primary.sha256,resumed.packet.generation.draftHash);
writeFileSync('include/game_types.h',readFileSync('include/game_types.h','utf8')+'\n/* relevant header edit */\n');
const header=await prepareFunction(name);
assert.equal(cache(header.packet,'analysis-cache'),'miss');assert.equal(header.packet.primary.text,edited);
/* An interrupted mandatory preflight must also be retried, not accepted as a
   complete warm packet merely because its compilation succeeded. */
header.packet.discovery.preflight[0].cancelled=true;
writeFileSync(header.path,JSON.stringify(header.packet));
const retried=await prepareFunction(name);
assert.notEqual(retried.path,header.path);assert.equal(retried.packet.primary.text,edited);
writeFileSync('tools/lib/symbolIndex.ts',readFileSync('tools/lib/symbolIndex.ts','utf8')+'\n/* shared implementation change */\n');
const helper=await prepareFunction(name);
assert.equal(cache(helper.packet,'analysis-cache'),'miss');assert.equal(helper.packet.primary.text,edited);
writeFileSync(helper.path,'{"interrupted":');
const repaired=await prepareFunction(name);
assert.notEqual(repaired.path,helper.path);assert.equal(repaired.packet.primary.text,edited);
assert.equal(packetIsFresh(repaired.packet),true);
/* Newly available clean definitions and relevant callee edits cannot reuse a
   previously absent/rejected contract. The relocated oracle admits it anew. */
const clean=readFileSync('src/CopyVec3.c','utf8');
writeFileSync('src/CopyVec3.c','#include "common.h"\nINCLUDE_ASM("build/asm/nonmatchings/CopyVec3", CopyVec3);\n');
assert.equal(seedOracle('absent').get('CopyVec3'),undefined);
const before=await prepareFunction('func_8001F190');
writeFileSync('src/CopyVec3.c',clean);
const available=seedOracle('available');assert.ok(available.get('CopyVec3'),available.records[0]?.reason);
assert.equal(available.records[0]?.status,'verified');
const nextStarted=performance.now(), after=await prepareFunction('func_8001F190');assert.equal(cache(after.packet,'analysis-cache'),'miss');
console.log('NEXT_AFTER_VERIFIED_DEFINITION_MS='+Math.round(performance.now()-nextStarted));
const later=seedOracle('later');assert.ok(later.get('CopyVec3'));assert.equal(later.records[0]?.cache,'hit');
withSymbolMetadata(()=>{
 const oracle=seedOracle('frozen');const current=buildEvidenceGraph('func_8001F190',{seed:oracle.get});
 const baseline=baselineGraph('func_8001F190',{seed:oracle.get});
 assert.deepEqual({...current,inputs:[]},{...baseline,inputs:[]});
 const discovery=discoverStatic('func_8001F190',root,current), original=discoverStatic('func_8001F190',root,baseline);
 /* The new graph records additional freshness inputs, not different evidence. */
 for(const input of baseline.inputs)assert.ok(current.inputs.includes(input),input);
 assert.deepEqual({...discovery,graph:{...discovery.graph,inputs:[]}}, {...original,graph:{...original.graph,inputs:[]}});
});
/* Cancellation during the real measurement orchestration. The fixed wrapper
   has no descendants; it never alters compiler flags or compilation evidence. */
mkdirSync('bin',{recursive:true});
const cpp=execFileSync('which',['mips-linux-gnu-cpp'],{encoding:'utf8'}).trim();
writeFileSync('bin/mips-linux-gnu-cpp','#!'+process.execPath+'\n'+
 'import fs from "node:fs";import cp from "node:child_process";const args=process.argv.slice(2);'+
 'if(args.includes("-o")&&args.some(a=>a.endsWith("/src/CopyVec3.c"))){fs.writeFileSync("paused","");setInterval(()=>{},1000);}'+
 'else{const r=cp.spawnSync('+JSON.stringify(cpp)+',args,{stdio:"inherit"});process.exit(r.status??1);}',{mode:0o755});
const old=process.env.PATH;process.env.PATH=join(root,'bin')+':'+old;
const abort=new AbortController(), task=prepareFunction('CopyVec3',{signal:abort.signal});
const end=Date.now()+15000;while(!existsSync('paused')&&Date.now()<end)await new Promise(r=>setTimeout(r,10));
assert.equal(existsSync('paused'),true);abort.abort();
const cancelled=await task;assert.ok(cancelled.packet.compilation.commands.some(c=>c.cancelled));
assert.equal(cancelled.packet.compilation.status,'failed');assert.equal(readFileSync('src/CopyVec3.c','utf8'),clean);
process.env.PATH=old;
const retry=await prepareFunction('CopyVec3');assert.equal(retry.packet.performance.cache,'miss');assert.equal(retry.packet.comparison.status,'exact');
const already=new AbortController();already.abort();await assert.rejects(prepareFunction(name,{signal:already.signal}));
console.log('PREPARATION_INTEGRATION_PASSED');
`;
