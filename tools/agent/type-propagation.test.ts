import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { assemble, type AsmLine } from "./matching-reconstruction/fixture-asm.js";
import { decodeFunction } from "./matching-reconstruction/decode.js";
import { buildMachineIrFrom } from "./machine-ir/index.js";
import { prototypesIn, contradictionsAgainst, type Prototype } from "./calleeTruth.js";
import { localSummary } from "./type-propagation/summary.js";
import { propagate, inferenceInput } from "./type-propagation/solve.js";
import { DEFAULT_BOUNDS, type EvidenceGraph } from "./type-propagation/model.js";
import { buildEvidenceGraph } from "./type-propagation/graph.js";
import { inspectType, slotsWithTypedefs, parameterReads, typeScopes, unspecifiedParameters, layoutFields } from "./type-propagation/c-types.js";
import { prepareM2c } from "../build/prepareM2c.js";
import { ROOT, compileSource } from "./decompToolchain.js";
import { parseRelocations, relocatedField } from "../lib/functionOracle.js";
import { parseC, field } from "./residual-source-search/tree-sitter-c.js";

const addresses = [0x80010000, 0x80010100, 0x80010200, 0x80010300];
const forward = (target: number): AsmLine[] => [["addiu", "sp", "sp", -24], ["sw", "ra", 16, "sp"], ["jal", target], ["nop"], ["lw", "ra", 16, "sp"], ["nop"], ["jr", "ra"], ["addiu", "sp", "sp", 24]];
const seed = (signature: string): Prototype => prototypesIn(signature, "leaf-context.h")[0]!;
function fixture(recursive = false): EvidenceGraph {
  const names = ["target", "callback", "wrapper", "known"];
  const lifted = names.map((name, i) => localSummary(buildMachineIrFrom(name, decodeFunction(assemble(i === 3 ? [["lw", "v0", 0, "a0"], ["jr", "ra"], ["nop"]] : forward(addresses[i + 1]!), addresses[i]!)), { containerId: "fixture" })));
  const graph: EvidenceGraph = { root: "fixture:target", bounds: DEFAULT_BOUNDS, nodes: lifted.map((l) => l.summary), relations: lifted.flatMap((l) => l.relations), frontier: [], unsupported: [], inputs: [], indexComplete: true,
    consumed: { functions: 4, instructions: 27, indexInstructions: 27, storageDependencies: 0 } };
  graph.nodes[3]!.seed = seed("s32 known(s32 *p);");
  for (let i = 0; i < 3; i++) {
    const caller = graph.nodes[i]!, callee = graph.nodes[i + 1]!, call = caller.calls[0]!;
    call.targets = [callee.id]; call.closed = true;
    for (const formal of callee.slots) {
      const actual = call.args[formal.slot]; if (actual === undefined || actual === null) continue;
      graph.relations.push({ id: `${call.id}:arg:${formal.slot}`, from: { function: caller.id, value: actual }, to: { function: callee.id, value: formal.value }, rule: "argument", witness: `original call 0x${call.at.toString(16)} ABI ${formal.slot}` });
    }
    for (const value of callee.returns) for (const result of call.results) graph.relations.push({ id: `${call.id}:result`, from: { function: callee.id, value }, to: { function: caller.id, value: result }, rule: "result", witness: `original call 0x${call.at.toString(16)} $v0` });
  }
  if (recursive) {
    const wrapper = graph.nodes[2]!, callback = graph.nodes[1]!;
    wrapper.calls.push({ ...wrapper.calls[0]!, id: "recursive-edge", targets: [callback.id] });
    graph.relations.push({ id: "recursive-argument", from: { function: wrapper.id, value: wrapper.slots[0]!.value }, to: { function: callback.id, value: callback.slots[0]!.value }, rule: "argument", witness: "frozen recursive argument" });
  }
  return graph;
}

