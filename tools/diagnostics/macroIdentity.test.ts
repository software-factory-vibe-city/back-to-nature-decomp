import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { ROOT } from "../lib/psxExeInfo.js";
import { loadContainers, type Container } from "../lib/container.js";
import { decodeMacroBytes, isCop2 } from "./macroInstructions.js";
import { extractMacroTemplates, loadMacroHeaders } from "./macroTemplates.js";
import { deriveRepoMacroEncodings, parseGasMacroDefinitions, readEncodingProbeSection } from "./macroEncodings.js";
import { compileSource, configuredAsFlagsForContainer, configuredCc1FlagsForContainer, configuredCompilerPath } from "../agent/decompToolchain.js";
import { tileMacroFunction, type MacroFunction } from "./macroTiler.js";
import { mineMacroCandidates } from "./macroMiner.js";
import { detectMacroIdentities, loadMacroFunctions, formatMacroIdentityReport } from "./macroIdentity.js";
import { collectMacroCoverage, loadMacroTextRanges, scanMacroPresence } from "./macroCoverage.js";

const bytes = (...words: number[]): Buffer => {
  const buffer = Buffer.alloc(words.length * 4);
  words.forEach((w, i) => buffer.writeUInt32LE(w >>> 0, i * 4));
  return buffer;
};
const fn = (buffer: Buffer, name = "test", vram = 0x80010000): MacroFunction => ({ name, container: "fixture", vram, bytes: buffer });
const cfc = (reg: number, cp: number): number => (0x12 << 26) | (2 << 21) | (reg << 16) | (cp << 11);
const sw = (reg: number, base: number, off = 0): number => (0x2b << 26) | (base << 21) | (reg << 16) | (off & 65535);
const addiu = (dst: number, base: number, off: number): number => (9 << 26) | (base << 21) | (dst << 16) | (off & 65535);
const move = (dst: number, src: number): number => (src << 21) | (dst << 11) | 0x21;
const jal = (addr: number): number => (3 << 26) | ((addr >>> 2) & 0x3ffffff);
const fixture = (body: string) => extractMacroTemplates([{ path: "fixture.h", source: body }]);
const read = (path: string): string => readFileSync(join(ROOT, path), "utf8");
const headers = ["include/psyq/inline_c.h", "include/psyq/inline_o.h", "include/psyq/gtemac.h", "include/debughook.h"].map(path => ({ path, source: read(path) }));
const sdk = extractMacroTemplates(headers);
const productionExe = deriveRepoMacroEncodings(sdk, "exe");
const productionOverlay = deriveRepoMacroEncodings(sdk, "overlay");

// Mechanical extraction goldens: text is retained, operands/register spaces
// and asm block boundaries are part of the template, not copied opcode tables.
test("golden ReadRotMatrix, ldv3, CAPTURE_RA and vintage boundaries", () => {
  const matrix = sdk.templates.find(t => t.macro === "gte_ReadRotMatrix" && t.vintage === "inline_c.h")!;
  assert.equal(matrix.blocks.length, 1);
  assert.equal(matrix.blocks[0]!.instructions.length, 16);
  assert.equal(matrix.blocks[0]!.literal, "cfc2\t$12, $0;" + "cfc2\t$13, $1;" + "sw\t$12, 0( %0 );" + "sw\t$13, 4( %0 );" + "cfc2\t$12, $2;" + "cfc2\t$13, $3;" + "cfc2\t$14, $4;" + "sw\t$12, 8( %0 );" + "sw\t$13, 12( %0 );" + "sw\t$14, 16( %0 );" + "cfc2\t$12, $5;" + "cfc2\t$13, $6;" + "cfc2\t$14, $7;" + "sw\t$12, 20( %0 );" + "sw\t$13, 24( %0 );" + "sw\t$14, 28( %0 )");
  const ldv = sdk.templates.find(t => t.macro === "gte_ldv3" && t.vintage === "inline_c.h")!;
  assert.deepEqual(ldv.blocks[0]!.instructions.map(p => p.args), [
    [{ kind: "cop", value: 0 }, { kind: "imm", value: 0 }, { kind: "gpr", value: "r0" }],
    [{ kind: "cop", value: 1 }, { kind: "imm", value: 4 }, { kind: "gpr", value: "r0" }],
    [{ kind: "cop", value: 2 }, { kind: "imm", value: 0 }, { kind: "gpr", value: "r1" }],
    [{ kind: "cop", value: 3 }, { kind: "imm", value: 4 }, { kind: "gpr", value: "r1" }],
    [{ kind: "cop", value: 4 }, { kind: "imm", value: 0 }, { kind: "gpr", value: "r2" }],
    [{ kind: "cop", value: 5 }, { kind: "imm", value: 4 }, { kind: "gpr", value: "r2" }],
  ]);
  assert.equal(sdk.templates.find(t => t.macro === "gte_ldv3" && t.vintage === "inline_o.h")!.blocks.length, 9);
  const capture = sdk.templates.find(t => t.macro === "CAPTURE_RA")!;
  assert.equal(capture.blocks.length, 2);
  assert.deepEqual(capture.blocks.map(b => b.literal), ["addu $8,%0,$0", "sw $31,0($8)"]);
  assert.equal(capture.blocks[0]!.instructions[0]!.args[1]!.value, "dst");
});

