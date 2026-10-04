import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { Store } from "../../../../tools/agent/resource-extraction/storage.ts";
import { TOOL_SCRIPTS, type Operation, type Request } from "../../../../tools/agent/resource-extraction/types.ts";

/** Fresh deterministic tool process, NOT a forked agent. New parser code is
 * picked up on the next call without restarting/reloading the TUI session. */
export async function runResource(operation: Operation, root: string, request: Request = {}, signal?: AbortSignal, progress?: (info: Record<string, unknown>) => void): Promise<Record<string, unknown>> {
  signal?.throwIfAborted();
  const store = new Store(root), nonce = randomBytes(12).toString("hex");
  const input = `requests/${nonce}.json`, log = `logs/commands/${nonce}.json`;
  store.json(input, request);
  const repository = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
  const script = TOOL_SCRIPTS.find(([key]) => key === operation)?.[1];
  if (!script) throw new Error("Unknown resource operation");
  const localScript = resolve(root, "tools/agent", script);
  const executable = existsSync(localScript) ? localScript : resolve(repository, "tools/agent", script);
  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
  return new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, [resolve(repository, "node_modules/tsx/dist/cli.mjs"), executable, "--request", input], { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "", buffered = "", result: Record<string, unknown> | undefined, cancelled = false;
    let force: ReturnType<typeof setTimeout> | undefined;
    const cancel = (): void => { cancelled = true; child.kill("SIGTERM"); force ??= setTimeout(() => child.kill("SIGKILL"), 2000); };
    const deadline = setTimeout(cancel, 180000);
    signal?.addEventListener("abort", cancel);
    child.stdout.on("data", chunk => {
      const text = chunk.toString(); stdout += text; buffered += text;
      if (stdout.length > 16 * 1024 * 1024) { cancel(); return; }
      let newline: number;
      while ((newline = buffered.indexOf("\n")) >= 0) {
        const line = buffered.slice(0, newline); buffered = buffered.slice(newline + 1);
        try {
          const message = JSON.parse(line);
          if (message.type === "progress") progress?.(message);
          if (message.type === "result") result = message.result;
        } catch { /* Preserve nonprotocol diagnostics in the full log. */ }
      }
    });
    child.stderr.on("data", chunk => { stderr += chunk.toString(); if (stderr.length > 4 * 1024 * 1024) cancel(); });
    child.once("error", reject);
    child.once("close", code => {
      clearTimeout(deadline); if (force) clearTimeout(force); signal?.removeEventListener("abort", cancel);
      store.json(log, { operation, request, code, cancelled, stdout, stderr });
      if (cancelled || code !== 0 || !result) reject(new Error(`${operation} ${cancelled ? "cancelled/timed out" : "failed"}: ${stderr.slice(-12000)}. Full log: build/assets/${log}`));
      else resolveResult({ ...result, commandLog: log });
    });
  });
}
