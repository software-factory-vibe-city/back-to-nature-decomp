import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ROOT, compileSource, configuredCompilerPath } from "../decompToolchain.js";
import { parseCc1Assembly } from "../variant-lab/compile.js";
import type { NormalizedInstruction } from "../variant-lab/types.js";
import { compareResidual, residualIsExact, residualKey } from "./align.js";
import { canonicalContext, canonicalSourceHash } from "./canonicalize.js";
import { validateSearchCheckpoint } from "./checkpoint.js";
import { domainAxes, median, pilotRanks, projectWallMs } from "./cost-report.js";
import { deriveCausalClosure } from "./compiler-closure.js";
import { buildDomain, candidateAt, shardRank, shardSize } from "./enumerate.js";
import { loadMacroRegistry, splitComponents } from "./macro-forms.js";
import { renderCandidate, renameIdentifiers } from "./render.js";
import { deriveGrammar, macroComponents } from "./rewrite-catalog.js";
import { runResidualSourceSearch } from "./run.js";
import { blockIsFrozen, buildSemanticGraph, memoryReadTokens } from "./semantic-graph.js";
import {
  MAX_REGION_NODES,
  RegionOrderModel,
  RegionTooLargeError,
  loopCarriedDependencies,
  memoryEffectsConflict,
  parseMemoryToken,
  regionDependencies,
} from "./topological-orders.js";
import { analyzeWebs, enumeratePartitions, websCompatible } from "./web-partitions.js";
import { mismatchedIndexes } from "./source-input.js";
import { discoverWitness, type DiscoveredWitness } from "./witness.js";
import { RESIDUAL_SEARCH_SCHEMA_VERSION, type CausalClosure, type ValueWeb } from "./types.js";

const registry = loadMacroRegistry();
const compilerAvailable = existsSync(configuredCompilerPath());

function graphOf(source: string, functionName = "fixture") {
  return buildSemanticGraph(functionName, `${functionName}.c`, source, registry);
}

function allNodesClosure(graph: ReturnType<typeof graphOf>, webs: ValueWeb[]): CausalClosure {
  return {
    schemaVersion: RESIDUAL_SEARCH_SCHEMA_VERSION,
    function: graph.function,
    seeds: [],
    items: [],
    nodeIds: graph.nodes.map((node) => node.id),
    webIds: webs.map((web) => web.id),
    uids: [],
    pseudos: [],
    wholeFunction: true,
    caveats: [],
  };
}

/* ------------------------------------------------------------------ */
/* Semantic graph                                                      */
/* ------------------------------------------------------------------ */

test("semantic graph models nested blocks, casts, macros, pointer fields, and C89 declarations", () => {
  const source = [
    "typedef struct { int a; int b; } Pair;",
    "int fixture(Pair *p, int x, unsigned int y) {",
    "    int t;",
    "    int u;",
    "    t = (short)x;",
    "    setSprt((&p->a));",
    "    p->b = t + 1;",
    "    if (y != 0) {",
    "        u = 2;",
    "        if (x > 3) {",
    "            u = 4;",
    "        }",
    "    } else {",
    "        u = 5;",
    "    }",
    "    while (u > 0) {",
    "        u = u - 1;",
    "    }",
    "    return t + u;",
    "}",
    "",
  ].join("\n");
  const graph = graphOf(source);
  const kinds = graph.nodes.map((node) => node.kind);
  assert.ok(kinds.includes("declaration"));
  assert.ok(kinds.includes("assign"));
  assert.ok(kinds.includes("known-macro"));
  assert.ok(kinds.includes("store"));
  assert.ok(kinds.includes("if"));
  assert.ok(kinds.includes("unknown"));
  assert.ok(kinds.includes("return"));
  const cast = graph.nodes.find((node) => node.text.includes("(short)x"))!;
  assert.deepEqual(cast.reads, ["x"]);
  const macro = graph.nodes.find((node) => node.kind === "known-macro")!;
  assert.deepEqual(macro.memoryWrites, ["field:p->a:code", "field:p->a:len"]);
  const store = graph.nodes.find((node) => node.kind === "store")!;
  assert.deepEqual(store.memoryWrites, ["field:p:b"]);
  assert.deepEqual(store.reads, ["p", "t"]);
  const inner = graph.nodes.filter((node) => node.kind === "if");
  assert.equal(inner.length, 2);
  const loop = graph.nodes.find((node) => node.text.startsWith("while"))!;
  assert.equal(loop.movable, false);
  const uVariable = graph.variables.find((variable) => variable.name === "u")!;
  assert.equal(uVariable.supported, false);
  const tVariable = graph.variables.find((variable) => variable.name === "t")!;
  assert.equal(tVariable.supported, true);
});

test("the function definition is located past comment mentions and forward prototypes", () => {
  /* A banner comment that names the function and carries braces and parentheses
   * used to misdirect the raw indexOf scan into parsing the wrong region. */
  const source = [
    "/* fixture - see notes/research/fixture-and-friends.md",
    " * {count, byte offset} pair used to locate a sub-table (4 bytes)",
    " */",
    "int fixture(int a);",
    "",
    "int fixture(int a)",
    "{",
    "    int t;",
    "    t = a;",
    "    return t;",
    "}",
    "",
  ].join("\n");
  const graph = graphOf(source);
  assert.equal(graph.variables.filter((variable) => variable.kind === "parameter").length, 1);
  assert.deepEqual(graph.nodes.filter((node) => node.kind === "declaration").map((node) => node.declName), ["t"]);
  assert.equal(graph.nodes.some((node) => node.kind === "unknown"), false);

  assert.throws(() => graphOf("/* fixture lives elsewhere */\nint other(void) { return 0; }\n"), /was not found/);
});

test("a banner comment naming the function cannot misdirect the parse", () => {
  /* Braces, parentheses, and the function's own name inside a comment used to
     misdirect the character scan into parsing the comment as a body. */
  const source = [
    "/* fixture — see notes/research/fixture.md",
    " * int fixture(int a) { return a; }  <- the shape this used to match",
    " * {count, byte offset} pair used to locate a sub-table (4 bytes)",
    " */",
    "int fixture(int a);",
    "",
    "int fixture(int a)",
    "{",
    "    int t;",
    "    t = a;",
    "    return t;",
    "}",
    "",
  ].join("\n");
  const graph = graphOf(source);
  assert.deepEqual(graph.nodes.map((node) => node.kind), ["declaration", "assign", "return"]);
  assert.equal(graph.parameters.length, 1);
  assert.equal(graph.functionSpan.lineStart, 7);
});

test("an unparsable region freezes a node instead of throwing", () => {
  const source = [
    "int fixture(int a) {",
    "    int t;",
    "    t = a;",
    "    @@@ this is not C @@@",
    "    return t;",
    "}",
    "",
  ].join("\n");
  const graph = graphOf(source);
  assert.ok(graph.nodes.some((node) => node.kind === "unknown"));
  const frozen = graph.nodes.find((node) => node.kind === "unknown")!;
  assert.deepEqual(frozen.memoryReads, ["*unknown*"]);
  assert.deepEqual(frozen.memoryWrites, ["*unknown*"]);
  assert.equal(frozen.movable, false);
  /* The statements around it are still modelled. */
  assert.ok(graph.nodes.some((node) => node.kind === "assign"));
  assert.ok(graph.nodes.some((node) => node.kind === "return"));
});

test("a return is a return, not a declaration of the value it returns", () => {
  /* The character-scan front end matched `return X;` against its declaration
     pattern and invented a local named X with type "return". */
  const graph = graphOf("s32 fixture(void) {\n    return D_8005E29C;\n}\n");
  assert.deepEqual(graph.nodes.map((node) => node.kind), ["return"]);
  assert.deepEqual(graph.nodes[0]!.memoryReads, ["global:D_8005E29C"]);
  assert.deepEqual(graph.variables, []);
});

test("an array local is a declaration whose name is an address", () => {
  const source = [
    "int fixture(int n) {",
    "    s16 list[12];",
    "    int t;",
    "    t = n;",
    "    list[0] = t;",
    "    return t;",
    "}",
    "",
  ].join("\n");
  const graph = graphOf(source);
  /* An array declarator used to defeat the declaration pattern, which froze it
     and every declaration after it. */
  assert.deepEqual(graph.nodes.map((node) => node.kind), ["declaration", "declaration", "assign", "store", "return"]);
  const list = graph.variables.find((variable) => variable.name === "list")!;
  assert.equal(list.addressEscapes, true);
  const store = graph.nodes.find((node) => node.kind === "store")!;
  assert.deepEqual(store.memoryWrites, ["element:list[]"]);
});

test("a hard-register-pinned declaration is frozen, not modelled as a local", () => {
  const source = [
    "void fixture(int a) {",
    "    register int *p __asm__(\"v0\");",
    "    p[0] = a;",
    "}",
    "",
  ].join("\n");
  const graph = graphOf(source);
  const declaration = graph.nodes[0]!;
  assert.equal(declaration.kind, "unknown");
  assert.match(declaration.evidence[0]!, /hard register/);
  /* The pinned name never becomes a renameable local. */
  assert.equal(graph.variables.some((variable) => variable.name === "p"), false);
});

test("a cast the grammar reads as a call is resolved by the configured type names", () => {
  const source = [
    "int fixture(int a, int *out) {",
    "    s16 t;",
    "    t = (s16)(a - 0x41);",
    "    out[0] = (s32)&D_8004B1A4;",
    "    return t;",
    "}",
    "",
  ].join("\n");
  const graph = graphOf(source);
  const cast = graph.nodes.find((node) => node.text.includes("0x41"))!;
  /* `(s16)(x)` is a call and `(s32)&x` is a bitwise and to a context-free
     grammar; only the type name tells them apart. */
  assert.equal(cast.kind, "assign");
  assert.equal(cast.movable, true);
  assert.deepEqual(cast.reads, ["a"]);
  assert.deepEqual(cast.memoryReads, []);
  const address = graph.nodes.find((node) => node.text.includes("D_8004B1A4"))!;
  assert.equal(address.kind, "store");
  assert.deepEqual(address.memoryReads, ["global:D_8004B1A4"]);
});