test("AST extraction ignores fake defines in comments and C strings", () => {
  const library = fixture('/* #define BAD(x) __asm__("sw $31,0(%0)") */\nconst char *s = "__asm__";\n#define GOOD(x) __asm__ volatile("addu $8,%0,$0;sw $31,0($8)" : : "r"(x) : "$8")\n');
  assert.deepEqual(library.templates.map(t => t.macro), ["GOOD"]);
});

test("composites expand in separate header environments and remap parameter names", () => {
  const library = extractMacroTemplates([
    { path: "c.h", source: '#define load(x) __asm__ volatile("lwc2 $0,0(%0)" : : "r"(x))\n' },
    { path: "o.h", source: '#define load(y) { __asm__ volatile("move $12,%0" : : "r"(y):"$12"); __asm__ volatile("lwc2 $0,0($12)"); }\n' },
    { path: "composite.h", source: '#define pair(a,b) { load(a); load(b); }\n' },
  ]);
  const pairs = library.templates.filter(t => t.macro === "pair");
  assert.deepEqual(pairs.map(t => t.vintage).sort(), ["c.h", "o.h"]);
  assert.equal(pairs.find(t => t.vintage === "c.h")!.blocks[1]!.instructions[0]!.args[2]!.value, "b");
  assert.equal(pairs.find(t => t.vintage === "o.h")!.blocks.length, 4);
});

test("no partial templates for computation, unknown callee or parametric word", () => {
  const library = fixture('#define X(x) { __asm__ volatile("cfc2 $12,$0"); mystery(x); }\n#define Y(x) __asm__ volatile(".word %0" : : "g"(x))\n#define Z(x) { __asm__ volatile("cfc2 $12,$0"); x=1; }\n');
  assert.equal(library.templates.length, 0);
  assert.equal(library.diagnostics.length, 3);
});

test("multiple independent operand lists reset %0 in inline_o statements", () => {
  const lib = fixture('#define TWO(a,b) { __asm__ volatile("mtc2 %0,$0"::"r"(a)); __asm__ volatile("mtc2 %0,$1"::"r"(b)); }\n');
  assert.equal(lib.templates[0]!.blocks[0]!.instructions[0]!.args[0]!.value, "a");
  assert.equal(lib.templates[0]!.blocks[1]!.instructions[0]!.args[0]!.value, "b");
});

const strict = fixture('#define READ(dst) __asm__ volatile("cfc2 $12,$0;sw $12,0(%0)"::"r"(dst):"$12")\n');
const split = fixture('#define READ(dst) { __asm__ volatile("cfc2 $12,$0"); __asm__ volatile("sw $12,0(%0)"::"r"(dst):"$12"); }\n');

