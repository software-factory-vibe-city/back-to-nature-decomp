import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { withFileMutationQueue } from "@earendil-works/pi-coding-agent";
import { recordedCommand, commandText } from "../../../../tools/lib/recordedCommand.ts";
import { hashFile, hashText, packetIsFresh, stagePrepared } from "../../../../tools/agent/prepareFunction.ts";
import { loadContainers } from "../../../../tools/lib/container.ts";
import { configuredToolchainIdentity } from "../../../../tools/agent/decompToolchain.ts";
import { packetOpening, type PreparationPacket } from "../../../../tools/agent/campaign/packet.ts";

export interface PreparedAttempt { packet: PreparationPacket; path: string }
export async function prepareAttempt(root: string, name: string, signal?: AbortSignal): Promise<PreparedAttempt> {
  const result = await recordedCommand("npx", ["tsx", "tools/agent/m2cFunc.ts", name, "--json"], root,
    join(root, "build/preparation/commands", name, `${Date.now()}-${process.pid}`), "prepare", signal, 600_000);
  if (result.status !== 0) throw new Error(`Preparation failed; full diagnostics: ${result.stderr}\n${commandText(result)}`);
  return JSON.parse(readFileSync(result.stdout, "utf8")) as PreparedAttempt;
}
export function persistAttempt(root: string, attempt: PreparedAttempt): void {
  writeFileSync(join(root, attempt.path), JSON.stringify(attempt.packet, null, 2) + "\n");
  writeFileSync(join(root, dirname(attempt.path), "handoff.md"), packetOpening(attempt.packet, attempt.path) + "\n");
}

export function buildInputs(root: string): Record<string, string> {
  const inputs: Record<string, string> = {};
  const visit = (path: string) => {
    if (!existsSync(path)) return;
    for (const e of readdirSync(path, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = join(path, e.name);
      if (e.isDirectory()) visit(file); else inputs[relative(root, file)] = hashFile(file);
    }
  };
  for (const dir of ["src", "include", "configs", "tools/agent", "tools/build", "tools/lib", ".pi/extensions/psx-decomp", "tools/vendor/m2c/m2c", "tools/vendor/m2c/m2c_pycparser", "tools/vendor/m2c-patches", "tools/vendor/maspsx/maspsx", "tools/vendor/tree-sitter-c"]) visit(join(root, dir));
  const tools = configuredToolchainIdentity();
  for (const file of [tools.compiler.path, tools.assemblerShim.path, "tools/vendor/m2c/m2c.py", ...loadContainers().map((c) => c.targetPath)]) inputs[file] = hashFile(join(root, file));
  for (const file of ["Makefile", ".pi/autodecomp.json", "package-lock.json", "node_modules/web-tree-sitter/web-tree-sitter.js", "node_modules/web-tree-sitter/web-tree-sitter.wasm"]) inputs[file] = hashFile(join(root, file));
  return inputs;
}
export const inputIdentity = (inputs: Record<string, string>) => hashText(JSON.stringify(Object.entries(inputs).sort(([a], [b]) => a.localeCompare(b))));
export const sameInputs = (a: Record<string, string>, b: Record<string, string>) => inputIdentity(a) === inputIdentity(b);
export interface Completion {
  origin: "static" | "agent";
  verifiedIdentity: string;
  inputs: Record<string, string>;
  changedFiles: string[];
  documentation: "pending" | "passed";
  verification?: "passed" | "invalidated";
  packetPath?: string;
  error?: string;
}

/** Exactness alone is never acceptance. Runs before any solver model lookup.
 * Failed staging is CAS-restored only when it is still exactly our own write. */
export async function attemptStaticFinalization(options: {
  root: string; attempt: PreparedAttempt; aborted: () => boolean;
  finalize: () => Promise<{ passed: boolean; changedFiles: string[]; detail: string }>;
}): Promise<{ completed?: Completion; handoff: string }> {
  const { root, attempt } = options;
  const p = attempt.packet;
  const handoff = () => packetOpening(p, attempt.path);
  if (options.aborted() || p.comparison.status !== "exact" || p.integration.blockers.length || !packetIsFresh(p, root))
    return { handoff: handoff() };
  const destination = join(root, p.identity.destination);
  const original = readFileSync(destination, "utf8");
  let staged = false;
  if (p.integration.state !== "live") {
    const result = await withFileMutationQueue(destination, async () => stagePrepared(p, root));
    staged = result.staged;
    if (!staged) { p.integration.blockers.push(result.reason ?? "staging refused"); persistAttempt(root, attempt); return { handoff: handoff() }; }
  }
  let result: Awaited<ReturnType<typeof options.finalize>>;
  try {
    if (options.aborted()) throw new Error("cancelled before finalization");
    result = await options.finalize();
  } catch (error) { result = { passed: false, changedFiles: [], detail: String(error) }; }
  if (result.passed && !options.aborted()) {
    const inputs = buildInputs(root);
    const completion: Completion = { origin: "static", inputs, verifiedIdentity: inputIdentity(inputs), verification: "passed",
      changedFiles: result.changedFiles, documentation: "pending", packetPath: attempt.path };
    p.finalization = { status: "passed", verifiedIdentity: completion.verifiedIdentity, changedFiles: result.changedFiles };
    p.integration.state = "live";
    persistAttempt(root, attempt);
    return { completed: completion, handoff: handoff() };
  }
  p.finalization = { status: "failed", gate: result.detail };
  if (staged) await withFileMutationQueue(destination, async () => {
    if (hashFile(destination) === p.integration.stagedHash) {
      writeFileSync(destination, original); p.integration.state = "staged";
    } else p.integration.blockers.push("concurrent source modification after staging; not restored");
  });
  persistAttempt(root, attempt);
  return { handoff: handoff() };
}

/** Documentation failure is independent of matching success and resumable.
 * Nothing here commits or resets files, including unauthorized documentation edits. */
export async function documentCompletion(root: string, completion: Completion,
  document: () => Promise<boolean>): Promise<Completion> {
  if (!sameInputs(completion.inputs, buildInputs(root))) return { ...completion, verification: "invalidated", documentation: "pending", error: "verified build inputs changed; finalization must be rerun" };
  if (completion.documentation === "passed") return completion;
  let succeeded = false;
  let error: string | undefined;
  try { succeeded = await document(); } catch (failure) { error = String(failure); }
  /* Even an aborted/failed role may have edited a header before it stopped. */
  if (!sameInputs(completion.inputs, buildInputs(root))) return { ...completion, verification: "invalidated", documentation: "pending", error: "documentation changed build inputs; finalization must be rerun" };
  return succeeded ? { ...completion, verification: "passed", documentation: "passed", error: undefined } :
    { ...completion, documentation: "pending", error: error ?? "documentation cancelled or model unavailable" };
}
