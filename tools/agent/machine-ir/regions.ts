/**
 * Structured regions over the CFG: the shapes a C body can have.
 *
 * A region tree is what a constructor needs and a path enumeration cannot
 * give: the `if` whose two arms rejoin at a named block, the loop whose body
 * is a set of blocks and whose exits are edges, the shared tail two arms both
 * fall into. Each is derived from dominance and postdominance rather than from
 * walking paths, so a function with twenty guards produces twenty regions
 * rather than a million.
 *
 * The tree is deliberately partial. A cycle with two entries has no `while`;
 * a branch whose arms never rejoin inside the enclosing region has no `if`.
 * Those are reported as `unstructured`, with the blocks named, because the
 * useful thing to tell a constructor is *which* piece has no shape — not that
 * the function as a whole is unsupported.
 */

import type { Cfg } from "./cfg.js";
import type { Dominance, NaturalLoop } from "./dominance.js";
import { computePostDominators, findNaturalLoops, irreducibleBlocks } from "./dominance.js";

export type Region =
  /** One block and nothing else. */
  | { kind: "block"; block: number }
  /** Regions executed one after another. */
  | { kind: "sequence"; parts: Region[] }
  /**
   * A two-armed branch whose arms rejoin at `join`.
   *
   * `join` is the immediate postdominator of the branch: the first block every
   * path through either arm must reach. An arm that leaves the function
   * instead of rejoining has no region, which is the `if (x) return;` shape.
   */
  | { kind: "if"; header: number; onTrue: Region | null; onFalse: Region | null; join: number | null }
  /** A dispatch and its cases; `join` as above. */
  | { kind: "switch"; header: number; cases: Array<Region | null>; join: number | null }
  /** A natural loop: header, body region, and the edges that leave it. */
  | { kind: "loop"; header: number; body: Region; exits: Array<{ from: number; to: number }>; latches: number[] }
  /** A back edge: control returns to an enclosing loop's header. */
  | { kind: "continue"; header: number }
  /** A cycle or branch with no structured shape. The blocks are named. */
  | { kind: "unstructured"; blocks: number[]; reason: string };

export interface RegionTree {
  root: Region;
  loops: NaturalLoop[];
  /** Blocks in a cycle no natural loop covers. */
  irreducible: number[];
  /** Blocks more than one region falls into: the shared tails. */
  sharedTails: number[];
  notes: string[];
}

/**
 * The *shape* of a block's exit.
 *
 * The structure recovery only needs to know whether a block falls through,
 * tests, dispatches or ends, which the CFG already records. Reading it here
 * keeps the region builder independent of whether SSA has been built.
 */
type ExitShape =
  | { kind: "fall"; to: number }
  | { kind: "branch"; onTrue: number; onFalse: number }
  | { kind: "dispatch"; targets: number[] }
  | { kind: "end" };

function exitShape(cfg: Cfg, index: number): ExitShape {
  const block = cfg.blocks[index]!;
  if (block.terminator === "branch" && block.successors.length === 2) {
    return { kind: "branch", onTrue: block.successors[0]!, onFalse: block.successors[1]! };
  }
  if (block.terminator === "dispatch" && block.successors.length > 0) {
    return { kind: "dispatch", targets: block.successors.slice() };
  }
  if (block.successors.length === 1) return { kind: "fall", to: block.successors[0]! };
  return { kind: "end" };
}

/**
 * Build the region tree.
 *
 * The walk is a single pass over the dominator structure: at each block, if it
 * heads a loop, emit the loop and continue after its exits; if it branches,
 * emit the `if` whose arms end at the immediate postdominator and continue
 * from there; otherwise emit the block and continue to its successor.
 * Termination is by construction — each step moves strictly forward in reverse
 * postorder, or into a strictly smaller loop body.
 */
