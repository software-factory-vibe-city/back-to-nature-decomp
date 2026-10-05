import { createHash } from "node:crypto";
import type { Prototype } from "../calleeTruth.js";
import { baseBias } from "./summary.js";
import { endpointKey, type EvidenceGraph, type Fact, type Constraint, type Propagation, type Endpoint, type InferenceInput } from "./model.js";
const identity = (x: unknown) => createHash("sha256").update(JSON.stringify(x)).digest("hex").slice(0, 24);
import { inspectType } from "./c-types.js";
const typeKey = (type: string, scope: string) => { const info = inspectType(type); return `${info.scopeSensitive ? scope : "word"}:${info.key}`; };

/** Tarjan SCCs over call dependencies, deterministic bottom-up order. */
export function components(graph: EvidenceGraph): string[][] {
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  const indices = new Map<string, number>(), low = new Map<string, number>(), stack: string[] = [], active = new Set<string>();
  const result: string[][] = []; let sequence = 0;
  const visit = (id: string) => {
    indices.set(id, sequence); low.set(id, sequence++); stack.push(id); active.add(id);
    for (const dest of [...new Set(nodes.get(id)!.calls.flatMap((c) => c.targets))].sort()) {
      if (!nodes.has(dest)) continue;
      if (!indices.has(dest)) { visit(dest); low.set(id, Math.min(low.get(id)!, low.get(dest)!)); }
      else if (active.has(dest)) low.set(id, Math.min(low.get(id)!, indices.get(dest)!));
    }
    if (low.get(id) === indices.get(id)) {
      const component: string[] = []; let next: string;
      do { next = stack.pop()!; active.delete(next); component.push(next); } while (next !== id);
      result.push(component.sort());
    }
  };
  for (const id of [...nodes.keys()].sort()) if (!indices.has(id)) visit(id);
  return result;
}

/** Monotone worklist over (endpoint, constraint, seed, condition). Provenance
 * is a finite parent DAG. No traversal-order winner and no expanding paths. */
