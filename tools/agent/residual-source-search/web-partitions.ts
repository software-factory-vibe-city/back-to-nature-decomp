import { buildFlow } from "./semantic-graph.js";
import type { SemanticGraph, SemanticNode, ValueWeb, WebGroup, WebPartition } from "./types.js";

/**
 * Value-web analysis: killing definitions start webs, uses and partial
 * updates join the webs that reach them, and web live ranges support the
 * merge admissibility proofs of grammar rule 4.1.
 */

export interface WebView {
  webs: ValueWeb[];
  websById: Map<string, ValueWeb>;
  /** nodeId -> variable -> webId with the unique web reaching a use at node entry. */
  reaching: Map<string, Map<string, string>>;
  /** nodeId -> variable -> webId of the definition made at this node. */
  defWebs: Map<string, Map<string, string>>;
  caveats: string[];
}

interface UnionFind {
  parent: Map<string, string>;
}

function findRoot(uf: UnionFind, key: string): string {
  let root = key;
  while (uf.parent.get(root) !== root) root = uf.parent.get(root)!;
  let cursor = key;
  while (uf.parent.get(cursor) !== root) {
    const next = uf.parent.get(cursor)!;
    uf.parent.set(cursor, root);
    cursor = next;
  }
  return root;
}

function union(uf: UnionFind, left: string, right: string): void {
  const leftRoot = findRoot(uf, left);
  const rightRoot = findRoot(uf, right);
  if (leftRoot !== rightRoot) uf.parent.set(rightRoot, leftRoot);
}

function nodeDefs(node: SemanticNode): Array<{ variable: string; killing: boolean }> {
  return node.writes.map((variable) => ({ variable, killing: node.killingWrite && node.writes.length === 1 }));
}

