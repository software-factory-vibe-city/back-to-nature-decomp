/** Historical acceptance replay. All five functions remain in the denominator.
 * The approval's F3EF0 best attempt is a NEGATIVE birth control: 999 is already
 * early. An independently preserved cursor attempt supplies the positive
 * late-999 case, archived verbatim and hash-pinned (not a generated respelling).
 * Named-first validates the ROLE, not just a class label. Every observed fact
 * is separately checked, so an unsupported confident fact blocks the gate. */
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT } from "../agent/decompToolchain.js";
import { analyzeCSource, matchingConstructs } from "../agent/cSourceGuard.js";
import { fingerprintWebPartition, type FingerprintReport } from "./fingerprintWebPartition.js";
import { certifyCopyContractions, certifyRoleFusions } from "./webPartitionProof.js";
import type { WebFact, MismatchClass } from "./webPartitionDiff.js";
interface Input { note?: string; source?: string; hash?: string; control?: "no-birth"; origin?: string }
const cohort: Array<{ functionName: string; expected: MismatchClass[]; inputs: Input[] }> = [
  { functionName: "func_80017F30", expected: ["fused"], inputs: [{ note: "notes/human-needed-approvals/func_80017F30.md" }] },
  { functionName: "ovl_11_func_800F8B4C", expected: ["split", "residence"], inputs: [{ note: "notes/human-needed-approvals/ovl_11_func_800F8B4C.md" }] },
  { functionName: "func_8001E340", expected: ["weight"], inputs: [{ source: "build/tmpc/func_8001E340.c" }] },
  { functionName: "ovl_11_func_800F3EF0", expected: ["birth"], inputs: [
    { note: "notes/human-needed-approvals/ovl_11_func_800F3EF0.md", control: "no-birth" },
    { source: "tools/diagnostics/test-fixtures/web-partition/800F3EF0-cursors.c", hash: "154e6e9d2081bf934702455fdb7548df463a16405af2759a8be6b7e6dcec4eb2", origin: "Verbatim build/parked-recovery/800F3EF0-cursors.c, preserved before this diagnostic; the approval's best attempt no longer has the described constant-birth defect." },
  ] },
  { functionName: "ovl_11_func_801129EC", expected: ["fused"], inputs: [{ note: "notes/human-needed-approvals/ovl_11_func_801129EC.md" }] },
];
const saved = (r: string) => /^(s[0-7]|fp)$/.test(r);
/** A second reading of the actual partition/RTL evidence, not of prose. */
export function validateObservedFact(report: FingerprintReport, f: WebFact): boolean {
  const candidate = report.candidate;
  if (!candidate || f.confidence !== "observed" || f.directive.confidence !== "hypothesis") return false;
  const ts = f.targetWebs.map(id => report.target.webs.find(w => w.id === id)), cs = f.candidateWebs.map(id => candidate.webs.find(w => w.id === id));
  if (ts.some(w => !w) || cs.some(w => !w)) return false;
  if (f.relation === "copy-point") {
    if (f.class !== "fused" && f.class !== "split") return false;
    const larger = f.class === "fused" ? report.target : candidate, smaller = f.class === "fused" ? candidate : report.target;
    return certifyCopyContractions(larger, smaller).some(p => JSON.stringify(f.class === "fused" ? [p.from.id, p.to.id, p.candidate.id] : [p.candidate.id, p.from.id, p.to.id]) === JSON.stringify([...f.targetWebs, ...f.candidateWebs]));
  }
  if (f.relation === "expression-roles") return f.class === "fused" && certifyRoleFusions(report.target, candidate).some(p => JSON.stringify([p.base.id, p.output.id, p.candidateBase.id, p.candidateOutput.id]) === JSON.stringify([...f.targetWebs, ...f.candidateWebs]));
  if (f.class === "birth") return ts.length === 2 && cs.length === 2 && ts.every((w,i) => w!.birthValue && w!.birthValue.key === cs[i]!.birthValue?.key) && (ts[0]!.birth - ts[1]!.birth) * (cs[0]!.birth - cs[1]!.birth) < 0;
  if (f.class === "residence") return ts.length === 1 && cs.length === 1 && ts[0]!.identity?.key === f.identity && cs[0]!.identity?.key === f.identity && saved(ts[0]!.residences[0]!.register) !== saved(cs[0]!.residences[0]!.register) && [...ts[0]!.residences, ...cs[0]!.residences].some(r => r.acrossCalls.length > 0);
  if (f.class === "entry-web") return ts.length === 1 && ts[0]!.entry && ts[0]!.identity?.key === f.identity && cs.length === 0;
  if (f.class === "fused" || f.class === "split") {
    const larger = f.class === "fused" ? report.target : candidate, members = new Set(f.class === "fused" ? f.targetWebs : f.candidateWebs);
    return [...ts, ...cs].every(w => w!.status === "proven" && w!.identity?.key === f.identity) && (f.class === "fused" ? ts.length > cs.length : cs.length > ts.length) && larger.copies.some(e => members.has(e.from) && members.has(e.to));
  }
  // Neither original reload cost nor original private weight is witnessed by
  // these replay inputs. A fabricated observed claim is a blocker, not a hit.
  return false;
}
export function namedHistoricalRole(name: string, f: WebFact | undefined): boolean {
  if (!f || f.confidence !== "observed") return false;
  switch (name) {
    case "func_80017F30": return f.class === "fused" && f.relation === "copy-point" && f.identity === "copy-origin:6" && /raw/.test(f.directive.text) && /carried/.test(f.directive.text);
    case "ovl_11_func_800F8B4C": return f.class === "residence" && f.identity === `const:${0x80130000}`;
    case "func_8001E340": return false; // No fresh hash-bound private-weight witness in this cohort.
    case "ovl_11_func_800F3EF0": return f.class === "birth" && f.identity === "const:999";
    case "ovl_11_func_801129EC": return f.class === "fused" && f.relation === "expression-roles" && f.identity.startsWith(`expression-role:const:${0x80076220}->`);
    default: return false;
  }
}
export function runHistoricalWebReplay() {
  const directory = join(ROOT, "build/webPartition/historical-replay"); mkdirSync(directory, { recursive: true });
  const rows = cohort.map(row => {
    const attempts = row.inputs.map((input, index) => {
      try {
        const origin = join(ROOT, input.note ?? input.source!);
        if (!existsSync(origin)) throw new Error(`Preserved attempt missing: ${origin}`);
        let source = readFileSync(origin, "utf8");
        if (input.note) {
          // Markdown extraction, NOT C inspection. Guard the complete C TU.
          const section = source.split("## Preserved attempt")[1], fenced = section?.match(/```c\s*\n([\s\S]*?)\n```/);
          if (!fenced) throw new Error("No complete preserved C fence"); source = fenced[1]!;
        }
        const sourceHash = createHash("sha256").update(source).digest("hex");
        if (input.hash && input.hash !== sourceHash) throw new Error("Historical fixture hash drift; refusing a silently replaced attempt");
        const guard = analyzeCSource(source), constructs = matchingConstructs(source);
        if (!guard.parses || !guard.embeddable || guard.includeAsm.length || constructs.localRegisterBindings.length || constructs.fileRegisterBindings.length || constructs.otherAsm.length) throw new Error("Preserved attempt must be complete clean C, not a matching workaround");
        const path = join(directory, `${row.functionName}${index ? `-supplement-${index}` : ""}.c`); writeFileSync(path, source);
        const report = fingerprintWebPartition(row.functionName, { source: path });
        const observed = report.diff?.facts.filter(f => f.confidence === "observed") ?? [], first = observed[0];
        const wrongConfident = observed.filter(f => !validateObservedFact(report, f)).map(f => f.id);
        const controlPassed = input.control !== "no-birth" || (report.status === "compared" && !!report.diff && report.oracleVerdict === "mismatch" && !report.diff.facts.some(f => f.class === "birth"));
        const namedFirst = input.control === undefined && report.oracleVerdict === "mismatch" && !!first && row.expected.includes(first.class) && namedHistoricalRole(row.functionName, first) && wrongConfident.length === 0;
        return { ...input, source: path, sourceHash, status: report.status, oracleVerdict: report.oracleVerdict, namedFirst, firstClass: first?.class ?? null, firstIdentity: first?.identity ?? null, wrongConfident, controlPassed, facts: report.diff?.facts ?? [], undetermined: report.diff?.undetermined ?? [], reportArtifact: report.reportArtifact };
      } catch (error) { return { ...input, status: "unavailable", namedFirst: false, firstClass: null, firstIdentity: null, wrongConfident: [], controlPassed: input.control === undefined, reason: String(error) }; }
    });
    const selected = attempts.find(a => a.namedFirst) ?? attempts[0]!;
    return { functionName: row.functionName, expected: row.expected, namedFirst: attempts.some(a => a.namedFirst), firstClass: selected.firstClass, firstIdentity: selected.firstIdentity, status: selected.status, attempts };
  });
  const namedFirst = rows.filter(r => r.namedFirst).length, wrongConfident = rows.flatMap(r => r.attempts.flatMap(a => a.wrongConfident)).length, controlsPassed = rows.every(r => r.attempts.every(a => a.controlPassed));
  const result = { schemaVersion: 2, rows, gate: { required: 4, denominator: cohort.length, namedFirst, wrongConfident, controlsPassed, met: namedFirst >= 4 && wrongConfident === 0 && controlsPassed }, caveat: "A passing directive gate validates observed roles and cited experimental suggestions, not recovered source or guaranteed clean-C matches. The original F3EF0 approval attempt remains a negative control; the positive birth attempt is independently preserved and hash-pinned. Private weight/reload costs remain undetermined without fresh witnesses." };
  writeFileSync(join(directory, "report.json"), JSON.stringify(result, null, 2) + "\n");
  return result;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some(a => a !== "--json")) { console.error("Usage: npx tsx tools/diagnostics/webPartitionReplay.ts [--json]"); process.exitCode = 1; }
  else {
    const report = runHistoricalWebReplay();
    console.log(args.includes("--json") ? JSON.stringify(report, null, 2) : report.rows.map(r => `${r.functionName}: ${r.firstClass ?? r.status} ${r.firstIdentity ?? ""}, named-first=${r.namedFirst}` + r.attempts.map(a => `\n  ${a.note ?? a.source}: ${a.control ? `${a.control} control=${a.controlPassed}` : `named-first=${a.namedFirst}`}${"reason" in a ? ` — ${a.reason}` : ""}`).join("")).join("\n") + `\nHistorical named-first gate: ${report.gate.namedFirst}/${report.gate.denominator} (requires ${report.gate.required}); wrong-confident=${report.gate.wrongConfident}; controls=${report.gate.controlsPassed ? "PASS" : "FAIL"}`);
    if (!report.gate.met) process.exitCode = 2;
  }
}
