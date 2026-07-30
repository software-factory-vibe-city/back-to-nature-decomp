import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ROOT, compileSource } from "../decompToolchain.js";
import { parseCc1Assembly } from "../variant-lab/compile.js";
import type { NormalizedInstruction } from "../variant-lab/types.js";
import { canonicalContext, canonicalSourceHash } from "./canonicalize.js";
import { validateSearchCheckpoint } from "./checkpoint.js";
import { deriveCausalClosure } from "./compiler-closure.js";
import { buildDomain, candidateAt, shardRank, shardSize } from "./enumerate.js";
import { loadMacroRegistry, splitComponents } from "./macro-forms.js";
import { renderCandidate, renameIdentifiers } from "./render.js";
import { deriveGrammar, macroComponents } from "./rewrite-catalog.js";
import { runResidualSourceSearch } from "./run.js";
import { buildSemanticGraph, memoryReadTokens } from "./semantic-graph.js";
import {
  MAX_REGION_NODES,
  RegionOrderModel,
  RegionTooLargeError,
  memoryEffectsConflict,
  parseMemoryToken,
} from "./topological-orders.js";
import { analyzeWebs, enumeratePartitions, websCompatible } from "./web-partitions.js";
import { discoverWitness, type DiscoveredWitness } from "./witness.js";
import { RESIDUAL_SEARCH_SCHEMA_VERSION, type CausalClosure, type ValueWeb } from "./types.js";

const registry = loadMacroRegistry();
const compilerAvailable = existsSync(join(ROOT, "tools/vendor/old-gcc/build-gcc-2.95.2-psx/cc1"));

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
      maxCandidates: 1,
    });
    assert.equal(first.status, "incomplete-budget");
    assert.equal(first.coverage?.complete, false);
    const resumed = await runResidualSourceSearch({
      functionName: "fixture",
      sourcePath: join(setup.scratch, "base.c"),
      runRootOverride: join(setup.scratch, "run"),
      target: setup.target,
      targetObjectPath: setup.targetObject,
      jobs: 1,
      resume: true,
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
