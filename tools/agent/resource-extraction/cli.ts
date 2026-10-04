import { readFileSync } from "node:fs";
import { executeResource } from "./pipeline.ts";
import { readRequest } from "./request-io.ts";
import { safePath } from "./storage.ts";
import type { Operation, Request } from "./types.ts";

/** Minimal argument lexer for slash commands: quotes, no expansion or shell. */
export function splitArguments(text: string): string[] {
  const result: string[] = []; let current = "", quote = "", started = false;
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
function declarative(value: string): unknown {
  if (Buffer.byteLength(value) > 65536) throw new Error("Declarative request exceeds 64 KiB");
  return JSON.parse(value);
}
export function parseArguments(args: string[], project: string): { operation?: Operation; request: Request; help: boolean; cancel: boolean } {
  const request: Request = {}; let operation: Operation | undefined, help = false, cancel = false;
  const seen = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const flag = args[i]!;
    if (seen.has(flag)) throw new Error(`Duplicate option: ${flag}`);
    seen.add(flag);
    if (flag === "--help") { help = true; continue; }
    if (flag === "--cancel") { cancel = true; continue; }
    if (flag === "--verify") { operation = "verify"; continue; }
    if (flag === "--force") { request.force = true; continue; }
    if (flag === "--full-verify") { request.fullVerify = true; continue; }
    if (flag === "--migrate-legacy") { request.migrateLegacy = true; continue; }
    const value = args[++i];
    if (value === undefined || value.startsWith("--")) throw new Error(`Missing value for ${flag}`);
    if (flag === "--input") request.input = value;
    else if (flag === "--limits") request.limits = declarative(value) as NonNullable<Request["limits"]>;
    else if (flag === "--offset") request.offset = Number(value);
    else if (flag === "--length") request.length = Number(value);
    else if (flag === "--action") request.action = value as NonNullable<Request["action"]>;
    else if (flag === "--baseline") request.baseline = value;
    else if (flag === "--schemas-json" || flag === "--transforms-json" || flag === "--schemas" || flag === "--transforms") {
      const json = flag.endsWith("-json") ? value : readFileSync(safePath(project, value), "utf8");
      const key = flag.startsWith("--schemas") ? "schemas" : "transforms";
      if (request[key]) throw new Error(`Duplicate ${key} definition`);
      request[key] = declarative(json) as never;
    } else throw new Error(`Unknown/retired option: ${flag}; use --help for the deterministic extractor`);
  }
  return { ...(operation ? { operation } : {}), request, help, cancel };
}
export function validateRequest(operation: Operation, request: Request): void {
  if (!request || typeof request !== "object" || Array.isArray(request)) throw new Error("Request must be an object");
  const allowed: Record<Operation, string[]> = {
    extract: ["input", "limits", "schemas", "transforms", "force", "fullVerify", "migrateLegacy"],
    verify: [], analyze: ["input", "limits", "offset", "length"], parser: ["action", "baseline"],
  };
  for (const key of Object.keys(request)) if (!allowed[operation].includes(key)) throw new Error(`Unsupported ${operation} parameter: ${key}`);
  for (const key of ["force", "fullVerify", "migrateLegacy"] as const) if (request[key] !== undefined && typeof request[key] !== "boolean") throw new Error(`Invalid ${key}`);
  for (const key of ["input", "baseline"] as const) if (request[key] !== undefined && typeof request[key] !== "string") throw new Error(`Invalid ${key}`);
  for (const key of ["schemas", "transforms"] as const) if (request[key] !== undefined && !Array.isArray(request[key])) throw new Error(`Invalid ${key}`);
  if (operation === "parser" && !["prepare", "test", "accept"].includes(request.action ?? "")) throw new Error("Parser action must be prepare, test or accept");
}
export const HELP = `Deterministic extraction: no model calls, run IDs, acceptance turns or commits.
  npm run extract-assets [-- --input extracted/path] [--force] [--full-verify]
  npm run extract-assets -- --verify
  npm run extract-assets -- --limits '{"maxOutputBytes":268435456}'
  npm run extract-assets -- --schemas path.json | --schemas-json JSON
  npm run extract-assets -- --transforms path.json | --transforms-json JSON
  npm run extract-assets -- --migrate-legacy
Flat exports: build/assets/extracted/{images,sounds,models,videos,data}/
Manifest: build/assets/manifest.json; generated notes: notes/asset-provenance.md
Schemas/transform associations are conditional assumptions, not loader proofs.
--force bypasses derivation caches; --full-verify additionally replays all results.
--verify is read-only and detects drift/corruption or interrupted publication.
--migrate-legacy removes only validated legacy-owned copies after publication;
unknown/edited files remain untouched. No blanket cleanup of build/assets/.
Parser investigation: resourceAnalyze.ts --input extracted/file [--offset N --length N]
Parser gate: resourceParser.ts --action prepare|test|accept [--baseline TOKEN].
Pi: /extract-resources is only a CLI wrapper; /build-resource-parser <work item>
loads the builder once. No automatic asset/documentation/model loop remains.`;
export async function resourceCli(operation: Operation, args: string[]): Promise<void> {
  const controller = new AbortController();
  const stop = (): void => controller.abort(new Error("Extraction cancelled"));
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
  try {
    const direct = readRequest(process.cwd(), args);
    const parsed = direct ? { request: direct, help: false, cancel: false } : parseArguments(args, process.cwd());
    if (parsed.help) { console.log(HELP); return; }
    if (parsed.cancel) throw new Error("CLI cancellation uses SIGINT/SIGTERM");
    const selected = "operation" in parsed ? parsed.operation ?? operation : operation;
    validateRequest(selected, parsed.request);
    const result = await executeResource(selected, process.cwd(), parsed.request, controller.signal, info => { if (direct) console.log(JSON.stringify({ type: "progress", ...info })); });
    console.log(direct ? JSON.stringify({ type: "result", result }) : JSON.stringify(result, null, 2));
  } catch (error) { console.error(String(error)); process.exitCode = 1; }
  finally { process.off("SIGINT", stop); process.off("SIGTERM", stop); }
}