test("AST type inspection preserves qualifiers/callbacks and does not treat comments as a pointer", () => {
  assert.equal(inspectType("const s32 *").word, true);
  assert.equal(inspectType("s32 /* * */").pointer, false);
  assert.deepEqual(slotsWithTypedefs(["int", "Callback", "Record", "int"], "typedef void (*Callback)(int); typedef struct R Record;"), [0, 1, null, null]);
});
test("AST fixed-field layout rejects invented aggregates and preserves literal array spans", () => {
  assert.deepEqual(layoutFields("u8 first; /* int fake; */ s32 words[2];"), { fields: [{ name: "first", offset: 0, size: 1 }, { name: "words", offset: 4, size: 8 }], size: 12 });
  assert.equal(layoutFields("int bits:3;"), null);
  assert.equal(layoutFields("struct { int x; } nested;"), null);
  assert.equal(layoutFields("int unknown[COUNT];"), null);
});
test("control-only arguments remain live even when they never reach an arithmetic operand", () => {
  const report = buildMachineIrFrom("guard", decodeFunction(assemble([["beq", "a3", "zero", "done"], ["nop"], ["jr", "ra"], ["addiu", "v0", "zero", 1], ["label", "done"], ["jr", "ra"], ["addiu", "v0", "zero", 2]], addresses[0]!)));
  assert.equal(localSummary(report).summary.slots.find((s) => s.slot === 3)?.used, true);
});
test("AST seed reads respect shadowing, assignments and strings; unspecified lists remain unspecified", () => {
  assert.deepEqual(parameterReads('void reads(int used, int unread, int shadow) { int copy = used; { int shadow = 3; copy += shadow; } puts("unread"); unread = 0; }', "reads"), [true, false, false]);
  const projected = unspecifiedParameters("typedef int I; void f(I a, I b);", "f");
  const prototype = prototypesIn(projected, "context.c")[0]!;
  assert.equal(prototype.parameters, null);
  assert.deepEqual(contradictionsAgainst(prototype, { kind: "target", where: "original", arity: { min: 2, max: 2 } }, false), []);
  const declarations = "typedef struct { int x; } Public;\ntypedef struct { int y; } Private;";
  assert.deepEqual(typeScopes(["Public *", "Private *"], declarations, (row) => ({ file: row === 0 ? "include/public.h" : "src/private.c", line: row + 1 }), "fallback"), ["include/public.h:Public", "src/private.c:Private"]);
});
test("budgets stop with an incomplete outcome and constants do not equate unrelated formal types", () => {
  const graph = fixture();
  const bounded = propagate({ ...graph, bounds: { ...DEFAULT_BOUNDS, propagationSteps: 1 } });
  assert.equal(bounded.status, "budget-incomplete"); assert.ok(bounded.steps <= 1);
  const known = graph.nodes[3]!, caller = graph.nodes[0]!;
  const literal = caller.report.ir.values.find((v) => v.op.kind === "const")!;
  graph.relations.push({ id: "constant-use", from: { function: caller.id, value: literal.id }, to: { function: known.id, value: known.slots[0]!.value }, rule: "argument", witness: "same word, different use" });
  assert.equal(propagate(graph).status, "fixed-point");
});
test("multi-hop leaf types reach root formal and result with replayable dependencies; order is invariant", () => {
  const graph = fixture(), solved = propagate(graph);
  const root = graph.nodes[0]!;
  const type = solved.facts.find((f) => f.endpoint.function === root.id && f.endpoint.value === root.slots[0]!.value && f.constraint.kind === "type-use");
  assert.ok(type); assert.equal(type.constraint.kind === "type-use" && type.constraint.type, "s32 *");
  let fact = type, hops = 0;
  while (fact.via) { assert.ok(graph.relations.some((r) => r.id === fact.via!.relation)); fact = solved.facts.find((f) => f.id === fact.via!.parent)!; hops++; }
  assert.ok(hops >= 2, "information crosses real intermediate value edges");
  const reordered = propagate({ ...graph, nodes: [...graph.nodes].reverse(), relations: [...graph.relations].reverse() });
  assert.deepEqual(solved.facts.map((f) => [f.id, f.endpoint, f.constraint, f.seed]), reordered.facts.map((f) => [f.id, f.endpoint, f.constraint, f.seed]));
  const input = inferenceInput(graph, solved);
  assert.ok(input.input.functions.target!.slots["0"]!.type); assert.ok(input.input.functions.target!.result?.type);
  delete graph.nodes[3]!.seed;
  assert.ok(!propagate(graph).facts.some((f) => f.constraint.kind === "type-use"));
});
test("public identities agree across source scopes; seeded partial projections retain their own representation", () => {
  const graph = fixture();
  graph.nodes[3]!.seed = { ...seed("s32 known(Shared *p);"), where: "src/leaf.c", typeScopes: { parameters: ["include/shared.h:Shared"], result: "word" } };
  graph.nodes[0]!.seed = { ...seed("s32 target(Shared *p, int unused);"), where: "src/root.c", usedParameters: [true, false], typeScopes: { parameters: ["include/shared.h:Shared", "word"], result: "word" } };
  const solved = propagate(graph);
  assert.equal(solved.conflicts.length, 0);
  graph.nodes[3]!.seed = seed("s32 known(u8 *p);");
  const conflicting = propagate(graph); assert.ok(conflicting.conflicts.length > 0);
  const projection = inferenceInput(graph, conflicting);
  const carrier = projection.carriers.find((c) => c.name === projection.input.functions.target!.slots["0"]!.type)!;
  assert.equal(carrier.type, "Shared *"); assert.equal(carrier.scope, "src/root.c");
  assert.equal(projection.input.functions.target!.slots["1"], undefined);
});
test("reverse caller result-use and recursive SCC converge without infinitely expanding witnesses", () => {
  const graph = fixture(true);
  delete graph.nodes[3]!.seed;
  graph.nodes[0]!.seed = seed("const s32 *target(const s32 *p);");
  const solved = propagate(graph);
  assert.equal(solved.status, "fixed-point");
  assert.ok(solved.components.some((c) => c.includes("fixture:callback") && c.includes("fixture:wrapper")));
  assert.ok(solved.facts.some((f) => f.endpoint.function === "fixture:known" && graph.nodes[3]!.returns.includes(f.endpoint.value) && f.constraint.kind === "type-use"));
  assert.ok(solved.facts.length < 200);
});
test("open indirect targets keep conditional facts; incompatible seeds are retained, not made uniform", () => {
  const graph = fixture();
  graph.nodes[2]!.calls[0]!.closed = false; graph.nodes[2]!.calls[0]!.remainder = ["unsupported dynamic target"];
  for (const r of graph.relations.filter((r) => r.from.function === "fixture:known" || r.to.function === "fixture:known")) r.conditional = "dispatch target known";
  const solved = propagate(graph);
  assert.ok(solved.facts.some((f) => f.conditional));
  assert.equal(inferenceInput(graph, solved).input.functions.target?.result, undefined);
  graph.nodes[0]!.seed = seed("s32 target(u8 *p);"); graph.nodes[2]!.calls[0]!.closed = true;
  for (const r of graph.relations) delete r.conditional;
  const conflict = propagate(graph);
  assert.ok(conflict.conflicts.length > 0);
  assert.ok(conflict.facts.some((f) => f.constraint.kind === "type-use" && f.constraint.type === "u8 *"));
});
test("call slots include the delay-slot stack word; jalr target is read BEFORE its delay slot", () => {
  const report = buildMachineIrFrom("stack", decodeFunction(assemble([["addiu", "sp", "sp", -24], ["jalr", "a0"], ["sw", "a1", 16, "sp"], ["jr", "ra"], ["nop"]], addresses[0]!)));
  const summary = localSummary(report).summary, call = summary.calls[0]!;
  assert.ok(call.args[4] !== null); assert.equal(report.ir.values[call.args[4]!]!.op.kind, "entry");
  const changed = buildMachineIrFrom("target-before-slot", decodeFunction(assemble([["jalr", "a0"], ["addiu", "a0", "zero", 0], ["jr", "ra"], ["nop"]], addresses[0]!)));
  const op = changed.ir.effects.find((e) => e.op.kind === "call")!.op;
  assert.ok(op.kind === "call" && changed.ir.values[op.through!]!.op.kind === "entry");
});
test("actual m2c input changes multi-hop raw call/return inference; raw forwarding compiles to exact relocated words", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "graph-inference-")); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const graph = fixture(), solved = propagate(graph), inference = inferenceInput(graph, solved);
  const context = join(dir, "context.c"), asm = join(dir, "original.s"), constraints = join(dir, "constraints.json");
  writeFileSync(context, "typedef signed int s32; s32 known(s32 *p);\n" + inference.carriers.map((c) => `void ${c.name}(${c.type});`).join("\n"));
  writeFileSync(constraints, JSON.stringify(inference.input));
  writeFileSync(asm, `.text\n${["target", "callback", "wrapper"].map((n, i) => `glabel ${n}\naddiu $sp, $sp, -24\nsw $ra, 16($sp)\njal ${["callback", "wrapper", "known"][i]}\nnop\nlw $ra, 16($sp)\nnop\njr $ra\naddiu $sp, $sp, 24\n`).join("")}`);
  const script = prepareM2c(ROOT).script;
  const run = (extra: string[]) => execFileSync("python3", [script, "--target", "mipsel-gcc-c", "--no-cache", "-f", "target", "--context", context, asm, ...extra], { encoding: "utf8", cwd: ROOT });
  const native = run([]);
  const raw = run(["--infer-related", "--passes", "4", "--graph-constraints", constraints]);
  assert.notEqual(raw, native);
  const recovered = prototypesIn(raw, "raw.c").find((p) => p.name === "target" && p.kind === "definition")!;
  assert.deepEqual(recovered.paramTypes, ["s32 *"]); assert.equal(recovered.returnType, "s32");
  const tree = parseC(raw);
  assert.equal(tree.rootNode.hasError, false);
  const call = tree.rootNode.descendantsOfType("call_expression").find((n) => field(n, "function")?.text === "callback")!;
  assert.equal(field(call, "arguments")?.namedChildren[0]?.text, "arg0"); tree.delete();
  const candidate = join(dir, "candidate.c"); writeFileSync(candidate, '#include "common.h"\n' + raw);
  const built = compileSource(candidate, join(dir, "compiled"), "target", { assemble: true, containerKind: "exe" });
  const binary = join(dir, "text.bin"); execFileSync("mips-linux-gnu-objcopy", ["-O", "binary", "-j", ".text", built.object!, binary]);
  const bytes = readFileSync(binary);
  const relocations = parseRelocations(execFileSync("mips-linux-gnu-objdump", ["-r", "-j", ".text", built.object!], { encoding: "utf8" }));
  for (const relocation of relocations) {
    assert.equal(relocation.symbol, "callback"); bytes.writeUInt32LE(relocatedField(relocation.type, bytes.readUInt32LE(relocation.offset), addresses[1]!), relocation.offset);
  }
  const expected = Buffer.from(assemble(forward(addresses[1]!), addresses[0]!).flatMap((w) => [w.raw & 255, (w.raw >>> 8) & 255, (w.raw >>> 16) & 255, w.raw >>> 24]));
  assert.deepEqual(bytes.subarray(0, expected.length), expected);
});
test("open callback formals do not acquire a supplied member's narrow whole signature", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "open-dispatch-")); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const context = join(dir, "context.c"), asm = join(dir, "original.s"), constraints = join(dir, "constraints.json");
  writeFileSync(context, "typedef signed int s32; typedef signed short s16; s16 callback(s16); void Result(s32);");
  writeFileSync(asm, `.text\nglabel root\naddiu $sp, $sp, -24\nsw $ra, 16($sp)\nlui $a1, %hi(callback)\naddiu $a1, $a1, %lo(callback)\njal dispatcher\nnop\nlw $ra, 16($sp)\nnop\njr $ra\naddiu $sp, $sp, 24\nglabel dispatcher\naddiu $sp, $sp, -24\nsw $ra, 16($sp)\njalr $a1\naddiu $a0, $a0, -12\nlw $ra, 16($sp)\nnop\njr $ra\naddiu $sp, $sp, 24\n`);
  const script = prepareM2c(ROOT).script;
  const run = (open: boolean) => {
    writeFileSync(constraints, JSON.stringify({ version: 1, functions: { dispatcher: { slots: { 0: {}, 1: {} }, result: { type: "Result" }, ...(open ? { openTargetSlots: [1] } : {}) } } }));
    return execFileSync("python3", [script, "--target", "mipsel-gcc-c", "--no-cache", "-f", "dispatcher", "--context", context, asm, "--infer-related", "--passes", "4", "--graph-constraints", constraints], { encoding: "utf8", cwd: ROOT });
  };
  const closed = run(false), open = run(true);
  assert.notEqual(open, closed);
  const inspect = (source: string) => { const tree = parseC(source); try { return tree.rootNode.descendantsOfType("parameter_declaration").flatMap((p) => p.descendantsOfType("type_identifier").map((n) => n.text)); } finally { tree.delete(); } };
  assert.ok(inspect(closed).includes("s16")); assert.ok(!inspect(open).includes("s16"));
});
test("configured originals retain matched incoming/cross-container calls and table entries without worklist pruning", () => {
  const graph = buildEvidenceGraph("ovl_25_func_800B7EB4", { bounds: { functions: 32 } });
  const root = graph.nodes.find((n) => n.id === graph.root)!;
  const dispatch = root.calls.find((c) => c.kind === "indirect")!;
  assert.deepEqual(dispatch.targets.map((t) => t.split(":")[1]), ["ovl_25_func_800B7F3C", "ovl_25_func_800B80A4", "ovl_25_func_800B813C", "ovl_25_func_800B81B4", "ovl_25_func_800B81F4"]);
  assert.equal(dispatch.closed, false); assert.ok(dispatch.remainder.length);
  assert.ok(graph.nodes.some((n) => n.name === "ovl_25_func_800B81B4"));
  assert.ok(graph.nodes.some((n) => n.calls.some((c) => c.targets.includes("exe:func_80013328"))));
  assert.ok(graph.frontier.length > 0); assert.ok(graph.consumed.functions <= 32);
});
