import assert from "node:assert/strict";
import test from "node:test";
import { loadContainers } from "../lib/container.js";
import { loadMacroFunctions } from "./macroIdentity.js";
import { buildChainCensus, scanChainFunction, chainRow } from "./nestedFunctionScan.js";
import { assemble, type AsmLine } from "../agent/matching-reconstruction/fixture-asm.js";
const fn = (name: string, lines: AsmLine[], vram = 0x80010000, container = "exe") => {
  const words = assemble(lines.map(l => l[0] === "lwc2" ? ["lw", ...l.slice(1)] as AsmLine : l), vram);
  const bytes = Buffer.alloc(words.length * 4);
  let n = 0;
  for (const line of lines) if (line[0] !== "label") {
    const raw = words[n]!.raw;
    bytes.writeUInt32LE(line[0] === "lwc2" ? ((raw & 0x03ffffff) | (0x32 << 26)) >>> 0 : raw, n++ * 4);
  }
  return { name, container, vram, bytes };
};
const dead = fn("child", [["addiu", "sp", "sp", -8], ["sw", "v0", 0, "sp"], ["jr", "ra"], ["addiu", "sp", "sp", 8]], 0x80020000);

test("callee recipe needs exact non-read proof; save-forward needs the surviving saved-entry web", () => {
  assert.equal(scanChainFunction(dead).callee!.form, "dead-spill");
  assert.equal(scanChainFunction(fn("reload", [["sw", "v0", 0, "sp"], ["lw", "v1", 0, "sp"], ["jr", "ra"], ["nop"]])).callee!.form, "undetermined");
  assert.equal(scanChainFunction(fn("escape", [["sw", "v0", 0, "sp"], ["addu", "a0", "sp", "zero"], ["jr", "ra"], ["nop"]])).callee!.form, "undetermined");
  const saved: AsmLine[] = [["addu", "s0", "v0", "zero"], ["jal", 0x80030000], ["nop"], ["addu", "v0", "s0", "zero"], ["jal", dead.vram], ["nop"], ["jr", "ra"], ["nop"]];
  assert.equal(scanChainFunction(fn("saved", saved)).callee!.form, "save-forward");
  saved.splice(3, 0, ["addiu", "s0", "zero", 0]);
  assert.equal(scanChainFunction(fn("killed", saved)).callee!.form, "undetermined");
});

test("caller accepts all three placements, including long branch fallthrough; no fixed-window heuristic", () => {
  const delay = fn("delay", [["jal", dead.vram], ["addiu", "v0", "sp", 16], ["jr", "ra"], ["nop"]]);
  const before = fn("before", [["addiu", "v0", "sp", 16], ["jal", dead.vram], ["nop"], ["jr", "ra"], ["nop"]]);
  const branch = fn("branch", [["bne", "a0", "a1", "exit"], ["addiu", "v0", "sp", 16], ...Array.from({ length: 12 }, (): AsmLine => ["nop"]), ["jal", dead.vram], ["nop"], ["label", "exit"], ["jr", "ra"], ["nop"]]);
  const census = buildChainCensus([dead, delay, before, branch]);
  for (const name of ["delay", "before", "branch"]) assert.equal(chainRow(census, name)!.calls[0]!.verdict, "confirmed-pair");
  assert.deepEqual(census.rows.filter(r => r.function !== "child").map(r => r.calls[0]!.placement), ["call-delay", "before-call", "branch-delay"]);
  assert.equal(scanChainFunction(fn("zero", [["addu", "v0", "sp", "zero"], ["jal", dead.vram], ["nop"]])).calls[0]!.offset, 0);
});

test("ordinary &local staging and jalr $v0 are rejected by consumption, including the call delay slot", () => {
  for (const use of [["addu", "a0", "v0", "zero"], ["sw", "a0", 0, "v0"], ["lwc2", 9, 0, "v0"]] as AsmLine[]) {
    const result = scanChainFunction(fn("scratch", [["addiu", "v0", "sp", 16], ["jal", dead.vram], use]));
    assert.equal(result.calls[0]!.verdict, "rejected"); assert.match(result.calls[0]!.reason, /consumes|redefines/);
  }
  assert.equal(scanChainFunction(fn("indirect", [["addiu", "v0", "sp", 16], ["jalr", "v0"], ["nop"]])).calls[0]!.verdict, "rejected");
  assert.equal(scanChainFunction(fn("indirect-slot", [["jalr", "v0"], ["addiu", "v0", "sp", 16]])).calls[0]!.verdict, "rejected");
});

test("pairing is container-qualified; same-address overlay children cannot license each other", () => {
  const other = { ...dead, container: "ovl_b" };
  const caller = fn("parent", [["jal", dead.vram], ["addiu", "v0", "sp", 16]], 0x80010000, "ovl_a");
  assert.equal(chainRow(buildChainCensus([other, caller]), "parent")!.calls[0]!.verdict, "caller-candidate");
  assert.equal(chainRow(buildChainCensus([dead, caller]), "parent")!.calls[0]!.verdict, "confirmed-pair", "EXE call is separately resolvable");
});

test("original census settles known family, open rulings, and prototype false positives without symbol exceptions", () => {
  const loaded = loadMacroFunctions(loadContainers());
  assert.equal(loaded.findings.length, 0);
  const census = buildChainCensus(loaded.functions);
  const calleeNames = ["func_8001E878", "func_8001E9F8", ...["800CFAD0", "800D0600", "800D1CD0", "800DD45C", "800F5108", "8010780C", "8011D438"].map(a => `ovl_11_func_${a}`), "ovl_19_func_800BB08C", "ovl_30_func_8012F030"];
  for (const name of calleeNames) assert.notEqual(chainRow(census, name)!.callee!.form, "undetermined", name);
  assert.equal(chainRow(census, "func_8001E9F8")!.callee!.form, "save-forward");
  assert.equal(new Set(chainRow(census, "func_8001E9F8")!.callee!.forwards.map(c => c.call)).size, 3, "two degenerate arms share a physical jal");
  assert.equal(new Set(chainRow(census, "func_8001E9F8")!.callee!.forwards.map(c => c.setup)).size, 4);
  assert.equal(chainRow(census, "func_8001EAE4")!.calls.filter(c => c.verdict === "confirmed-pair").length, 8);
  assert.equal(chainRow(census, "ovl_11_func_800D062C")!.calls.filter(c => c.verdict === "confirmed-pair").length, 2);
  assert.equal(chainRow(census, "ovl_11_func_8011D438")!.verdict, "paired");
  assert.equal(chainRow(census, "ovl_30_func_8012F030")!.verdict, "callee-only");
  // This documented macro user captures a post-call return, NOT entry $2.
  assert.equal(chainRow(census, "ovl_19_func_800B8E88"), null);
  for (const name of ["func_8001E26C", "func_8001DCB0", "func_8001DE4C", "func_8001C37C", "func_80016C08", "func_80017F88"])
    assert.ok(chainRow(census, name)!.calls.every(c => c.verdict === "rejected"), name);
  for (const address of [0x800ee6f8, 0x800ee71c]) {
    const site = census.rows.flatMap(r => r.calls).find(c => c.setup === address)!;
    assert.equal(site.verdict, "rejected"); assert.match(site.reason, /call delay slot/);
  }
  assert.equal(chainRow(census, "ovl_11_func_8010EE5C")!.verdict, "undetermined", "live chain dereference has no fixed spill/forward recipe");
});
