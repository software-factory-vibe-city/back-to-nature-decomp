/** Align by proven value identity, not by hard-register name. Advice is a
 * source experiment, never an assertion about the lost source. Ambiguous
 * multiplicities/joins stay outside the actionable fact set. */
import type { Web, WebPartition } from "./webPartition.js";
import type { CandidatePartition, ExplicitHardLifetime, PseudoWeb } from "./candidateWebPartition.js";
import type { LifetimeRange } from "../agent/compiler-trace/types.js";
import { certifyCopyContractions, certifyRoleFusions } from "./webPartitionProof.js";
export type MismatchClass = "fused" | "split" | "weight" | "birth" | "residence" | "entry-web" | "free-copy";
export interface Citation { path: string; kind: "closure" | "measured-precedent"; detail: string }
export interface Directive { text: string; confidence: "hypothesis"; mechanismSheet: string; citations: Citation[]; verification: string }
export interface WebFact {
  id: string; class: MismatchClass; identity: string; targetWebs: string[]; candidateWebs: string[];
  confidence: "observed" | "undetermined";
  relation: "same-value" | "copy-point" | "expression-roles";
  evidence: string[]; directive: Directive;
}
/** Correct-web/different-scratch assignment is NOT a spelling fact or progress
 * metric. It belongs to allocator analysis; attach reconstructed dump evidence
 * so a register-only near miss does not disappear into unknown identity noise. */
