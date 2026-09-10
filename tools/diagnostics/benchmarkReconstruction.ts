/**
 * benchmarkReconstruction.ts — run the automatic matching reconstruction
 * engine over a set of functions and report terminal states and costs
 * (plans/automatic-matching-reconstruction.md, Phase B and the §8 census).
 *
 *   npx tsx tools/diagnostics/benchmarkReconstruction.ts <fn> [<fn> ...] [--json]
 *   npx tsx tools/diagnostics/benchmarkReconstruction.ts --parked [--json]
 *   npx tsx tools/diagnostics/benchmarkReconstruction.ts --census [--json]
 *
 * `--parked` collects the functions the autonomous loop has parked (their
 * sources carry the park marker). `--census` collects every unmatched function
 * in every container — a source that is missing or still hands the function to
 * the assembler — runs the engine over all of them, and aggregates blocker
 * categories by function and byte count: the measured failure census that
 * prioritizes which constructor to build next. The harness reads `src/` only
 * to *discover names*; the engine it invokes reads target-side artifacts
 * alone. Unsupported and noncompiling outcomes are counted in the denominator
 * — nothing is silently omitted.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, compileSource } from "../agent/decompToolchain.js";
import { loadContainers, vramToRom } from "../lib/container.js";
import { loadFunctionSpans, requireFunctionLocation } from "../lib/symbolIndex.js";
import { compareFunction } from "../lib/functionOracle.js";
import { sha256File, writeStableJson } from "../agent/provenance.js";
import { groupHeadingOf } from "../agent/fileGroupings.js";
import { runM2c } from "../agent/m2cFunc.js";
import { decodeBytes } from "../agent/matching-reconstruction/exec.js";
import { reconstructFunction } from "../agent/matching-reconstruction/engine.js";
import type { ResultBundle } from "../agent/matching-reconstruction/types.js";

const PARK_MARKER = "PARKED by /auto_decompilation_loop";

function parkedFunctions(): string[] {
  const names: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory)) {
      const path = join(directory, entry);
      if (statSync(path).isDirectory()) visit(path);
      else if (entry.endsWith(".c") && readFileSync(path, "utf-8").includes(PARK_MARKER)) {
        names.push(entry.replace(/\.c$/, ""));
      }
    }
  };
  visit(join(ROOT, "src"));
  return names.sort();
}

/** Every function whose source is absent or still an INCLUDE_ASM stub. */
function unmatchedFunctions(): string[] {
  const names: string[] = [];
  for (const container of loadContainers()) {
    for (const span of loadFunctionSpans(container)) {
      const sourcePath = join(ROOT, container.paths.srcDir, `${span.name}.c`);
      if (!existsSync(sourcePath)) {
        names.push(span.name);
        continue;
      }
      const content = readFileSync(sourcePath, "utf-8");
      if (content.includes("INCLUDE_ASM(") && content.includes(span.name)) names.push(span.name);
    }
  }
  return names;
}

/** Bucket an unresolved detail into a census category naming a mechanism. */
export function censusCategory(result: ResultBundle): string {
  if (result.state === "exact-candidate") return "exact-candidate";
  const detail = result.unresolved?.detail ?? "";
  if (result.state === "domain-exhausted") return "domain-exhausted (relation fits; grammar lacks a witness)";
  if (result.state === "context-unresolved") return "context-unresolved (relation fits; origin evidence missing)";
  if (result.state === "budget-exhausted") return "budget-exhausted";
  if (result.state === "tool-failure") return "tool-failure";
  /* CR(n,reg) — call result as predicate/value/return. */
  if (detail.includes("call-result")) return "call-result referenced without a temp binding";
  if (detail.includes("CR(")) return "call-result (CR) in predicate or value expression";
  /* S3 categories: calls whose callee signature could not be recovered are
   * now honest refusals (state unsupported-target) with a specific reason,
   * no longer "no parameter plan". */
  if (detail.includes("callee signature is unknown") || detail.includes("indirect call")) {
    return "unresolvable callee signature (unknown/indirect)";
  }
  if (detail.includes("returns void — the CR atom")) {
    return "void callee whose result the caller reads";
  }
  /* Not plain C: coprocessor, handwritten, undecoded ops. */
  if (detail.includes("undecoded operation") || detail.includes("coprocessor") || detail.includes("handwritten")) {
    return "not plain C (coprocessor/handwritten/undecoded)";
  }
  const stores = detail.includes("stores memory");
  const calls = detail.includes("calls another function");
  if (stores && calls) return "writes + calls";
  if (stores) return "writes, no calls";
  if (calls) return "calls, no writes";
  if (detail.includes("outside the decoded integer subset")) return "undecoded operations (coprocessor/handwritten)";
  if (detail.includes("symbolic address")) return "symbolic address base (pointer/computed indexing)";
  if (detail.includes("state budget") || detail.includes("cycle with unchanged live state") || detail.includes("step budget")) {
    return "unbounded or symbolic-bound control";
  }
  if (detail.includes("short-circuit chain") || detail.includes("not a scan") || detail.includes("template")
    || detail.includes("record") || detail.includes("unconditional return") || detail.includes("constant")
    || detail.includes("affine")) {
    return "read-only, call-free, but not a fixed-stride scan";
  }
  if (detail.includes("general control flow")) {
    return "general control flow: " + detail.slice(0, 60);
  }
  return `other: ${detail.slice(0, 60)}`;
}