test("strict asm order rejects compiler gaps but explicitly absorbs inserted nops", () => {
  assert.equal(tileMacroFunction(fn(bytes(cfc(12, 0), addiu(2, 0, 7), sw(12, 4))), strict).verdict, "no-template-match");
  const report = tileMacroFunction(fn(bytes(cfc(12, 0), 0, sw(12, 4))), strict);
  assert.equal(report.verdict, "fully-tiled");
  assert.equal(report.tiling[0]!.nopsAbsorbed, 1);
  assert.equal(report.absorbedNops, 1);
  assert.equal(report.coverage.explained, 1);
});

test("separate asm blocks allow independent compiler feeds, not hard-register hazards", () => {
  const report = tileMacroFunction(fn(bytes(cfc(12, 0), addiu(2, 0, 7), sw(12, 4))), split);
  assert.equal(report.verdict, "fully-tiled");
  assert.equal(report.tiling[0]!.gaps.length, 1);
  assert.equal(tileMacroFunction(fn(bytes(cfc(12, 0), addiu(12, 0, 7), sw(12, 4))), split).verdict, "no-template-match");
  assert.equal(tileMacroFunction(fn(bytes(cfc(12, 0), sw(2, 5), sw(12, 4))), split).verdict, "no-template-match");
});

test("wildcards remain consistent and cannot bind to an asm clobber", () => {
  const lib = fixture('#define PAIR(p) __asm__ volatile("lwc2 $0,0(%0);lwc2 $1,4(%0)"::"r"(p))\n');
  const lwc = (cp: number, base: number, off: number) => (0x32 << 26) | (base << 21) | (cp << 16) | off;
  assert.equal(tileMacroFunction(fn(bytes(lwc(0, 4, 0), lwc(1, 5, 4))), lib).tiling.length, 0);
  assert.equal(tileMacroFunction(fn(bytes(cfc(12, 0), sw(12, 12))), strict).tiling.length, 0);
});

test("match cannot cross an incoming branch, unknown word, or control delay slot", () => {
  assert.equal(tileMacroFunction(fn(bytes((4 << 26) | 2, 0, cfc(12, 0), sw(12, 4))), strict).tiling.length, 0);
  assert.equal(tileMacroFunction(fn(bytes(cfc(12, 0), 0xffffffff, sw(12, 4))), split).tiling.length, 0);
  assert.equal(tileMacroFunction(fn(bytes(jal(0x80020000), cfc(12, 0), sw(12, 4))), strict).tiling.length, 0);
});

test("unrecognized cop2 is undetermined, no-cop2 control has no nop-only tiles", () => {
  const no = tileMacroFunction(fn(bytes(addiu(2, 0, 1), 0, 0x03e00008, 0)), sdk);
  assert.equal(no.verdict, "no-cop2"); assert.deepEqual(no.tiling, []);
  const unknown = tileMacroFunction(fn(bytes(0x4affffff)), sdk);
  assert.equal(unknown.verdict, "no-template-match"); assert.equal(unknown.classification, "undetermined");
  const established = tileMacroFunction({ ...fn(bytes(0x4affffff)), handwrittenEvidence: ["independently adjudicated fixture"] }, sdk);
  assert.equal(established.classification, "handwritten-asm");
});

test("fixed final command words do not match different GTE operations or DMPSX markers", () => {
  const lib = fixture('#define RTPS() __asm__ volatile("nop;nop;.word 0x4A180001")\n');
  assert.equal(tileMacroFunction(fn(bytes(0, 0, 0x4a180001)), lib).verdict, "fully-tiled");
  assert.equal(tileMacroFunction(fn(bytes(0, 0, 0x4a280030)), lib).tiling.length, 0);
  assert.ok(sdk.diagnostics.some(d => d.reason.includes("DMPSX sentinel")));
  assert.equal(tileMacroFunction(fn(bytes(0, 0, 0x4a180001)), sdk).tiling.length, 0);
});