export function buildRegions(cfg: Cfg, dominance: Dominance): RegionTree {
  const loops = findNaturalLoops(cfg, dominance);
  const irreducible = irreducibleBlocks(cfg, loops);
  const ipdom = computePostDominators(cfg);
  const notes: string[] = [];

  const position = new Int32Array(cfg.blocks.length).fill(Number.MAX_SAFE_INTEGER);
  cfg.reversePostorder.forEach((block, index) => { position[block] = index; });

  const loopAt = new Map<number, NaturalLoop>();
  for (const loop of loops) {
    /* Innermost first — `loops` is sorted smallest-body-first, so the first
     * entry for a header is the tightest loop it heads. */
    if (!loopAt.has(loop.header)) loopAt.set(loop.header, loop);
  }

  const sharedTails = cfg.blocks.filter((block) => block.predecessors.length > 1).map((block) => block.index);

  /**
   * Regions from `start` up to but not including `stop`, staying inside
   * `scope` when one is given (the enclosing loop's body).
   *
   * Memoized on (start, stop, enclosing loop). Without it, an `if` whose arms
   * do not rejoin inside the current scope makes both arms expand the rest of
   * the region, and a function with a dozen such branches produces an
   * exponential tree — the very path explosion this representation exists to
   * avoid, reintroduced at the structure layer. With it, a region reachable
   * two ways is one region referenced twice.
   *
   * An in-progress key that is re-entered is a cycle no natural loop covers;
   * it becomes `unstructured` rather than recursing.
   */
  const memo = new Map<string, Region | "in-progress">();
  const build = (
    start: number,
    stop: number | null,
    scope: Set<number> | null,
    scopeHeader: number | null,
    active: Set<number>,
  ): Region => {
    const key = `${start}|${stop ?? -1}|${scopeHeader ?? -1}`;
    const cached = memo.get(key);
    if (cached === "in-progress") {
      return { kind: "unstructured", blocks: [start], reason: "re-entered outside any natural loop" };
    }
    if (cached !== undefined) return cached;
    memo.set(key, "in-progress");

    const parts: Region[] = [];
    let current: number | null = start;
    let first = true;
    while (current !== null && current !== stop) {
      if (current < 0 || current >= cfg.blocks.length) break;
      if (scope && !scope.has(current)) break;
      /* Returning to a loop header this branch is already inside is the back
       * edge. The header a body build starts at is exempt on the first step. */
      if (!first && (active.has(current) || current === scopeHeader)) break;
      first = false;

      const loop = loopAt.get(current);
      const alreadyInside = active.has(current) || (scope !== null && loop !== undefined && scope.size === loop.body.size);
      if (loop && !alreadyInside && (!scope || scope.has(current))) {
        const body = build(loop.header, null, loop.body, loop.header, new Set([...active, loop.header]));
        parts.push({ kind: "loop", header: loop.header, body, exits: loop.exits, latches: loop.latches });
        const outside = [...new Set(loop.exits.map((exit) => exit.to).filter((to) => to >= 0 && !loop.body.has(to)))];
        if (outside.length === 0) { current = null; continue; }
        if (outside.length > 1) {
          notes.push(`the loop at B${loop.header} has ${outside.length} distinct exit targets; the sequence after it is not single-entry`);
        }
        current = outside.sort((left, right) => position[left]! - position[right]!)[0]!;
        continue;
      }

      /* An edge back to an enclosing loop's header is a `continue`, not a
       * region: the repetition is the loop, and building it as a subtree would
       * either recurse or report a structure defect that is not there. */
      const arm = (target: number, join: number | null): Region | null => {
        if (target < 0 || target === join) return null;
        if (target === scopeHeader || active.has(target)) return { kind: "continue", header: target };
        return build(target, join, scope, scopeHeader, active);
      };

      const exit = exitShape(cfg, current);
      if (exit.kind === "branch") {
        const join = joinOf(current, ipdom, scope);
        const onTrue = arm(exit.onTrue, join);
        const onFalse = arm(exit.onFalse, join);
        parts.push({ kind: "if", header: current, onTrue, onFalse, join });
        current = join;
        continue;
      }

      if (exit.kind === "dispatch") {
        const join = joinOf(current, ipdom, scope);
        const cases = exit.targets.map((target) => arm(target, join));
        parts.push({ kind: "switch", header: current, cases, join });
        current = join;
        continue;
      }

      parts.push({ kind: "block", block: current });
      current = exit.kind === "fall" ? exit.to : null;
    }

    const region: Region = parts.length === 0
      ? { kind: "sequence", parts: [] }
      : parts.length === 1 ? parts[0]! : { kind: "sequence", parts };
    memo.set(key, region);
    return region;
  };

  const root = build(cfg.entry, null, null, null, new Set());

  if (irreducible.length > 0) {
    notes.push(
      `${irreducible.length} block(s) sit in a cycle with more than one entry (B${irreducible.join(", B")}); ` +
      "there is no `while` whose body they are",
    );
  }

  return { root, loops, irreducible, sharedTails, notes };
}