/* ---- the frozen evaluation manifest (plan §5) ----------------------------- */

const MANIFEST_PATH = "configs/reconstruction/benchmark-manifest.json";
const MANIFEST_SCHEMA_VERSION = 1;

interface ManifestEntry {
  name: string;
  /** `exact-candidate`, or `unresolved` for a documented honest failure. */
  expect: "exact-candidate" | "unresolved";
  note: string;
}

interface Manifest {
  schemaVersion: number;
  frozenAt: string;
  /** SHA-256 of every container image, so drifted inputs are visible. */
  imageHashes: Record<string, string>;
  development: ManifestEntry[];
  challenge: string[];
  heldOut: Array<{ name: string; stratum: string; grouping?: string | undefined }>;
}

/** Development regressions: one entry per demonstrated mechanism, plus the
 * documented honest failures whose mechanisms are future work. */
const DEVELOPMENT_SET: ManifestEntry[] = [
  { name: "ovl_21_func_800BA670", expect: "exact-candidate", note: "inferred call signature + void wrapper — ABI tier 3 resolved arity, callee undecompiled" },
  { name: "ovl_11_func_800F13D8", expect: "exact-candidate", note: "embedded-table scan via witnessed parent origin (plan §2)" },
  { name: "ovl_11_func_800DBB94", expect: "exact-candidate", note: "scan with != guard and raw argument compare" },
  { name: "ovl_11_func_800DBF60", expect: "exact-candidate", note: "scan starting at record 1 of a labelled table" },
  { name: "func_8001BF74", expect: "exact-candidate", note: "straight-line stores, gp-relative small data" },
  { name: "func_8001FA98", expect: "exact-candidate", note: "return of a post-incremented global" },
  { name: "ovl_19_func_800BAC50", expect: "exact-candidate", note: "stores through an argument pointer" },
  { name: "ovl_28_func_800B935C", expect: "exact-candidate", note: "sltiu-1 spelled as == 0" },
  { name: "ovl_23_func_800BA278", expect: "exact-candidate", note: "guarded decision tree with early returns" },
  { name: "func_80017C04", expect: "exact-candidate", note: "call + return through a matched callee (func_80019030) — S1/S2/S3" },
  { name: "func_800209D4", expect: "exact-candidate", note: "SDK void callee wrapper (SsUtReverbOn) — S2 tier 2" },
  { name: "func_800209F4", expect: "exact-candidate", note: "SDK void callee wrapper (SsUtReverbOff) — S2 tier 2" },
  { name: "func_8001F190", expect: "exact-candidate", note: "matched two-arg callee (CopyVec3) with symbol-address arg — S1/S2/S3" },
  { name: "func_8002098C", expect: "exact-candidate", note: "SDK one-arg callee (SsUtSetReverbFeedback) with parameter usage — S1/S2/S3" },
  { name: "func_80017300", expect: "unresolved", note: "count-up loop the compiler reversed — future loop constructor (plan §5 B1)" },
  { name: "ovl_11_func_800F14D8", expect: "unresolved", note: "symbolic-bound wrap-around value search" },
  { name: "func_80017F30", expect: "unresolved", note: "sentinel-terminated parallel pointer scan" },
];