test("production oracle uses the repo include graph and both configured flag columns", () => {
  for (const oracle of [productionExe, productionOverlay]) {
    const kind = oracle.report.containerKind;
    assert.deepEqual(oracle.report.cc1Flags, configuredCc1FlagsForContainer(kind));
    assert.deepEqual(oracle.report.asFlags, configuredAsFlagsForContainer(kind));
    assert.equal(oracle.report.toolchain.compiler.path, configuredCompilerPath().slice(ROOT.length + 1));
    assert.deepEqual(oracle.report.includes.map(i => i.path), ["include/macro.inc", "include/gte_macros.inc"]);
    assert.ok(oracle.report.maspsxFlags.includes("--run-assembler"));
    const raw = readEncodingProbeSection(readFileSync(join(ROOT, oracle.report.probeObject)));
    for (const command of oracle.report.commands) assert.equal(raw.readUInt32LE(command.offset), command.word);
    assert.equal(oracle.report.commands.find(c => c.statement === "rtps")!.word, 0x4a180001);
    assert.equal(oracle.report.commands.find(c => c.statement === "op0")!.word, 0x4b70000c);
    const original = sdk.templates.find(t => t.macro === "gte_rtps" && t.vintage === "inline_c.h")!;
    const translated = oracle.library.templates.find(t => t.id === original.id)!;
    assert.equal(translated.blocks[0]!.literal, original.blocks[0]!.literal);
    const report = tileMacroFunction(fn(bytes(0, 0, 0x4a180001)), oracle.library);
    assert.equal(report.verdict, "fully-tiled");
    assert.equal(report.tiling[0]!.encodingEvidence[0]!.header, "include/gte_macros.inc");
    assert.equal(report.tiling[0]!.encodingEvidence[0]!.containerKind, kind);
    assert.equal(report.tiling[0]!.encodingEvidence[0]!.probeObjectSha256, oracle.report.probeObjectSha256);
    assert.ok(oracle.library.diagnostics.some(d => d.reason.includes("GAS macro 'rt'")), "missing aliases stay unresolved rather than guessed");
  }
  assert.ok(productionExe.report.asFlags.includes("-G8"));
  assert.ok(productionOverlay.report.asFlags.includes("-G0"));
  assert.throws(() => deriveRepoMacroEncodings(productionExe.library, "overlay"), /raw header templates/);
});

test("default census resolves commands locally; raw mode and removed inputs are explicit", () => {
  const report = detectMacroIdentities({ functions: [fn(bytes(0, 0, 0x4a180001))], library: sdk });
  assert.equal(report.schemaVersion, 3);
  assert.equal(report.commandEncodingMode, "production-toolchain");
  assert.equal(report.functions[0]!.verdict, "fully-tiled");
  assert.equal(report.encodingToolchains.length, 1);
  assert.equal(report.functions[0]!.tiling[0]!.encodingEvidence[0]!.header, "include/gte_macros.inc");
  const raw = detectMacroIdentities({ functions: [fn(bytes(0, 0, 0x4a180001))], library: sdk, resolveCommands: false });
  assert.equal(raw.commandEncodingMode, "raw-header-only");
  assert.equal(raw.functions[0]!.verdict, "no-template-match");
  assert.deepEqual(raw.encodingToolchains, []);
  assert.throws(() => detectMacroIdentities({ commandEncodingHeaders: [] } as never), /were removed/);
});

test("GAS extraction ignores commented-out definitions and example words", () => {
  const defs = parseGasMacroDefinitions('/* .macro wrong\n.endm */\n# .macro ignored\n# .endm\n.macro good\n # .word 0xdeadbeef\n cop2 0x180001\n.endm\n', "fixture.inc");
  assert.deepEqual(defs.map(d => d.macro), ["good"]);
  assert.equal(defs[0]!.line, 5);
  assert.throws(() => parseGasMacroDefinitions(".macro broken\n", "bad.inc"), /Unterminated/);
});

test("generated vintage substitutions compile through production without a foreign header", () => {
  for (const oracle of [productionExe, productionOverlay]) {
    for (const header of oracle.report.reconstructionHeaders.filter(h => h.vintage === "inline_c.h" || h.vintage === "inline_o.h")) {
      const dir = mkdtempSync(join(ROOT, "build/macroIdentity/repo-encodings", "header-test-"));
      const source = join(dir, "test.c");
      writeFileSync(source, `#include "common.h"\n#include "${header.vintage}"\n#include "${join(ROOT, header.path)}"\nvoid test_commands(void) { gte_rtps(); gte_op0${header.vintage === "inline_c.h" ? "_b" : ""}(); }\n`);
      const artifact = compileSource(source, dir, "test", { assemble: true, useOverrides: false, containerKind: oracle.report.containerKind });
      const insns = decodeMacroBytes(readEncodingProbeSection(readFileSync(artifact.object!), ".text"), 0);
      assert.deepEqual(insns.filter(isCop2).map(i => i.word), [0x4a180001, 0x4b70000c]);
      assert.ok(!insns.some(i => i.word === 0x7f || i.word === 0x127f));
    }
  }
});

