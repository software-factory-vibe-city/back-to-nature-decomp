import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { CommandResult } from "./types.ts";

export interface RunOptions {
  cwd: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  signal?: AbortSignal;
  stdoutFile?: string;
  stderrFile?: string;
  maxCaptureBytes?: number;
}

function appendBounded(current: string, chunk: Buffer, maxBytes: number): string {
  const next = current + chunk.toString("utf8");
  if (Buffer.byteLength(next, "utf8") <= maxBytes) return next;
  const buffer = Buffer.from(next, "utf8");
  return buffer.subarray(buffer.length - maxBytes).toString("utf8");
}

export async function runCommand(command: string, args: string[], options: RunOptions): Promise<CommandResult> {
  const started = Date.now();
  const maxBytes = options.maxCaptureBytes ?? 2 * 1024 * 1024;
  if (options.stdoutFile) await mkdir(dirname(options.stdoutFile), { recursive: true });
  if (options.stderrFile) await mkdir(dirname(options.stderrFile), { recursive: true });

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    const killTree = (signal: NodeJS.Signals) => {
      if (!child.pid) return;
      try {
        if (process.platform !== "win32") process.kill(-child.pid, signal);
        else child.kill(signal);
      } catch {
        /* Process already exited. */
      }
    };

    const abort = () => {
      killTree("SIGTERM");
      setTimeout(() => killTree("SIGKILL"), 5_000).unref();
    };
    options.signal?.addEventListener("abort", abort, { once: true });

    if (options.timeoutMs && options.timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        killTree("SIGTERM");
        setTimeout(() => killTree("SIGKILL"), 5_000).unref();
      }, options.timeoutMs);
      timer.unref();
    }

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout = appendBounded(stdout, chunk, maxBytes);
      if (options.stdoutFile) stdoutChunks.push(Buffer.from(chunk));
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr = appendBounded(stderr, chunk, maxBytes);
      if (options.stderrFile) stderrChunks.push(Buffer.from(chunk));
    });

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
      reject(error);
    });

    child.on("close", async (code, signal) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
      try {
        if (options.stdoutFile) await writeFile(options.stdoutFile, Buffer.concat(stdoutChunks));
        if (options.stderrFile) await writeFile(options.stderrFile, Buffer.concat(stderrChunks));
      } catch (error) {
        reject(error);
        return;
      }
      resolve({
        command: [command, ...args].join(" "),
        code: code ?? 1,
        signal,
        timedOut,
        stdout,
        stderr,
        durationMs: Date.now() - started,
      });
    });
  });
}

export async function readTextIfExists(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return "";
  }
}