test("a store through a dereferenced pointer is modelled, not frozen", () => {
  const source = [
    "void fixture(int *p, int *q, int x) {",
    "    *p = x;",
    "    *(s32 *)q = x + 1;",
    "}",
    "",
  ].join("\n");
  const graph = graphOf(source);
  assert.deepEqual(graph.nodes.map((node) => node.kind), ["store", "store"]);
  assert.deepEqual(graph.nodes[0]!.memoryWrites, ["object:p"]);
  assert.deepEqual(graph.nodes[1]!.memoryWrites, ["object:q"]);
});

/* ------------------------------------------------------------------ */
/* Loop and switch structure                                           */
/* ------------------------------------------------------------------ */

test("a for loop models its init, body, and update as blocks", () => {
  const source = [
    "int fixture(int *out, int n) {",
    "    int i;",
    "    int t;",
    "    t = n;",
    "    for (i = 0; i < 4; i++) {",
    "        out[i] = t;",
    "        t = t + 1;",
    "    }",
    "    return t;",
    "}",
    "",
  ].join("\n");
  const graph = graphOf(source);
  const loop = graph.nodes.find((node) => node.loopForm !== undefined)!;
  assert.equal(loop.loopForm, "for");
  assert.equal(loop.condition, "i < 4");
  assert.equal(loop.hasContinue, false);

  const kindOf = (index: number) => graph.blocks[index]!.kind;
  assert.equal(kindOf(loop.initBlock!), "loop-init");
  assert.equal(kindOf(loop.bodyBlock!), "loop-body");
  assert.equal(kindOf(loop.updateBlock!), "loop-update");
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const textsIn = (index: number) => graph.blocks[index]!.nodeIds.map((id) => byId.get(id)!.text);
  assert.deepEqual(textsIn(loop.initBlock!), ["i = 0"]);
  assert.deepEqual(textsIn(loop.updateBlock!), ["i++"]);
  assert.deepEqual(textsIn(loop.bodyBlock!), ["out[i] = t;", "t = t + 1;"]);

  /* The construct itself is never moved or reshaped, and its node carries the
     condition's effects now that the header and body are modelled. */
  assert.equal(loop.movable, false);
  assert.deepEqual(loop.reads, ["i"]);
  assert.deepEqual(loop.writes, []);
  assert.deepEqual(loop.memoryReads, []);
  assert.deepEqual(loop.memoryWrites, []);
  /* The body statements are real, movable statements with real effects. */
  const body = graph.blocks[loop.bodyBlock!]!.nodeIds.map((id) => byId.get(id)!);
  assert.deepEqual(body.map((node) => node.kind), ["store", "assign"]);
  assert.deepEqual(body.map((node) => node.movable), [true, true]);
  assert.deepEqual(body[0]!.memoryWrites, ["element:out[]"]);
});

test("a comma-separated for update becomes one node per statement", () => {
  const source = "void fixture(int *p, int n) {\n    int i;\n    for (i = 0; i < n; i++, p++) {\n        p[0] = i;\n    }\n}\n";
  const graph = graphOf(source);
  const loop = graph.nodes.find((node) => node.loopForm === "for")!;
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  assert.deepEqual(graph.blocks[loop.updateBlock!]!.nodeIds.map((id) => byId.get(id)!.text), ["i++", "p++"]);
});

test("while and do/while model a body block and no header blocks", () => {
  const whileGraph = graphOf("void fixture(int u) {\n    while (u > 0) {\n        u = u - 1;\n    }\n}\n");
  const loop = whileGraph.nodes.find((node) => node.loopForm !== undefined)!;
  assert.equal(loop.loopForm, "while");
  assert.equal(loop.initBlock, undefined);
  assert.equal(loop.updateBlock, undefined);
  assert.equal(whileGraph.blocks[loop.bodyBlock!]!.kind, "loop-body");
  assert.equal(whileGraph.blocks[loop.bodyBlock!]!.nodeIds.length, 1);

  const doGraph = graphOf("void fixture(int k) {\n    do {\n        k++;\n    } while (k < 3);\n}\n");
  const doLoop = doGraph.nodes.find((node) => node.loopForm !== undefined)!;
  assert.equal(doLoop.loopForm, "do-while");
  assert.equal(doLoop.condition, "k < 3");
  assert.equal(doGraph.blocks[doLoop.bodyBlock!]!.nodeIds.length, 1);
});

test("a continue that belongs to the loop is recorded and a nested one is not", () => {
  const own = graphOf("void fixture(int n) {\n    int i;\n    for (i = 0; i < n; i++) {\n        if (i == 2) { continue; }\n        n = n - 1;\n    }\n}\n");
  assert.equal(own.nodes.find((node) => node.loopForm === "for")!.hasContinue, true);

  const nested = graphOf("void fixture(int n) {\n    int i;\n    int j;\n    for (i = 0; i < n; i++) {\n        for (j = 0; j < n; j++) {\n            continue;\n        }\n    }\n}\n");
  const loops = nested.nodes.filter((node) => node.loopForm === "for");
  assert.equal(loops.length, 2);
  const outer = loops.find((node) => node.span.start < loops[0]!.span.start || node.text.includes("i++"))!;
  assert.equal(outer.hasContinue, false);
});

test("a switch models one block per case, labels included", () => {
  const source = [
    "int fixture(int i) {",
    "    int t;",
    "    t = 0;",
    "    switch (i) {",
    "        case 1:",
    "            t = 2;",
    "            break;",
    "        case 5:",
    "            t = 3;",
    "            break;",
    "        default:",
    "            break;",
    "    }",
    "    return t;",
    "}",
    "",
  ].join("\n");
  const graph = graphOf(source);
  const node = graph.nodes.find((item) => item.caseBlocks !== undefined)!;
  assert.equal(node.condition, "i");
  assert.equal(node.caseBlocks!.length, 3);
  const blocks = node.caseBlocks!.map((index) => graph.blocks[index]!);
  assert.deepEqual(blocks.map((block) => block.kind), ["case", "case", "case"]);
  assert.deepEqual(blocks.map((block) => block.caseLabel), ["1", "5", undefined]);
  assert.deepEqual(blocks.map((block) => block.nodeIds.length), [2, 2, 1]);
  assert.equal(node.movable, false);
  assert.deepEqual(node.memoryWrites, ["*unknown*"]);
  assert.equal(graph.caveats.some((line) => /switch frozen at line 4/.test(line)), true);
});

test("a case block never becomes an order region", () => {
  const source = [
    "int fixture(int *out, int n) {",
    "    int a;",
    "    int b;",
    "    a = n;",
    "    b = n + 1;",
    "    switch (n) {",
    "        case 1:",
    "            out[0] = a;",
    "            out[1] = b;",
    "            break;",
    "        default:",
    "            break;",
    "    }",
    "    return a + b;",
    "}",
    "",
  ].join("\n");
  const graph = graphOf(source);
  const view = analyzeWebs(graph);
  const derived = deriveGrammar({ graph, view, closure: allNodesClosure(graph, view.webs), source, registry });
  /* Fall-through and `break` are control this schema does not model, so the
     statements of a case stay outside every order region. */
  const frozenBlocks = new Set(graph.blocks
    .filter((block) => blockIsFrozen(graph.blocks, block.index))
    .map((block) => block.index));
  assert.ok(frozenBlocks.size >= 2);
  for (const region of derived.regions) assert.equal(frozenBlocks.has(region.block), false);
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  for (const region of derived.regions) {
    for (const id of region.nodeIds) assert.equal(byId.get(id)!.block, region.block);
  }
});

/* ------------------------------------------------------------------ */
/* Loop-carried dependencies                                           */
/* ------------------------------------------------------------------ */

/**
 * The tail of func_80016C08, where its whole residual lives. Three statements
 * form a forced chain and two are free, so a loop body of five statements has
 * 5!/3! = 20 dependency-valid orders.
 */
const LOOP_TAIL_SOURCE = [
  "typedef struct { int tag; } Poly;",
  "typedef struct { int field_118; } Gfx;",
  "extern Gfx *D_8005E3C0;",
  "int fixture(u32 *ot, Poly *poly, int size, int count) {",
  "    int total;",
  "    int i;",
  "    total = 0;",
  "    for (i = 0; i < count; i++) {",
  "        poly->tag = (*ot & 0xFFFFFF) | 0x09000000;",
  "        *ot = (s32) poly & 0xFFFFFF;",
  "        total += size;",
  "        poly++;",
  "        D_8005E3C0->field_118 += 0x28;",
  "    }",
  "    return total;",
  "}",
  "",
].join("\n");

/** The variant with every Phase 5 form axis at its baseline choice. */
function baselineVariant(runtime: { variants: Array<{ splitMask: number; updateMask: number; birthMask: number; count: bigint }> }) {
  return runtime.variants.find((variant) =>
    variant.splitMask === 0 && variant.updateMask === 0 && variant.birthMask === 0)!;
}

function loopBodyRegion(source: string) {
  const graph = graphOf(source);
  const view = analyzeWebs(graph);
  const derived = deriveGrammar({ graph, view, closure: allNodesClosure(graph, view.webs), source, registry });
  const loop = graph.nodes.find((node) => node.loopForm !== undefined)!;
  const region = derived.regions.find((item) => item.block === loop.bodyBlock)!;
  return { graph, view, derived, loop, region };
}

test("a loop body is an order region with a hand-verified number of orders", () => {
  const { graph, view, derived, region } = loopBodyRegion(LOOP_TAIL_SOURCE);
  assert.equal(region.nodeIds.length, 5);
  const domain = buildDomain({ graph, view, derived });
  const runtime = domain.partitions[0]!.regions.find((item) => item.region.id === region.id)!;
  /* statement 1 reads *ot and statement 2 writes it; both read poly and
     statement 4 writes it: a three-statement chain and two free statements. */
  assert.equal(baselineVariant(runtime).count, 20n);
  /* The region's own size is the sum over every form and placement variant. */
  assert.equal(runtime.size, runtime.variants.reduce((total, variant) => total + variant.count, 0n));
});

test("a loop-carried anti-dependence keeps the read before the write", () => {
  const source = [
    "int fixture(int *b, int n, int c) {",
    "    int a;",
    "    int i;",
    "    a = 0;",
    "    for (i = 0; i < n; i++) {",
    "        a = b[i];",
    "        b[i] = c;",
    "    }",
    "    return a;",
    "}",
    "",
  ].join("\n");
  const { graph, view, derived, region } = loopBodyRegion(source);
  assert.equal(region.nodeIds.length, 2);
  const domain = buildDomain({ graph, view, derived });
  const runtime = domain.partitions[0]!.regions.find((item) => item.region.id === region.id)!;
  /* Swapping would make the read see this iteration's store instead of the
     previous iteration's value, so the region has exactly one order. */
  assert.equal(baselineVariant(runtime).count, 1n);
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  assert.deepEqual(region.nodeIds.map((id) => byId.get(id)!.kind), ["assign", "store"]);
});