test("resolves stack and exact symbol operands, never carries load/call facts", () => {
  const stack = tileMacroFunction(fn(bytes(addiu(2, 29, 24), move(8, 2), sw(31, 8))), sdk);
  assert.equal(stack.tiling[0]!.candidateC, "CAPTURE_RA(&stack_0x18);");
  const global = tileMacroFunction(fn(bytes(0x3c028006, addiu(2, 2, -0x37b4), move(8, 2), sw(31, 8))), sdk, {}, new Map([[0x8005c84c, "caller_log"]]));
  assert.equal(global.tiling[0]!.candidateC, "CAPTURE_RA(&caller_log);");
  const called = tileMacroFunction(fn(bytes(addiu(2, 29, 24), jal(0x80020000), 0, move(8, 2), sw(31, 8))), sdk);
  assert.equal(called.tiling[0]!.operands[0]!.resolution, "unresolved");
});

test("overlap alternatives do not double count coverage or manufacture mixed vintage", () => {
  const lib = extractMacroTemplates([{ path: "c.h", source: '#define A(p) __asm__ volatile("cfc2 $12,$0;sw $12,0(%0)"::"r"(p))\n' }, { path: "o.h", source: '#define B(p) __asm__ volatile("cfc2 $12,$0;sw $12,0(%0)"::"r"(p))\n' }]);
  const report = detectMacroIdentities({ functions: [fn(bytes(cfc(12, 0), sw(12, 4)))], library: lib, resolveCommands: false, groups: [{ heading: "group", members: ["test"] }] });
  assert.equal(report.functions[0]!.coverage.explained, 1);
  assert.equal(report.functions[0]!.tiling.length, 1);
  assert.equal(report.functions[0]!.tiling[0]!.alternatives.length, 1);
  assert.equal(report.translationUnits[0]!.finding, "undetermined");
  assert.equal(report.functions[0]!.headerVintages.finding, "undetermined");
  assert.deepEqual(report.functions[0]!.headerVintages.compatible, ["c.h", "o.h"]);
  assert.equal(report.functions[0]!.candidateC.oracleStatus, "unverified");
  assert.equal(report.functions[0]!.candidateC.scope, "macro-islands-only");
});

const vintageLibrary = extractMacroTemplates([
  { path: "c.h", source: '#define READ(p) __asm__ volatile("cfc2 $12,$0;sw $12,0(%0)"::"r"(p))\n' },
  { path: "o.h", source: '#define READ(p) { __asm__ volatile("move $12,%0"::"r"(p)); __asm__ volatile("cfc2 $13,$0;sw $13,0($12)"); }\n' },
  { path: "project.h", source: '#define CAPTURE(p) __asm__ volatile("addu $8,%0,$0;sw $31,0($8)"::"r"(p))\n' },
]);
const cRead = bytes(cfc(12, 0), sw(12, 4));
const oRead = bytes(move(12, 4), cfc(13, 0), sw(13, 12));
const projectCapture = bytes(move(8, 4), sw(31, 8));