export function propagate(graph: EvidenceGraph, externalSeed: (name: string) => Prototype | undefined = () => undefined): Propagation {
  const sccs = components(graph), rank = new Map(sccs.flatMap((scc, i) => scc.map((id) => [id, i] as const)));
  const live = new Set(graph.nodes.flatMap((n) => n.slots.filter((s) => s.used).map((s) => endpointKey({ function: n.id, value: s.value }))));
  const liveParents = new Map<string, string[]>();
  for (const relation of graph.relations) {
    const key = endpointKey(relation.to);
    liveParents.set(key, [...(liveParents.get(key) ?? []), endpointKey(relation.from)]);
  }
  const liveQueue = [...live];
  let steps = 0, liveStopped = false;
  for (let cursor = 0; cursor < liveQueue.length && !liveStopped; cursor++) {
    for (const parent of liveParents.get(liveQueue[cursor]!) ?? []) {
      if (steps >= graph.bounds.propagationSteps) { liveStopped = true; break; }
      steps++;
      if (!live.has(parent)) { live.add(parent); liveQueue.push(parent); }
    }
  }
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  const facts = new Map<string, Fact>(), queue: Fact[] = [];
  const add = (endpoint: Endpoint, constraint: Constraint, seed: string, via: Fact["via"], conditional?: string) => {
    const key = identity([endpointKey(endpoint), constraint, seed, conditional ?? ""]);
    if (facts.has(key)) return;
    const fact: Fact = { id: key, endpoint, constraint, seed, via, ...(conditional ? { conditional } : {}) };
    facts.set(key, fact); queue.push(fact);
  };
  const typed = (endpoint: Endpoint, type: string | undefined, scope: string, seed: string, conditional?: string, typeIdentity?: string) => {
    if (type && !inspectType(type).void && inspectType(type).abiWords !== 2) add(endpoint, { kind: "type-use", type, scope, ...(typeIdentity ? { identity: typeIdentity } : {}) }, seed, null, conditional);
  };
  for (const node of [...graph.nodes].sort((a, b) => (rank.get(a.id)! - rank.get(b.id)!) || a.id.localeCompare(b.id))) {
    const report = node.report;
    if (node.seed) {
      for (const [parameter, type] of (node.seed.paramTypes ?? []).entries()) {
        const slot = node.seed.slots?.[parameter];
        for (const formal of node.slots.filter((s) => s.slot === slot && (s.used || live.has(endpointKey({ function: node.id, value: s.value })))))
          typed({ function: node.id, value: formal.value }, type, node.seed.where, `${node.seed.where}:${node.seed.line}:${node.name}:parameter-${parameter}`, undefined, node.seed.typeScopes?.parameters[parameter]);
      }
      if (node.seed.returnType && inspectType(node.seed.returnType).word)
        for (const value of node.returns) typed({ function: node.id, value }, node.seed.returnType, node.seed.where, `${node.seed.where}:${node.seed.line}:${node.name}:result`, undefined, node.seed.typeScopes?.result);
    }
    const address = (value: number, width: number, signed: boolean | null, access: "load" | "store", at?: number) => {
      const p = baseBias(report, value);
      let base = value, offset = 0;
      if (p?.base.startsWith("entry:")) {
        const formal = report.ir.values.find((v) => v.op.kind === "entry" && `entry:${v.op.register}` === p.base);
        if (formal) { base = formal.id; offset = p.bias; }
      }
      /* Stack dereferences are not evidence that a C argument is a pointer. */
      if (p?.base === "entry:sp") return;
      add({ function: node.id, value: base }, { kind: "address-use", offset, width, signed, access }, `original:${node.id}:0x${at?.toString(16)}:${access}`, null);
    };
    for (const v of report.ir.values) if (v.op.kind === "load") address(v.op.address, v.op.width, v.op.signed, "load", v.vram);
    for (const e of report.ir.effects) if (e.op.kind === "store") address(e.op.address, e.op.width, null, "store", e.vram);
    for (const call of node.calls) {
      /* A closed target set admits a universal meet of independent declared
         contracts. An open remainder forbids this, however many targets agree. */
      if (call.closed && call.targets.length > 1) {
        const contracts = call.targets.map((target) => nodes.get(target)?.seed ?? externalSeed(target.split(":").slice(1).join(":")));
        if (contracts.every((c): c is Prototype => !!c)) {
          const witnesses = contracts.map((c, i) => `${call.targets[i]}@${c.where}:${c.line}`).join(";");
          for (const slot of call.args.keys()) {
            const types = contracts.map((c) => { const parameter = c.slots?.indexOf(slot) ?? -1; return parameter < 0 ? undefined : c.paramTypes?.[parameter]; });
            const identities = contracts.map((c) => c.typeScopes?.parameters[c.slots?.indexOf(slot) ?? -1] ?? c.where);
            if (!types[0] || !types.every((type, i) => type && typeKey(type, identities[i]!) === typeKey(types[0]!, identities[0]!))) continue;
            const actual = call.args[slot];
            if (actual !== null && actual !== undefined) typed({ function: node.id, value: actual }, types[0], contracts[0]!.where,
              `all-target formal meet:${call.id}:slot-${slot}:${witnesses}`, undefined, identities[0]);
          }
          const types = contracts.map((c) => c.returnType);
          if (types[0] && inspectType(types[0]).word && types.every((type, i) => type && typeKey(type, contracts[i]!.typeScopes?.result ?? contracts[i]!.where) === typeKey(types[0]!, contracts[0]!.typeScopes?.result ?? contracts[0]!.where)))
            for (const result of call.results) typed({ function: node.id, value: result }, types[0], contracts[0]!.where,
              `all-target result meet:${call.id}:${witnesses}`, undefined, contracts[0]!.typeScopes?.result);
        }
      }
    }
    for (const call of node.calls) for (const target of call.targets) {
      const contract = nodes.get(target)?.seed ?? externalSeed(target.split(":").slice(1).join(":"));
      if (!contract) continue;
      const conditional = call.closed && call.targets.length === 1 ? undefined : `${call.id} targets ${target}`;
      for (const [parameter, type] of (contract.paramTypes ?? []).entries()) {
        const slot: number | null | undefined = contract.slots?.[parameter];
        const actual = slot === null || slot === undefined ? undefined : call.args[slot];
        const originalCallee = nodes.get(target);
        if (originalCallee && !originalCallee.slots.some((s) => s.slot === slot && (s.used || live.has(endpointKey({ function: originalCallee.id, value: s.value }))))) continue;
        if (actual !== undefined && actual !== null && report.ir.values[actual]?.op.kind !== "call-result")
          typed({ function: node.id, value: actual }, type, contract.where, `${contract.where}:${contract.line}:${target}:parameter-${parameter}:call-0x${call.at.toString(16)}`, conditional, contract.typeScopes?.parameters[parameter]);
      }
      if (contract.returnType && inspectType(contract.returnType).word)
        for (const value of call.results) typed({ function: node.id, value }, contract.returnType, contract.where,
          `${contract.where}:${contract.line}:${target}:result:call-0x${call.at.toString(16)}`, conditional, contract.typeScopes?.result);
    }
  }
  const relations = new Map<string, Array<{ relation: EvidenceGraph["relations"][number]; direction: "forward" | "reverse" }>>();
  for (const relation of graph.relations) {
    for (const [e, direction] of [[relation.from, "forward"], [relation.to, "reverse"]] as const)
      relations.set(endpointKey(e), [...(relations.get(endpointKey(e)) ?? []), { relation, direction }]);
  }
  let stopped = liveStopped;
  /* Facts propagate backward from a phi use to every input. Forward facts from
     one branch remain conditional; only a meet over ALL phi inputs could make
     them unconditional. We don't pretend a union is that meet. */
  while (queue.length && steps < graph.bounds.propagationSteps) {
    const fact = queue.shift()!;
    for (const { relation, direction } of relations.get(endpointKey(fact.endpoint)) ?? []) {
      if (steps >= graph.bounds.propagationSteps) { stopped = true; break; }
      steps++;
      const dest = direction === "forward" ? relation.to : relation.from;
      const sourceValue = nodes.get(fact.endpoint.function)?.report.ir.values[fact.endpoint.value];
      /* Constants are polymorphic uses, not one shared C variable: passing 10
         to an s16 and an s32 parameter must not equate those formals. */
      if (sourceValue?.op.kind === "const" && relation.rule === "argument" && direction === "forward") continue;
      if (relation.rule === "phi-input" && direction === "forward") continue;
      /* Chained dispatch conditions are not silently intersected into a proof.
         Preserve the per-target fact, but stop across a different open edge. */
      if (fact.conditional && relation.conditional && fact.conditional !== relation.conditional) continue;
      add(dest, fact.constraint, fact.seed, { parent: fact.id, relation: relation.id, direction }, fact.conditional ?? relation.conditional);
    }
    if (stopped) break;
  }
  const byEndpoint = new Map<string, Fact[]>();
  for (const fact of facts.values()) if (!fact.conditional) byEndpoint.set(endpointKey(fact.endpoint), [...(byEndpoint.get(endpointKey(fact.endpoint)) ?? []), fact]);
  const conflicts: Propagation["conflicts"] = [];
  for (const [endpoint, list] of byEndpoint) {
    const first = list[0]!;
    if (nodes.get(first.endpoint.function)?.report.ir.values[first.endpoint.value]?.op.kind === "const") continue;
    const types = list.filter((f) => f.constraint.kind === "type-use");
    if (new Set(types.map((f) => f.constraint.kind === "type-use" ? typeKey(f.constraint.type, f.constraint.identity ?? f.constraint.scope) : "")).size > 1)
      conflicts.push({ endpoint, facts: types.map((f) => f.id).sort() });
  }
  const incomplete = stopped || queue.length > 0 || !graph.indexComplete || graph.frontier.length > 0;
  const unresolved: Propagation["unresolved"] = [];
  for (const node of graph.nodes) {
    for (const slot of [...node.slots.filter((s) => s.used).map((s) => ({ label: s.slot as number | "return", value: s.value })),
      ...(!node.seed?.returnsVoid ? node.returns.map((value) => ({ label: "return" as const, value })) : [])]) {
      const key = endpointKey({ function: node.id, value: slot.value });
      if (conflicts.some((c) => c.endpoint === key)) unresolved.push({ node: node.id, slot: slot.label, outcome: "conflict", reason: "incompatible type-use requirements under a single uncast representation; conversion/separate-view alternatives remain, both seeds retained" });
      else if (!(byEndpoint.get(key) ?? []).some((f) => f.constraint.kind === "type-use")) {
        const opaque = node.report.ir.values[slot.value]?.op.kind === "opaque";
        const dispatch = node.calls.find((c) => !c.closed && c.through === slot.value);
        unresolved.push({ node: node.id, slot: slot.label, outcome: opaque ? "unsupported" : incomplete ? "budget/input-incomplete" : "fixed-point-unresolved",
          reason: opaque ? "opaque SSA value blocks this relation" : dispatch ? `open callback at 0x${dispatch.at.toString(16)}: a supplied target cannot establish the whole callable contract or its ignored result; ${dispatch.remainder.join("; ")}` : "no unconditional declared type reached this live value; width/address facts are partial, not a complete source contract" });
      }
    }
  }
  return { status: stopped || queue.length ? "budget-incomplete" : "fixed-point", steps, components: sccs,
    facts: [...facts.values()].sort((a, b) => a.id.localeCompare(b.id)), conflicts: conflicts.sort((a, b) => a.endpoint.localeCompare(b.endpoint)), unresolved };
}