test("a loop-carried conflict is always an intra-iteration conflict too", () => {
  /* nodesConflict is symmetric in the pair, so the back edge can never order
     two statements the within-iteration edges left free. */
  const check = (source: string) => {
    const { graph, view, derived, region } = loopBodyRegion(source);
    const variableNames = new Set(graph.variables.map((variable) => variable.name));
    const byId = new Map(graph.nodes.map((node) => [node.id, node]));
    const views = region.nodeIds.map((id) => {
      const node = byId.get(id)!;
      const webAt = (variable: string) =>
        view.reaching.get(id)?.get(variable) ?? view.defWebs.get(id)?.get(variable);
      return {
        id,
        node,
        reads: new Set(node.reads),
        writes: new Set(node.writes),
        memoryReads: node.memoryReads.map((token) => parseMemoryToken(token, webAt, (name) => variableNames.has(name))),
        memoryWrites: node.memoryWrites.map((token) => parseMemoryToken(token, webAt, (name) => variableNames.has(name))),
      };
    });
    return loopCarriedDependencies(views, regionDependencies(views));
  };
  assert.deepEqual(check(LOOP_TAIL_SOURCE), []);
  assert.deepEqual(check([
    "int fixture(int *b, int n, int c) {",
    "    int a;",
    "    int i;",
    "    a = 0;",
    "    for (i = 0; i < n; i++) {",
    "        a = b[i];",
    "        b[i] = c;",
    "    }",
    "    return a;",
    "}",
    "",
  ].join("\n")), []);
});

test("exact counting agrees with brute-force enumeration on loop bodies", () => {
  const permutations = <T>(items: T[]): T[][] => {
    if (items.length <= 1) return [items];
    return items.flatMap((item, index) =>
      permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [item, ...rest]));
  };
  for (const source of [LOOP_TAIL_SOURCE, [
    "int fixture(int *p, int *q, int n) {",
    "    int t;",
    "    int u;",
    "    int i;",
    "    t = 0;",
    "    u = 0;",
    "    for (i = 0; i < n; i++) {",
    "        t = p[i];",
    "        u = q[i];",
    "        p[i] = u;",
    "    }",
    "    return t + u;",
    "}",
    "",
  ].join("\n")]) {
    const { graph, view, derived, region } = loopBodyRegion(source);
    const domain = buildDomain({ graph, view, derived });
    const runtime = domain.partitions[0]!.regions.find((item) => item.region.id === region.id)!;
    const variableNames = new Set(graph.variables.map((variable) => variable.name));
    const byId = new Map(graph.nodes.map((node) => [node.id, node]));
    const views = region.nodeIds.map((id) => {
      const node = byId.get(id)!;
      const webAt = (variable: string) =>
        view.reaching.get(id)?.get(variable) ?? view.defWebs.get(id)?.get(variable);
      return {
        id,
        node,
        reads: new Set(node.reads),
        writes: new Set(node.writes),
        memoryReads: node.memoryReads.map((token) => parseMemoryToken(token, webAt, (name) => variableNames.has(name))),
        memoryWrites: node.memoryWrites.map((token) => parseMemoryToken(token, webAt, (name) => variableNames.has(name))),
      };
    });
    const edges = [...regionDependencies(views), ...loopCarriedDependencies(views, regionDependencies(views))];
    const legal = permutations(region.nodeIds).filter((order) => {
      const at = new Map(order.map((id, index) => [id, index]));
      return edges.every((edge) => at.get(edge.from)! < at.get(edge.to)!);
    });
    assert.equal(baselineVariant(runtime).count, BigInt(legal.length));
  }
});

/* ------------------------------------------------------------------ */
/* Grammar strata: compound assignment and loop update placement       */
/* ------------------------------------------------------------------ */

