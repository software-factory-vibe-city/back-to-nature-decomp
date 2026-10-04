import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync, readFileSync } from "node:fs";
import { finished } from "node:stream/promises";
import { join } from "node:path";

export interface CommandRecord {
  command: string;
  args: string[];
  cwd: string;
  status: number | null;
  cancelled: boolean;
  timedOut: boolean;
  stdout: string;
  stderr: string;
  error?: string;
}

/** Fixed argv, bounded wall time, complete streams including failed commands. */
export async function recordedCommand(command: string, args: string[], cwd: string, directory: string,
  label: string, signal?: AbortSignal, timeoutMs = 120_000, ownProcessGroup = true): Promise<CommandRecord> {
  mkdirSync(directory, { recursive: true });
  const stdout = join(directory, `${label}.stdout`);
  const stderr = join(directory, `${label}.stderr`);
  const out = createWriteStream(stdout);
  const err = createWriteStream(stderr);
  let error: string | undefined;
  const drained = Promise.all([out, err].map((s) => finished(s).catch((e) => { error = String(e); })));
  let timedOut = false;
  let cancelled = signal?.aborted ?? false;
  let status: number | null = null;
  if (!cancelled) {
    try {
      const child = spawn(command, args, { cwd, detached: ownProcessGroup && process.platform !== "win32", stdio: ["ignore", "pipe", "pipe"] });
      /* On spawn failure readable pipes close without necessarily ending. The
         child close event, not pipe's end, owns closing the output files. */
      child.stdout!.pipe(out, { end: false });
      child.stderr!.pipe(err, { end: false });
      const stop = () => {
        if (!child.pid) return;
        if (ownProcessGroup && process.platform !== "win32") {
          try { process.kill(-child.pid, "SIGKILL"); } catch { child.kill("SIGKILL"); }
        } else child.kill("SIGKILL");
      };
      const onAbort = () => { cancelled = true; stop(); };
      const timer = setTimeout(() => { timedOut = true; stop(); }, timeoutMs);
      signal?.addEventListener("abort", onAbort, { once: true });
      child.on("error", (e) => { error = e.message; });
      if (signal?.aborted) onAbort();
      status = await new Promise<number | null>((resolve) => child.once("close", resolve));
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    } catch (e) { error = String(e); }
  }
  out.end(); err.end(); await drained;
  return { command, args, cwd, status, cancelled, timedOut, stdout, stderr, ...(error ? { error } : {}) };
}

export function commandText(record: CommandRecord): string {
  return [readFileSync(record.stdout, "utf8"), readFileSync(record.stderr, "utf8"), record.error ?? ""].filter(Boolean).join("\n");
}
