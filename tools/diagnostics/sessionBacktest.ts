/** Immutable, branch-aware session evidence. Never executes recorded commands. */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const digest = (text: string | Buffer): string => createHash("sha256").update(text).digest("hex");
type ObjectValue = Record<string, unknown>;
const object = (value: unknown): ObjectValue => value && typeof value === "object" && !Array.isArray(value) ? value as ObjectValue : {};
const string = (value: unknown): string => typeof value === "string" ? value : "";
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
export interface Entry { id: string; parentId: string | null; line: number; type: string; timestamp: string; raw: ObjectValue }
export interface Call { id: string; name: string; args: ObjectValue; entry: string; line: number; timestamp: string; attempt?: string; role: string;
  results: Array<{ entry: string; line: number; text: string; raw: ObjectValue }>; evidence: "complete" | "missing" | "duplicate" | "ambiguous" | "truncated" }
export interface Attempt { id: string; target: string; selection: string; line: number; timestamp: string; branchParent: string | null;
  resumedFrom?: string; started: boolean; solverTurns: number; documentationTurns: number; calls: string[]; stages: Array<{ stage: string; entry: string; line: number }>;
  usage: ObjectValue[]; model: ObjectValue; reproducibility: { observed: boolean; compilerReplayable: boolean; m2cReplayable: boolean; fullAttemptReplayable: boolean; missing: string[] } }