export function analyzeWebs(graph: SemanticGraph): WebView {
  const flow = buildFlow(graph);
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const variableInfo = new Map(graph.variables.map((variable) => [variable.name, variable]));
  const orderIndex = new Map(flow.order.map((id, index) => [id, index]));
  const caveats: string[] = [];

  /* Forward reaching definitions. */
  const seed = new Map<string, Set<string>>();
  for (const parameter of graph.parameters) seed.set(parameter.name, new Set([`entry:${parameter.name}`]));
  for (const variable of graph.variables) {
    if (variable.kind === "local") seed.set(variable.name, new Set([`undef:${variable.name}`]));
  }

  const inSets = new Map<string, Map<string, Set<string>>>();
  const outSets = new Map<string, Map<string, Set<string>>>();
  const cloneState = (state: Map<string, Set<string>>): Map<string, Set<string>> =>
    new Map([...state].map(([variable, defs]) => [variable, new Set(defs)]));
  const mergeInto = (target: Map<string, Set<string>>, addition: Map<string, Set<string>>): boolean => {
    let changed = false;
    for (const [variable, defs] of addition) {
      let bucket = target.get(variable);
      if (!bucket) {
        bucket = new Set();
        target.set(variable, bucket);
      }
      for (const def of defs) {
        if (!bucket.has(def)) {
          bucket.add(def);
          changed = true;
        }
      }
    }
    return changed;
  };

  const predecessors = new Map<string, string[]>();
  for (const [id, targets] of flow.successors) {
    for (const target of targets) {
      const bucket = predecessors.get(target) || [];
      bucket.push(id);
      predecessors.set(target, bucket);
    }
  }

  for (const id of flow.order) {
    inSets.set(id, new Map());
    outSets.set(id, new Map());
  }
  if (flow.entry) mergeInto(inSets.get(flow.entry)!, seed);

  const statesEqual = (left: Map<string, Set<string>>, right: Map<string, Set<string>>): boolean => {
    if (left.size !== right.size) return false;
    for (const [variable, defs] of left) {
      const other = right.get(variable);
      if (!other || other.size !== defs.size) return false;
      for (const def of defs) if (!other.has(def)) return false;
    }
    return true;
  };

  let changed = true;
  while (changed) {
    changed = false;
    for (const id of flow.order) {
      const node = byId.get(id)!;
      const inState = inSets.get(id)!;
      for (const predecessor of predecessors.get(id) || []) {
        if (mergeInto(inState, outSets.get(predecessor)!)) changed = true;
      }
      /* OUT is a pure transfer of IN so killing definitions stay killing. */
      const outState = cloneState(inState);
      for (const def of nodeDefs(node)) {
        const key = `def:${id}:${def.variable}`;
        if (def.killing) outState.set(def.variable, new Set([key]));
        else {
          const bucket = outState.get(def.variable) || new Set<string>();
          bucket.add(key);
          outState.set(def.variable, bucket);
        }
      }
      if (!statesEqual(outSets.get(id)!, outState)) {
        outSets.set(id, outState);
        changed = true;
      }
    }
  }

  /* Union-find: uses and partial updates join every reaching definition. */
  const uf: UnionFind = { parent: new Map() };
  const ensure = (key: string): void => {
    if (!uf.parent.has(key)) uf.parent.set(key, key);
  };
  for (const [variable, defs] of seed) for (const def of defs) { void variable; ensure(def); }
  for (const id of flow.order) {
    const node = byId.get(id)!;
    for (const def of nodeDefs(node)) ensure(`def:${id}:${def.variable}`);
  }
  for (const id of flow.order) {
    const node = byId.get(id)!;
    const inState = inSets.get(id)!;
    const joins = new Set<string>(node.reads);
    for (const def of nodeDefs(node)) {
      if (!def.killing) joins.add(def.variable);
    }
    for (const variable of joins) {
      const reaching = [...(inState.get(variable) || [])];
      for (const key of reaching) ensure(key);
      for (let index = 1; index < reaching.length; index++) union(uf, reaching[0]!, reaching[index]!);
      for (const def of nodeDefs(node)) {
        if (!def.killing && def.variable === variable && reaching.length > 0) {
          union(uf, reaching[0]!, `def:${id}:${def.variable}`);
        }
      }
    }
  }

  /* Backward variable liveness. */
  const liveIn = new Map<string, Set<string>>(flow.order.map((id) => [id, new Set<string>()]));
  changed = true;
  while (changed) {
    changed = false;
    for (let index = flow.order.length - 1; index >= 0; index--) {
      const id = flow.order[index]!;
      const node = byId.get(id)!;
      const kills = new Set(nodeDefs(node).filter((def) => def.killing).map((def) => def.variable));
      const next = new Set<string>(node.reads);
      for (const successor of flow.successors.get(id) || []) {
        for (const variable of liveIn.get(successor) || []) {
          if (!kills.has(variable)) next.add(variable);
        }
      }
      const current = liveIn.get(id)!;
      if (next.size !== current.size || [...next].some((variable) => !current.has(variable))) {
        liveIn.set(id, next);
        changed = true;
      }
    }
  }

  /* Materialize webs per variable. */
  const rootMembers = new Map<string, Set<string>>();
  for (const key of uf.parent.keys()) {
    const root = findRoot(uf, key);
    const bucket = rootMembers.get(root) || new Set<string>();
    bucket.add(key);
    rootMembers.set(root, bucket);
  }

  const defPosition = (key: string): number => {
    if (key.startsWith("entry:")) return -2;
    if (key.startsWith("undef:")) return -1;
    const nodeId = key.split(":")[1]!;
    return orderIndex.get(nodeId) ?? Number.MAX_SAFE_INTEGER;
  };

  const variableOf = (key: string): string => key.split(":").pop()!;
  const webs: ValueWeb[] = [];
  const webOfDef = new Map<string, string>();
  const perVariable = new Map<string, Array<{ root: string; members: string[] }>>();
  for (const [root, members] of rootMembers) {
    const list = [...members];
    const variable = variableOf(list[0]!);
    const hasReal = list.some((key) => key.startsWith("def:") || key.startsWith("entry:"));
    if (!hasReal) continue;
    const bucket = perVariable.get(variable) || [];
    bucket.push({ root, members: list.sort((left, right) => defPosition(left) - defPosition(right) || left.localeCompare(right)) });
    perVariable.set(variable, bucket);
  }

  for (const [variable, groups] of [...perVariable].sort(([left], [right]) => left.localeCompare(right))) {
    groups.sort((left, right) => defPosition(left.members[0]!) - defPosition(right.members[0]!) || left.root.localeCompare(right.root));
    const info = variableInfo.get(variable);
    groups.forEach((group, webIndex) => {
      const id = `${variable}#${webIndex}`;
      const contaminated = group.members.some((key) => key.startsWith("undef:"));
      const parameterEntry = group.members.some((key) => key.startsWith("entry:"));
      const defNodes = group.members.filter((key) => key.startsWith("def:")).map((key) => key.split(":")[1]!);
      if (parameterEntry) defNodes.unshift("param-entry");
      const evidence: string[] = [];
      if (contaminated) evidence.push("A possibly uninitialized use joins this web; renaming is frozen.");
      if (info && !info.supported) evidence.push("Variable is frozen by an unsupported access.");
      if (info?.addressEscapes) evidence.push("Variable address escapes; storage identity must be preserved.");
      const web: ValueWeb = {
        id,
        variable,
        webIndex,
        defNodes,
        useNodes: [],
        typeText: (info?.typeText || "").replace(/\s+/g, " "),
        pointer: Boolean(info?.pointer),
        parameterEntry,
        liveAtNodes: [],
        renameable: Boolean(info && info.supported && !info.addressEscapes && info.typeText) && !contaminated && !parameterEntry,
        evidence,
      };
      webs.push(web);
      for (const key of group.members) webOfDef.set(key, id);
    });
    if (groups.length > 1 && info && !info.supported) {
      caveats.push(`${variable} has ${groups.length} webs but is frozen by unsupported accesses.`);
    }
  }
  const websById = new Map(webs.map((web) => [web.id, web]));

  /* Use resolution, def mapping, and web live ranges. */
  const reaching = new Map<string, Map<string, string>>();
  const defWebs = new Map<string, Map<string, string>>();
  for (const id of flow.order) {
    const node = byId.get(id)!;
    const inState = inSets.get(id)!;
    const reachingHere = new Map<string, string>();
    for (const variable of new Set([...node.reads, ...node.writes])) {
      const keys = [...(inState.get(variable) || [])];
      const webIds = new Set(keys.map((key) => webOfDef.get(key)).filter((value): value is string => Boolean(value)));
      if (webIds.size === 1) reachingHere.set(variable, [...webIds][0]!);
    }
    reaching.set(id, reachingHere);
    const defsHere = new Map<string, string>();
    for (const def of nodeDefs(node)) {
      const web = webOfDef.get(`def:${id}:${def.variable}`);
      if (web) defsHere.set(def.variable, web);
    }
    defWebs.set(id, defsHere);

    for (const variable of node.reads) {
      const web = reachingHere.get(variable);
      if (web) websById.get(web)!.useNodes.push(id);
    }
    if (!node.killingWrite || node.writes.length !== 1) {
      for (const web of defsHere.values()) websById.get(web)!.useNodes.push(id);
    }
    /* Web live range: variable live at entry and this web reaches. */
    for (const variable of liveIn.get(id)!) {
      const keys = [...(inState.get(variable) || [])];
      for (const key of keys) {
        const web = webOfDef.get(key);
        if (web) {
          const record = websById.get(web)!;
          if (!record.liveAtNodes.includes(id)) record.liveAtNodes.push(id);
        }
      }
    }
  }
  for (const web of webs) {
    web.useNodes = [...new Set(web.useNodes)].sort((left, right) => (orderIndex.get(left) ?? 0) - (orderIndex.get(right) ?? 0));
    web.liveAtNodes.sort((left, right) => (orderIndex.get(left) ?? 0) - (orderIndex.get(right) ?? 0));
  }

  return { webs, websById, reaching, defWebs, caveats };
}

