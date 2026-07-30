import type { SemanticNode } from "./types.js";

/**
 * Dependency-valid statement orders (grammar rule 4.2): conservative scalar,
 * memory, and barrier dependencies derived under the active web partition,
 * with exact linear-extension counting, ranking, and unranking.
 */

export const MAX_REGION_NODES = 16;

export type MemoryNamespace = "field" | "object" | "element" | "global" | "unknown";

export interface MemoryEffect {
  token: string;
  namespace: MemoryNamespace;
  key: string;
  field?: string;
  /** Web ids of local base variables at this node (identity of the pointed-to object). */
  baseWebs: string[];
  /** Global identifiers appearing in the object key. */
  globals: string[];
}

export interface RegionNodeView {
  id: string;
  node: SemanticNode;
  /** Effective scalar reads/writes as partition group names. */
  reads: Set<string>;
  writes: Set<string>;
  memoryReads: MemoryEffect[];
  memoryWrites: MemoryEffect[];
}

export function parseMemoryToken(
  token: string,
  webOfVariable: (variable: string) => string | undefined,
  isVariable: (name: string) => boolean,
): MemoryEffect {
  if (token === "*unknown*") return { token, namespace: "unknown", key: "", baseWebs: [], globals: [] };
  const match = token.match(/^(field|object|element|global):(.*)$/);
  if (!match) return { token, namespace: "unknown", key: "", baseWebs: [], globals: [] };
  const namespace = match[1] as MemoryNamespace;
  let key = match[2]!;
  let field: string | undefined;
  if (namespace === "field") {
    const split = key.lastIndexOf(":");
    field = key.slice(split + 1);
    key = key.slice(0, split);
  }
  const identifiers = [...new Set([...key.matchAll(/\b[A-Za-z_]\w*\b/g)].map((item) => item[0]!))];
  const baseWebs = identifiers
    .filter((name) => isVariable(name))
    .map((name) => webOfVariable(name) ?? `?:${name}`)
    .sort();
  const globals = namespace === "global"
    ? [key]
    : identifiers.filter((name) => !isVariable(name)).sort();
  const effect: MemoryEffect = { token, namespace, key, baseWebs, globals };
  if (field !== undefined) effect.field = field;
  return effect;
}

function shareBase(left: MemoryEffect, right: MemoryEffect): boolean {
  return left.baseWebs.some((web) => right.baseWebs.includes(web)) ||
    left.globals.some((name) => right.globals.includes(name));
}

/**
 * Conservative may-alias test for two memory effects where at least one
 * writes. Distinct named fields of one identical object commute; everything
 * sharing a base object or global is ordered; effects with provably distinct
 * named bases rely on the recorded non-aliasing assumption.
 */
export function memoryEffectsConflict(left: MemoryEffect, right: MemoryEffect): boolean {
  if (left.namespace === "unknown" || right.namespace === "unknown") return true;
  if (left.namespace === "global" && right.namespace === "global") return left.key === right.key;
  if (left.namespace === "global") return right.globals.includes(left.key);
  if (right.namespace === "global") return left.globals.includes(right.key);
  const sameObject = left.key === right.key &&
    left.baseWebs.join(",") === right.baseWebs.join(",") &&
    !left.baseWebs.some((web) => web.startsWith("?:"));
  if (left.namespace === "field" && right.namespace === "field" && sameObject) {
    return left.field === right.field;
  }
  if (left.namespace === "element" && right.namespace === "element" && sameObject) return true;
  if (sameObject) return true;
  return shareBase(left, right);
}

function nodesConflict(left: RegionNodeView, right: RegionNodeView): { conflict: boolean; kind?: string } {
  for (const write of left.writes) {
    if (right.reads.has(write)) return { conflict: true, kind: `raw:${write}` };
    if (right.writes.has(write)) return { conflict: true, kind: `waw:${write}` };
  }
  for (const write of right.writes) {
    if (left.reads.has(write)) return { conflict: true, kind: `war:${write}` };
  }
  for (const leftEffect of left.memoryWrites) {
    for (const rightEffect of [...right.memoryReads, ...right.memoryWrites]) {
      if (memoryEffectsConflict(leftEffect, rightEffect)) return { conflict: true, kind: `memory:${leftEffect.token}` };
    }
  }
  for (const rightEffect of right.memoryWrites) {
    for (const leftEffect of left.memoryReads) {
      if (memoryEffectsConflict(leftEffect, rightEffect)) return { conflict: true, kind: `memory:${rightEffect.token}` };
    }
  }
  return { conflict: false };
}

