import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../lib/psxExeInfo.js";
import { loadContainers } from "../lib/container.js";
import { compareFunction } from "../lib/functionOracle.js";
import { compileSource } from "../agent/decompToolchain.js";
import { parseC, walk } from "../agent/residual-source-search/tree-sitter-c.js";
import { collectMacroCoverage, loadMacroTextRanges, scanMacroPresence } from "./macroCoverage.js";
import { detectMacroIdentities, loadMacroFunctions } from "./macroIdentity.js";
import { mineMacroCandidates } from "./macroMiner.js";

function bytes(words: number[]): Buffer {
  const out = Buffer.alloc(words.length * 4);
  words.forEach((w, i) => out.writeUInt32LE(w >>> 0, i * 4));
  return out;
}

test("presence-only scan counts opcode families and merges >=3/32-word clusters", () => {
  const words = Array<number>(96).fill(0);
  words[1] = 0x4a180001; words[8] = 0xc8000000; words[20] = 0xe8000000;
  words[80] = 0x4a180001;
  const report = scanMacroPresence(bytes(words), { container: "unenabled", targetPath: "fixture.bin", enabled: false, reason: "No splat", base: null });
  assert.deepEqual(report.counts, { COP2: 2, LWC2: 1, SWC2: 1, total: 4 });
  assert.equal(report.tier, "presence-only"); assert.equal(report.bounds, "unbounded");
  assert.equal(report.clusters.length, 1); assert.equal(report.clusters[0]!.opCount, 3);
  assert.equal(report.clusters[0]!.startVram, null); assert.match(report.caveat, /data/);
  const bounded = scanMacroPresence(bytes(words), { container: "enabled", targetPath: "fixture.bin", enabled: true, reason: "Splat", ranges: [{ startOffset: 0, endOffset: 4 }], base: 0x80010000 });
  assert.equal(bounded.counts.total, 0); assert.deepEqual(bounded.clusters, []);
  assert.equal(bounded.bounds, "splat-text");
  assert.throws(() => scanMacroPresence(bytes(words), { container: "bad", targetPath: "fixture.bin", enabled: true, reason: "Splat", ranges: [{ startOffset: 0, endOffset: 400 }] }), /Invalid presence range/);
});