function freezeManifest(): Manifest {
  const imageHashes: Record<string, string> = {};
  const heldOut: Manifest["heldOut"] = [];
  for (const container of loadContainers()) {
    imageHashes[container.id] = sha256File(join(ROOT, container.targetPath));
    /* Stratify matched functions by cheap byte-level features; take a small
     * deterministic sample per stratum. Known matching C stays evaluator-only:
     * the engine never reads it. */
    const image = readFileSync(join(ROOT, container.targetPath));
    const perStratum = new Map<string, string[]>();
    for (const span of loadFunctionSpans(container)) {
      const sourcePath = join(ROOT, container.paths.srcDir, `${span.name}.c`);
      if (!existsSync(sourcePath)) continue;
      const content = readFileSync(sourcePath, "utf-8");
      if (content.includes("INCLUDE_ASM(") && content.includes(span.name)) continue;
      if (DEVELOPMENT_SET.some((entry) => entry.name === span.name)) continue;
      const rom = vramToRom(container, span.vram);
      const insns = decodeBytes(image.subarray(rom, rom + span.size), span.vram);
      const hasCalls = insns.some((insn) => insn.op === "jal" || insn.op === "jalr");
      const hasStores = insns.some((insn) => insn.op === "sb" || insn.op === "sh" || insn.op === "sw");
      const hasLoops = insns.some((insn) => insn.target !== undefined && insn.target <= insn.vram);
      const sizeBucket = span.size <= 64 ? "small" : span.size <= 256 ? "medium" : "large";
      const stratum = `${container.kind}/${hasCalls ? "calls" : "leaf"}/${hasStores ? "writes" : "readonly"}/${hasLoops ? "loops" : "straight"}/${sizeBucket}`;
      perStratum.set(stratum, [...(perStratum.get(stratum) ?? []), span.name]);
    }
    for (const [stratum, members] of [...perStratum.entries()].sort()) {
      for (const name of members.sort().slice(0, 3)) {
        heldOut.push({ name, stratum, grouping: groupHeadingOf(name) });
      }
    }
  }
  const manifest: Manifest = {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    frozenAt: new Date().toISOString(),
    imageHashes,
    development: DEVELOPMENT_SET,
    challenge: parkedFunctions(),
    heldOut,
  };
  writeStableJson(join(ROOT, MANIFEST_PATH), manifest);
  return manifest;
}

function loadManifestFile(): Manifest {
  const path = join(ROOT, MANIFEST_PATH);
  if (!existsSync(path)) {
    console.error(`no manifest at ${MANIFEST_PATH}; run --freeze-manifest first`);
    process.exit(2);
  }
  const manifest = JSON.parse(readFileSync(path, "utf-8")) as Manifest;
  for (const container of loadContainers()) {
    const hash = sha256File(join(ROOT, container.targetPath));
    if (manifest.imageHashes[container.id] && manifest.imageHashes[container.id] !== hash) {
      console.error(`input drift: ${container.id}'s image differs from the frozen manifest`);
      process.exit(2);
    }
  }
  return manifest;
}

/** Raw-m2c baseline: its draft compiled and byte-compared as-is (plan §5 B2). */
function m2cBaseline(name: string): { verdict: string; detail: string } {
  try {
    const draft = runM2c(name, ROOT);
    const directory = join(ROOT, "build/matchingReconstruction/m2c-baseline", name);
    mkdirSync(directory, { recursive: true });
    const sourcePath = join(directory, `${name}.c`);
    /* runM2c already prepends #include "common.h", which defines s16/u16/etc.
     * Prepending STANDALONE_TYPEDEF_BLOCK on top re-typedefs them, and GCC
     * 2.95 rejects duplicate typedefs — failing every m2c draft on a harness
     * artifact rather than a real defect. Compile the draft as-is. */
    writeFileSync(sourcePath, draft);
    const location = requireFunctionLocation(name);
    const artifacts = compileSource(sourcePath, directory, name, {
      assemble: true, useOverrides: false, containerKind: location.container.kind,
    });
    const oracle = compareFunction(name, { objectPath: artifacts.object!, container: location.container });
    return { verdict: oracle.verdict, detail: `${oracle.same}/${Math.max(oracle.targetWords.length, oracle.candidateWords.length)} words` };
  } catch (error) {
    return { verdict: "noncompiling", detail: (error instanceof Error ? error.message : String(error)).slice(0, 80) };
  }
}

const args = process.argv.slice(2);
const json = args.includes("--json");
const census = args.includes("--census");
const withM2c = args.includes("--m2c-baseline");
const setIndex = args.indexOf("--set");
const setName = setIndex >= 0 ? args[setIndex + 1] : undefined;
const requested = args.filter((arg, index) => !arg.startsWith("--") && args[index - 1] !== "--set");

if (args.includes("--freeze-manifest")) {
  const manifest = freezeManifest();
  console.log(`frozen ${MANIFEST_PATH}: ${manifest.development.length} development, ${manifest.challenge.length} challenge, ${manifest.heldOut.length} held-out`);
  process.exit(0);
}

let names: string[];
let expectations: Map<string, "exact-candidate" | "unresolved"> | undefined;
if (setName) {
  const manifest = loadManifestFile();
  if (setName === "development") {
    names = manifest.development.map((entry) => entry.name);
    expectations = new Map(manifest.development.map((entry) => [entry.name, entry.expect]));
  } else if (setName === "challenge") {
    names = manifest.challenge;
  } else if (setName === "held-out") {
    names = manifest.heldOut.map((entry) => entry.name);
  } else {
    console.error(`unknown set ${setName}; sets: development, challenge, held-out`);
    process.exit(2);
  }
} else {
  names = census
    ? [...unmatchedFunctions(), ...requested]
    : args.includes("--parked") ? [...parkedFunctions(), ...requested] : requested;
}