/** Native m2c receives PARTIAL word-slot constraints, never fabricated complete
 * signatures/void/arity. Type objects are declared carriers in the context. */
export function inferenceInput(graph: EvidenceGraph, propagation: Propagation): { input: InferenceInput; carriers: Array<{ name: string; type: string; scope: string }> } {
  const input: InferenceInput = { version: 1, functions: {}, openTables: Object.fromEntries(graph.nodes.flatMap((n) => n.calls
    .filter((c) => c.table && !c.closed).map((c) => [c.table!.split(":").slice(1).join(":"), c.remainder]))) }, carriers: Array<{ name: string; type: string; scope: string }> = [];
  const carrier = (type: string, scope: string, typeIdentity = scope): { type: string } => {
    const name = `M2C_constraint_${identity([typeIdentity, type])}`;
    if (!carriers.some((item) => item.name === name)) carriers.push({ name, type, scope });
    return { type: name };
  };
  const get = (node: string, value: number): { type?: string; pointer?: boolean } | undefined => {
    const key = endpointKey({ function: node, value });
    if (propagation.conflicts.some((c) => c.endpoint === key)) return undefined;
    const facts = propagation.facts.filter((f) => endpointKey(f.endpoint) === key && !f.conditional);
    const typed = facts.find((f) => f.constraint.kind === "type-use");
    if (typed?.constraint.kind === "type-use") {
      const c = typed.constraint;
      return carrier(c.type, c.scope, c.identity);
    }
    if (facts.some((f) => f.constraint.kind === "address-use")) return { pointer: true };
    return undefined;
  };
  for (const node of graph.nodes) {
    if (node.seed && !node.seed.usedParameters?.some((used) => !used)) continue; /* complete observable contract in context */
    const fn: InferenceInput["functions"][string] = { slots: {} };
    const openTargetSlots = node.slots.filter((formal) => node.calls.some((call) => !call.closed && call.through === formal.value)).map((formal) => formal.slot);
    if (openTargetSlots.length) fn.openTargetSlots = [...new Set(openTargetSlots)].sort((a, b) => a - b);
    for (const formal of node.slots) {
      if (node.seed) {
        /* The audited declaration owns a seeded value's representation. Other
           uses may demand conversions; they cannot erase or replace this type.
           Unread source parameters remain absent from the inference floor. */
        const parameter = node.seed.slots?.indexOf(formal.slot) ?? -1;
        const type = node.seed.paramTypes?.[parameter];
        if (parameter >= 0 && node.seed.usedParameters?.[parameter] && type)
          fn.slots[String(formal.slot)] = carrier(type, node.seed.where, node.seed.typeScopes?.parameters[parameter]);
      } else {
        const constraint = get(node.id, formal.value);
        if (formal.used || constraint) fn.slots[String(formal.slot)] = constraint ?? {}; /* preserve holes & floor */
      }
    }
    if (!node.seed) {
      const results = node.returns.map((v) => get(node.id, v));
      if (results.length && results.every((r) => r && JSON.stringify(r) === JSON.stringify(results[0]))) fn.result = results[0]!;
    }
    if (Object.keys(fn.slots).length || fn.result) input.functions[node.name] = fn;
  }
  return { input, carriers: carriers.sort((a, b) => a.name.localeCompare(b.name)) };
}