/* ------------------------------------------------------------------ */
/* Canonical admissible partitions                                     */
/* ------------------------------------------------------------------ */

export interface PartitionEnumeration {
  partitions: WebPartition[];
  complete: boolean;
}

/**
 * Enumerate canonical set partitions (restricted growth strings) of the
 * given webs under a pairwise compatibility predicate. The baseline
 * partition (group by original variable) is always placed first.
 */
export function enumeratePartitions(
  webs: ValueWeb[],
  compatible: (left: ValueWeb, right: ValueWeb) => boolean,
  cap: number,
): PartitionEnumeration {
  const results: number[][] = [];
  let complete = true;
  const groups: number[][] = [];
  const rgs: number[] = [];

  const visit = (index: number): void => {
    if (!complete) return;
    if (index === webs.length) {
      if (results.length >= cap) {
        complete = false;
        return;
      }
      results.push([...rgs]);
      return;
    }
    const web = webs[index]!;
    for (let groupIndex = 0; groupIndex <= groups.length; groupIndex++) {
      if (groupIndex < groups.length) {
        const members = groups[groupIndex]!;
        if (!members.every((member) => compatible(webs[member]!, web))) continue;
        members.push(index);
        rgs.push(groupIndex);
        visit(index + 1);
        rgs.pop();
        members.pop();
      } else {
        groups.push([index]);
        rgs.push(groupIndex);
        visit(index + 1);
        rgs.pop();
        groups.pop();
      }
      if (!complete) return;
    }
  };
  if (webs.length > 0) visit(0);
  else results.push([]);

  const baselineRgs = baselinePartition(webs);
  const key = (value: number[]): string => value.join(",");
  const baselineKey = key(baselineRgs);
  const ordered = results
    .map((value) => ({ value, baseline: key(value) === baselineKey }))
    .sort((left, right) => Number(right.baseline) - Number(left.baseline) ||
      key(left.value).localeCompare(key(right.value), undefined, { numeric: true }));

  return {
    partitions: ordered.map((entry) => ({
      rgs: entry.value,
      groups: [],
      baseline: entry.baseline,
    })),
    complete,
  };
}