test("coexisting project headers are not alternative SDK vintages in a function or TU", () => {
  assert.deepEqual(vintageLibrary.templates.filter(t => t.macro === "READ").map(t => t.vintageFamily), ["c.h|o.h", "c.h|o.h"]);
  assert.equal(vintageLibrary.templates.find(t => t.macro === "CAPTURE")!.vintageFamily, "project.h");
  const report = detectMacroIdentities({
    functions: [fn(Buffer.concat([cRead, projectCapture]), "combined"), fn(cRead, "sdk"), fn(projectCapture, "project")],
    library: vintageLibrary, resolveCommands: false,
    groups: [{ heading: "coexisting", members: ["sdk", "project"] }],
  });
  const combined = report.functions[0]!;
  assert.equal(combined.tiling.length, 2);
  assert.deepEqual(combined.headerVintages.witnessed, ["c.h", "project.h"]);
  assert.equal(combined.headerVintages.finding, "single-vintage");
  assert.deepEqual(combined.headerVintages.families, [
    { family: "c.h|o.h", witnessed: ["c.h"], compatible: ["c.h"] },
    { family: "project.h", witnessed: ["project.h"], compatible: ["project.h"] },
  ]);
  assert.equal(report.translationUnits[0]!.finding, "single-vintage");
  assert.deepEqual(report.translationUnits[0]!.families, combined.headerVintages.families);
});

test("distinct witnesses from the same alternative-header family report true mixing", () => {
  const report = detectMacroIdentities({
    functions: [fn(Buffer.concat([cRead, oRead, projectCapture]), "mixed"), fn(cRead, "c"), fn(oRead, "o")],
    library: vintageLibrary, resolveCommands: false,
    groups: [{ heading: "mixed TU", members: ["c", "o"] }],
  });
  assert.equal(report.functions[0]!.tiling.length, 3);
  assert.equal(report.functions[0]!.headerVintages.finding, "mixed-vintages");
  assert.deepEqual(report.functions[0]!.headerVintages.families[0]!.witnessed, ["c.h", "o.h"]);
  assert.equal(report.translationUnits[0]!.finding, "mixed-vintages");
  assert.deepEqual(report.translationUnits[0]!.families[0]!.witnessed, ["c.h", "o.h"]);
});

test("tiler and miner limits are explicit and validate options", () => {
  const lib = fixture('#define X() { __asm__ volatile("cfc2 $12,$0"); __asm__ volatile("cfc2 $13,$1"); }\n');
  const limited = tileMacroFunction(fn(bytes(cfc(12, 0), cfc(13, 1))), lib, { maxSearchStates: 1 });
  assert.ok(limited.limitations.some(s => s.includes("bound reached")));
  assert.throws(() => tileMacroFunction(fn(bytes(0)), lib, { maxGap: -1 }), /Invalid/);
  assert.throws(() => mineMacroCandidates([], [], { minSupport: 1 }), /Invalid/);
});

test("Tier A rediscovers a two-site hard core with different compiler feeds", () => {
  const sites = [fn(bytes(addiu(2, 29, 24), move(8, 2), sw(31, 8)), "local"), fn(bytes(0x3c028006, addiu(2, 2, 24), move(8, 2), sw(31, 8)), "global")];
  const mined = mineMacroCandidates(sites, [], { tier: "tier-a" });
  const capture = mined.candidates.find(c => c.verdict === "macro-candidate" && c.template.some(t => t.startsWith("sw ")))!;
  assert.ok(capture); assert.equal(capture.signals.variantFeed, true); assert.ok(capture.signals.rigidRegisters.includes(8));
  const known = sites.map(f => tileMacroFunction(f, sdk));
  assert.equal(mineMacroCandidates(sites, known, { tier: "tier-a" }).candidates.length, 0);
});

test("Tier A withheld GTE core repeats at three sites, clean-C negative control stays negative", () => {
  const sites = ["a", "b", "c"].map(name => fn(bytes(cfc(12, 0), cfc(13, 1), sw(12, 29), sw(13, 29, 4)), name));
  assert.ok(mineMacroCandidates(sites, [], { tier: "tier-a" }).candidates.some(c => c.verdict === "macro-candidate" && c.signals.cop2));
  const clean = ["a", "b", "c"].map(name => fn(bytes(addiu(2, 0, -1), sw(2, 4), sw(0, 4, 4), 0x03e00008, 0), name));
  assert.ok(mineMacroCandidates(clean, [], { tier: "tier-a" }).candidates.every(c => c.verdict !== "macro-candidate"));
  assert.equal(mineMacroCandidates(sites, [], { maxPatterns: 1 }).completeWithinBounds, false);
});