interface State { attempt?: string; role: string; model: ObjectValue }
export function parseEntries(text: string): { entries: Entry[]; incomplete: Array<{ line: number; text: string }> } {
  const entries: Entry[] = [], incomplete: Array<{ line: number; text: string }> = [];
  text.split("\n").forEach((line, index) => {
    if (!line.trim()) return;
    try {
      const raw = object(JSON.parse(line));
      entries.push({ id: string(raw.id) || `physical-${index + 1}`, parentId: typeof raw.parentId === "string" ? raw.parentId : null,
        line: index + 1, type: string(raw.type), timestamp: string(raw.timestamp), raw });
    } catch { incomplete.push({ line: index + 1, text: line }); }
  });
  return { entries, incomplete };
}
export function messageText(message: ObjectValue): string {
  return typeof message.content === "string" ? message.content : array(message.content).map(object).filter((c) => c.type === "text").map((c) => string(c.text)).join("\n");
}
const fn = "(?:ovl_\\d+_)?func_[0-9a-fA-F]+";
export function selectedTarget(text: string): { target?: string; ambiguous: string[]; documentation: boolean } {
  const documentation = /(?:passed the full finalize gate|Documentation attempt:|\/skill:psx-post-decompile-documentation)/.test(text);
  const hits = [...text.matchAll(new RegExp(`(?:Target|Function|Current function):\\s*(${fn})\\b`, "g"))].map((m) => m[1]!);
  const unique = [...new Set(hits)];
  return { ...(unique.length === 1 ? { target: unique[0] } : {}), ambiguous: unique.length > 1 ? unique : [], documentation };
}
/** Only actual call records are unwrapped. A textual tool mention is not a call. */
export function normalizeCalls(content: unknown[]): Array<{ id: string; name: string; args: ObjectValue }> {
  return content.flatMap((value) => {
    const call = object(value);
    if (call.type !== "toolCall") return [];
    const name = string(call.name).replace(/^functions\./, "");
    const args = object(call.arguments);
    if (name === "multi_tool_use.parallel") return array(args.tool_uses).map(object).map((nested, index) => ({
      id: `${string(call.id)}:${index}`, name: string(nested.recipient_name).replace(/^functions\./, ""), args: object(nested.parameters),
    }));
    return [{ id: string(call.id), name, args }];
  });
}
export function classifyCall(call: Pick<Call, "name" | "args">): string {
  if (call.name === "psx_m2c") return "raw-m2c";
  if (call.name === "psx_repair_m2c") return "historical-repaired";
  if (call.name === "psx_finalize_function") return "model-finalization";
  if (["psx_residual_objective", "psx_fuzz_variants", "psx_triage"].includes(call.name)) return "measurement";
  if (["write", "edit"].includes(call.name)) return "source-edit";
  if (call.name === "read") return "discovery-read";
  if (call.name === "bash") {
    const command = string(call.args.command).trim();
    /* Restrict to argv-shaped executable prefixes. Never count echo/rg/read
       references to a tool as execution, or replay a historical shell. */
    const prefix = command.replace(/^cd\s+[^;&\n]+\s*&&\s*/, "");
    if (/^(?:npx\s+tsx\s+\S*m2cFunc\.ts|python3?\s+\S*m2c\.py)\b/.test(prefix)) return "raw-m2c";
    if (/^npx\s+tsx\s+\S*repairM2c\.ts\b/.test(prefix)) return "historical-repaired";
    if (/^(?:make\s+(?:check|check-all)|npx\s+tsx\s+\S*(?:diffFunc|residualObjective)\.ts)\b/.test(prefix)) return "measurement";
  }
  return "other";
}
export function extractSession(text: string) {
  const parsed = parseEntries(text), entries = parsed.entries;
  const byId = new Map(entries.map((e) => [e.id, e]));
  const states = new Map<string, State>();
  const attempts: Attempt[] = [], calls: Call[] = [], boundaries: Array<{ entry: string; line: number; reason: string; targets?: string[] }> = [];
  const attemptMap = new Map<string, Attempt>();
  const results = new Map<string, Call["results"]>();
  const unresolved = new Set(entries.map((e) => e.id));
  const apply = (e: Entry) => {
    const parent = e.parentId ? states.get(e.parentId) : undefined;
    const state: State = { ...parent, role: parent?.role ?? "solver", model: { ...(parent?.model ?? {}) } };
    if (e.type === "model_change") state.model = { ...state.model, provider: e.raw.provider, model: e.raw.modelId };
    if (e.type === "thinking_level_change") state.model.thinking = e.raw.thinkingLevel;
    const m = object(e.raw.message), role = string(m.role), text = messageText(m);
    if (role === "user") {
      const selected = selectedTarget(text);
      if (selected.ambiguous.length) boundaries.push({ entry: e.id, line: e.line, reason: "multiple explicit targets", targets: selected.ambiguous });
      if (selected.target && !selected.documentation) {
        const resumed = [...attempts].reverse().find((a) => a.target === selected.target && a.line < e.line);
        const a: Attempt = { id: e.id, target: selected.target, selection: e.id, line: e.line, timestamp: e.timestamp, branchParent: e.parentId,
          ...(resumed ? { resumedFrom: resumed.id } : {}), started: false, solverTurns: 0, documentationTurns: 0, calls: [], stages: [], usage: [], model: state.model,
          reproducibility: { observed: false, compilerReplayable: false, m2cReplayable: false, fullAttemptReplayable: false,
            missing: ["attempt-start Git/dirty workspace identity", "m2c invocation/context/revision together", "agent-readable notes/cache state"] } };
        attempts.push(a); attemptMap.set(a.id, a); state.attempt = a.id; state.role = "solver";
      } else if (selected.documentation) state.role = "documentation";
    }
    const attempt = state.attempt ? attemptMap.get(state.attempt) : undefined;
    if (role === "assistant") {
      if (attempt) {
        attempt.started = true;
        if (state.role === "documentation") attempt.documentationTurns++; else attempt.solverTurns++;
        if (m.usage) attempt.usage.push({ ...object(m.usage), provider: m.provider, model: m.model, role: state.role, entry: e.id });
      }
      for (const c of normalizeCalls(array(m.content))) {
        const call: Call = { ...c, entry: e.id, line: e.line, timestamp: e.timestamp, ...(state.attempt ? { attempt: state.attempt } : {}), role: state.role, results: [], evidence: "missing" };
        calls.push(call);
        if (attempt) { attempt.calls.push(c.id); attempt.stages.push({ stage: classifyCall(call), entry: e.id, line: e.line }); }
      }
    }
    if (role === "toolResult") {
      const id = string(m.toolCallId), list = results.get(id) ?? [];
      list.push({ entry: e.id, line: e.line, text, raw: m }); results.set(id, list);
    }
    states.set(e.id, state); unresolved.delete(e.id);
  };
  /* Parent links, not physical adjacency. Delayed/shuffled entries are legal. */
  while (unresolved.size) {
    let progressed = false;
    for (const e of entries) if (unresolved.has(e.id) && (!e.parentId || states.has(e.parentId) || !byId.has(e.parentId))) {
      if (e.parentId && !byId.has(e.parentId)) boundaries.push({ entry: e.id, line: e.line, reason: `missing parent ${e.parentId}` });
      apply(e); progressed = true;
    }
    if (!progressed) { for (const id of unresolved) boundaries.push({ entry: id, line: byId.get(id)!.line, reason: "parent cycle" }); break; }
  }
  for (const c of calls) {
    c.results = results.get(c.id) ?? [];
    c.evidence = !c.results.length ? "missing" : c.results.some((r) => /(?:Output (?:is |was )?truncated|\[\d+ more lines|truncated to)/i.test(r.text)) ? "truncated" :
      c.results.length > 1 ? new Set(c.results.map((r) => digest(JSON.stringify(r.raw)))).size === 1 ? "duplicate" : "ambiguous" : "complete";
    const a = c.attempt ? attemptMap.get(c.attempt) : undefined;
    if (a && ["raw-m2c", "historical-repaired", "source-edit"].includes(classifyCall(c)) && c.results.some((r) => !r.raw.isError)) a.reproducibility.observed = true;
  }
  const childCounts = new Map<string, number>(); for (const e of entries) if (e.parentId) childCounts.set(e.parentId, (childCounts.get(e.parentId) ?? 0) + 1);
  return { schemaVersion: 1, sha256: digest(text), entries: entries.length, attempts: attempts.sort((a, b) => a.line - b.line),
    calls: calls.sort((a, b) => a.line - b.line), queued: attempts.filter((a) => !a.started).map((a) => a.id),
    branchPoints: [...childCounts].filter(([, n]) => n > 1).map(([id, visits]) => ({ id, visits })), boundaries, incomplete: parsed.incomplete };
}
export function freezeSession(path: string, out: string) {
  const bytes = readFileSync(path), sha256 = digest(bytes), directory = join(out, sha256);
  mkdirSync(directory, { recursive: true });
  const snapshot = join(directory, "session.jsonl");
  if (existsSync(snapshot) && digest(readFileSync(snapshot)) !== sha256) throw new Error("Frozen session drift");
  if (!existsSync(snapshot)) writeFileSync(snapshot, bytes);
  return { directory, sha256, source: resolve(path), snapshot };
}
function main() {
  const args = process.argv.slice(2), flag = args.indexOf("--out"), out = flag < 0 ? "build/session-backtest" : args[flag + 1]!;
  const paths = args.filter((a, i) => a !== "--freeze-only" && (flag < 0 || (i !== flag && i !== flag + 1)));
  if (!paths.length) throw new Error("Usage: sessionBacktest.ts <session.jsonl>... --out <build/directory> [--freeze-only]");
  const runs = paths.map((path) => {
    const frozen = freezeSession(path, out);
    writeFileSync(join(frozen.directory, "input-manifest.json"), JSON.stringify(frozen, null, 2) + "\n");
    if (args.includes("--freeze-only")) return frozen;
    const result = extractSession(readFileSync(frozen.snapshot, "utf8"));
    writeFileSync(join(frozen.directory, "evidence.json"), JSON.stringify(result, null, 2) + "\n");
    return { ...frozen, attempts: result.attempts.length, started: result.attempts.filter((a) => a.started).length,
      uniqueFunctions: new Set(result.attempts.filter((a) => a.started).map((a) => a.target)).size, queued: result.queued.length,
      calls: result.calls.length, branchPoints: result.branchPoints.length, boundaries: result.boundaries, incomplete: result.incomplete.length };
  });
  writeFileSync(join(out, "coverage.json"), JSON.stringify(runs, null, 2) + "\n"); console.log(JSON.stringify(runs, null, 2));
}
if (import.meta.url === `file://${process.argv[1]}`) main();