export function baselinePartition(webs: ValueWeb[]): number[] {
  const groupByVariable = new Map<string, number>();
  const rgs: number[] = [];
  for (const web of webs) {
    let group = groupByVariable.get(web.variable);
    if (group === undefined) {
      group = groupByVariable.size;
      groupByVariable.set(web.variable, group);
    }
    rgs.push(group);
  }
  return rgs;
}

/** Integer value ranges for representation-preserving constant materialization. */
const INTEGER_RANGES: Record<string, [number, number]> = {
  u8: [0, 255], u_char: [0, 255], "unsigned char": [0, 255],
  /* char is unsigned under the configured -funsigned-char. */
  char: [0, 255],
  s8: [-128, 127], "signed char": [-128, 127],
  u16: [0, 65535], u_short: [0, 65535], "unsigned short": [0, 65535],
  s16: [-32768, 32767], short: [-32768, 32767],
  u32: [0, 4294967295], u_long: [0, 4294967295], u_int: [0, 4294967295],
  "unsigned int": [0, 4294967295], "unsigned long": [0, 4294967295], unsigned: [0, 4294967295],
  s32: [-2147483648, 2147483647], int: [-2147483648, 2147483647], long: [-2147483648, 2147483647],
};

export function constantFitsType(value: number, typeText: string): boolean {
  const normalized = typeText.replace(/\b(?:const|volatile)\b/g, "").replace(/\s+/g, " ").trim();
  const range = INTEGER_RANGES[normalized];
  return range !== undefined && value >= range[0] && value <= range[1];
}

