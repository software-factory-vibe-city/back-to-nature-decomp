import { readFileSync } from "node:fs";
import { executeResource } from "./pipeline.ts";
import { iterationOperation } from "./iteration.ts";
import { readRequest } from "./request-io.ts";
import { Store } from "./storage.ts";
import type { Operation, Request } from "./types.ts";

/** Minimal argument lexer for slash commands: quotes, no expansion or shell. */
export function splitArguments(text: string): string[] {
  const result: string[] = [];
  let current = "", quote = "", started = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (char === "\\") { if (++i === text.length) throw new Error("Trailing argument escape"); current += text[i]; started = true; }
    else if (quote) { if (char === quote) quote = ""; else current += char; }
    else if (char === "'" || char === '"') { quote = char; started = true; }
    else if (/\s/.test(char)) { if (started) { result.push(current); current = ""; started = false; } }
    else { current += char; started = true; }
  }
  if (quote) throw new Error("Unterminated argument quote");
  if (started) result.push(current);
  return result;
}
export function parseArguments(args: string[], project: string): { operation?: Operation; request: Request; help: boolean; agents: boolean; cancel: boolean; maxIterations: number } {
  const request: Request = {};
  let operation: Operation | undefined, help = false, agents = true, cancel = false, maxIterations = Number.MAX_SAFE_INTEGER;
  const seen = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const flag = args[i]!;
    if (seen.has(flag)) throw new Error(`Duplicate option: ${flag}`);
    seen.add(flag);
    if (flag === "--help") { help = true; continue; }
    if (flag === "--no-agents") { agents = false; continue; }
    if (flag === "--cancel") { cancel = true; continue; }
    if (flag === "--status") { operation = "campaign"; request.action = "check"; continue; }
    const value = args[++i];
    if (value === undefined || value.startsWith("--")) throw new Error(`Missing value for ${flag}`);
    if (flag === "--input") request.input = value;
    else if (flag === "--run") request.run = value;
    else if (flag === "--resume") request.resume = value;
    else if (flag === "--document") { operation = "document"; request.run = value; request.action = "bundle"; }
    else if (flag === "--node") request.node = value;
    else if (flag === "--max-steps") request.maxSteps = Number(value);
    else if (flag === "--max-iterations") { maxIterations = Number(value); if (!Number.isSafeInteger(maxIterations) || maxIterations < 1) throw new Error("Invalid maxIterations"); }
    else if (flag === "--limits") request.limits = JSON.parse(value);
    else if (flag === "--transform-node") request.transformNode = value;
    else if (flag === "--transform-address") request.transformAddress = Number(value);
    else if (flag === "--action") {
      if (!["bundle", "check", "propose", "next", "asset"].includes(value)) throw new Error("Invalid action");
      request.action = value as Request["action"];
    } else if (flag === "--schemas" || flag === "--claims") {
      const store = new Store(project);
      const path = store.path(value.startsWith("build/assets/") ? value.slice(13) : value);
      const bytes = readFileSync(path);
      if (bytes.length > 65536) throw new Error("Declarative request exceeds 64 KiB");
      if (flag === "--schemas") request.schemas = JSON.parse(bytes.toString());
      else request.claims = JSON.parse(bytes.toString());
    } else throw new Error(`Unknown option: ${flag}`);
  }
  if (request.run && request.resume) throw new Error("Use run OR resume");
  if (seen.has("--status") && seen.has("--document")) throw new Error("Use status OR document");
  return { ...(operation ? { operation } : {}), request, help, agents, cancel, maxIterations };
}
export const HELP = `Static-first resource extraction (generated output: build/assets/)
  resourceCampaign.ts [--input extracted/path] [--max-steps N] [--limits JSON]
  resourceCampaign.ts --resume RUN [--max-steps N]
  resourceCampaign.ts --status
  resourceCampaign.ts --document RUN
  resourceInventory.ts [--input extracted/path] [--schemas build/assets/file.json]
  resourceProbe.ts|resourceAnalyze.ts|resourceExtract.ts --run RUN [--node NODE]
  resourceExtract.ts --run RUN --node INPUT --transform-node CODE --transform-address ADDRESS
  resourceVerify.ts|resourceDocument.ts --run RUN
  resourceDocument.ts --run RUN --action propose --claims build/assets/claims.json
Schemas are supplied hypotheses, not loader-derived proofs. Static recovery is
bounded; unresolved operations and unknown proprietary formats are reported.
Slash loop: --max-iterations N, --no-agents, --cancel.
The active-TUI loop commits each accepted asset note or tested parser. Generated
assets are never committed. --no-agents runs deterministic stages without commits.
Parser and explicit iteration commit gates also accept bounded --request JSON.`;
export async function resourceCli(operation: Operation, args: string[]): Promise<void> {
  const controller = new AbortController();
  const stop = (): void => controller.abort(new Error("Extraction cancelled"));
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
  try {
    const direct = readRequest(process.cwd(), args);
    const parsed = direct ? { request: direct, operation, help: false, cancel: false } : parseArguments(args, process.cwd());
    if (parsed.help) { console.log(HELP); return; }
    if (parsed.cancel) throw new Error("--cancel is an extension command control; CLI cancellation uses SIGINT/SIGTERM");
    const selected = parsed.operation ?? operation;
    const result = selected === "iteration" ? await iterationOperation(process.cwd(), parsed.request, controller.signal) : await executeResource(selected, process.cwd(), parsed.request, controller.signal, info => { if (direct) console.log(JSON.stringify({ type: "progress", ...info })); });
    console.log(direct ? JSON.stringify({ type: "result", result }) : JSON.stringify(result, null, 2));
  } catch (error) { console.error(String(error)); process.exitCode = 1; }
  finally { process.off("SIGINT", stop); process.off("SIGTERM", stop); }
}
