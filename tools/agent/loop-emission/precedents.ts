/**
 * precedents.ts — who already produced the emission order you need.
 *
 * This project's retrieval is indexed two ways, and neither can answer that
 * question. `psx_idiom_search` matches instruction shapes, so a query over a
 * preheader returns whatever function shares its surrounding boilerplate —
 * asked about `ovl_10_func_800BA394`'s block 93 it returns two cluster-mates
 * aligned on the `FntPrint` prologue, at 55%, and neither carries the
 * mechanism. `psx_residual_signatures` indexes residual shapes, so a function
 * that matched on the first attempt was never open on any signature and is
 * absent from it entirely — which is exactly the population that *contains the
 * answers*.
 *
 * The key that finds it is the pass decision itself. `deriveRequirement` runs
 * on the target's bytes, so it runs on matched and unmatched functions alike,
 * and asking every matched function "does your preheader force an emission
 * past pass 1" takes about ninety seconds. On this tree it returns two
 * functions out of four hundred and fifteen. Five sessions of compiler
 * forensics went by without anyone asking.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../decompToolchain.js";
import { best, readLedger } from "../experimentLedger.js";
import { ensureArtifact, projectPath, stamped, writeStableJson, type EnsuredArtifact } from "../provenance.js";
import { targetProgram } from "../idiomSearch.js";
import { cachedLoopTrace } from "../loopTrace.js";
import { findCascades } from "../loop-trace/cascade.js";
import { deriveRequirement, type Pass2RouteId } from "./derive.js";
import { goalsFor } from "./compare.js";
import type { GroupRole, PreheaderRequirement } from "./types.js";

/**
 * What the C at `source` is to the preheader beside it.
 *
 * `matched` means that C provably produces those bytes. `parked` means the
 * preheader is still the target's own — it is derived from the bytes, which
 * exist whether or not anyone has matched them — but the C is an attempt that
 * does not yet reproduce it.
 *
 * Both are worth registering and they are worth different things, so the
 * difference is carried rather than smoothed away. A matched precedent is a
 * spelling to copy. A parked one is not: what it offers is the *shape*, and its
 * own loop trace, which is a measurement of which mechanisms that shape can
 * reach even though the attempt around them is wrong. Reading a parked
 * precedent as a spelling to copy would be copying a failure.
 */
export type PrecedentStatus = "matched" | "parked";

export interface Precedent {
  functionName: string;
  /** Project-relative path to the C this was read alongside. */
  source: string;
  status: PrecedentStatus;
  block: number;
  vram?: number;
  /** The preheader's group roles, in order. */
  roles: GroupRole[];
  /** Group texts, so the reader can see the shape without opening the file. */
  groups: string[];
  /** Indices of groups the ordering forces past pass 1. */
  forced: number[];
  /** Symbols of the forced groups. */
  forcedSymbols: string[];
  /**
   * Which routes to a pass-2 emission this function's own shape leaves open.
   *
   * Target-side, like everything else in the index — it is what makes the index
   * answerable for a stub and cheap for four hundred functions. `inner-cascade`
   * appearing here means the forced group sits in a nest, which is the
   * structural precondition; whether the cascade actually happened is a
   * measurement, and `measuredCascade` is where that comes from.
   */
  routes: Pass2RouteId[];
  /** Headers of loops nested inside the one this preheader feeds. */
  innerLoops: number[];
}

interface PrecedentIndex {
  precedents: Precedent[];
  scanned: number;
  withPreheaders: number;
}

/** Every source file under `src/`, matched or still a stub. */
function sourceFiles(): Array<{ name: string; path: string; stub: boolean }> {
  const directories = ["src"];
  const overlays = join(ROOT, "src/overlays");
  if (existsSync(overlays)) {
    for (const entry of readdirSync(overlays)) directories.push(`src/overlays/${entry}`);
  }
  const found: Array<{ name: string; path: string; stub: boolean }> = [];
  for (const directory of directories) {
    const absolute = join(ROOT, directory);
    if (!existsSync(absolute)) continue;
    for (const file of readdirSync(absolute)) {
      if (!file.endsWith(".c")) continue;
      const path = join(absolute, file);
      found.push({
        name: file.replace(/\.c$/, ""),
        path,
        stub: /INCLUDE_ASM/.test(readFileSync(path, "utf8")),
      });
    }
  }
  return found.sort((left, right) => left.name.localeCompare(right.name));
}