if (names.length === 0) {
  console.error("usage: npx tsx tools/diagnostics/benchmarkReconstruction.ts <fn> [...] | --parked | --census | --set <name> | --freeze-manifest  [--m2c-baseline] [--json]");
  process.exit(2);
}

const results: ResultBundle[] = [];
const baselines = new Map<string, { verdict: string; detail: string }>();
for (const name of names) {
  if (!census || results.length % 100 === 0) {
    console.error(`reconstructing ${name} (${results.length + 1}/${names.length})`);
  }
  results.push(reconstructFunction({ functionName: name, notify: () => {} }));
  if (withM2c) baselines.set(name, m2cBaseline(name));
}

/* Development expectations are the regression gate: a mechanism that stops
 * reconstructing, or an honest failure that silently changes class, fails. */
let expectationFailures = 0;
if (expectations) {
  for (const result of results) {
    const expected = expectations.get(result.functionName);
    const actual = result.state === "exact-candidate" ? "exact-candidate" : result.state === "tool-failure" ? "tool-failure" : "unresolved";
    if (expected && actual !== expected) {
      console.error(`EXPECTATION FAILED: ${result.functionName} expected ${expected}, got ${result.state}`);
      expectationFailures++;
    }
  }
}

if (json) {
  console.log(JSON.stringify(results, null, 2));
} else if (census) {
  /* The census view: categories by function and byte count, most bytes first,
   * with the interesting states listed by name. */
  const buckets = new Map<string, { functions: number; bytes: number }>();
  for (const result of results) {
    const category = censusCategory(result);
    const bucket = buckets.get(category) ?? { functions: 0, bytes: 0 };
    bucket.functions++;
    bucket.bytes += result.sizeBytes;
    buckets.set(category, bucket);
  }
  console.log(`census over ${results.length} unmatched function(s), ${results.reduce((sum, result) => sum + result.sizeBytes, 0)} bytes`);
  for (const [category, bucket] of [...buckets.entries()].sort((a, b) => b[1].bytes - a[1].bytes)) {
    console.log(`  ${String(bucket.functions).padStart(5)} fn ${String(bucket.bytes).padStart(8)} B  ${category}`);
  }
  for (const state of ["exact-candidate", "domain-exhausted", "context-unresolved", "budget-exhausted", "tool-failure"]) {
    const matching = results.filter((result) => result.state === state);
    if (matching.length === 0) continue;
    console.log(`${state}:`);
    for (const result of matching) {
      const note = result.state === "exact-candidate"
        ? result.winner!.id
        : (result.unresolved?.detail ?? "").slice(0, 90);
      console.log(`  ${result.functionName} (${result.sizeBytes} B) — ${note}`);
    }
  }
  const artifact = join(ROOT, "build/matchingReconstruction/census.json");
  writeStableJson(artifact, {
    generatedBy: "tools/diagnostics/benchmarkReconstruction.ts --census",
    functions: results.map((result) => ({
      functionName: result.functionName,
      containerId: result.containerId,
      sizeBytes: result.sizeBytes,
      state: result.state,
      category: censusCategory(result),
      detail: result.unresolved?.detail,
      winner: result.winner?.id,
    })),
  });
  console.log(`written: ${artifact}`);
} else {
  const width = Math.max(...names.map((name) => name.length));
  for (const result of results) {
    const cost = `${String(result.candidates.length).padStart(3)} cand ${String(result.compiles).padStart(3)} cc ${String(result.wallMs).padStart(6)}ms`;
    const detail = result.state === "exact-candidate"
      ? `winner ${result.winner!.id}`
      : (result.unresolved?.detail ?? "").slice(0, 100);
    const baseline = baselines.get(result.functionName);
    const m2c = baseline ? `  m2c: ${baseline.verdict} (${baseline.detail})` : "";
    console.log(`${result.functionName.padEnd(width)}  ${result.state.padEnd(18)} ${cost}  ${detail}${m2c}`);
  }
  const byState = new Map<string, number>();
  for (const result of results) byState.set(result.state, (byState.get(result.state) ?? 0) + 1);
  console.log("---");
  for (const [state, count] of [...byState.entries()].sort()) console.log(`${state}: ${count}`);
  console.log(`total compiles: ${results.reduce((sum, result) => sum + result.compiles, 0)}, ` +
    `total wall: ${results.reduce((sum, result) => sum + result.wallMs, 0)}ms`);
  if (withM2c) {
    const exactM2c = [...baselines.values()].filter((baseline) => baseline.verdict === "match").length;
    console.log(`m2c baseline: ${exactM2c}/${baselines.size} byte-exact as raw drafts`);
  }
}

if (expectationFailures > 0) process.exit(1);