test("the compound-assignment stratum stays removed while it changes nothing", { skip: !compilerAvailable }, () => {
  /* The plan's rule: a stratum that cannot be shown to change generated
     assembly on at least one fixture is removed rather than kept. If this ever
     fails, the configured compiler started distinguishing the two spellings
     and the stratum should be reinstated. */
  const scratch = mkdtempSync(join(tmpdir(), "rss-compound-"));
  try {
    const assemblyOf = (name: string, text: string): string => {
      const path = join(scratch, `${name}.c`);
      writeFileSync(path, text);
      return JSON.stringify(parseCc1Assembly(compileSource(path, join(scratch, name), "fixture").assembly));
    };
    const pairs: Array<[string, string, string]> = [
      ["scalar", "int fixture(int a, int n){int t;int i;t=0;for(i=0;i<n;i++){t+=a;}return t;}",
        "int fixture(int a, int n){int t;int i;t=0;for(i=0;i<n;i++){t=t+(a);}return t;}"],
      ["pointer", "int fixture(int *p,int n){int i;int t;t=0;for(i=0;i<n;i++){p+=2;t+=p[0];}return t;}",
        "int fixture(int *p,int n){int i;int t;t=0;for(i=0;i<n;i++){p=p+(2);t=t+(p[0]);}return t;}"],
      ["field", "typedef struct{int a;int b;}S;void fixture(S*s,int x){s->a+=x;s->b+=x;}",
        "typedef struct{int a;int b;}S;void fixture(S*s,int x){s->a=s->a+(x);s->b=s->b+(x);}"],
      ["shift", "int fixture(int a,int b){int t;t=a;t<<=b;t|=b;return t;}",
        "int fixture(int a,int b){int t;t=a;t=t<<(b);t=t|(b);return t;}"],
      ["increment", "void fixture(int*p,int n){int i;i=0;p[0]=n;i++;p[1]=i;}",
        "void fixture(int*p,int n){int i;i=0;p[0]=n;i=i+1;p[1]=i;}"],
      ["element", "void fixture(int*p,int n,int x){int i;for(i=0;i<n;i++){p[i]+=x;}}",
        "void fixture(int*p,int n,int x){int i;for(i=0;i<n;i++){p[i]=p[i]+(x);}}"],
    ];
    for (const [name, compound, expanded] of pairs) {
      assert.equal(assemblyOf(`${name}-c`, compound), assemblyOf(`${name}-e`, expanded),
        `${name}: the two spellings reached different assembly; reinstate compound-assignment-form`);
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test("the removed stratum is recorded as suppressed with its measurement", () => {
  const source = "int fixture(int a){\n    int t;\n    t = 0;\n    t += a;\n    return t;\n}\n";
  const graph = graphOf(source);
  const view = analyzeWebs(graph);
  const derived = deriveGrammar({ graph, view, closure: allNodesClosure(graph, view.webs), source, registry });
  assert.equal(derived.grammar.activeRules.includes("compound-assignment-form"), false);
  const suppressed = derived.grammar.suppressedRules.find((rule) => rule.rule === "compound-assignment-form")!;
  assert.match(suppressed.reason, /measured, not assumed/);
  assert.ok(suppressed.evidence.length > 0);
});

test("a for header's updates may sit at the body tail instead", () => {
  const source = [
    "int fixture(int *out, int n) {",
    "    int i;",
    "    int t;",
    "    t = 0;",
    "    for (i = 0; i < n; i++) {",
    "        out[0] = t;",
    "        out[1] = t;",
    "    }",
    "    return t;",
    "}",
    "",
  ].join("\n");
  const graph = graphOf(source);
  const view = analyzeWebs(graph);
  const derived = deriveGrammar({ graph, view, closure: allNodesClosure(graph, view.webs), source, registry });
  assert.ok(derived.grammar.activeRules.includes("loop-update-placement"));
  const loop = graph.nodes.find((node) => node.loopForm === "for")!;
  const body = derived.regions.find((item) => item.block === loop.bodyBlock)!;
  assert.equal(body.movableUpdates.length, 1);
  /* The update block is absorbed: its statement belongs to exactly one region. */
  assert.equal(derived.regions.some((item) => item.block === loop.updateBlock), false);

  const domain = buildDomain({ graph, view, derived });
  const renders = [...Array(Number(domain.total)).keys()]
    .map((rank) => renderCandidate(source, graph, view, candidateAt(domain, BigInt(rank))));
  assert.equal(renders[0], source);
  const moved = renders.find((text) => text.includes("for (i = 0; i < n; )"))!;
  assert.ok(moved, "some coordinate moves the update into the body");
  assert.ok(moved.includes("i++;"));
  /* Exactly one `i++` survives: the header lost what the body gained. */
  assert.equal(moved.split("i++").length - 1, 1);
  const context = canonicalContext(graph, source);
  assert.equal(new Set(renders.map((text) => canonicalSourceHash(text, context))).size, renders.length);
});

test("a continue pins the header update where it is", () => {
  const source = [
    "int fixture(int *out, int n) {",
    "    int i;",
    "    int t;",
    "    t = 0;",
    "    for (i = 0; i < n; i++) {",
    "        if (i == 2) { continue; }",
    "        out[0] = t;",
    "        out[1] = t;",
    "    }",
    "    return t;",
    "}",
    "",
  ].join("\n");
  const graph = graphOf(source);
  const view = analyzeWebs(graph);
  const derived = deriveGrammar({ graph, view, closure: allNodesClosure(graph, view.webs), source, registry });
  /* A continue skips the body tail but still runs the header update, so the
     two placements are not the same program. */
  assert.equal(derived.regions.some((region) => region.movableUpdates.length > 0), false);
  assert.equal(derived.grammar.activeRules.includes("loop-update-placement"), false);
  assert.ok(derived.grammar.caveats.some((line) => /has a continue; its header updates stay/.test(line)));
});

const SWITCH_SOURCE = [
  "int fixture(int i) {",
  "    int t;",
  "    t = 0;",
  "    switch (i) {",
  "        case 1:",
  "            t = 2;",
  "            break;",
  "        case 5:",
  "            t = 3;",
  "            break;",
  "        default:",
  "            t = 9;",
  "            break;",
  "    }",
  "    return t;",
  "}",
  "",
].join("\n");

test("a switch with distinct, terminated cases also has a compare-chain form", () => {
  const graph = graphOf(SWITCH_SOURCE);
  const view = analyzeWebs(graph);
  const derived = deriveGrammar({ graph, view, closure: allNodesClosure(graph, view.webs), source: SWITCH_SOURCE, registry });
  assert.ok(derived.grammar.activeRules.includes("switch-form"));
  assert.equal(derived.switchForms.length, 1);
  assert.deepEqual(derived.switchForms[0]!.labels, ["1", "5", null]);

  const domain = buildDomain({ graph, view, derived });
  const renders = [...Array(Number(domain.total)).keys()]
    .map((rank) => renderCandidate(SWITCH_SOURCE, graph, view, candidateAt(domain, BigInt(rank))));
  assert.equal(renders[0], SWITCH_SOURCE);
  const chain = renders.find((text) => text.includes("if (i == 1)"))!;
  assert.ok(chain, "some coordinate spells the switch as a chain");
  assert.ok(chain.includes("} else if (i == 5) {"));
  assert.ok(chain.includes("} else {"));
  assert.equal(chain.includes("switch"), false);
  assert.equal(chain.includes("break;"), false);
  /* The chain runs the same statements. */
  for (const statement of ["t = 2;", "t = 3;", "t = 9;"]) assert.ok(chain.includes(statement));
  const context = canonicalContext(graph, SWITCH_SOURCE);
  assert.equal(new Set(renders.map((text) => canonicalSourceHash(text, context))).size, renders.length);
});

test("a switch the chain cannot reproduce keeps its form with an exact reason", () => {
  const refuse = (source: string, pattern: RegExp) => {
    const graph = graphOf(source);
    const view = analyzeWebs(graph);
    const derived = deriveGrammar({ graph, view, closure: allNodesClosure(graph, view.webs), source, registry });
    assert.equal(derived.switchForms.length, 0, source);
    assert.ok(derived.grammar.caveats.some((line) => pattern.test(line)), `${source}\n${derived.grammar.caveats.join("\n")}`);
  };
  /* Fall-through is not a compare chain. */
  refuse(SWITCH_SOURCE.replace("            t = 2;\n            break;\n", "            t = 2;\n"), /falls through/);
  /* A non-constant label cannot be compared against. */
  refuse(SWITCH_SOURCE.replace("case 5:", "case LIMIT:"), /not an integer constant/);
  /* A default before the last case changes which clause wins. */
  refuse([
    "int fixture(int i) {",
    "    int t;",
    "    t = 0;",
    "    switch (i) {",
    "        default:",
    "            t = 9;",
    "            break;",
    "        case 1:",
    "            t = 2;",
    "            break;",
    "    }",
    "    return t;",
    "}",
    "",
  ].join("\n"), /default case is not last/);
});

test("integration: the switch chain form compiles and changes generated assembly", { skip: !compilerAvailable }, () => {
  const scratch = mkdtempSync(join(tmpdir(), "rss-switch-"));
  try {
    const graph = graphOf(SWITCH_SOURCE);
    const view = analyzeWebs(graph);
    const derived = deriveGrammar({ graph, view, closure: allNodesClosure(graph, view.webs), source: SWITCH_SOURCE, registry });
    const domain = buildDomain({ graph, view, derived });
    const chain = [...Array(Number(domain.total)).keys()]
      .map((rank) => renderCandidate(SWITCH_SOURCE, graph, view, candidateAt(domain, BigInt(rank))))
      .find((text) => text.includes("if (i == 1)"))!;
    const assemblyOf = (name: string, text: string): string => {
      const path = join(scratch, `${name}.c`);
      writeFileSync(path, text);
      return JSON.stringify(parseCc1Assembly(compileSource(path, join(scratch, name), "fixture").assembly));
    };
    /* The rendered chain is real C, and the compiler treats the two forms
       differently: a balanced compare tree against a chain. */
    assert.notEqual(assemblyOf("sbase", SWITCH_SOURCE), assemblyOf("schain", chain));
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test("integration: loop update placement changes generated assembly", { skip: !compilerAvailable }, () => {
  /* A stratum earns its place by changing what the compiler emits. */
  const scratch = mkdtempSync(join(tmpdir(), "rss-strata-"));
  try {
    const assemblyOf = (name: string, text: string): string => {
      const path = join(scratch, `${name}.c`);
      writeFileSync(path, text);
      return JSON.stringify(parseCc1Assembly(compileSource(path, join(scratch, name), "fixture").assembly));
    };
    const base = [
      "typedef struct { int a; int b; } Pair;",
      "void fixture(Pair *s, int n) {",
      "    int i;",
      "    for (i = 0; i < n; i++, s++) {",
      "        s->a = i;",
      "        s->b = i + 1;",
      "    }",
      "}",
      "",
    ].join("\n");
    const moved = base
      .replace("for (i = 0; i < n; i++, s++) {", "for (i = 0; i < n; i++) {")
      .replace("        s->b = i + 1;\n", "        s->b = i + 1;\n        s++;\n");
    assert.notEqual(base, moved);
    assert.notEqual(assemblyOf("ubase", base), assemblyOf("uform", moved));
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test("memory read extraction distinguishes loads, address-of, and derefs", () => {
  const variables = new Set(["p", "q", "i", "x"]);
  assert.deepEqual(memoryReadTokens("q[0] + 3", variables), ["element:q[]"]);
  assert.deepEqual(memoryReadTokens("p->len + x", variables), ["field:p:len"]);
  assert.deepEqual(memoryReadTokens("&p->len", variables), []);
  assert.deepEqual(memoryReadTokens("(&p->sprite)", variables), []);
  assert.deepEqual(memoryReadTokens("*q + 1", variables), ["object:q"]);
  assert.deepEqual(memoryReadTokens("x * q", variables), []);
  assert.deepEqual(memoryReadTokens("D_80049044[i]", variables), ["global:D_80049044"]);
});

/* ------------------------------------------------------------------ */
/* Residual alignment                                                  */
/* ------------------------------------------------------------------ */

function instruction(canonical: string, relocation?: string): NormalizedInstruction {
  const [mnemonic, rest] = canonical.split(/\s+(.*)/);
  const operands = rest ? rest.split(",") : [];
  return { mnemonic: mnemonic!, operands, canonical, ...(relocation ? { relocation } : {}) };
}

test("the residual key closes the differences the assembler and linker introduce", () => {
  const same = (left: NormalizedInstruction, right: NormalizedInstruction, why: string) =>
    assert.equal(residualKey(left), residualKey(right), why);

  /* $30 has two names. */
  same(instruction("sw s8,128(sp)"), instruction("sw fp,128(sp)"), "register alias");
  same(instruction("addu s8,v1,v0"), instruction("addu fp,v1,v0"), "register alias in a result");
  same(instruction("lhu a0,0(s8)"), instruction("lhu a0,0(fp)"), "register alias in a base");

  /* The assembler rewrites a subtract of a constant. */
  same(instruction("addiu sp,sp,-136"), instruction("subu sp,sp,136"), "assembler macro");

  /* A generated symbol carries its own address, and small-data addressing is
     a choice the assembler makes that the cc1 stream does not encode. */
  same(instruction("sh v1,%lo(8005e438)(gp)"), instruction("sh v1,d_8005e438"), "gp-relative form");
  same(instruction("lw v1,%lo(8005e3c0)(v0)"), instruction("lw v1,%lo(d_8005e3c0)(v0)"), "symbol name or address");

  /* An unresolved call target resolves through its own relocation record. */
  same(instruction("jal 0<func_80016c08>", "%lo(80016b7c)"), instruction("jal func_80016b7c"), "call relocation");

  /* Real differences survive: this pair is the residual of func_80016C08. */
  assert.notEqual(
    residualKey(instruction("lui v1,%hi(8005e3c0)")),
    residualKey(instruction("lui v0,%hi(8005e3c0)")));
  assert.notEqual(residualKey(instruction("lw v1,%lo(8005e3c0)(v1)")), residualKey(instruction("lw v1,%lo(8005e3c0)(v0)")));
  /* A different callee is still a difference. */
  assert.notEqual(residualKey(instruction("jal 0<encl>", "%lo(80016b7c)")), residualKey(instruction("jal func_80019070")));
});

test("delay-slot fills are aligned away, not charged to the source", () => {
  /* The target has been through the assembler; the cc1 stream has not. */
  const target = ["addiu sp,sp,-8", "jal func_80016b7c", "nop", "lw v0,0(a0)", "nop", "jr ra"].map((text) => instruction(text));
  const candidate = ["subu sp,sp,8", "jal func_80016b7c", "lw v0,0(a0)", "jr ra"].map((text) => instruction(text));
  const result = compareResidual(target, candidate);
  assert.equal(result.assemblerFill, 2);
  assert.equal(result.exact, 4);
  assert.equal(result.total, 4);
  assert.deepEqual(result.mismatchedTargetIndexes, []);
  assert.equal(result.category, "exact");
  assert.equal(residualIsExact(result), true);
  /* The positional comparison this replaced saw five differences in a stream
     that has none: the first nop desynchronizes everything after it. */
  assert.equal(mismatchedIndexes(target, candidate).length, 5);
});

test("one inserted instruction does not desynchronize the rest of the stream", () => {
  const body = Array.from({ length: 40 }, (_unused, index) => instruction(`addiu v0,v0,${index}`));
  const target = [...body];
  const candidate = [instruction("lui v1,4"), ...body];
  const result = compareResidual(target, candidate);
  assert.equal(result.exact, 40);
  assert.deepEqual(result.unpairedTargetIndexes, []);
  assert.deepEqual(result.unpairedCandidateIndexes, [0]);
  /* A pure insertion still seeds the closure. */
  assert.deepEqual(result.mismatchedTargetIndexes, [0]);
  assert.equal(result.category, "instruction-count");
  assert.equal(residualIsExact(result), false);
});

test("a substitution seeds once, from the target side", () => {
  const target = ["lw v0,0(a0)", "addiu a0,a0,4", "jr ra"].map((text) => instruction(text));
  const candidate = ["lw v0,0(a0)", "addiu a0,a0,9", "jr ra"].map((text) => instruction(text));
  const result = compareResidual(target, candidate);
  assert.deepEqual(result.unpairedTargetIndexes, [1]);
  assert.deepEqual(result.unpairedCandidateIndexes, [1]);
  /* The cc1 side sits in the same gap, so it adds no second seed. */
  assert.deepEqual(result.mismatchedTargetIndexes, [1]);
  assert.equal(result.category, "allocation-or-operands");
});

test("a permutation of the same instructions is reported as scheduling", () => {
  const target = ["lw v0,0(a0)", "lw v1,4(a0)", "jr ra"].map((text) => instruction(text));
  const candidate = ["lw v1,4(a0)", "lw v0,0(a0)", "jr ra"].map((text) => instruction(text));
  const result = compareResidual(target, candidate);
  assert.equal(result.category, "scheduling-permutation");
  assert.equal(residualIsExact(result), false);
});

/* ------------------------------------------------------------------ */
/* Value webs                                                          */
/* ------------------------------------------------------------------ */

test("web analysis separates killing definitions and merges join-reaching definitions", () => {
  const source = [
    "int fixture(int a, int b, int c) {",
    "    int t;",
    "    int u;",
    "    t = a + 1;",
    "    u = t + 2;",
    "    t = b + 3;",
    "    if (c != 0) {",
    "        t = 4;",
    "    }",
    "    return t + u;",
    "}",
    "",
  ].join("\n");
  const graph = graphOf(source);
  const view = analyzeWebs(graph);
  const tWebs = view.webs.filter((web) => web.variable === "t");
  assert.equal(tWebs.length, 2);
  /* The second and third t definitions merge through the if join. */
  assert.equal(tWebs[1]!.defNodes.length, 2);
  const uWeb = view.webs.find((web) => web.id === "u#0")!;
  assert.equal(websCompatible(tWebs[0]!, uWeb), true);
  assert.equal(websCompatible(uWeb, tWebs[1]!), false);
});

test("partition enumeration matches Bell numbers and places the baseline first", () => {
  const makeWeb = (name: string): ValueWeb => ({
    id: `${name}#0`,
    variable: name,
    webIndex: 0,
    defNodes: ["n0"],
    useNodes: [],
    typeText: "int",
    pointer: false,
    parameterEntry: false,
    liveAtNodes: [],
    renameable: true,
    evidence: [],
  });
  const four = ["a", "b", "c", "d"].map(makeWeb);
  const five = ["a", "b", "c", "d", "e"].map(makeWeb);
  const bellFour = enumeratePartitions(four, () => true, 100000);
  const bellFive = enumeratePartitions(five, () => true, 100000);
  assert.equal(bellFour.partitions.length, 15);
  assert.equal(bellFive.partitions.length, 52);
  assert.ok(bellFour.complete);
  assert.deepEqual(bellFour.partitions[0]!.rgs, [0, 1, 2, 3]);
  const capped = enumeratePartitions(five, () => true, 10);
  assert.equal(capped.complete, false);
});

/* ------------------------------------------------------------------ */
/* Linear extensions                                                   */
/* ------------------------------------------------------------------ */

test("linear extension counting, ranking, and unranking are exact", () => {
  const free = new RegionOrderModel(3, [0, 0, 0]);
  assert.equal(free.count(), 6n);
  const chain = new RegionOrderModel(3, [0, 1, 2]);
  assert.equal(chain.count(), 1n);
  const diamond = new RegionOrderModel(4, [0, 1, 1, 6]);
  assert.equal(diamond.count(), 2n);
  for (let rank = 0n; rank < free.count(); rank++) {
    const order = free.unrank(rank);
    assert.equal(free.rank(order), rank);
  }
  assert.deepEqual(free.unrank(0n), [0, 1, 2]);
  assert.throws(() => new RegionOrderModel(MAX_REGION_NODES + 1, new Array(MAX_REGION_NODES + 1).fill(0)), RegionTooLargeError);
  const projected = free.withRemoved(0b010);
  assert.equal(projected.model.count(), 2n);
  assert.deepEqual(projected.kept, [0, 2]);
});

test("memory effect conflicts respect object identity, fields, and globals", () => {
  const webAt = (variable: string) => (variable === "p2" ? "p#1" : `${variable}#0`);
  const isVariable = (name: string) => ["p", "p2", "q"].includes(name);
  const parse = (token: string) => parseMemoryToken(token, webAt, isVariable);
  assert.equal(memoryEffectsConflict(parse("field:p:a"), parse("field:p:b")), false);
  assert.equal(memoryEffectsConflict(parse("field:p:a"), parse("field:p:a")), true);
  assert.equal(memoryEffectsConflict(parse("field:p:a"), parse("object:p")), true);
  assert.equal(memoryEffectsConflict(parse("field:p:a"), parse("field:q:a")), false);
  assert.equal(memoryEffectsConflict(parse("*unknown*"), parse("field:p:a")), true);
  assert.equal(memoryEffectsConflict(parse("global:D_1"), parse("global:D_1")), true);
  assert.equal(memoryEffectsConflict(parse("global:D_1"), parse("global:D_2")), false);
  assert.equal(memoryEffectsConflict(parse("element:p[]"), parse("element:p[]")), true);
  assert.equal(memoryEffectsConflict(parse("element:p[]"), parse("element:q[]")), false);
  /* Same base variable but a different value web: distinct objects. */
  assert.equal(memoryEffectsConflict(parse("field:p:a"), parse("field:p2:a")), false);
});

/* ------------------------------------------------------------------ */
/* Domain construction, coordinates, sharding                          */
/* ------------------------------------------------------------------ */

function syntheticDomain() {
  const source = [
    "int fixture(int a, int b, int c) {",
    "    int x;",
    "    int y;",
    "    int z;",
    "    x = a + 1;",
    "    y = b + 2;",
    "    z = c + 3;",
    "    return x + y + z;",
    "}",
    "",
  ].join("\n");
  const graph = graphOf(source);
  const view = analyzeWebs(graph);
  const closure = allNodesClosure(graph, view.webs);
  const derived = deriveGrammar({ graph, view, closure, source, registry });
  const domain = buildDomain({ graph, view, derived });
  return { source, graph, view, derived, domain };
}

test("domain counting is exact and every coordinate renders a distinct canonical source", () => {
  const { source, graph, view, domain } = syntheticDomain();
  /* Hand-checked: the baseline partition alone contributes 3! orders plus
     birth subsets = 16; merging x/y/z into the dead parameter webs a/b/c
     yields 15 admissible partitions and 117 total representations. */
  assert.equal(domain.partitions.length, 15);
  assert.ok(domain.partitions[0]!.named.baseline);
  assert.equal(domain.partitions[0]!.size, 16n);
  assert.equal(domain.total, 117n);
  const context = canonicalContext(graph, source);
  const hashes = new Set<string>();
  for (let rank = 0n; rank < domain.total; rank++) {
    const plan = candidateAt(domain, rank);
    const rendered = renderCandidate(source, graph, view, plan);
    hashes.add(canonicalSourceHash(rendered, context));
    if (rank === 0n) assert.equal(rendered, source);
  }
  assert.equal(hashes.size, 117);
});

test("domain derivation and coordinates are deterministic", () => {
  const first = syntheticDomain();
  const second = syntheticDomain();
  assert.equal(first.domain.total, second.domain.total);
  assert.deepEqual(first.domain.domain, second.domain.domain);
  const planA = candidateAt(first.domain, 7n);
  const planB = candidateAt(second.domain, 7n);
  assert.deepEqual(planA.coordinate, planB.coordinate);
});

test("shards are disjoint and their union covers the whole domain", () => {
  const total = 16n;
  const counts = [1, 2, 3, 4, 5];
  for (const count of counts) {
    const seen = new Set<string>();
    let sum = 0n;
    for (let index = 1; index <= count; index++) {
      const size = shardSize(total, { index, count });
      sum += size;
      for (let local = 0n; local < size; local++) {
        const rank = shardRank({ index, count }, local);
        assert.ok(rank < total);
        assert.ok(!seen.has(rank.toString()));
        seen.add(rank.toString());
      }
    }
    assert.equal(sum, total);
    assert.equal(seen.size, Number(total));
  }
});

/* ------------------------------------------------------------------ */
/* Cost report                                                         */
/* ------------------------------------------------------------------ */

test("the pilot sample is deterministic, stratified, and inside the domain", () => {
  assert.deepEqual(pilotRanks(0n), []);
  assert.deepEqual(pilotRanks(3n).map(String), ["0", "1", "2"]);
  const ranks = pilotRanks(1000n);
  assert.equal(ranks.length, 64);
  assert.deepEqual(ranks, pilotRanks(1000n));
  assert.equal(new Set(ranks.map(String)).size, 64);
  assert.equal(ranks[0], 0n);
  assert.ok(ranks.every((rank) => rank >= 0n && rank < 1000n));
  /* Even spacing: no two neighbours differ by more than one step. */
  const steps = ranks.slice(1).map((rank, index) => rank - ranks[index]!);
  assert.equal(new Set(steps.map(String)).size <= 2, true);
  /* A domain smaller than the sample is covered exhaustively. */
  assert.equal(pilotRanks(9n).length, 9);
});

test("the per-axis breakdown bounds the domain and puts the largest axis first", () => {
  const { domain } = syntheticDomain();
  const axes = domainAxes(domain);
  assert.ok(axes.length >= 2);
  for (let index = 1; index < axes.length; index++) {
    assert.ok(BigInt(axes[index - 1]!.radix) >= BigInt(axes[index]!.radix));
  }
  /* The domain is a sum over sections of a product over regions, so the
     radices bound it rather than multiplying out to it exactly. */
  const bound = axes.reduce((product, axis) => product * BigInt(axis.radix), 1n);
  assert.ok(bound >= domain.total);
  const section = axes.find((axis) => axis.kind === "section")!;
  assert.equal(section.radix, String(domain.partitions.length));
  assert.equal(axes.filter((axis) => axis.kind === "region").length, domain.partitions[0]!.regions.length);
});

test("the projection is N x (1 - d) x c / jobs and degrades instead of lying", () => {
  assert.equal(median([5, 1, 3]), 3);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([]), 0);
  assert.equal(projectWallMs(1000n, 0.5, 40, 4), 5000);
  assert.equal(projectWallMs(1000n, 0, 40, 1), 40000);
  /* A domain beyond double precision reports no projection rather than one
     that silently saturates. */
  assert.equal(projectWallMs(10n ** 400n, 0, 40, 1), null);
});

test("the CLI surface is one function name plus --derive-only, --source, and --json", () => {
  const cli = join(ROOT, "tools/agent/searchResidualSourceSpace.ts");
  for (const removed of ["--jobs", "--shard", "--start", "--resume", "--max-candidates", "--max-partitions"]) {
    const result = spawnSync("npx", ["tsx", cli, "fixture", removed, "2"], { cwd: ROOT, encoding: "utf8" });
    assert.equal(result.status, 1, `${removed} should no longer be accepted`);
    assert.match(result.stderr, new RegExp(`unknown option: ${removed}`));
  }
  const noName = spawnSync("npx", ["tsx", cli, "--derive-only"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(noName.status, 1);
  assert.match(noName.stderr, /missing function name/);
});

test("integration: --derive-only prices the run and a full run reuses and reports against it", { skip: !compilerAvailable }, async () => {
  const setup = prepareFixture("estimate", STORE_BASE, STORE_VARIANT);
  try {
    /* Perturb one immediate so the run has to go all the way to exhaustion. */
    const target = setup.target.map((instruction) =>
      instruction.canonical === "addiu a1,a1,1"
        ? { ...instruction, operands: ["a1", "a1", "9"], canonical: "addiu a1,a1,9" }
        : instruction);
    const shared = {
      functionName: "fixture",
      sourcePath: join(setup.scratch, "base.c"),
      runRootOverride: join(setup.scratch, "run"),
      target,
      jobs: 2,
    } as const;

    const derived = await runResidualSourceSearch({ ...shared, deriveOnly: true });
    assert.equal(derived.status, "derived");
    const estimate = derived.estimate!;
    assert.equal(estimate.totalCandidates, derived.domain!.totalCandidates);
    assert.equal(estimate.pilot.size, Number(derived.domain!.totalCandidates));
    assert.deepEqual(estimate.pilot.ranks, ["0", "1"]);
    assert.equal(estimate.calibrationSamplesMs.length, 5);
    assert.ok(estimate.perCandidateMs > 0);
    assert.ok(estimate.duplicateRate >= 0 && estimate.duplicateRate <= 1);
    assert.ok(estimate.projectedMs !== null && estimate.projectedMs > 0);
    assert.ok(estimate.axes.length >= 2);
    assert.match(derived.statusDetail, /2 coordinate\(s\) were sampled/);
    assert.ok(derived.caveats.some((line) => /lever on this cost is the residual/.test(line)));

    /* The full run resolves the sampled coordinates from the pilot instead of
       compiling them again, and reports its real time against the projection. */
    const full = await runResidualSourceSearch(shared);
    assert.equal(full.status, "exhausted-no-exact");
    assert.equal(full.coverage?.complete, true);
    assert.equal(full.timing?.projectedMs, estimate.projectedMs);
    assert.ok(full.timing!.ratio! > 0);
    assert.ok(full.caveats.some((line) => /reused \d+ assembly class/.test(line)));
    assert.deepEqual(
      full.classes.map((item) => [item.classId, item.representativeRank, item.members]),
      derived.classes.map((item) => [item.classId, item.representativeRank, item.members]));
  } finally {
    rmSync(setup.scratch, { recursive: true, force: true });
  }
});

/* ------------------------------------------------------------------ */
/* Known-macro component forms                                         */
/* ------------------------------------------------------------------ */

test("composite macros split into registered components derived from the verified definition", () => {
  const setSprt = registry.active.get("setSprt")!;
  const components = splitComponents(setSprt, ["(&p->sprite)"], registry)!;
  assert.equal(components.length, 2);
  assert.equal(components[0]!.statement, "setlen((&p->sprite), 4);");
  assert.equal(components[1]!.statement, "setcode((&p->sprite), 0x64);");
  /* addPrim nests the unregistered getaddr expression; the split is refused. */
  const addPrim = registry.active.get("addPrim")!;
  assert.equal(splitComponents(addPrim, ["ot", "p"], registry), undefined);
  /* Single-component bodies are not composites. */
  const termPrim = registry.active.get("termPrim")!;
  assert.equal(splitComponents(termPrim, ["p"], registry), undefined);
});

test("macro split adds a region dimension with exact counts and distinct renders", () => {
  const source = [
    "void fixture(int *s, int x) {",
    "    setSprt(s);",
    "    s[0] = x;",
    "}",
    "",
  ].join("\n");
  const graph = graphOf(source);
  const macroNode = graph.nodes.find((node) => node.kind === "known-macro")!;
  const components = macroComponents(macroNode, new Set(graph.variables.map((variable) => variable.name)), registry)!;
  assert.equal(components.length, 2);
  assert.equal(components[0]!.id, `${macroNode.id}::c0`);
  const view = analyzeWebs(graph);
  const closure = allNodesClosure(graph, view.webs);
  const derived = deriveGrammar({ graph, view, closure, source, registry });
  assert.deepEqual(derived.regions[0]!.splittable, [macroNode.id]);
  const domain = buildDomain({ graph, view, derived });
  /* Unsplit: the macro and the store are ordered (shared base object) -> 1.
     Split: setlen/setcode commute with each other but not the store -> 2. */
  assert.equal(domain.total, 3n);
  const context = canonicalContext(graph, source);
  const renders = new Set<string>();
  for (let rank = 0n; rank < domain.total; rank++) {
    const rendered = renderCandidate(source, graph, view, candidateAt(domain, rank));
    renders.add(canonicalSourceHash(rendered, context));
    if (rank === 0n) assert.equal(rendered, source);
    if (rank > 0n) assert.match(rendered, /setlen\(s, 4\);/);
  }
  assert.equal(renders.size, 3);
});

/* ------------------------------------------------------------------ */
/* Constant materialization (rule 4.3)                                 */
/* ------------------------------------------------------------------ */

test("materialization sites come only from diff-named literal macro arguments", () => {
  const source = [
    "int fixture(int *s, int t) {",
    "    u8 c;",
    "    setSprt(s);",
    "    setWH(s, 8, 12);",
    "    /* boundary */",
    "    c = 0x64;",
    "    setcode(s, c);",
    "    return 0;",
    "}",
    "",
  ].join("\n");
  const graph = graphOf(source);
  const view = analyzeWebs(graph);
  const closure = allNodesClosure(graph, view.webs);
  /* Only 4 is named by the residual diff; 8, 12, and 0x64 are not. */
  const derived = deriveGrammar({ graph, view, closure, source, registry, mismatchImmediates: [4] });
  assert.equal(derived.sites.length, 1);
  assert.equal(derived.sites[0]!.value, 4);
  assert.equal(derived.sites[0]!.freshType, "u8");
  assert.equal(derived.materializations.length, 2);
  /* The synthetic web merges with the disjoint u8 web c but not with s or t. */
  const merged = derived.materializations[1]!.partitions
    .filter((partition) => partition.groupOfWeb.get("mat_0#0") === "c");
  assert.ok(merged.length >= 1);
  const domain = buildDomain({ graph, view, derived });
  const context = canonicalContext(graph, source);
  const hashes = new Set<string>();
  for (let rank = 0n; rank < domain.total; rank++) {
    const rendered = renderCandidate(source, graph, view, candidateAt(domain, rank));
    hashes.add(canonicalSourceHash(rendered, context));
  }
  assert.equal(hashes.size, Number(domain.total));
  const mergedPlan = candidateAt(domain, domain.partitions.find((partition) =>
    partition.named.groupOfWeb.get("mat_0#0") === "c")!.offset);
  const mergedRender = renderCandidate(source, graph, view, mergedPlan);
  assert.match(mergedRender, /c = 4;/);
  assert.match(mergedRender, /setlen\(s, c\);/);
});

test("constant type representability gates synthetic web merges", async () => {
  const { constantFitsType } = await import("./web-partitions.js");
  assert.equal(constantFitsType(4, "u8"), true);
  assert.equal(constantFitsType(300, "u8"), false);
  assert.equal(constantFitsType(300, "u16"), true);
  assert.equal(constantFitsType(70000, "s16"), false);
  assert.equal(constantFitsType(70000, "u32"), true);
  assert.equal(constantFitsType(4, "SpritePacket *"), false);
});

/* ------------------------------------------------------------------ */
/* Rendering and canonicalization                                      */
/* ------------------------------------------------------------------ */

test("identifier renaming skips fields, strings, and comments", () => {
  const renames = new Map([["code", "blue"]]);
  assert.equal(renameIdentifiers("p->code = code + 1;", renames), "p->code = blue + 1;");
  assert.equal(renameIdentifiers("s = \"code\";", renames), "s = \"code\";");
  assert.equal(renameIdentifiers("/* code */ code = 1;", renames), "/* code */ blue = 1;");
  assert.equal(renameIdentifiers("a.code += code;", renames), "a.code += blue;");
});

test("canonical hashing equates alpha-equivalent sources only", () => {
  const graph = graphOf("int fixture(int a) {\n    int t;\n    t = a + 1;\n    return t;\n}\n");
  const context = canonicalContext(graph, "int fixture(int a) {\n    int t;\n    t = a + 1;\n    return t;\n}\n");
  const left = canonicalSourceHash("int fixture(int a) {\n    int t;\n    t = a + 1;\n    return t;\n}\n", context);
  const right = canonicalSourceHash("int fixture(int a) {\n    int zz;  /* comment */\n    zz = a + 1;\n    return zz;\n}\n", context);
  const different = canonicalSourceHash("int fixture(int a) {\n    int t;\n    t = a + 2;\n    return t;\n}\n", context);
  assert.equal(left, right);
  assert.notEqual(left, different);
});

/* ------------------------------------------------------------------ */
/* Causal closure reason paths                                         */
/* ------------------------------------------------------------------ */

test("closure derivation records auditable reason paths and is deterministic", () => {
  const source = "int fixture(int a) {\n    int t;\n    t = a + 7;\n    return t;\n}\n";
  const graph = graphOf(source);
  const view = analyzeWebs(graph);
  const analysis = {
    target: [{ index: 0, canonical: "li v0,7", mnemonic: "li", operands: ["v0", "7"] }],
    candidate: [{ index: 0, canonical: "li v0,8", mnemonic: "li", operands: ["v0", "8"], uid: 12, candidateUids: [12] }],
    correspondence: [{ targetIndex: 0, candidateIndex: 0, candidateUid: 12, confidence: "exact", evidence: [] }],
    registerRoles: [],
    delaySlots: [],
    requirements: [],
  } as never;
  const trace = { pseudos: [], schedulers: [], allocationOrder: [] } as never;
  const bundle = { function: "fixture", mismatchedTargetIndexes: [0] } as never;
  const run = () => deriveCausalClosure({
    graph, view, bundle, trace, analysis, registry,
    dumpDirectory: "/nonexistent", sourceFileName: "fixture.c",
  });
  const closure = run();
  const assignNode = graph.nodes.find((node) => node.kind === "assign")!;
  assert.ok(closure.nodeIds.includes(assignNode.id));
  const item = closure.items.find((entry) => entry.id === `node:${assignNode.id}`)!;
  assert.ok(item.reasons.some((reason) => reason.kind === "constant-binding" && reason.from === "target:0"));
  assert.ok(closure.webIds.includes("t#0"));
  assert.deepEqual(run(), closure);
});

/* ------------------------------------------------------------------ */
/* Checkpoints                                                         */
/* ------------------------------------------------------------------ */

test("checkpoint validation refuses drifted identities", () => {
  const checkpoint = {
    schemaVersion: RESIDUAL_SEARCH_SCHEMA_VERSION,
    function: "fixture",
    runId: "run",
    identityHash: "hash-a",
    evaluatedRanges: [],
    evaluatedCount: "0",
    classes: [],
    exactCandidates: [],
  } as never;
  assert.doesNotThrow(() => validateSearchCheckpoint(checkpoint, { functionName: "fixture", runId: "run", identityHash: "hash-a" }));
  assert.throws(() => validateSearchCheckpoint(checkpoint, { functionName: "fixture", runId: "run", identityHash: "hash-b" }), /refusing resume/);
  assert.throws(() => validateSearchCheckpoint(checkpoint, { functionName: "other", runId: "run", identityHash: "hash-a" }), /different search run/);
});

/* ------------------------------------------------------------------ */
/* Synthetic compiler integration                                      */
/* ------------------------------------------------------------------ */

interface FixtureSetup {
  scratch: string;
  target: NormalizedInstruction[];
  targetObject: string;
}

function prepareFixture(name: string, base: string, variant: string): FixtureSetup {
  const scratch = mkdtempSync(join(tmpdir(), `rss-${name}-`));
  writeFileSync(join(scratch, "base.c"), base);
  writeFileSync(join(scratch, "variant.c"), variant);
  const artifacts = compileSource(join(scratch, "variant.c"), join(scratch, "target"), "fixture", { assemble: true });
  return { scratch, target: parseCc1Assembly(artifacts.assembly), targetObject: artifacts.object! };
}

const STORE_BASE = "typedef struct { int a; int b; } Pair;\nint fixture(Pair *p, int x, int y) {\n    p->a = x + 1;\n    p->b = y + 2;\n    return 0;\n}\n";
const STORE_VARIANT = "typedef struct { int a; int b; } Pair;\nint fixture(Pair *p, int x, int y) {\n    p->b = y + 2;\n    p->a = x + 1;\n    return 0;\n}\n";

test("integration: two legal statement orders find the exact source", { skip: !compilerAvailable }, async () => {
  const setup = prepareFixture("orders", STORE_BASE, STORE_VARIANT);
  try {
    const summary = await runResidualSourceSearch({
      functionName: "fixture",
      sourcePath: join(setup.scratch, "base.c"),
      runRootOverride: join(setup.scratch, "run"),
      target: setup.target,
      targetObjectPath: setup.targetObject,
      jobs: 2,
    });
    assert.equal(summary.status, "exact-candidate-found");
    assert.equal(summary.exactCandidates.length, 1);
    assert.notEqual(summary.exactCandidates[0]!.globalRank, "0");
    assert.ok(summary.classes.some((item) => item.fullObjectExact));
    assert.equal(summary.coverage?.complete, true);
  } finally {
    rmSync(setup.scratch, { recursive: true, force: true });
  }
});

test("integration: fresh-versus-reused web split finds the exact source", { skip: !compilerAvailable }, async () => {
  const base = "int fixture(int a, int b, int *out) {\n    int t;\n    t = a + 5;\n    out[0] = t;\n    t = b + 7;\n    out[1] = t;\n    return 0;\n}\n";
  const variant = "int fixture(int a, int b, int *out) {\n    int t;\n    int t2;\n    t = a + 5;\n    out[0] = t;\n    t2 = b + 7;\n    out[1] = t2;\n    return 0;\n}\n";
  const setup = prepareFixture("webs", base, variant);
  try {
    const summary = await runResidualSourceSearch({
      functionName: "fixture",
      sourcePath: join(setup.scratch, "base.c"),
      runRootOverride: join(setup.scratch, "run"),
      target: setup.target,
      targetObjectPath: setup.targetObject,
      jobs: 2,
    });
    assert.equal(summary.status, "exact-candidate-found");
    assert.ok(summary.exactCandidates.length >= 1);
  } finally {
    rmSync(setup.scratch, { recursive: true, force: true });
  }
});

test("integration: declaration-birth form finds the exact source across a region boundary", { skip: !compilerAvailable }, async () => {
  const base = "int fixture(int *p, int *q, int x) {\n    int t;\n    p[0] = x;\n    /* boundary */\n    t = q[0] + 3;\n    p[1] = t;\n    return t;\n}\n";
  const variant = "int fixture(int *p, int *q, int x) {\n    int t = q[0] + 3;\n    p[0] = x;\n    p[1] = t;\n    return t;\n}\n";
  const setup = prepareFixture("birth", base, variant);
  try {
    const summary = await runResidualSourceSearch({
      functionName: "fixture",
      sourcePath: join(setup.scratch, "base.c"),
      runRootOverride: join(setup.scratch, "run"),
      target: setup.target,
      targetObjectPath: setup.targetObject,
      jobs: 2,
    });
    assert.equal(summary.status, "exact-candidate-found");
  } finally {
    rmSync(setup.scratch, { recursive: true, force: true });
  }
});

test("integration: known-macro component forms find an interleaved split target", { skip: !compilerAvailable }, async () => {
  const header = "#include \"common.h\"\n#include \"psyq/stddef.h\"\n#include \"psyq/libgte.h\"\n#include \"psyq/libgpu.h\"\n";
  const base = `${header}void fixture(SPRT *s, int x, int y) {\n    setSprt(s);\n    setXY0(s, x, y);\n}\n`;
  const variant = `${header}void fixture(SPRT *s, int x, int y) {\n    setlen(s, 4);\n    setXY0(s, x, y);\n    setcode(s, 0x64);\n}\n`;
  const setup = prepareFixture("macro", base, variant);
  try {
    const summary = await runResidualSourceSearch({
      functionName: "fixture",
      sourcePath: join(setup.scratch, "base.c"),
      runRootOverride: join(setup.scratch, "run"),
      target: setup.target,
      targetObjectPath: setup.targetObject,
      jobs: 2,
    });
    assert.equal(summary.status, "exact-candidate-found");
    assert.ok(summary.exactCandidates.length >= 1);
  } finally {
    rmSync(setup.scratch, { recursive: true, force: true });
  }
});

test("integration: constant materialization with web merging finds a multi-set constant target", { skip: !compilerAvailable }, async () => {
  const header = "#include \"common.h\"\n#include \"psyq/stddef.h\"\n#include \"psyq/libgte.h\"\n#include \"psyq/libgpu.h\"\n";
  const base = `${header}void fixture(SPRT *s, int t) {\n    u8 c;\n    setSprt(s);\n    s->x0 = (short)t;\n    c = 0x64;\n    if (t != 0) {\n        c = 0x66;\n    }\n    setcode(s, c);\n}\n`;
  const variant = `${header}void fixture(SPRT *s, int t) {\n    u8 c;\n    c = 4;\n    setlen(s, c);\n    setcode(s, 0x64);\n    s->x0 = (short)t;\n    c = 0x64;\n    if (t != 0) {\n        c = 0x66;\n    }\n    setcode(s, c);\n}\n`;
  const setup = prepareFixture("materialize", base, variant);
  try {
    const summary = await runResidualSourceSearch({
      functionName: "fixture",
      sourcePath: join(setup.scratch, "base.c"),
      runRootOverride: join(setup.scratch, "run"),
      target: setup.target,
      targetObjectPath: setup.targetObject,
      jobs: 4,
    });
    assert.equal(summary.status, "exact-candidate-found");
    assert.ok(summary.exactCandidates.length >= 1);
    assert.equal(summary.coverage?.complete, true);
  } finally {
    rmSync(setup.scratch, { recursive: true, force: true });
  }
});

test("integration: an unreachable target exhausts honestly", { skip: !compilerAvailable }, async () => {
  const setup = prepareFixture("exhaust", STORE_BASE, STORE_VARIANT);
  try {
    /* Perturb one immediate so no grammar representation can reach the target. */
    const target = setup.target.map((instruction) =>
      instruction.canonical === "addiu a1,a1,1"
        ? { ...instruction, operands: ["a1", "a1", "9"], canonical: "addiu a1,a1,9" }
        : instruction);
    const summary = await runResidualSourceSearch({
      functionName: "fixture",
      sourcePath: join(setup.scratch, "base.c"),
      runRootOverride: join(setup.scratch, "run"),
      target,
      jobs: 2,
    });
    assert.equal(summary.status, "exhausted-no-exact");
    assert.equal(summary.coverage?.complete, true);
    assert.equal(summary.exactCandidates.length, 0);
  } finally {
    rmSync(setup.scratch, { recursive: true, force: true });
  }
});

test("integration: unknown-effect causal region is refused", { skip: !compilerAvailable }, async () => {
  const base = "extern void helper(int value);\nint fixture(int a) {\n    helper(a + 4);\n    return 0;\n}\n";
  const variant = "extern void helper(int value);\nint fixture(int a) {\n    helper(a + 9);\n    return 0;\n}\n";
  const setup = prepareFixture("refuse", base, variant);
  try {
    const summary = await runResidualSourceSearch({
      functionName: "fixture",
      sourcePath: join(setup.scratch, "base.c"),
      runRootOverride: join(setup.scratch, "run"),
      target: setup.target,
      jobs: 1,
    });
    assert.ok(summary.status === "unsupported-source" || summary.status === "unsupported-correspondence");
    assert.equal(summary.exactCandidates.length, 0);
  } finally {
    rmSync(setup.scratch, { recursive: true, force: true });
  }
});

test("integration: an interrupted run resumes to the same outcome", { skip: !compilerAvailable }, async () => {
  const setup = prepareFixture("resume", STORE_BASE, STORE_VARIANT);
  try {
    const first = await runResidualSourceSearch({
      functionName: "fixture",
      sourcePath: join(setup.scratch, "base.c"),
      runRootOverride: join(setup.scratch, "run"),
      target: setup.target,
      targetObjectPath: setup.targetObject,
      jobs: 1,
      interruptAfter: 1,
    });
    assert.equal(first.status, "incomplete-budget");
    assert.equal(first.coverage?.complete, false);
    /* Resume is automatic: the same command picks up from the checkpoint. */
    const resumed = await runResidualSourceSearch({
      functionName: "fixture",
      sourcePath: join(setup.scratch, "base.c"),
      runRootOverride: join(setup.scratch, "run"),
      target: setup.target,
      targetObjectPath: setup.targetObject,
      jobs: 1,
    });
    assert.equal(resumed.status, "exact-candidate-found");
    assert.equal(resumed.coverage?.complete, true);
    assert.equal(resumed.coverage?.evaluatedCandidates, "2");
  } finally {
    rmSync(setup.scratch, { recursive: true, force: true });
  }
});

/* ------------------------------------------------------------------ */
/* Administrative copies (rule 4.7)                                    */
/* ------------------------------------------------------------------ */

function writeWitnessFixture(root: string, runId: string, options?: {
  status?: string;
  label?: string;
  evidence?: string[];
}): void {
  const directory = join(root, runId);
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "manifest.json"), JSON.stringify({
    status: options?.status ?? "sat",
    function: "fixture",
  }));
  writeFileSync(join(directory, "witness.json"), JSON.stringify({
    phantoms: [{ templateId: "phantom-a", producerUid: 4, producerPseudo: 81, readRegister: "t2" }],
    sourceRequirements: [{ id: "phantom-phantom-a" }],
  }));
  writeFileSync(join(directory, "input.json"), JSON.stringify({
    model: {
      nodes: [{
        uid: 4,
        pseudo: 81,
        label: options?.label ?? "move t2,a0",
        evidence: options?.evidence ?? ["The ABI entry copy has a fixed pre-statement chain position."],
      }],
    },
  }));
}

test("witness discovery binds ABI entry-copy phantoms and refuses others", () => {
  const scratch = mkdtempSync(join(tmpdir(), "rss-witness-"));
  try {
    assert.equal(discoverWitness("fixture", scratch), undefined);
    writeWitnessFixture(scratch, "unsatrun", { status: "unsat" });
    assert.equal(discoverWitness("fixture", scratch), undefined);
    writeWitnessFixture(scratch, "satrun");
    const witness = discoverWitness("fixture", scratch)!;
    assert.equal(witness.runId, "satrun");
    assert.equal(witness.sourceRequirements, 1);
    assert.equal(witness.phantoms.length, 1);
    assert.equal(witness.phantoms[0]!.abiParameterIndex, 0);
    assert.equal(witness.phantoms[0]!.refusal, undefined);
    /* A producer that is not a machine-evidenced ABI entry copy stays unbound. */
    writeWitnessFixture(scratch, "zother", { label: "sra t4,a3,16", evidence: ["ordinary"] });
    const unbound = discoverWitness("fixture", scratch)!;
    assert.equal(unbound.runId, "zother");
    assert.equal(unbound.phantoms[0]!.abiParameterIndex, undefined);
    assert.match(unbound.phantoms[0]!.refusal!, /not a machine-evidenced ABI/);
    assert.ok(unbound.caveats.some((line) => /Multiple SAT witnesses/.test(line)));
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

const COPY_FIXTURE_SOURCE = [
  "typedef struct { int a; int b; } Pair;",
  "int fixture(Pair *p, int x, int y) {",
  "    int t;",
  "    int u;",
  "    t = x + 1;",
  "    u = y + 2;",
  "    /* boundary */",
  "    p->a = t;",
  "    p->b = u;",
  "    return 0;",
  "}",
  "",
].join("\n");

function copyFixtureWitness(): DiscoveredWitness {
  return {
    runId: "testwitness",
    directory: "build/schedulerConstraint/fixture/testwitness",
    phantoms: [{
      templateId: "phantom-a",
      producerUid: 4,
      producerPseudo: 81,
      readRegister: "t2",
      producerLabel: "move t2,a0",
      abiParameterIndex: 0,
      evidence: ["Producer UID 4 is the ABI entry copy \"move t2,a0\" of argument register a0."],
    }],
    sourceRequirements: 1,
    caveats: [],
  };
}

test("administrative-form activates only on a witness and copy candidates render correctly", () => {
  const source = COPY_FIXTURE_SOURCE;
  const graph = graphOf(source);
  const view = analyzeWebs(graph);
  const closure = allNodesClosure(graph, view.webs);

  /* Without a witness the stratum is suppressed with an exact reason. */
  const plain = deriveGrammar({ graph, view, closure, source, registry });
  assert.ok(!plain.grammar.activeRules.includes("administrative-form"));
  const suppressed = plain.grammar.suppressedRules.find((rule) => rule.rule === "administrative-form")!;
  assert.match(suppressed.reason, /no SAT scheduler-constraint witness/);

  /* With a bound witness the stratum activates and cites the run. */
  const witness = copyFixtureWitness();
  const derived = deriveGrammar({ graph, view, closure, source, registry, witness });
  assert.ok(derived.grammar.activeRules.includes("administrative-form"));
  assert.equal(derived.grammar.witness?.runId, "testwitness");
  assert.equal(derived.grammar.administrativeSites?.length, 1);
  const site = derived.grammar.administrativeSites![0]!;
  assert.equal(site.readVariable, "p");
  assert.equal(site.freshVariable, "admin_0");
  /* Only the scalar region qualifies: the store region reads p directly. */
  assert.equal(site.regionId, "r0-0");
  assert.equal(site.redirectedReadNodes.length, 2);

  const plainDomain = buildDomain({ graph, view, derived: plain });
  const domain = buildDomain({ graph, view, derived });
  assert.ok(domain.total > plainDomain.total);
  const copySection = domain.partitions.find((partition) => partition.administrativeCopies.length > 0)!;
  const plan = candidateAt(domain, copySection.offset);
  assert.deepEqual(plan.coordinate.administrativeCopies, [site.siteId]);
  const rendered = renderCandidate(source, graph, view, plan);
  assert.match(rendered, /Pair \*\s*admin_0;/);
  assert.match(rendered, /admin_0 = p;/);
  assert.match(rendered, /admin_0->a = t;/);
  assert.match(rendered, /admin_0->b = u;/);
  /* The copy's own read is never redirected and rank 0 stays byte-identical. */
  assert.equal(renderCandidate(source, graph, view, candidateAt(domain, 0n)), source);

  /* Every coordinate still renders a distinct canonical source. */
  const context = canonicalContext(graph, source);
  const hashes = new Set<string>();
  for (let rank = 0n; rank < domain.total; rank++) {
    hashes.add(canonicalSourceHash(renderCandidate(source, graph, view, candidateAt(domain, rank)), context));
  }
  assert.equal(hashes.size, Number(domain.total));
});

test("a copy web never merges with the web it copies", () => {
  const copied: ValueWeb = {
    id: "p#0", variable: "p", webIndex: 0, defNodes: ["param-entry"], useNodes: [],
    typeText: "int *", pointer: true, parameterEntry: true, liveAtNodes: ["n1"],
    renameable: false, evidence: [],
  };
  const copy: ValueWeb = {
    id: "admin_0#0", variable: "admin_0", webIndex: 0, defNodes: ["admin:phantom-a@r0-0"], useNodes: [],
    typeText: "int *", pointer: true, parameterEntry: false, liveAtNodes: ["n2"],
    renameable: true, syntheticCopyOf: "p#0", evidence: [],
  };
  assert.equal(websCompatible(copy, copied), false);
  assert.equal(websCompatible(copied, copy), false);
  const unrelated: ValueWeb = { ...copied, id: "q#0", variable: "q", parameterEntry: false, renameable: true };
  assert.equal(websCompatible(copy, unrelated), true);
});

test("integration: witness-activated copy candidates compile and the grammar cites the run", { skip: !compilerAvailable }, async () => {
  const base = COPY_FIXTURE_SOURCE;
  const variant = base.replace("    p->a = t;\n    p->b = u;", "    p->b = u;\n    p->a = t;");
  assert.notEqual(base, variant);
  const setup = prepareFixture("admincopy", base, variant);
  try {
    const witnessRoot = join(setup.scratch, "witness");
    mkdirSync(witnessRoot, { recursive: true });
    writeWitnessFixture(witnessRoot, "satrun");
    const summary = await runResidualSourceSearch({
      functionName: "fixture",
      sourcePath: join(setup.scratch, "base.c"),
      runRootOverride: join(setup.scratch, "run"),
      witnessRootOverride: witnessRoot,
      target: setup.target,
      targetObjectPath: setup.targetObject,
      jobs: 4,
    });
    assert.equal(summary.status, "exact-candidate-found");
    assert.equal(summary.coverage?.complete, true);
    const grammar = JSON.parse(readFileSync(join(setup.scratch, "run", "grammar.json"), "utf8"));
    assert.ok(grammar.activeRules.includes("administrative-form"));
    assert.equal(grammar.witness.runId, "satrun");
    assert.equal(grammar.administrativeSites.length, 1);
  } finally {
    rmSync(setup.scratch, { recursive: true, force: true });
  }
});

test("refusal: INCLUDE_ASM stubs are ineligible without compiling", async () => {
  const scratch = mkdtempSync(join(tmpdir(), "rss-stub-"));
  try {
    writeFileSync(join(scratch, "base.c"), "INCLUDE_ASM(\"asm/nonmatchings\", fixture);\n");
    const summary = await runResidualSourceSearch({
      functionName: "fixture",
      sourcePath: join(scratch, "base.c"),
      runRootOverride: join(scratch, "run"),
      target: [],
      jobs: 1,
    });
    assert.equal(summary.status, "unsupported-source");
    assert.match(summary.statusDetail, /INCLUDE_ASM/);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
