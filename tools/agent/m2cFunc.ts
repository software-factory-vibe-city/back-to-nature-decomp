/** Shared first-pass preparation entry point. Raw output and every diagnostic
 * stay under build/preparation/. --write is a guarded handoff, never overwrite. */
import { prepareFunction, stagePrepared } from "./prepareFunction.js";
import { packetOpening } from "./campaign/packet.js";
import { ROOT } from "./decompToolchain.js";

export { prepareFunction, stagePrepared } from "./prepareFunction.js";

/** Explicit alternative for diagnostic consumers; no repair or scalar backstop. */
export async function runM2c(functionName: string, root = ROOT, options: { write?: boolean; contextFile?: string } = {}): Promise<string> {
  const result = await prepareFunction(functionName, { root, alternative: true, ...(options.contextFile ? { contextFile: options.contextFile } : {}) });
  if (!result.packet.primary) throw new Error(`m2c ${result.packet.generation.status}; preserved packet: ${result.path}`);
  if (options.write) {
    const staged = stagePrepared(result.packet, root);
    if (!staged.staged) throw new Error(`Not staged: ${staged.reason}. Draft and diagnostics: ${result.path}`);
  }
  return result.packet.primary.text;
}

if (process.argv[1]?.endsWith("m2cFunc.ts")) {
  const args = process.argv.slice(2);
  const contextIdx = args.indexOf("--context");
  const contextFile = contextIdx >= 0 ? args[contextIdx + 1] : undefined;
  const fn = args.find((a, i) => !a.startsWith("--") && i !== (contextIdx >= 0 ? contextIdx + 1 : -1));
  if (!fn || !/^[A-Za-z_]\w*$/.test(fn)) throw new Error("Usage: m2cFunc.ts <function> [--json] [--write] [--alternative] [--context <file>]");
  const result = await prepareFunction(fn, { alternative: args.includes("--alternative"), ...(contextFile ? { contextFile } : {}) });
  /* Legacy --write now refuses an existing attempt and dirty/concurrent work. */
  if (args.includes("--write")) stagePrepared(result.packet);
  const handoff = packetOpening(result.packet, result.path);
  /* Even JSON is a small handoff reference. Controllers load the machine
     packet from disk; it must never become an agent-facing stdout dump. */
  console.log(args.includes("--json") ? JSON.stringify({ path: result.path, handoff }) : handoff);
}
