import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseCSV, type CsvEntry } from "../build/analyzeLayout.js";
import { ROOT } from "./psxExeInfo.js";
import { overlayDirectCalls, overlayFunctionSymbols, overlayFunctionsFromContext, overlaySectionSplits } from "./overlayFunctionBoundaries.js";
import type { OverlayLayout } from "./overlayLayout.js";

const entry = (address: number, length: number, name = `func_${address.toString(16)}`): CsvEntry =>
  ({ address, vrom: address, length, name, spimdisasmType: "code" });
const context = (rows: Array<[number, string, string, string]>) =>
  "category,address,getName,getType,parentFunction\n" + rows.map(([address, name, type, parent]) =>
    `symbol,0x${address.toString(16)},${name},${type},${parent}`).join("\n") + "\n";

const fragments = [entry(0x100, 0x50), entry(0x150, 8), entry(0x158, 8), entry(0x160, 0x5c), entry(0x1bc, 8)];
const rows: Array<[number, string, string, string]> = [
  [0x100, "head", "@function", "None"],
  [0x150, "case1", "@jumptablelabel", "head"],
  [0x158, "case7", "@jumptablelabel", "head"],
  [0x160, "case8", "@jumptablelabel", "head"],
  [0x1bc, "next", "@function", "None"],
];

test("jumptable fragments recover their owner's extent, independent of symbol spelling", () => {
  const functions = overlayFunctionsFromContext(fragments, context(rows), "ovl_test_", 0x100, 0x1c4);
  assert.deepEqual(functions, [
    { address: 0x100, name: "ovl_test_func_100", size: 0xbc },
    { address: 0x1bc, name: "ovl_test_func_1BC" },
  ]);
  assert.match(overlayFunctionSymbols(functions), /ovl_test_func_100 = 0x100; \/\/ size:0xbc type:func/);
});

test("a separately recognised function is retained, even with a local-looking name", () => {
  const functions = overlayFunctionsFromContext(
    [entry(0x100, 8), entry(0x108, 8)],
    context([[0x100, "head", "@function", "None"], [0x108, ".L108", "@function", "None"]]),
    "ovl_test_", 0x100, 0x110,
  );
  assert.equal(functions.length, 2);
  assert.ok(functions.every((f) => f.size === undefined));
});

test("a direct-call target cannot be absorbed even if the disassembler calls it a label", () => {
  assert.throws(() => overlayFunctionsFromContext(fragments, context(rows), "", 0x100, 0x1c4, new Set([0x150])), /independent call target/);
  const bytes = Buffer.alloc(0x30);
  const jal = (0x0c000000 | ((0x800b0100 >>> 2) & 0x03ffffff)) >>> 0;
  for (const offset of [0, 0x10, 0x20]) bytes.writeUInt32LE(jal + offset, offset);
  const layout: OverlayLayout = { rodataStart: 0, textStart: 0x10, dataStart: 0x20, fileEnd: 0x30, evidence: [], residuals: [] };
  assert.deepEqual([...overlayDirectCalls(bytes, 0x800b0000, layout)], [0x800b0140]);
});

test("nested local parentage is resolved, but orphaned or interleaved labels are refused", () => {
  const nested = rows.map((row) => [...row] as typeof row);
  nested[3] = [0x160, "branch", "@branchlabel", "case7"];
  assert.equal(overlayFunctionsFromContext(fragments, context(nested), "", 0x100, 0x1c4)[0]!.size, 0xbc);
  for (const parent of ["missing", "case8", "next"]) {
    const bad = rows.map((row) => [...row] as typeof row);
    bad[3]![3] = parent;
    assert.throws(() => overlayFunctionsFromContext(fragments, context(bad), "", 0x100, 0x1c4), /no contiguous owning function/);
  }
});

test("unknown metadata, overlap and gaps do not silently discard fragments", () => {
  assert.throws(() => overlayFunctionsFromContext(fragments, "address,name\n", "", 0x100, 0x1c4), /missing category/);
  assert.throws(() => overlayFunctionsFromContext(fragments, context(rows.slice(1)), "", 0x100, 0x1c4), /no symbol type/);
  assert.throws(() => overlayFunctionsFromContext([entry(0x100, 0x54), ...fragments.slice(1)], context(rows), "", 0x100, 0x1c4), /overlapping/);
  assert.throws(() => overlayFunctionsFromContext([entry(0x100, 0x4c), ...fragments.slice(1)], context(rows), "", 0x100, 0x1c4), /no contiguous/);
});

test("section CSV separates read-only data from code and excludes trailing data", () => {
  const layout: OverlayLayout = { rodataStart: 0, textStart: 0x40, dataStart: 0x100, fileEnd: 0x200, evidence: [], residuals: [] };
  assert.equal(overlaySectionSplits(0x800b0000, layout),
    "offset,vram,.rodata\n0,800b0000,overlay\noffset,vram,.text\n40,800b0040,overlay\n100,800b0100,.end\n");
  assert.doesNotMatch(overlaySectionSplits(0x800b0000, { ...layout, textStart: 0 }), /\.rodata/);
});

test("original ovl_11 switch recovers cold and stays whole on the seeded second pass", (t) => {
  const input = join(ROOT, "extracted/overlays/ovl_11.bin");
  if (!existsSync(input)) { t.skip("original overlay is not provisioned"); return; }
  const root = mkdtempSync(join(tmpdir(), "overlay-boundary-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  /* Original section geometry, not the live (possibly already repaired)
     function config. No matched C, objects, curated symbols or sizes seed
     the first pass. This reproduces the bootstrap defect from bytes alone. */
  const base = 0x800b7e20;
  const layout: OverlayLayout = { rodataStart: 0, textStart: 0x3e14, dataStart: 0x69960,
    fileEnd: 0x76000, evidence: [], residuals: [] };
  const splits = join(root, "sections.csv"), csv = join(root, "functions.csv"), ctx = join(root, "context.csv");
  writeFileSync(splits, overlaySectionSplits(base, layout));
  const run = (symbols?: string) => execFileSync("spimdisasm", ["singleFileDisasm", input, join(root, "disasm"),
    "--file-splits", splits, "--vram", `0x${base.toString(16)}`, "--arch-level", "MIPS1", "--instr-category", "r3000gte",
    "--compiler", "PSYQ", "--endian", "little", "--disasm-unknown", "--function-info", csv, "--save-context", ctx,
    ...(symbols ? ["--symbol-addrs", symbols] : [])], { encoding: "utf8", stdio: "pipe" });
  run();
  const raw = parseCSV(csv);
  assert.equal(raw.find((e) => e.address === 0x8010876c)?.length, 0x50, "function-info alone still truncates the switch");
  const functions = overlayFunctionsFromContext(raw, readFileSync(ctx, "utf8"), "ovl_11_", base + layout.textStart, base + layout.dataStart,
    overlayDirectCalls(readFileSync(input), base, layout));
  assert.equal(functions.find((f) => f.address === 0x8010876c)?.size, 0xbc);
  for (const address of [0x801087bc, 0x801087c4, 0x801087cc]) {
    assert.ok(!functions.some((f) => f.address === address), `0x${address.toString(16)} remains a local case`);
  }
  assert.equal(raw.length - functions.length, 3, "all other function boundaries are unchanged");
  const symbols = join(root, "symbols.txt");
  writeFileSync(symbols, overlayFunctionSymbols(functions));
  run(symbols);
  const second = parseCSV(csv);
  assert.equal(second.find((e) => e.address === 0x8010876c)?.length, 0xbc);
  assert.equal(second.length, functions.length);
});