export interface RegionDependency {
  from: string;
  to: string;
  kind: string;
}

/** Precedence edges among region nodes given in original program order. */
export function regionDependencies(views: RegionNodeView[]): RegionDependency[] {
  const edges: RegionDependency[] = [];
  for (let left = 0; left < views.length; left++) {
    for (let right = left + 1; right < views.length; right++) {
      const result = nodesConflict(views[left]!, views[right]!);
      if (result.conflict) edges.push({ from: views[left]!.id, to: views[right]!.id, kind: result.kind! });
    }
  }
  return edges;
}

export class RegionTooLargeError extends Error {
  constructor(readonly nodeCount: number) {
    super(`region with ${nodeCount} reorderable nodes exceeds the exact-counting bound of ${MAX_REGION_NODES}`);
  }
}

/**
 * Exact linear-extension model over one region. `preds[i]` is the bitmask of
 * nodes that must precede node `i`. Enumeration order is deterministic: the
 * original order always has rank 0.
 */
export class RegionOrderModel {
  private counts: bigint[] | undefined;

  constructor(readonly size: number, readonly preds: number[]) {
    if (size > MAX_REGION_NODES) throw new RegionTooLargeError(size);
  }

  static fromDependencies(ids: string[], edges: RegionDependency[]): RegionOrderModel {
    const index = new Map(ids.map((id, position) => [id, position]));
    const preds = ids.map(() => 0);
    for (const edge of edges) {
      const from = index.get(edge.from);
      const to = index.get(edge.to);
      if (from === undefined || to === undefined) continue;
      preds[to] = preds[to]! | (1 << from);
    }
    return new RegionOrderModel(ids.length, preds);
  }

  /** Project the model onto the nodes outside `removeMask` (removed nodes must have no predecessors). */
  withRemoved(removeMask: number): { model: RegionOrderModel; kept: number[] } {
    const kept: number[] = [];
    for (let index = 0; index < this.size; index++) {
      if ((removeMask & (1 << index)) === 0) kept.push(index);
    }
    const remap = new Map(kept.map((original, compressed) => [original, compressed]));
    const preds = kept.map((original) => {
      let mask = 0;
      let bits = this.preds[original]!;
      while (bits !== 0) {
        const bit = bits & -bits;
        bits ^= bit;
        const predecessor = Math.log2(bit) | 0;
        const compressed = remap.get(predecessor);
        if (compressed !== undefined) mask |= 1 << compressed;
      }
      return mask;
    });
    return { model: new RegionOrderModel(kept.length, preds), kept };
  }

  private table(): bigint[] {
    if (this.counts) return this.counts;
    const total = 1 << this.size;
    const counts = new Array<bigint>(total).fill(0n);
    counts[0] = 1n;
    for (let mask = 1; mask < total; mask++) {
      let sum = 0n;
      for (let node = 0; node < this.size; node++) {
        const bit = 1 << node;
        if ((mask & bit) === 0) continue;
        /* node can be placed last among `mask` when no successor... use the
           dual: node is placeable FIRST when preds are outside mask; count by
           first-placement recursion on the remaining set. */
        if ((this.preds[node]! & mask) !== 0) continue;
        sum += counts[mask ^ bit]!;
      }
      counts[mask] = sum;
    }
    this.counts = counts;
    return counts;
  }

  count(): bigint {
    return this.table()[(1 << this.size) - 1]!;
  }

  unrank(rank: bigint): number[] {
    const counts = this.table();
    let mask = (1 << this.size) - 1;
    let remaining = rank;
    const order: number[] = [];
    while (mask !== 0) {
      let placed = false;
      for (let node = 0; node < this.size; node++) {
        const bit = 1 << node;
        if ((mask & bit) === 0) continue;
        if ((this.preds[node]! & mask) !== 0) continue;
        const subCount = counts[mask ^ bit]!;
        if (remaining < subCount) {
          order.push(node);
          mask ^= bit;
          placed = true;
          break;
        }
        remaining -= subCount;
      }
      if (!placed) throw new Error("rank exceeds the number of linear extensions");
    }
    return order;
  }

  rank(order: number[]): bigint {
    const counts = this.table();
    let mask = (1 << this.size) - 1;
    let rank = 0n;
    for (const chosen of order) {
      for (let node = 0; node < this.size; node++) {
        const bit = 1 << node;
        if ((mask & bit) === 0) continue;
        if ((this.preds[node]! & mask) !== 0) continue;
        if (node === chosen) break;
        rank += counts[mask ^ bit]!;
      }
      mask ^= 1 << chosen;
    }
    return rank;
  }
}