export interface AssignmentDiagnostic {
  identity: string; description: string; targetWeb: string; candidateWeb: string;
  targetRegister: string; candidateRegister: string; unchangedGeometry: boolean;
  pseudo: PseudoWeb | null;
  overlaps: Array<{
    hard: ExplicitHardLifetime; role: LifetimeRange;
    requiredRelation: { beforeUid: number; afterUid: number } | null;
  }>;
}
export interface PartitionDiff {
  schemaVersion: 1; facts: WebFact[]; assignments: AssignmentDiagnostic[];
  undetermined: Array<{ identity: string; reason: string }>;
  exactObservedPartition: boolean;
}
export interface WeightWitness {
  targetHash: string; candidateHash: string; identity: string; pseudo: number;
  minimumReferences: number; liveLength: number; artifact: string;
}
const precedents: Record<MismatchClass, { sheet: string; citations: Citation[]; text: string }> = {
  fused: { sheet: "allocation", text: "Give the second role a named typed temporary at the observed copy point; preserve its actual view/consumer, not a differently spelled alias. CSE may erase an alias: verify the new web.", citations: [{ path: "notes/human-needed-approvals/func_80017F30.md", kind: "measured-precedent", detail: "Raw and loop-carried roles must be distinct; aliases alone are not sufficient." }] },
  split: { sheet: "allocation", text: "Try merging the locals carrying this value into one reused variable; preserve their nonoverlapping roles and all effects.", citations: [{ path: "notes/human-needed-approvals/ovl_11_func_800F8B4C.md", kind: "closure", detail: "Contains the 800DBD78 donor diff merging var_v1_2 into var_v1." }] },
  weight: { sheet: "allocation", text: "Confirm the required weighted-reference/live-length threshold with psx_allocator_counterfactual before changing textual references. Machine operands cannot prove a REG_N_REFS threshold; do not introduce asm or a phantom use.", citations: [{ path: "notes/research/func_8001E340-index-allocno-asm-reference.md", kind: "measured-precedent", detail: "7 to >=8 holds only at the measured live geometry; its asm closure is not a clean-C recipe." }] },
  birth: { sheet: "schedule", text: "Try moving this value's binding statement across the named other binding; for a constant, bind a local before the loop. Check loop emission and scheduling before attributing machine birth order to source order.", citations: [{ path: "notes/human-needed-approvals/ovl_11_func_800F3EF0.md", kind: "measured-precedent", detail: "The 999 constant's birth position is a measured requirement, not proof of an original declaration." }] },
  residence: { sheet: "allocation", text: "Name the local whose high-half/value must survive the indicated call; keep high-half and full-pointer consumers distinct. Do not pin a hard register.", citations: [{ path: "notes/human-needed-approvals/ovl_11_func_800F8B4C.md", kind: "measured-precedent", detail: "High-half residence across calls; final workaround is not original-source evidence." }] },
  "entry-web": { sheet: "declarations", text: "Route to psx_scan_read_before_def and the nested-function/TU-context census. An unexplained entry value is not a respelling problem; check static-chain and file-scope-register evidence.", citations: [{ path: "notes/research/func_8001E9F8.md", kind: "measured-precedent", detail: "TU-wide register-context hypothesis." }] },
  "free-copy": { sheet: "allocation", text: "Heavyweight reload-equivalence candidate: do not add held locals. Check single-set REG_EQUIV and the lreg -> greg copy delta; bytes alone cannot certify zero-cost reload rematerialization.", citations: [{ path: "notes/research/func_80012598.md", kind: "measured-precedent", detail: "14 copies appear at reload; multi-set C copies hold registers and are not equivalent." }] },
};
function directive(kind: MismatchClass): Directive {
  const p = precedents[kind];
  return { text: p.text, confidence: "hypothesis", mechanismSheet: `psx_reference ${p.sheet}`, citations: p.citations, verification: "Suggestion only: compile complete clean C, measure the named web fact, then confirm relocated bytes and make check." };
}
const saved = (w: Web): boolean => w.residences.some(r => /^(s[0-7]|fp)$/.test(r.register));
const groups = (p: WebPartition): Map<string, Web[]> => {
  const m = new Map<string, Web[]>();
  for (const w of p.webs) if (w.identity && w.status === "proven") { const ws = m.get(w.identity.key) ?? []; ws.push(w); m.set(w.identity.key, ws); }
  return m;
};
const signature = (p: WebPartition): string => JSON.stringify({ webs: p.webs, copies: p.copies, transitions: p.transitions });
const scratch = (register: string): boolean => /^(v[01]|a[0-3]|t[0-9])$/.test(register);
function assignmentDiagnostic(t: Web, c: Web, candidate: WebPartition | CandidatePartition): AssignmentDiagnostic | null {
  if (t.residences.length !== 1 || c.residences.length !== 1) return null;
  const tr = t.residences[0]!, cr = c.residences[0]!;
  if (tr.register === cr.register || !scratch(tr.register) || !scratch(cr.register)) return null;
  const matching = "pseudoWebs" in candidate ? candidate.pseudoWebs.filter(p => p.attribution !== "undetermined" && p.machineWebs.length === 1 && p.machineWebs[0] === c.id && p.hardRegister === cr.register) : [];
  const pseudo = matching.length === 1 ? matching[0]! : null;
  const overlaps: AssignmentDiagnostic["overlaps"] = [];
  if (pseudo && "hardRegisterLifetimes" in candidate) for (const role of pseudo.lifetimes) for (const hard of candidate.hardRegisterLifetimes) {
    // Endpoint coincidence alone is not proof of a conflict (e.g. a dying
    // source and newly born destination of one coalescible copy).
    if (hard.registerName !== tr.register || role.block !== hard.block || hard.birthIndex >= role.deathIndex || role.birthIndex >= hard.deathIndex) continue;
    let requiredRelation: AssignmentDiagnostic["overlaps"][number]["requiredRelation"] = null;
    if (role.birthIndex < hard.birthIndex && hard.birthIndex < role.deathIndex && role.deathUid !== undefined && hard.birthUid !== undefined && !role.liveOut && !hard.liveIn) requiredRelation = { beforeUid: role.deathUid, afterUid: hard.birthUid };
    else if (hard.birthIndex < role.birthIndex && role.birthIndex < hard.deathIndex && hard.deathUid !== undefined && role.birthUid !== undefined && !hard.liveOut && !role.liveIn) requiredRelation = { beforeUid: hard.deathUid, afterUid: role.birthUid };
    overlaps.push({ hard, role, requiredRelation });
  }
  const geometry = (w: Web) => JSON.stringify([w.birth, w.death, w.readCount, w.estimatedWeightedReferences, w.residences.map(r => [r.definitions, r.reads, r.acrossCalls])]);
  return { identity: t.identity!.key, description: t.identity!.description, targetWeb: t.id, candidateWeb: c.id, targetRegister: tr.register, candidateRegister: cr.register, unchangedGeometry: geometry(t) === geometry(c), pseudo, overlaps };
}
export function diffWebPartitions(target: WebPartition, candidate: WebPartition | CandidatePartition, witnesses: WeightWitness[] = []): PartitionDiff {
  const facts: WebFact[] = [], assignments: AssignmentDiagnostic[] = [], undetermined: PartitionDiff["undetermined"] = [];
  // The common machine layer must be identical on matched code even if the
  // compiler used additional pseudos, phantom refs or reload remats upstream.
  // This is NOT a byte-match shortcut: compare the extracted partition itself.
  if (signature(target) === signature(candidate)) return { schemaVersion: 1, facts, assignments, undetermined, exactObservedPartition: true };
  const tg = groups(target), cg = groups(candidate);
  const add = (kind: MismatchClass, identity: string, ts: Web[], cs: Web[], evidence: string[], confidence: WebFact["confidence"] = "observed", relation: WebFact["relation"] = "same-value"): void => {
    facts.push({ id: `${kind}:${identity}${kind === "birth" ? `|${ts[1]?.birthValue?.key ?? "?"}` : ""}`, class: kind, identity, targetWebs: ts.map(w => w.id), candidateWebs: cs.map(w => w.id), confidence, relation, evidence, directive: directive(kind) });
  };
  // A loop-carried value can change each iteration while equality at its
  // copy point is still exact. This bounded certificate never invents a
  // whole-loop identity: contraction must explain EVERY candidate word.
  for (const [larger, smaller, kind] of [[target, candidate, "fused"], [candidate, target, "split"]] as const) for (const proof of certifyCopyContractions(larger, smaller)) {
    const ts = kind === "fused" ? [proof.from, proof.to] : [proof.candidate], cs = kind === "fused" ? [proof.candidate] : [proof.from, proof.to];
    add(kind, `copy-origin:${proof.from.birth}`, ts, cs, [
      `Copy ${proof.from.id} ($${proof.from.residences[0]!.register}) -> ${proof.to.id} ($${proof.to.residences[0]!.register}) at instruction ${proof.edge.at}${proof.edge.delaySlot ? " (delay slot)" : ""}.`,
      "Single-definition source dies at the copy; contraction within one CFG block has no intervening destination access/call/load hazard and reproduces every opposite-side word exactly.",
      "Equality is proven at the copy point; loop-carried whole-web value identity remains undetermined.",
    ], "observed", "copy-point");
    facts[facts.length - 1]!.directive.text = kind === "fused" ? `Keep the raw binding at instruction ${proof.from.birth} and the carried binding at instruction ${proof.edge.at} in separate typed locals. Assign carried = raw at that copy point; keep the masked/view consumers of raw separate from the backedge consumers of carried. An alias alone may disappear: measure the copy web.` : `Try one reused typed local for the two roles joined at instruction ${proof.edge.at}; the target is the exact contraction of this copy. Preserve all consumers and effects.`;
  }
  if ("pseudoWebs" in candidate) for (const proof of certifyRoleFusions(target, candidate)) {
    add("fused", `expression-role:${proof.base.identity!.key}->${proof.output.identity!.key}`, [proof.base, proof.output], [proof.candidateBase, proof.candidateOutput], [
      `Base ${proof.base.identity!.description} and derived saved pointer are DIFFERENT values; both add operands and the result align by proven identities.`,
      `Target base $${proof.base.residences[0]!.register} -> result $${proof.output.residences[0]!.register} at instruction ${proof.targetAt}; candidate reuses $${proof.candidateBase.residences[0]!.register} at instruction ${proof.candidateAt}.`,
      `Candidate pseudo ${proof.pseudo.pseudo} has ${proof.pseudo.sets} SETs: base binding UID ${proof.binding.uid}, self-input pointer update UID ${proof.update.uid}. This is multi-SET role reuse, not merely hard-register coalescing of separate single-SET pseudos.`,
    ], "observed", "expression-roles");
    facts[facts.length - 1]!.directive.text = `Use an unsigned-char byte-base local for ${proof.base.identity!.description} and a separate integer byte-offset local. Preserve the signed index and existing byte-offset computation; form record = (ActualRecordType *)(byteBase + byteOffset) in a fresh typed record local, not by overwriting byteBase. Keep record live for the call consumers. Measure whether the multi-SET pseudo splits; do not pin registers.`;
    facts[facts.length - 1]!.directive.citations = [{ path: "notes/techniques-for-solving-parked-functions.md", kind: "measured-precedent", detail: "800F227C: fresh typed pointer outputs vs reused tied accumulator changed [0,0,2,13] to exact; ASM-assisted closure, not a clean-C recipe." }, { path: "notes/human-needed-approvals/ovl_11_func_801129EC.md", kind: "measured-precedent", detail: "Base, wide index, scaled offset and final saved-pointer physical roles; pin closure is not original-source evidence." }];
  }
  for (const key of [...new Set([...tg.keys(), ...cg.keys()])].sort()) {
    const ts = tg.get(key) ?? [], cs = cg.get(key) ?? [];
    if (!ts.length || !cs.length) {
      if (ts.length === 1 && ts[0]!.entry && /^entry:(v[01]|t\d+)$/.test(key)) add("entry-web", key, ts, cs, [`Target reads ${ts[0]!.identity!.description} without an in-function birth.`]);
      else undetermined.push({ identity: key, reason: "Value exists on one side only; semantic/population change or missing identity evidence, not a proven partition lever." });
      continue;
    }
    if (ts.length !== cs.length) {
      // Copy topology is necessary: repeated constant materializations with
      // no connected uses are ambiguous, not proof of a fused source variable.
      const larger = ts.length > cs.length ? ts : cs;
      const p = ts.length > cs.length ? target : candidate;
      const members = new Set(larger.map(w => w.id));
      const copies = p.copies.filter(e => members.has(e.from) && members.has(e.to));
      if (copies.length === 0) { undetermined.push({ identity: key, reason: `${ts.length} target vs ${cs.length} candidate residences, but no same-value copy topology proves a split/merge alignment.` }); continue; }
      const kind = ts.length > cs.length ? "fused" : "split";
      add(kind, key, ts, cs, [`Same proven value: ${ts.length} target webs vs ${cs.length} candidate webs.`, ...copies.map(e => `Copy ${e.from} -> ${e.to} at instruction ${e.at}${e.delaySlot ? " (delay slot)" : ""}.`)]);
      continue;
    }
    if (ts.length !== 1) { undetermined.push({ identity: key, reason: "Equal multiplicities but several same-value webs: residence/weight/birth alignment is ambiguous." }); continue; }
    const t = ts[0]!, c = cs[0]!;
    const assignment = assignmentDiagnostic(t, c, candidate);
    if (assignment) assignments.push(assignment);
    if (saved(t) !== saved(c)) {
      const tc = t.residences.flatMap(r => r.acrossCalls), cc = c.residences.flatMap(r => r.acrossCalls);
      if (tc.length || cc.length) add("residence", key, ts, cs, [`Target ${t.residences[0]!.register}, candidate ${c.residences[0]!.register}.`, `Target spans calls at [${tc}]; candidate [${cc}].`]);
      else undetermined.push({ identity: key, reason: "Saved/scratch assignment differs but neither web spans a call; no call-lifetime spelling directive is justified." });
    }
    if (t.readCount !== c.readCount || t.estimatedWeightedReferences !== c.estimatedWeightedReferences) {
      const witness = witnesses.find(w => w.identity === key && w.targetHash === target.byteHash && w.candidateHash === candidate.byteHash);
      add("weight", key, ts, cs, [`Machine reads ${t.readCount} vs ${c.readCount}; estimated weighted operands+defs ${t.estimatedWeightedReferences} vs ${c.estimatedWeightedReferences}.`, witness ? `${witness.artifact}: pseudo ${witness.pseudo} needs >=${witness.minimumReferences} weighted refs at live length ${witness.liveLength}.` : "No fresh counterfactual threshold; private allocator weight is undetermined."], witness ? "observed" : "undetermined");
    }
  }
  // Relative birth order, not absolute machine offsets (which change whenever
  // one side inserts an instruction). Report each inverted pair once.
  const bindings = (p: WebPartition): Map<string, Web[]> => {
    const m = new Map<string, Web[]>();
    for (const w of p.webs) if (w.birthValue && !w.entry) { const ws = m.get(w.birthValue.key) ?? []; ws.push(w); m.set(w.birthValue.key, ws); }
    return m;
  };
  const tBirths = bindings(target), cBirths = bindings(candidate);
  const unique = [...tBirths.keys()].filter(k => tBirths.get(k)!.length === 1 && cBirths.get(k)?.length === 1);
  for (let a = 0; a < unique.length; a++) for (let b = a + 1; b < unique.length; b++) {
    const ka = unique[a]!, kb = unique[b]!, ta = tBirths.get(ka)![0]!, tb = tBirths.get(kb)![0]!, ca = cBirths.get(ka)![0]!, cb = cBirths.get(kb)![0]!;
    if ((ta.birth - tb.birth) * (ca.birth - cb.birth) >= 0) continue;
    // Birth advice belongs to bounded named bindings, not every load event.
    if (![ta.birthValue!.kind, tb.birthValue!.kind].some(k => ["constant", "address", "symbol-high"].includes(k))) continue;
    if ([ta.birthValue!.kind, tb.birthValue!.kind].some(k => ["entry", "load", "call-result"].includes(k))) continue;
    add("birth", ka, [ta, tb], [ca, cb], [`Target binding ${ka} @${ta.birth} vs ${kb} @${tb.birth}; candidate @${ca.birth} vs @${cb.birth}.`, "Machine birth-order inversion is observed; source-statement order is not proven."]);
  }
  // A reload classification requires compiler-side equivalence evidence; raw
  // words only establish representation compatibility. Keep it nonconfident.
  const copied = target.copies.filter(e => e.from !== e.to);
  if (copied.length >= 8 && "pseudoWebs" in candidate && candidate.pseudoWebs.some(p => p.copyFrom.length > 0 && (p.sets ?? 0) > 1)) {
    add("free-copy", "reload-compatibility", [], [], [`${copied.length} target copy instructions; candidate contains multi-set copy pseudos.`, "Original REG_EQUIV/allocator costs cannot be recovered from bytes."], "undetermined");
  }
  for (const p of [target, candidate]) for (const w of p.webs) if (w.status === "undetermined") undetermined.push({ identity: `${p.side}:${w.id}`, reason: w.evidence.join(" ") });
  const order: MismatchClass[] = ["entry-web", "fused", "split", "residence", "birth", "weight", "free-copy"];
  facts.sort((a,b) => order.indexOf(a.class) - order.indexOf(b.class) || a.id.localeCompare(b.id));
  return { schemaVersion: 1, facts, assignments, undetermined, exactObservedPartition: false };
}
export function renderWebDiff(diff: PartitionDiff): string[] {
  const lines = ["SAME-VALUE WEB PARTITION"];
  if (diff.exactObservedPartition) return [...lines, "  Empty diff: observed partitions agree (pre-reload pseudo state may differ)."];
  for (const f of diff.facts) lines.push(`  ${f.class} ${f.identity} [${f.confidence}; ${f.relation}]`, ...f.evidence.map(s => `    ${s}`), `    TRY: ${f.directive.text}`, `    LOAD: ${f.directive.mechanismSheet}`, ...f.directive.citations.map(c => `    ${c.kind}: ${c.path} — ${c.detail}`));
  if (!diff.facts.length) lines.push("  No proven spelling lever.");
  if (diff.assignments.length) {
    lines.push("  SCRATCH ASSIGNMENT (separate from spelling facts/progress)");
    for (const a of diff.assignments) {
      lines.push(`    ${a.description}: target $${a.targetRegister}, candidate $${a.candidateRegister}.`, a.unchangedGeometry ? "    Same value, web count, birth/death, reads and estimated weight; not a fused/split web." : "    Same proven value; machine lifetime/uses also differ.");
      const p = a.pseudo;
      if (!p) { lines.push("    No unique dump-pseudo correspondence; allocation cause undetermined."); continue; }
      lines.push(`    lreg pseudo ${p.pseudo}: ${p.sets ?? "?"} SET(s), ${p.weightedReferences ?? "?"} weighted refs, allocator span ${p.allocatorLiveLength ?? "?"}; ${p.allocationStage ?? "unknown"} allocation -> $${p.hardRegister}.`, `    SET UIDs [${p.setUids}]; use UIDs [${p.useUids}]; death UIDs [${p.deathUids}].`);
      if (!a.overlaps.length) lines.push(`    No reconstructed interior overlap with explicit $${a.targetRegister}; inspect quantity priorities/preferences/conflicts. This is not proof the register was free.`);
      for (const o of a.overlaps) {
        lines.push(`    RECONSTRUCTED lreg block ${o.role.block}: pseudo ${p.pseudo} UID ${o.role.birthUid ?? "live-in"}..${o.role.deathUid ?? "live-out"} (indices ${o.role.birthIndex}..${o.role.deathIndex}) overlaps explicit $${a.targetRegister} UID ${o.hard.birthUid ?? "live-in"}..${o.hard.deathUid ?? "live-out"} (indices ${o.hard.birthIndex}..${o.hard.deathIndex}).`);
        if (o.hard.birthExpression) lines.push(`      Hard-register birth: ${o.hard.birthExpression}`);
        if (o.role.birthIndex < o.hard.birthIndex && o.hard.birthIndex < o.role.deathIndex) lines.push(`      Pre-allocation order: UID ${o.role.birthUid ?? "?"} (${p.memoryLoad ? "load" : "pseudo birth"}) -> UID ${o.hard.birthUid ?? "?"} ($${a.targetRegister} SET) -> UID ${o.role.deathUid ?? "?"} (last use/death). Final scheduling can hide this overlap.`);
        if (o.requiredRelation) lines.push(`      Nonoverlap experiment: UID ${o.requiredRelation.beforeUid} before UID ${o.requiredRelation.afterUid} in pre-allocation RTL (not merely final assembly). Necessary for this ordering route, not sufficient for an exact allocation.`);
      }
      lines.push("    Dump intervals are reconstructed, not private allocator proof. No verified clean-C spelling is established here.");
    }
    lines.push("    NEXT: inspect local allocation for a complete clean candidate; compare the named UIDs/intervals, then verify bytes. Moving a C statement is not enough unless it changes this pre-allocation order.");
  }
  if (diff.undetermined.length) lines.push(`  ${diff.undetermined.length} undetermined alignments/identities (see JSON; not defects).`);
  return lines;
}
/** Named fact progress is a secondary report, never a replacement for the
 * staged residual: a web improvement bought by wrong semantics is no win. */
export function addressedWebFacts(baseline: PartitionDiff, variant: PartitionDiff): string[] {
  const remaining = new Set(variant.facts.filter(f => f.confidence === "observed").map(f => f.id));
  return baseline.facts.filter(f => f.confidence === "observed" && !remaining.has(f.id) && (variant.exactObservedPartition || !variant.undetermined.some(u => u.identity === f.identity))).map(f => f.id);
}