/** Every source file that is live compiled C, i.e. an already-matched function. */
export function matchedSources(): Array<{ name: string; path: string }> {
  return sourceFiles().filter((entry) => !entry.stub).map(({ name, path }) => ({ name, path }));
}

/**
 * Every function whose preheader shape is worth registering, and what its C is.
 *
 * The matched functions, plus the **parked** ones that have a preserved
 * attempt. A parked function's preheader comes off its target bytes exactly
 * like a matched one's — the derivation never reads a candidate — so excluding
 * it drops a real shape from the index for a reason that is about the tree's
 * progress rather than about the compiler. It also drops precisely the
 * population a stalled session most needs: the other function stuck on the same
 * mechanism. Two cluster-mates sat parked as complementary halves while this
 * index could see neither of them.
 */
export function precedentSources(): Array<{ name: string; path: string; status: PrecedentStatus }> {
  const found: Array<{ name: string; path: string; status: PrecedentStatus }> = [];
  for (const entry of sourceFiles()) {
    if (!entry.stub) {
      found.push({ name: entry.name, path: entry.path, status: "matched" });
      continue;
    }
    /* A stub with no preserved attempt has no C to point a reader at, and a
       precedent that names no source is a shape with nowhere to go. */
    const winner = best(readLedger(entry.name));
    if (!winner?.sourcePath) continue;
    const preserved = join(ROOT, winner.sourcePath);
    if (!existsSync(preserved)) continue;
    found.push({ name: entry.name, path: preserved, status: "parked" });
  }
  return found;
}

function scan(): PrecedentIndex {
  const precedents: Precedent[] = [];
  let scanned = 0;
  let withPreheaders = 0;

  for (const { name, path, status } of precedentSources()) {
    let requirement;
    try {
      const program = targetProgram(name);
      if (!program) continue;
      requirement = deriveRequirement(program, name);
    } catch {
      continue;
    }
    scanned++;
    if (requirement.preheaders.length > 0) withPreheaders++;

    for (const preheader of requirement.preheaders) {
      const goals = goalsFor(preheader);
      if (goals.length === 0) continue;
      const precedent: Precedent = {
        functionName: name,
        source: projectPath(path),
        status,
        block: preheader.block,
        roles: preheader.groups.map((group) => group.role),
        groups: preheader.groups.map((group) => group.text),
        forced: goals.map((goal) => goal.group.index),
        forcedSymbols: goals.map((goal) => goal.symbol),
        routes: [...new Set(goals.flatMap((goal) => goal.routes.map((route) => route.id)))],
        innerLoops: preheader.innerLoops,
      };
      if (preheader.vram !== undefined) precedent.vram = preheader.vram;
      precedents.push(precedent);
    }
  }
  return { precedents, scanned, withPreheaders };
}

/**
 * The index, rebuilt whenever the set of registered shapes changes.
 *
 * Keyed on the sources themselves: a function newly matched is a new precedent,
 * a function parked back to a stub becomes a parked one, and a parked function
 * whose best attempt changes is re-read.
 */
export function precedentIndex(): EnsuredArtifact<PrecedentIndex> {
  const artifactPath = join(ROOT, "build/loopEmission/precedents.json");
  return ensureArtifact<PrecedentIndex>({
    artifactPath,
    label: "loop-emission precedent index",
    functionName: "(corpus)",
    costHint: "scans every registered function's target bytes, about 90 seconds",
    inputs: {
      files: precedentSources().map((entry) => entry.path),
      implementation: [join(ROOT, "tools/agent/loop-emission")],
    },
    produce: (provenance) => {
      const index = scan();
      writeStableJson(artifactPath, stamped(index, provenance));
      return index;
    },
    read: (stored) => {
      const value = stored as PrecedentIndex;
      if (!Array.isArray(value?.precedents)) throw new Error("stored precedent index has no precedents");
      return value;
    },
  });
}