test("Tier B call/terminate/call spine respects delay slots and shared constants", () => {
  const format = 0x8001a970, draw = 0x80017b3c;
  const sites = [0, 1, 2].map(index => fn(bytes(jal(format), 0, 0x3413ffff, addiu(7, 0, 0x6e), addiu(6, 0, index * 8), jal(draw), (0x29 << 26) | (2 << 21) | (19 << 16)), `number${index}`));
  const mined = mineMacroCandidates(sites, [], { tier: "tier-b" });
  const trio = mined.candidates.find(c => c.representation === "effect-window" && c.template.length === 3)!;
  assert.ok(trio); assert.equal(trio.template[1], "store.sh constant:65535");
  assert.ok(trio.template[2]!.includes("arg3:110")); assert.ok(!trio.template[2]!.includes("arg2:"));
  assert.equal(trio.verdict, "undetermined"); assert.equal(trio.claim, "shared-source-shape"); assert.equal(trio.occurrences.length, 3);
  const report = detectMacroIdentities({ functions: sites, library: sdk, resolveCommands: false, mine: { tier: "tier-b" } });
  assert.deepEqual(report.detectedFunctions, ["fixture:number0", "fixture:number1", "fixture:number2"]);
  assert.equal(report.censusComplete, true);
});

// Original-byte acceptance is conditional on local extracted inputs. Synthetic
// tests above always run; missing binaries are visible skips, not fake passes.
const containers = existsSync(join(ROOT, "extracted/iso/slus_011.15")) ? loadContainers() : [];
const live = containers.length ? loadMacroFunctions(containers) : { functions: [], findings: [] };
const byName = new Map(live.functions.map(f => [f.name, f]));
test("original D6B8 entry, DFD4 inventory, both CAPTURE_RA sites, and clean control", { skip: !byName.has("func_8001D6B8") || !existsSync(join(ROOT, "build/functions.csv")) || !existsSync(join(ROOT, "build/functions/func_8001DFD4.s")) }, () => {
  const d6 = tileMacroFunction(byName.get("func_8001D6B8")!, sdk);
  assert.equal(d6.tiling[0]!.macro, "gte_ReadRotMatrix"); assert.equal(d6.tiling[0]!.start, d6.start + 4);
  assert.equal(d6.tiling[0]!.vintage, "inline_c.h"); assert.equal(d6.tiling[0]!.operands[0]!.value, 29);
  assert.equal(d6.tiling[0]!.candidateC, "gte_ReadRotMatrix(&stack_0x0);");
  const dfd4 = tileMacroFunction(byName.get("func_8001DFD4")!, sdk);
  const lines = read("build/functions/func_8001DFD4.s").split("\n").filter(l => /\/\* [0-9A-F]+ [0-9A-F]+ [0-9A-F]+ \*\//.test(l) && /\b(?:cfc2|ctc2|mfc2|mtc2|lwc2|swc2|cop2|rtps)\b/.test(l));
  assert.equal(dfd4.cop2.count, lines.length);
  assert.deepEqual(dfd4.cop2.mnemonics, { lwc2: 2, rtps: 1, cfc2: 1, swc2: 1, mfc2: 1 });
  for (const name of ["func_80016054", "func_80015704"]) assert.ok(tileMacroFunction(byName.get(name)!, sdk).tiling.some(t => t.macro === "CAPTURE_RA"));
  const clean = tileMacroFunction(byName.get("func_80011EE8")!, sdk);
  assert.equal(clean.verdict, "no-cop2"); assert.deepEqual(clean.tiling, []);
  const raw = decodeMacroBytes(byName.get("func_8001DFD4")!.bytes, dfd4.start);
  assert.equal(raw.filter(isCop2).length, dfd4.cop2.count);
  assert.equal(live.findings.length, 0);
  assert.ok(byName.has("func_80037494"), "SDK object-interior functions are in the census");
});

test("original CAPTURE_RA rediscovery with all known templates withheld", { skip: !byName.has("func_80015704") }, () => {
  const mined = mineMacroCandidates([byName.get("func_80016054")!, byName.get("func_80015704")!], [], { tier: "tier-a" });
  assert.ok(mined.candidates.some(c => c.verdict === "macro-candidate" && c.occurrences.some(o => o.function === "func_80016054") && c.occurrences.some(o => o.function === "func_80015704")));
});

test("original overlay number trio and byte-identical twins", { skip: !byName.has("ovl_11_func_800F8B4C") }, () => {
  const overlay = live.functions.filter(f => f.container === "ovl_11");
  const mined = mineMacroCandidates(overlay, [], { tier: "tier-b", maxPatterns: 10000, maxCandidates: 500 });
  assert.ok(mined.identicalFunctions.some(p => p.occurrences.some(o => o.function === "ovl_11_func_800E1770") && p.occurrences.some(o => o.function === "ovl_11_func_8010BC54")));
  const trio = mined.candidates.find(c => c.representation === "effect-window" && c.occurrences.some(o => o.function === "ovl_11_func_800F8B4C") && c.template.length === 3 && c.template[0]!.startsWith(`call address:${0x8001a970}`) && c.template[1] === "store.sh constant:65535" && c.template[2]!.startsWith(`call address:${0x80017b3c}`));
  assert.ok(trio); assert.equal(trio.claim, "shared-source-shape");
  assert.equal(trio.verdict, "undetermined"); assert.ok(trio.occurrences.length >= 3);
});

test("splat code bounds exclude COP2-looking overlay data and report truncation", () => {
  mkdirSync(join(ROOT, "build"), { recursive: true });
  const dir = mkdtempSync(join(ROOT, "build/macro-census-test-"));
  try {
    const base = dir.slice(ROOT.length + 1);
    writeFileSync(join(dir, "overlay.bin"), bytes(addiu(2, 0, 1), 0x03e00008, 0, 0x4a180001));
    writeFileSync(join(dir, "overlay.yaml"), 'segments:\n  - type: code\n    start: 0x0\n    vram: 0x80010000\n    subsegments:\n      - [0x0, asm, clean]\n      - [0xC, data]\n  - [0x10]\n');
    const container = { id: "fixture", kind: "overlay", targetPath: `${base}/overlay.bin`, payloadOffset: 0, payloadSize: 16, loadAddr: 0x80010000, paths: { splat: `${base}/overlay.yaml` } } as Container;
    const loaded = loadMacroFunctions([container]);
    assert.equal(loaded.functions.length, 1); assert.equal(loaded.functions[0]!.bytes.length, 12);
    assert.equal(tileMacroFunction(loaded.functions[0]!, sdk).cop2.count, 0);
    writeFileSync(join(dir, "overlay.bin"), bytes(0));
    assert.equal(loadMacroFunctions([container]).findings[0]!.reason, "Invalid or truncated configured function extent");
    const incomplete = detectMacroIdentities({ containers: [container], library: sdk, resolveCommands: false });
    assert.equal(incomplete.censusComplete, false);
    assert.match(formatMacroIdentityReport(incomplete), /CENSUS INCOMPLETE/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("CLI is import-safe, --help needs no binary scan, and unknown arguments fail", () => {
  const help = spawnSync(process.execPath, ["--import", "tsx", "tools/diagnostics/macroIdentity.ts", "--help"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(help.status, 0); assert.match(help.stdout, /--raw-headers/); assert.ok(!help.stdout.includes("--encoding-header")); assert.ok(!help.stdout.includes("Macro identity census:"));
  const bad = spawnSync(process.execPath, ["--import", "tsx", "tools/diagnostics/macroIdentity.ts", "--typo"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(bad.status, 1); assert.match(bad.stderr, /Unknown argument/);
  const removed = spawnSync(process.execPath, ["--import", "tsx", "tools/diagnostics/macroIdentity.ts", "--encoding-header", "unused.h"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(removed.status, 1); assert.match(removed.stderr, /Unknown argument/);
  const report = detectMacroIdentities({ functions: [fn(bytes(0x03e00008, 0), "clean")], library: sdk, resolveCommands: false });
  assert.ok(!formatMacroIdentityReport(report).includes("fixture:clean")); assert.ok(formatMacroIdentityReport(report, true).includes("fixture:clean"));
});