/** Pairwise merge admissibility per grammar rules 4.1, 4.3, and 4.7. */
export function websCompatible(left: ValueWeb, right: ValueWeb): boolean {
  if (left.variable === right.variable) return true;
  /* An administrative copy never merges with the web it copies: the copy
     statement would collapse to a self-assignment and vanish before sched1. */
  if (left.syntheticCopyOf === right.id || right.syntheticCopyOf === left.id) return false;
  const liveRight = new Set(right.liveAtNodes);
  const disjoint = !left.liveAtNodes.some((node) => liveRight.has(node));
  const syntheticLeft = left.syntheticConstant !== undefined;
  const syntheticRight = right.syntheticConstant !== undefined;
  if (syntheticLeft || syntheticRight) {
    if (!disjoint) return false;
    if (syntheticLeft && syntheticRight) return left.typeText === right.typeText;
    const solid = syntheticLeft ? right : left;
    const constant = syntheticLeft ? left : right;
    if (!leftRenameableForGrouping(solid) || solid.pointer) return false;
    return constantFitsType(constant.syntheticConstant!, solid.typeText);
  }
  if (!leftRenameableForGrouping(left) || !leftRenameableForGrouping(right)) return false;
  if (left.parameterEntry && right.parameterEntry) return false;
  if (left.typeText !== right.typeText || left.typeText.length === 0) return false;
  if (left.pointer !== right.pointer) return false;
  return disjoint;
}

function leftRenameableForGrouping(web: ValueWeb): boolean {
  /* A parameter-entry web cannot be renamed but may absorb compatible webs. */
  return web.renameable || web.parameterEntry;
}

export interface NamedPartition extends WebPartition {
  /** webId -> rendered group name. */
  nameOf: Map<string, string>;
}

/**
 * Deterministic canonical naming: parameter groups keep the parameter name,
 * groups holding a variable's first web keep the variable name, and later
 * webs get a fresh derived name that cannot collide.
 */
export function nameGroups(
  rgs: number[],
  webs: ValueWeb[],
  reservedNames: Set<string>,
): WebGroup[] | undefined {
  const groupCount = rgs.length === 0 ? 0 : Math.max(...rgs) + 1;
  const members: number[][] = Array.from({ length: groupCount }, () => []);
  rgs.forEach((group, index) => members[group]!.push(index));
  const used = new Set(reservedNames);
  const groups: WebGroup[] = [];
  for (const groupMembers of members) {
    const memberWebs = groupMembers.map((index) => webs[index]!);
    const parameterWebs = memberWebs.filter((web) => web.parameterEntry);
    if (parameterWebs.length > 1) return undefined;
    let name: string | undefined;
    let parameterName: string | undefined;
    if (parameterWebs.length === 1) {
      name = parameterWebs[0]!.variable;
      parameterName = name;
    } else {
      const firstWeb = memberWebs.find((web) => web.webIndex === 0 && !web.parameterEntry);
      if (firstWeb && !used.has(firstWeb.variable)) name = firstWeb.variable;
      else {
        const earliest = memberWebs[0]!;
        let candidate = `${earliest.variable}_${earliest.webIndex}`;
        let suffix = 2;
        while (used.has(candidate)) candidate = `${earliest.variable}_${earliest.webIndex}_${suffix++}`;
        name = candidate;
      }
    }
    if (used.has(name) && parameterName === undefined) return undefined;
    used.add(name);
    /* Merged groups keep the concrete member type; a synthetic constant's
       canonical fresh type applies only when the group is synthetic-only. */
    const solidMember = memberWebs.find((web) => web.syntheticConstant === undefined);
    const group: WebGroup = {
      name,
      webIds: memberWebs.map((web) => web.id),
      typeText: (solidMember ?? memberWebs[0]!).typeText,
    };
    if (parameterName !== undefined) group.parameterName = parameterName;
    groups.push(group);
  }
  return groups;
}