test("extracted overlays without container mappings are explicit skips, with presence only", () => {
  mkdirSync(join(ROOT, "build"), { recursive: true });
  const dir = mkdtempSync(join(ROOT, "build/macro-coverage-test-"));
  try {
    writeFileSync(join(dir, "ovl_unknown.bin"), bytes([0x4a180001, 0xc8000000, 0xe8000000]));
    const report = detectMacroIdentities({ containers: [], overlayDirectory: dir, library: { templates: [], diagnostics: [] }, resolveCommands: false });
    assert.equal(report.censusComplete, true); assert.equal(report.functions.length, 0);
    // Explicitly selected empty container set does not silently widen scope.
    assert.match(report.coverage.containersSkipped[0]!.reason, /Outside requested/);
    const project = collectMacroCoverage([], [], [], { scope: "project", overlayDirectory: dir });
    assert.equal(project.coverage.complete, false);
    assert.match(project.coverage.containersSkipped[0]!.reason, /No manifest\/container mapping/);
    assert.equal(project.presence[0]!.counts.total, 3); assert.equal(project.presence[0]!.bounds, "unbounded");
    assert.deepEqual(project.coverage.containersScanned, []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

const containers = existsSync(join(ROOT, "extracted/iso/slus_011.15")) ? loadContainers() : [];
const loaded = containers.length ? loadMacroFunctions(containers) : { functions: [], findings: [] };

test("all 14 address-named EXE COP2 functions include the 11 INCLUDE_ASM payloads", { skip: !containers.length }, () => {
  const exe = containers.find(c => c.id === "exe")!;
  const report = detectMacroIdentities({ containers: [exe] });
  const cop = report.functions.filter(f => f.name.startsWith("func_") && f.cop2.count);
  assert.equal(cop.length, 14);
  const parked = ["8001B5DC", "8001B6A0", "8001BB88", "8001BBD8", "8001C37C", "8001D348", "8001D6B8", "8001DCB0", "8001DE4C", "8001E088", "8001E26C"];
  for (const suffix of parked) {
    const name = `func_${suffix}`, f = cop.find(f => f.name.toLowerCase() === name.toLowerCase());
    assert.ok(f, name);
    const source = readFileSync(join(ROOT, "src", `${f.name}.c`), "utf8");
    const tree = parseC(source); let stub = false;
    try { walk(tree.rootNode, n => { if (n.type === "call_expression" && n.childForFieldName("function")?.text === "INCLUDE_ASM") stub = true; return true; }); }
    finally { tree.delete(); }
    assert.ok(stub, `${name} remains an INCLUDE_ASM payload, not excluded`);
  }
  assert.equal(report.coverage.functionByteSource, "original-target-bytes");
  assert.equal(report.coverage.sourceEligibility, "all-function-extents-including-INCLUDE_ASM");
  const entry = cop.find(f => f.name === "func_8001D6B8")!.tiling[0]!;
  assert.equal(entry.macro, "gte_ReadRotMatrix"); assert.equal(entry.vintage, "inline_c.h");
  assert.equal(entry.operands[0]!.value, 29); assert.equal(entry.operands[0]!.expression, "&stack_0x0");
  assert.equal(cop.find(f => f.name === "func_8001D6B8")!.sourceRepresentation, "INCLUDE_ASM");
  assert.equal(report.conversionQueue[0]!.function, "func_80038674");
  assert.equal(report.conversionQueue.filter(f => f.sourceRepresentation === "INCLUDE_ASM").length, 11);
  const outer = cop.find(f => f.name === "func_80038674")!;
  assert.equal(outer.sourceRepresentation, "top-level-asm");
  assert.equal(outer.coverage.fraction, 7 / 16);
  assert.deepEqual(outer.tiling.map(t => [t.macro, t.vintage]), [["gte_ldopv2", "inline_c.h"], ["gte_op0_b", "inline_c.h"], ["gte_stlvnl", "inline_c.h"]]);
  assert.ok(outer.candidateC.calls.every(c => c.header.endsWith("inline_c.h")));
  assert.equal(outer.candidateC.oracleStatus, "unverified");
});

test("38674 conversion boundary excludes the return of the exact SDK OuterProduct0 signature", { skip: !containers.length }, () => {
  const sdk = JSON.parse(readFileSync(join(ROOT, "tools/vendor/psx_psyq_signatures/470/LIBGTE.LIB.json"), "utf8")) as Array<{ name: string; sig: string; labels: Array<{ name: string }> }>;
  const signature = sdk.find(s => s.labels.some(l => l.name === "OuterProduct0"))!;
  const expected = Buffer.from(signature.sig.replace(/\s+/g, ""), "hex");
  const exe = containers.find(c => c.id === "exe")!;
  const f = loaded.functions.find(f => f.name === "func_80038674")!;
  const original = readFileSync(join(ROOT, exe.targetPath));
  const offset = f.vram - exe.loadAddr + exe.payloadOffset;
  assert.equal(f.bytes.length, 0x50); assert.equal(expected.length, 0x60);
  assert.deepEqual(original.subarray(offset, offset + expected.length), expected);
  assert.equal(original.readUInt32LE(offset + f.bytes.length), 0x03e00008, "jr ra belongs to this routine, but is outside the configured extent");
});

test("enabled ovl_11 presence excludes both COP2-looking work-area data clusters", { skip: !containers.some(c => c.id === "ovl_11") }, () => {
  const c = containers.find(c => c.id === "ovl_11")!;
  const raw = readFileSync(join(ROOT, c.targetPath));
  const base = c.loadAddr - c.payloadOffset;
  const bounded = scanMacroPresence(raw, { container: c.id, targetPath: c.targetPath, enabled: true, reason: "Splat", ranges: loadMacroTextRanges(c), base });
  assert.equal(bounded.counts.total, 0); assert.deepEqual(bounded.clusters, []);
  const unbounded = scanMacroPresence(raw, { container: c.id, targetPath: c.targetPath, enabled: false, reason: "Negative control", base });
  for (const address of [0x80126688, 0x80128310]) assert.ok(unbounded.clusters.some(cluster => cluster.startVram! <= address && cluster.endVram! > address));
});

test("matched clean-C sample has no macro-candidate under --mine all", { skip: !containers.length }, () => {
  const dir = mkdtempSync(join(ROOT, "build/macro-negative-control-"));
  const exe = containers.find(c => c.id === "exe")!;
  const sample = [];
  try {
    for (const f of loaded.functions.filter(f => f.container === "exe")) {
      const sourcePath = join(ROOT, exe.paths.srcDir, `${f.name}.c`);
      if (!existsSync(sourcePath)) continue;
      const source = readFileSync(sourcePath, "utf8");
      const tree = parseC(source); let disallowed = tree.rootNode.hasError;
      try { walk(tree.rootNode, n => {
        if (n.type.includes("asm") || n.type === "identifier" && /^(?:INCLUDE_ASM|CAPTURE_|SCRATCH_STACK_|gte_|BREAK|M2C_BREAK)/.test(n.text)) disallowed = true;
        return true;
      }); } finally { tree.delete(); }
      if (disallowed) continue;
      const artifact = compileSource(sourcePath, join(dir, f.name), f.name, { assemble: true });
      assert.equal(compareFunction(f.name, { container: exe, objectPath: artifact.object! }).verdict, "match", `negative control ${f.name} must actually match`);
      sample.push(f);
      if (sample.length === 12) break;
    }
    assert.equal(sample.length, 12);
    const mining = mineMacroCandidates(sample, [], { tier: "all", maxPatterns: 200000, maxCandidates: 10000 });
    assert.ok(mining.completeWithinBounds);
    assert.ok(mining.candidates.every(c => c.verdict !== "macro-candidate"));
    assert.ok(mining.candidates.every(c => ["macro-candidate", "compiler-explainable", "undetermined"].includes(c.verdict)));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