/** The block both arms of a branch rejoin at, or null when they do not. */
function joinOf(block: number, ipdom: Int32Array, scope: Set<number> | null): number | null {
  const join = ipdom[block];
  if (join === undefined || join < 0 || join === block) return null;
  if (scope && !scope.has(join)) return null;
  return join;
}

/**
 * Distinct regions — the number actually stored.
 *
 * A region reachable two ways is one object referenced twice, so counting by
 * identity is what measures the representation. `regionCount` below counts the
 * *expansion* instead, which is the size a naive tail-duplicating emitter
 * would produce: the gap between the two numbers is exactly how much sharing
 * the structure recovery found.
 */
export function distinctRegionCount(region: Region): number {
  const seen = new Set<Region>();
  const visit = (item: Region): void => {
    if (seen.has(item)) return;
    seen.add(item);
    switch (item.kind) {
      case "sequence": for (const part of item.parts) visit(part); return;
      case "if":
        if (item.onTrue) visit(item.onTrue);
        if (item.onFalse) visit(item.onFalse);
        return;
      case "switch": for (const part of item.cases) if (part) visit(part); return;
      case "loop": visit(item.body); return;
      default: return;
    }
  };
  visit(region);
  return seen.size;
}

/** Count the regions a tail-duplicating expansion would emit. */
export function regionCount(region: Region): number {
  switch (region.kind) {
    case "block": return 1;
    case "sequence": return 1 + region.parts.reduce((sum, part) => sum + regionCount(part), 0);
    case "if": return 1 + (region.onTrue ? regionCount(region.onTrue) : 0) + (region.onFalse ? regionCount(region.onFalse) : 0);
    case "switch": return 1 + region.cases.reduce((sum, part) => sum + (part ? regionCount(part) : 0), 0);
    case "loop": return 1 + regionCount(region.body);
    case "continue": return 1;
    case "unstructured": return 1;
  }
}

/** An indented outline of the region tree. */
export function renderRegions(region: Region, indent = ""): string[] {
  switch (region.kind) {
    case "block": return [`${indent}B${region.block}`];
    case "sequence": return region.parts.flatMap((part) => renderRegions(part, indent));
    case "if": return [
      `${indent}if B${region.header}${region.join !== null ? ` → join B${region.join}` : " (arms do not rejoin)"}`,
      ...(region.onTrue ? [`${indent}  then:`, ...renderRegions(region.onTrue, `${indent}    `)] : []),
      ...(region.onFalse ? [`${indent}  else:`, ...renderRegions(region.onFalse, `${indent}    `)] : []),
    ];
    case "switch": return [
      `${indent}switch B${region.header}${region.join !== null ? ` → join B${region.join}` : ""}`,
      ...region.cases.flatMap((part, index) => part ? [`${indent}  case ${index}:`, ...renderRegions(part, `${indent}    `)] : []),
    ];
    case "loop": return [
      `${indent}loop B${region.header} (latches B${region.latches.join(", B")}; ${region.exits.length} exit edge(s))`,
      ...renderRegions(region.body, `${indent}  `),
    ];
    case "continue": return [`${indent}continue → B${region.header}`];
    case "unstructured": return [`${indent}unstructured B${region.blocks.join(", B")}: ${region.reason}`];
  }
}
