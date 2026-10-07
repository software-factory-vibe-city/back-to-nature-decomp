import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { assemble, type AsmLine } from "../agent/matching-reconstruction/fixture-asm.js";
import { extractWebPartition, type WebPartition } from "./webPartition.js";
import { extractCandidatePartition } from "./candidateWebPartition.js";
import { addressedWebFacts, diffWebPartitions } from "./webPartitionDiff.js";
import { certifyCopyContractions, certifyRoleFusions } from "./webPartitionProof.js";
import { runHistoricalWebReplay, namedHistoricalRole, validateObservedFact } from "./webPartitionReplay.js";
import { allocationDominant, fingerprintWebPartition, pinAuditNames, probeRegisterPins, renderFingerprint, targetWebPartition } from "./fingerprintWebPartition.js";
import { unpinDeclarations } from "./webPartitionAudit.js";
import { matchingConstructs } from "../agent/cSourceGuard.js";
import { webPartitionFindings } from "../agent/triage.js";
import { ROOT, configuredCompilerPath } from "../agent/decompToolchain.js";
import type { ResidualObjective } from "../agent/pipeline-reversal/objective.js";
const base = 0x80010000;
function partition(lines: AsmLine[], side: "target" | "candidate" = "target"): WebPartition {
  const words = assemble(lines, base), bytes = Buffer.alloc(words.length * 4);
  words.forEach((w,i) => bytes.writeUInt32LE(w.raw, i * 4));
  return extractWebPartition({ functionName: "fixture", bytes, vram: base, side });
}
const split: AsmLine[] = [["addiu", "v0", "zero", 7], ["addu", "v1", "v0", "zero"], ["sw", "v0", 0, "a0"], ["sw", "v1", 4, "a0"], ["jr", "ra"], ["nop"]];
const fused: AsmLine[] = [["addiu", "v0", "zero", 7], ["sw", "v0", 0, "a0"], ["sw", "v0", 4, "a0"], ["jr", "ra"], ["nop"]];
test("copies retain one value but open two webs; register reuse is not identity", () => {
  const p = partition(split), ws = p.webs.filter(w => w.identity?.key === "const:7");
  assert.equal(ws.length, 2); assert.equal(p.copies.length, 1);
  assert.equal(p.copies[0]!.from, ws[0]!.id); assert.equal(p.copies[0]!.to, ws[1]!.id);
  const reused = partition([["addiu", "v0", "zero", 7], ["sw", "v0", 0, "a0"], ["addiu", "v0", "zero", 8], ["sw", "v0", 4, "a0"]]);
  assert.deepEqual(reused.webs.filter(w => w.residences[0]!.register === "v0").map(w => w.identity?.key), ["const:7", "const:8"]);
});
test("fused/split directives cite a prior closure, rather than a register pin", () => {
  const d = diffWebPartitions(partition(split), partition(fused, "candidate"));
  assert.equal(d.facts[0]?.class, "fused"); assert.equal(d.facts[0]?.identity, "const:7");
  assert.match(d.facts[0]!.directive.text, /named typed temporary/);
  assert.ok(d.facts[0]!.directive.citations.every(c => existsSync(join(ROOT, c.path))));
  const inv = diffWebPartitions(partition(fused), partition(split, "candidate"));
  assert.equal(inv.facts[0]?.class, "split"); assert.equal(inv.facts[0]?.directive.citations[0]?.kind, "closure");
  assert.deepEqual(addressedWebFacts(d, diffWebPartitions(partition(split), partition(split, "candidate"))), ["fused:const:7"]);
  assert.deepEqual(addressedWebFacts(d, { ...d, facts: [], undetermined: [{ identity: "const:7", reason: "lost proof" }] }), []);
});
test("different-value joins are undetermined; equal joins are proven", () => {
  const diamond = (right: number): AsmLine[] => [["beq", "a0", "zero", "right"], ["nop"], ["addiu", "v0", "zero", 1], ["j", "join"], ["nop"], ["label", "right"], ["addiu", "v0", "zero", right], ["label", "join"], ["sw", "v0", 0, "a1"], ["jr", "ra"], ["nop"]];
  const differing = partition(diamond(2)).webs.find(w => w.residences[0]!.register === "v0")!;
  assert.equal(differing.status, "undetermined"); assert.equal(differing.readCount, 1, "one operand, not two reaching defs");
  assert.equal(partition(diamond(1)).webs.find(w => w.residences[0]!.register === "v0")?.identity?.key, "const:1");
});
test("same-symbol HI16 web can feed repeated signed LO16 consumers", () => {
  const p = partition([["lui", "s0", 0x8007], ["addiu", "v0", "s0", -14280], ["sw", "v0", 0, "a0"], ["addiu", "v1", "s0", -14280], ["sw", "v1", 4, "a0"]]);
  assert.equal(p.webs.find(w => w.residences[0]!.register === "s0")?.identity?.kind, "symbol-high");
  assert.equal(p.webs.filter(w => w.identity?.key === `const:${0x8006c838}`).length, 2);
});
test("call effects happen after the delay-slot copy and kill scratch identities", () => {
  const p = partition([["addiu", "v0", "zero", 7], ["jal", 0x80020000], ["addu", "s0", "v0", "zero"], ["sw", "s0", 0, "a0"], ["sw", "v0", 4, "a0"]]);
  assert.equal(p.webs.find(w => w.residences[0]!.register === "s0")?.identity?.key, "const:7");
  assert.equal(p.copies[0]?.delaySlot, true);
  assert.equal(p.webs.filter(w => w.residences[0]!.register === "v0")[1]?.identity?.kind, "call-result");
});
test("stack reload identity is propagated only without aliasing writes", () => {
  const lines: AsmLine[] = [["addiu", "sp", "sp", -24], ["addiu", "v0", "zero", 7], ["sw", "v0", 16, "sp"], ["lw", "v1", 16, "sp"], ["nop"], ["sw", "v1", 0, "a0"]];
  const p = partition(lines);
  assert.equal(p.webs.find(w => w.residences[0]!.register === "v1")?.identity?.key, "const:7");
  const alias = [...lines.slice(0,3), ["sw", "zero", 0, "a0"] as AsmLine, ...lines.slice(3)];
  assert.equal(partition(alias).webs.find(w => w.residences[0]!.register === "v1")?.status, "undetermined");
});
test("memory versions distinguish loads across stores; dead writes do not create live webs", () => {
  const p = partition([["lw", "v0", 0, "a0"], ["nop"], ["sw", "v0", 0, "a1"], ["lw", "v1", 0, "a0"], ["nop"], ["sw", "v1", 4, "a1"], ["addiu", "t1", "zero", 999]]);
  assert.notEqual(p.webs.find(w => w.residences[0]!.register === "v0")?.identity?.key, p.webs.find(w => w.residences[0]!.register === "v1")?.identity?.key);
  assert.ok(!p.webs.some(w => w.residences[0]!.register === "t1"));
});
test("load-delay hazards and opaque words do not prove downstream identities", () => {
  const p = partition([["lw", "v0", 0, "a0"], ["addu", "v1", "v0", "zero"], ["sw", "v1", 0, "a1"]]);
  assert.ok(p.caveats.some(c => c.includes("load-delay")));
  assert.equal(p.webs.find(w => w.residences[0]!.register === "v1")?.status, "undetermined");
  assert.throws(() => extractWebPartition({ functionName: "bad", vram: base, bytes: Buffer.alloc(3) }), /unaligned/);
});
test("weight has no confident threshold without a hash-matched counterfactual", () => {
  const t = partition(fused), c = partition([...fused.slice(0,3), ["sw", "v0", 8, "a0"], ...fused.slice(3)], "candidate");
  const d = diffWebPartitions(t,c);
  assert.equal(d.facts.find(f => f.class === "weight")?.confidence, "undetermined");
  const witness = { targetHash: t.byteHash, candidateHash: c.byteHash, identity: "const:7", pseudo: 81, minimumReferences: 8, liveLength: 22, artifact: "measured-counterfactual.json" };
  const yes = diffWebPartitions(t,c,[witness]).facts.find(f => f.class === "weight")!;
  assert.match(yes.evidence.join(" "), />=8/);
  assert.equal(diffWebPartitions(t,c,[{ ...witness, candidateHash: "stale" }]).facts.find(f => f.class === "weight")?.confidence, "undetermined");
});
test("birth reports relative bindings, entry-web routes upstream, scratch vs saved reports residence", () => {
  const a: AsmLine[] = [["addiu", "v0", "zero", 999], ["addiu", "v1", "zero", 7], ["sw", "v0", 0, "a0"], ["sw", "v1", 4, "a0"]];
  const b: AsmLine[] = [a[1]!, a[0]!, ...a.slice(2)];
  assert.equal(diffWebPartitions(partition(a), partition(b,"candidate")).facts[0]?.class, "birth");
  const entry = diffWebPartitions(partition([["sw", "t0", 0, "a0"]]), partition([["sw", "zero", 0, "a0"]],"candidate"));
  assert.equal(entry.facts[0]?.class, "entry-web"); assert.match(entry.facts[0]!.directive.text, /nested-function/);
  const residence = diffWebPartitions(partition([["addiu", "s0", "zero", 7], ["jal", 0x80020000], ["nop"], ["sw", "s0", 0, "a0"]]), partition([["jal", 0x80020000], ["nop"], ["addiu", "v0", "zero", 7], ["sw", "v0", 0, "a0"]],"candidate"));
  assert.equal(residence.facts[0]?.class, "residence");
  const short = diffWebPartitions(partition([["addiu", "s0", "zero", 7], ["sw", "s0", 0, "a0"]]), partition([["addiu", "v0", "zero", 7], ["sw", "v0", 0, "a0"]],"candidate"));
  assert.ok(!short.facts.some(f => f.class === "residence"));
  assert.match(short.undetermined[0]!.reason, /neither web spans a call/);
});
test("golden GCC dumps supply allocation headers, lifetime/UIDs and RTL births", () => {
  const fixture = (stage: string) => readFileSync(new URL(`../agent/compiler-trace/test-fixtures/allocation.${stage}.txt`, import.meta.url), "utf8");
  const lreg = fixture("lreg"), greg = fixture("greg");
  const result = extractCandidatePartition(partition([],"candidate"), { rtl: lreg, lreg, greg });
  const local = result.pseudoWebs.find(p => p.pseudo === 105)!, global = result.pseudoWebs.find(p => p.pseudo === 106)!;
  assert.equal(local.sets, 1); assert.equal(local.weightedReferences, 2); assert.equal(local.hardRegister, "v0");
  assert.equal(local.birthUid, 10); assert.deepEqual(local.useUids, [12]); assert.deepEqual(local.deathUids, [12]);
  assert.equal(global.sets, 2); assert.equal(global.weightedReferences, 4); assert.equal(global.identity, null);
  assert.throws(() => extractCandidatePartition(partition([]), { rtl: "", lreg: "unfamiliar", greg }), /dump format/);
});
test("checked loop copy contraction does not guess a cyclic value identity", () => {
  const target: AsmLine[] = [["j", "body"], ["nop"], ["label", "top"], ["beq", "t0", "zero", "done"], ["addiu", "a0", "a0", 2], ["label", "body"], ["lhu", "v0", 0, "a0"], ["nop"], ["andi", "v1", "v0", 255], ["bne", "v1", "zero", "top"], ["addu", "t0", "v0", "zero"], ["label", "done"], ["jr", "ra"], ["addu", "v0", "zero", "zero"]];
  const contracted = target.map(i => [...i] as AsmLine);
  contracted[6] = ["lhu", "t0", 0, "a0"]; contracted[8] = ["andi", "v1", "t0", 255]; contracted[10] = ["nop"];
  const t = partition(target), c = partition(contracted, "candidate"), proof = certifyCopyContractions(t, c);
  assert.equal(proof.length, 1); assert.equal(proof[0]?.from.status, "undetermined");
  const d = diffWebPartitions(t, c); assert.equal(d.facts[0]?.class, "fused"); assert.equal(d.facts[0]?.relation, "copy-point");
  assert.match(d.facts[0]!.directive.text, /carried = raw/);
  const bad = structuredClone(c); bad.machine.words[0] = bad.machine.words[0]! ^ 4;
  assert.deepEqual(certifyCopyContractions(t, bad), [], "one unexplained word rejects the certificate");
  const liveSource = partition(target.slice(0, -1).concat([["nop"]])), liveCandidate = partition(contracted.slice(0, -1).concat([["nop"]]), "candidate");
  assert.deepEqual(certifyCopyContractions(liveSource, liveCandidate), [], "implicit ABI return must not observe the removed source SET");
  const readsOldDest = [...target], newRead = [...contracted];
  readsOldDest[7] = ["sw", "t0", 0, "a1"]; newRead[7] = ["sw", "t0", 0, "a1"];
  assert.deepEqual(certifyCopyContractions(partition(readsOldDest), partition(newRead, "candidate")), [], "old destination read before copy forbids early overwrite");
});
test("register binding erasure uses AST and preserves strings, comments, instruction asm and disabled code", () => {
  const s = '/* asm("v0") */\nint f(void) { register int x asm("v0"); const char *s="asm(\\"v1\\")"; asm volatile("nop"); return x; }\n#if 0\nint y asm("s0");\n#endif\n';
  const r = unpinDeclarations(s);
  assert.equal(r.removed, 1); assert.match(r.source, /register int x ;/);
  assert.match(r.source, /asm volatile/); assert.match(r.source, /y asm/); assert.match(r.source, /\/\* asm/);
});
test("pin erasure leaves assembler aliases, file-scope context and malformed conditionals untouched", () => {
  const s = 'extern int data asm("alias");\nregister int global asm("s0");\nint f(void) { register int local asm("v0"); return local; }';
  const r = unpinDeclarations(s);
  assert.equal(r.removed, 1); assert.match(r.source, /data asm\("alias"\)/); assert.match(r.source, /global asm\("s0"\)/);
  assert.throws(() => unpinDeclarations('#if 1\nint f(void) { register int x asm("v0"); return x; }'), /Cannot inspect/);
});
test("source construct report separates local pins, file context, aliases and instructions", () => {
  const source = 'extern int data asm("alias");\nregister int global asm("s0");\nint f(void) { register int local asm("v0"); asm volatile("nop"); return local; }';
  const c = matchingConstructs(source);
  assert.deepEqual(c.localRegisterBindings.map(b => b.name), ["local"]);
  assert.deepEqual(c.fileRegisterBindings.map(b => b.name), ["global"]);
  assert.equal(c.otherAsm.length, 1);
  assert.equal(c.otherAsm[0]?.scope, "function");
  assert.equal(c.localRegisterBindings[0]?.binding, 'asm("v0")');
});
test("pin census preserves inactive arms but still probes an active else/elif", () => {
  const source = 'int f(void) {\n#if 0\nregister int off asm("v0");\n#elif 0\nregister int off2 asm("v0");\n#else\nregister int on asm("v1");\n#endif\n#if 1\nregister int on2 asm("v0");\n#else\nregister int off3 asm("v1");\n#endif\nreturn on;\n}';
  const constructs = matchingConstructs(source);
  assert.deepEqual(constructs.localRegisterBindings.map(b => b.name), ["on", "on2"]);
  const erased = unpinDeclarations(source);
  assert.equal(erased.removed, 2);
  for (const name of ["off", "off2", "off3"]) assert.ok(erased.source.includes(`int ${name} asm(`));
  const elif = source.replace('#elif 0', '#elif 1');
  assert.deepEqual(matchingConstructs(elif).localRegisterBindings.map(b => b.name), ["off2", "on2"]);
});
test("candidate symbol/high identities are read from structured RTL nodes", () => {
  const lreg = ';; Function fixture\n83 registers.\nRegister 81 used 2 times across 2 insns in block 0; set 1 time; GR_REGS or none.\n;; Register 81 in 16.\n(insn 10 0 12 (set (reg:SI 81) (high:SI (symbol_ref:SI ("data")))) -1 (nil) (nil))\n(insn 12 10 0 (set (reg:SI 4) (reg:SI 81)) -1 (nil) (nil))\n';
  const result = extractCandidatePartition(partition([]), { rtl: lreg, lreg, greg: ';; Function fixture\n;; Register 81 in 16.\n' }, new Map([["data", 0x8006c838]]));
  assert.equal(result.pseudoWebs[0]?.identity?.key, `const:${0x80070000}`);
  const starred = lreg.replaceAll('"data"', '"*data"');
  assert.equal(extractCandidatePartition(partition([]), { rtl: starred, lreg: starred, greg: ';; Function fixture\n' }, new Map([["data", 0x8006c838]])).pseudoWebs[0]?.identity?.key, `const:${0x80070000}`, "GCC raw assembler-name marker is not an ELF symbol character");
  assert.throws(() => extractCandidatePartition(partition([]), { rtl: lreg, lreg, greg: ';; Function other\n' }), /do not belong/);
});
function selectorPartition(register: "v0" | "v1", twice = false): WebPartition {
  const load: AsmLine[] = [["lhu", register, 20992, "s1"], ["nop"], ["sh", register, 34, "a0"]];
  return partition([["lui", "s1", 0x8007], ...load, ...(twice ? load : []), ["addiu", "v0", "zero", 0], ["jr", "ra"], ["nop"]], register === "v0" ? "target" : "candidate");
}
function selectorDumps(overlap = true, secondPseudo = false, unusedCall = false) {
  const load = '(insn 67 11 75 (set (reg:SI 96) (zero_extend:SI (mem:HI (plus:SI (reg:SI 82) (const_int 20992)) 0))) -1 (nil) (nil))\n';
  const zero = '(insn 75 67 72 (set (reg/i:SI 2 v0) (const_int 0)) -1 (nil) (nil))\n';
  const store = '(insn 72 75 76 (set (mem:HI (plus:SI (reg:SI 4 a0) (const_int 34)) 0) (subreg:HI (reg:SI 96) 0)) -1 (nil) (expr_list:REG_DEAD (reg:SI 96) (nil)))\n';
  const lreg = ';; Function fixture\n100 registers.\nRegister 96 used 2 times across 3 insns in block 0; set 1 time; GR_REGS or none.\n;; Register 96 in 3.\n'
    + (secondPseudo ? 'Register 97 used 2 times across 3 insns in block 0; set 1 time; GR_REGS or none.\n;; Register 97 in 3.\n' : '')
    + ';; Start of basic block 0, registers live: 4 [$4]\n(insn 11 0 67 (set (reg:SI 82) (const_int 2147942400)) -1 (nil) (nil))\n'
    + (unusedCall ? '(call_insn 22 11 67 (set (reg:SI 2 v0) (call (mem:SI (symbol_ref:SI ("callee")) 0) (const_int 16))) -1 (nil) (expr_list:REG_UNUSED (reg:SI 2 v0) (nil)))\n' : '')
    + load + (overlap ? zero + store : store + zero)
    + '(insn 76 72 0 (use (reg/i:SI 2 v0)) -1 (nil) (expr_list:REG_DEAD (reg/i:SI 2 v0) (nil)))\n'
    + (secondPseudo ? load.replaceAll('67', '87').replaceAll('96', '97') + store.replaceAll('72', '88').replaceAll('96', '97') : '');
  return { rtl: lreg, lreg, greg: ';; Function fixture\n;; Register 96 in 3.\n' + (secondPseudo ? ';; Register 97 in 3.\n' : '') };
}
test("unique typed memory access projects a pseudo; ambiguous accesses in either direction do not", () => {
  const result = extractCandidatePartition(selectorPartition("v1"), selectorDumps());
  const p = result.pseudoWebs.find(p => p.pseudo === 96)!;
  assert.deepEqual(p.memoryLoad, { address: 0x80075200, width: 2, signed: false });
  assert.equal(p.attribution, "unique-memory-access-and-register"); assert.equal(p.machineWebs.length, 1);
  assert.equal(result.webs.find(w => w.id === p.machineWebs[0])?.identity?.memory?.width, 2);
  for (const [observed, dumps] of [[selectorPartition("v1", true), selectorDumps()], [selectorPartition("v1"), selectorDumps(true, true)]] as const) {
    const ambiguous = extractCandidatePartition(observed, dumps);
    assert.equal(ambiguous.pseudoWebs.find(p => p.pseudo === 96)?.attribution, "undetermined");
  }
  const wrongWidth = selectorDumps();
  wrongWidth.lreg = wrongWidth.lreg.replace('mem:HI', 'mem:QI');
  assert.equal(extractCandidatePartition(selectorPartition("v1"), wrongWidth).pseudoWebs.find(p => p.pseudo === 96)?.attribution, "undetermined");
});
test("scratch-only register difference is an allocation diagnostic, never a spelling fact/gradient", () => {
  const t = selectorPartition("v0"), c = extractCandidatePartition(selectorPartition("v1"), selectorDumps());
  const d = diffWebPartitions(t, c);
  assert.deepEqual(d.facts, []); assert.deepEqual(addressedWebFacts(d, diffWebPartitions(t, t)), []);
  assert.equal(d.assignments.length, 1); assert.equal(d.assignments[0]?.unchangedGeometry, true);
  assert.equal(d.assignments[0]?.pseudo?.pseudo, 96);
  assert.deepEqual(d.assignments[0]?.overlaps.map(o => o.requiredRelation), [{ beforeUid: 72, afterUid: 75 }]);
  assert.deepEqual(diffWebPartitions(t, t).assignments, []);
  const endpoint = structuredClone(c), role = endpoint.pseudoWebs.find(p => p.pseudo === 96)!.lifetimes[0]!;
  const hard = endpoint.hardRegisterLifetimes.find(h => h.birthUid === 75)!;
  hard.birthIndex = role.deathIndex; hard.deathIndex = role.deathIndex + 1;
  assert.equal(diffWebPartitions(t, endpoint).assignments[0]?.overlaps.length, 0, "one coincident endpoint alone is not a reconstructed conflict");
  const noOverlap = diffWebPartitions(t, extractCandidatePartition(selectorPartition("v1"), selectorDumps(false)));
  assert.equal(noOverlap.assignments[0]?.overlaps.length, 0, "endpoint disjoint ranges are not conflicts");
  const unused = extractCandidatePartition(selectorPartition("v1"), selectorDumps(true, false, true));
  assert.ok(!unused.hardRegisterLifetimes.some(r => r.birthUid === 22), "REG_UNUSED call result must not create a false full-tail interval");
  const ambiguous = diffWebPartitions(t, extractCandidatePartition(selectorPartition("v1"), selectorDumps(true, true)));
  assert.equal(ambiguous.assignments[0]?.pseudo, null); assert.deepEqual(ambiguous.assignments[0]?.overlaps, []);
});
test("triage gate requires semantically aligned allocation-majority; exact/unknown never activate", () => {
  const o = { exact: false, degraded: false, undetermined: 0, controlFlow: 0, population: 0, schedule: 1, allocation: 3 } as ResidualObjective;
  assert.equal(allocationDominant(o), true);
  for (const changed of [{ population: 1 }, { controlFlow: 1 }, { exact: true }, { undetermined: 1 }, { schedule: 4 }]) assert.equal(allocationDominant({ ...o, ...changed }), false);
});
const originals = existsSync(join(ROOT, "extracted/iso/slus_011.15"));
const projectTest = originals ? test : test.skip;
projectTest("five original-target gates: delay copy, sign view, high web, copy census, index weight", () => {
  const p = targetWebPartition("func_80017F30");
  assert.ok(p.copies.some(e => e.delaySlot && p.webs.find(w => w.id === e.from)?.residences[0]?.register === "v0" && p.webs.find(w => w.id === e.to)?.residences[0]?.register === "t0"));
  assert.ok(p.webs.every(w => w.liveLength >= 1));
  const sign = targetWebPartition("func_8001D2D8");
  assert.match(sign.webs.find(w => w.birth === 0)?.identity?.description ?? "", /sll/);
  assert.match(sign.webs.find(w => w.birth === 1)?.identity?.description ?? "", /sra/);
  const high = targetWebPartition("ovl_11_func_800DDDBC").webs.find(w => w.identity?.kind === "symbol-high")!;
  assert.equal(high.readCount, 2);
  const remats = targetWebPartition("func_80012598");
  assert.ok(remats.copies.length >= 16, "base copies present; bytes do not certify reload cost");
  const index = targetWebPartition("func_8001E340").webs.find(w => w.residences[0]!.register === "a1")!;
  assert.equal(index.readCount, 2); assert.equal(index.estimatedWeightedReferences, 7, "7 is weighted defs+uses, NOT 7 machine reads");
});
const toolchain = originals && existsSync(configuredCompilerPath());
let replayCache: ReturnType<typeof runHistoricalWebReplay> | undefined;
const historicalReplay = () => replayCache ??= runHistoricalWebReplay();
(toolchain ? test : test.skip)("byte-matched corpus has empty observed diffs with genuine candidate dumps", () => {
  // EXE + overlay, straight-line + loops + calls + pinned/reload-heavy code.
  const names = ["ClearPairS32", "ClearVal8005E2CC", "CopyVec3", "func_80020E38", "func_80021820", "func_8001D2D8", "func_8001E340", "func_80017F30", "func_80012598", "ovl_11_func_800DDDBC", "ovl_11_func_800F3EF0", "ovl_11_func_800F8B4C", "ovl_11_func_801129EC", "ovl_11_func_800BF450", "ovl_11_func_800E1770"];
  for (const name of names) {
    const r = fingerprintWebPartition(name);
    assert.equal(r.oracleVerdict, "match", `${name}: sample must independently match bytes`);
    assert.equal(r.diff?.exactObservedPartition, true, name); assert.deepEqual(r.diff?.facts, [], name);
    assert.ok(r.candidate?.pseudoWebs.length || name.startsWith("Clear"), name);
  }
});
(toolchain ? test : test.skip)("BC54 pin probe explains the two words and pre-allocation overlap inline without claiming a clean spelling", () => {
  const name = "ovl_11_func_8010BC54", source = join(ROOT, "src/overlays/ovl_11", `${name}.c`), before = readFileSync(source, "utf8");
  const configPath = join(ROOT, ".pi/autoloop.json"), config = readFileSync(configPath, "utf8");
  const baseline = fingerprintWebPartition(name), probe = probeRegisterPins(baseline)!, r = probe.report!;
  assert.equal(baseline.oracleVerdict, "match"); assert.equal(r.oracleVerdict, "mismatch");
  assert.equal(r.oracleEvidence?.sameWords, 35); assert.equal(r.oracleEvidence?.totalWords, 37);
  assert.deepEqual(r.oracleEvidence?.differences.map(d => d.address), [0x8010bcc8, 0x8010bcd4]);
  assert.ok(r.provenance.object && existsSync(r.provenance.object));
  assert.deepEqual(r.diff?.facts, []); assert.equal(r.diff?.assignments.length, 1);
  const a = r.diff!.assignments[0]!;
  assert.equal(a.unchangedGeometry, true); assert.equal(a.pseudo?.pseudo, 96);
  assert.deepEqual(a.pseudo?.setUids, [67]); assert.deepEqual(a.pseudo?.deathUids, [72]);
  assert.equal(a.overlaps.length, 1, "unused earlier call result must not manufacture a blocker");
  assert.equal(a.overlaps[0]?.hard.birthUid, 75); assert.equal(a.overlaps[0]?.hard.deathUid, 76);
  assert.deepEqual(a.overlaps[0]?.requiredRelation, { beforeUid: 72, afterUid: 75 });
  const text = renderFingerprint(baseline, probe).join("\n");
  assert.match(text, /35\/37/); assert.match(text, /0x8010bcc8: target lhu\s+v0.*candidate lhu\s+v1/);
  assert.match(text, /0x8010bcd4: target sh\s+v0.*candidate sh\s+v1/);
  assert.match(text, /not a fused\/split web/); assert.match(text, /UID 67.*-> UID 75.*-> UID 72/);
  assert.match(text, /No verified clean-C spelling/); assert.match(text, /inspectLocalAllocationVariant\.ts/);
  const findings = webPartitionFindings(r);
  assert.equal(findings.length, 1); assert.equal(findings[0]?.severity, "info");
  assert.match(findings[0]!.summary, /allocator diagnostic, not a spelling directive/);
  assert.match(findings[0]!.evidence.join("\n"), /pseudo UID 67\.\.72 overlaps explicit \$v0 UID 75\.\.76/);
  assert.equal(readFileSync(source, "utf8"), before); assert.equal(readFileSync(configPath, "utf8"), config);
});
(toolchain ? test : test.skip)("multi-SET base/result fusion needs unique same-block bindings, not hard-register reuse alone", () => {
  const attempt = historicalReplay().rows.find(r => r.functionName === "ovl_11_func_801129EC")!.attempts[0]!;
  assert.ok(attempt.source);
  const r = fingerprintWebPartition("ovl_11_func_801129EC", { source: attempt.source });
  const c = r.candidate!, facts = r.diff!.facts;
  assert.equal(facts[0]?.class, "fused"); assert.equal(facts[0]?.relation, "expression-roles");
  assert.equal(namedHistoricalRole(r.functionName, facts[0]), true); assert.equal(validateObservedFact(r, facts[0]!), true);
  assert.equal(certifyRoleFusions(r.target, c).length, 1);
  const p = c.pseudoWebs.find(p => p.pseudo === 81)!;
  assert.equal(p.setBindings.find(s => s.uid === 34)?.identity?.key, `const:${0x80076220}`);
  assert.equal(p.setBindings.find(s => s.uid === 53)?.selfInput, true);
  for (const mutate of [
    (p: typeof c.pseudoWebs[number]) => { p.sets = 1; },
    (p: typeof c.pseudoWebs[number]) => { p.setBindings.find(s => s.uid === 53)!.selfInput = false; },
    (p: typeof c.pseudoWebs[number]) => { p.setBindings.find(s => s.uid === 34)!.identity = null; },
    (p: typeof c.pseudoWebs[number]) => { p.setBindings.find(s => s.uid === 34)!.block = null; },
    (p: typeof c.pseudoWebs[number]) => { p.setBindings.find(s => s.uid === 53)!.block = p.setBindings.find(s => s.uid === 34)!.block! + 1; },
  ]) {
    const bad = structuredClone(c); mutate(bad.pseudoWebs.find(p => p.pseudo === 81)!);
    assert.deepEqual(certifyRoleFusions(r.target, bad), [], "an unsupported pseudo relation must not become a confident fact");
    assert.equal(validateObservedFact({ ...r, candidate: bad }, facts[0]!), false);
  }
  const ambiguous = structuredClone(c), duplicate = structuredClone(p);
  duplicate.pseudo = Math.max(...c.pseudoWebs.map(p => p.pseudo)) + 1;
  ambiguous.pseudoWebs.push(duplicate);
  assert.deepEqual(certifyRoleFusions(r.target, ambiguous), [], "another pseudo assigned the same register must refuse attribution");
  assert.equal(validateObservedFact({ ...r, candidate: ambiguous }, facts[0]!), false);
});
(toolchain ? test : test.skip)("historical named-first gate retains five cases, passes four specific roles, and audits all confident facts", () => {
  const replay = historicalReplay();
  assert.deepEqual(replay.gate, { required: 4, denominator: 5, namedFirst: 4, wrongConfident: 0, controlsPassed: true, met: true });
  assert.equal(replay.rows.find(r => r.functionName === "func_8001E340")?.namedFirst, false, "no private-weight threshold fabricated");
  const birth = replay.rows.find(r => r.functionName === "ovl_11_func_800F3EF0")!;
  assert.equal(birth.attempts.length, 2); assert.equal(birth.attempts[0]?.control, "no-birth");
  assert.equal(birth.attempts[0]?.namedFirst, false); assert.equal(birth.attempts[0]?.controlPassed, true);
  const positive = birth.attempts[1]!;
  assert.equal(positive.namedFirst, true);
  assert.ok("sourceHash" in positive && "facts" in positive);
  assert.equal(positive.hash, positive.sourceHash);
  assert.equal(birth.firstIdentity, "const:999");
  assert.equal(namedHistoricalRole("ovl_11_func_800F3EF0", { ...positive.facts[0]!, identity: "const:24" }), false, "wrong binding of the right class cannot pass");
});
projectTest("retirement audit derives configured pins including 801 addresses", () => {
  const names = pinAuditNames(JSON.parse(readFileSync(join(ROOT,".pi/autoloop.json"),"utf8")));
  assert.ok(names.includes("func_80020E38")); assert.ok(names.includes("func_80021820")); assert.ok(names.some(n => n.startsWith("ovl_11_func_801")));
});