export interface PrecedentHit {
  precedent: Precedent;
  /** How much of the role sequence around the forced group agrees. */
  score: number;
  /** Routes this precedent and the queried preheader both leave open. */
  sharedRoutes: Pass2RouteId[];
  why: string;
  /**
   * A cascade actually observed in this precedent's own trace.
   *
   * The difference between "its shape permits the mechanism" and "its compiler
   * did the mechanism", which is the difference between a hypothesis and a
   * worked example. Absent when no fresh trace of that source is on disk —
   * absent, not assumed either way.
   */
  measuredCascade?: string;
}

/**
 * A cascade in a precedent's own loop trace, when one has already been measured.
 *
 * Never compiles: a precedent list is a survey, and a survey that costs one
 * compile per hit is a survey nobody runs. `cachedLoopTrace` re-hashes the
 * source before returning anything, so a hit here is a measurement of the file
 * as it stands.
 */
export function measuredCascade(functionName: string): string | undefined {
  const cached = cachedLoopTrace(functionName);
  if (!cached) return undefined;
  const cascades = findCascades(cached.trace);
  if (cascades.length === 0) return undefined;
  const first = cascades[0]!;
  return `pass ${first.firstPass} loop ${first.inner} hoisted insn ${first.innerInsn} into the outer body; ` +
    `pass ${first.secondPass} loop ${first.outer} re-hoisted it to the preheader` +
    `${first.symbol === undefined ? "" : ` — ${first.symbol}`}`;
}

/**
 * Precedents for one preheader, closest role-context first.
 *
 * Ranked on the roles *around* the forced group rather than on symbols or
 * instruction text: what transfers between two functions is the shape of the
 * preheader — what is invariant, what is an induction initialisation, and in
 * what order — not which globals they happen to name.
 */
export function precedentsFor(preheader: PreheaderRequirement, index: PrecedentIndex): PrecedentHit[] {
  const goals = goalsFor(preheader);
  if (goals.length === 0) return [];
  const wanted = preheader.groups.map((group) => group.role);
  const wantedRoutes = new Set(goals.flatMap((goal) => goal.routes.map((route) => route.id)));

  return index.precedents
    .map((precedent) => {
      /* Longest common run of roles, which is what "the same kind of preheader"
         means when the two functions share no symbols at all. */
      let best = 0;
      for (let here = 0; here < wanted.length; here++) {
        for (let there = 0; there < precedent.roles.length; there++) {
          let run = 0;
          while (here + run < wanted.length
            && there + run < precedent.roles.length
            && wanted[here + run] === precedent.roles[there + run]) run++;
          best = Math.max(best, run);
        }
      }
      const sharedRoutes = (precedent.routes ?? []).filter((route) => wantedRoutes.has(route));
      const hit: PrecedentHit = {
        precedent,
        score: best,
        sharedRoutes,
        why: `its block ${precedent.block} forces ${precedent.forcedSymbols.join(", ")} past pass 1; ` +
          `${best} of this preheader's ${wanted.length} group roles run in the same order there` +
          `${sharedRoutes.includes("inner-cascade") ? "; and like this one it forces that emission out of a nest" : ""}`,
      };
      const measured = measuredCascade(precedent.functionName);
      if (measured !== undefined) hit.measuredCascade = measured;
      return hit;
    })
    /* A shared route is the thing that transfers; a role run is how close the
       shape is. Rank on the route first so a worked example of the mechanism is
       not buried under a closer-looking preheader that reached it another way. */
    .filter((hit) => hit.score >= 2)
    .sort((left, right) =>
      Number(right.sharedRoutes.includes("inner-cascade")) - Number(left.sharedRoutes.includes("inner-cascade"))
      || right.score - left.score);
}
