import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { ModelTierConfig, WorkerResult, WorkerUsage, WorkMode } from "./types.ts";

interface WorkerOptions {
  workspace: string;
  sessionDir: string;
  mode: WorkMode;
  functionName?: string;
  model: ModelTierConfig;
  continueSession: boolean;
  timeoutMs: number;
  idleTimeoutMs: number;
  turnLimit: number;
  signal?: AbortSignal;
  handoff?: string;
  mirrorOutput?: boolean;
}

const EMPTY_USAGE: WorkerUsage = {
  turns: 0,
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  costUsd: 0,
};

function promptFor(options: WorkerOptions): string {
  if (options.mode === "project-refinement") {
    return "/skill:psx-project-refinement Survey the current tree and execute one coherent, bounded, verified refinement batch. Do not commit.";
  }
  if (!options.functionName) throw new Error(`${options.mode} requires a function name`);
  if (options.mode === "targeted-refinement") return `/skill:psx-refine-function Target: ${options.functionName}.`;
  if (options.continueSession) {
    return `Continue matching ${options.functionName}. The deterministic supervisor rejected the previous result. Re-run psx_residual_objective and the clean-source checks, re-derive which pass owns the remaining residual with psx_reverse_pipeline, and continue without forbidden workarounds.`;
  }
  const handoff = options.handoff ? ` Prior deterministic evidence: ${options.handoff}` : "";
  return `/skill:psx-decompile-function Target: ${options.functionName}. Mode: resume/fix if clean C exists, otherwise fresh decompilation. Work only on this function and do not commit.${handoff}`;
}

function number(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function collectUsage(event: any, usage: WorkerUsage, seen: Set<string>): void {
  const candidate = event?.message?.usage ?? (event?.type === "message_end" ? event?.usage : undefined);
  if (!candidate || typeof candidate !== "object") return;
  const key = String(event?.message?.id ?? event?.id ?? createHash("sha1").update(JSON.stringify(candidate)).digest("hex"));
  if (seen.has(key)) return;
  seen.add(key);
  usage.inputTokens += number(candidate.input ?? candidate.inputTokens);
  usage.outputTokens += number(candidate.output ?? candidate.outputTokens);
  usage.cacheReadTokens += number(candidate.cacheRead ?? candidate.cacheReadTokens);
  usage.cacheWriteTokens += number(candidate.cacheWrite ?? candidate.cacheWriteTokens);
  usage.costUsd += number(candidate.cost?.total ?? candidate.costUsd ?? candidate.totalCost);
}

function assistantText(event: any): string | undefined {
  const message = event?.message;
  if (!message || message.role !== "assistant" || !Array.isArray(message.content)) return undefined;
  const text = message.content
    .filter((part: any) => part?.type === "text" && typeof part.text === "string")
    .map((part: any) => part.text)
    .join("\n")
    .trim();
  return text || undefined;
}

export async function runPiWorker(options: WorkerOptions): Promise<WorkerResult> {
  mkdirSync(options.sessionDir, { recursive: true });
  const startedAt = new Date().toISOString();
  const stdoutLog = join(options.sessionDir, `worker-${Date.now()}.jsonl`);
  const stderrLog = join(options.sessionDir, `worker-${Date.now()}.stderr.log`);
  const stdoutStream = createWriteStream(stdoutLog);
  const stderrStream = createWriteStream(stderrLog);
  const piBin = join(options.workspace, "node_modules", ".bin", "pi");
  const args = ["--mode", "json", "--session-dir", options.sessionDir];
  if (options.continueSession) args.push("--continue");
  if (options.model.model) args.push("--model", options.model.model);
  args.push("--thinking", options.model.thinking, "-p", promptFor(options));

  return new Promise((resolve, reject) => {
    const child = spawn(piBin, args, {
      cwd: options.workspace,
      env: { ...process.env, AUTODECOMP_WORKER: "1" },
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const usage = { ...EMPTY_USAGE };
    const seenUsage = new Set<string>();
    let buffered = "";
    let parseErrors = 0;
    let finalText: string | undefined;
    let timedOut = false;
    let idleTimedOut = false;
    let turnLimitReached = false;
    let stoppedByController = false;
    let settled = false;
    let idleTimer: NodeJS.Timeout;

    const killTree = (signal: NodeJS.Signals) => {
      if (!child.pid) return;
      try {
        if (process.platform !== "win32") process.kill(-child.pid, signal);
        else child.kill(signal);
      } catch {
        /* Process already exited. */
      }
    };
    const terminate = () => {
      killTree("SIGTERM");
      setTimeout(() => killTree("SIGKILL"), 5_000).unref();
    };
    const resetIdle = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        idleTimedOut = true;
        terminate();
      }, options.idleTimeoutMs);
      idleTimer.unref();
    };
    const onAbort = () => {
      stoppedByController = true;
      terminate();
    };
    options.signal?.addEventListener("abort", onAbort, { once: true });

    const wallTimer = setTimeout(() => {
      timedOut = true;
      terminate();
    }, options.timeoutMs);
    wallTimer.unref();
    resetIdle();

    const processLine = (line: string) => {
      if (!line.trim()) return;
      try {
        const event = JSON.parse(line);
        if (event.type === "turn_start") {
          usage.turns++;
          if (usage.turns >= options.turnLimit) {
            turnLimitReached = true;
            terminate();
          }
        }
        collectUsage(event, usage, seenUsage);
        finalText = assistantText(event) ?? finalText;
      } catch {
        parseErrors++;
      }
    };

    child.stdout?.on("data", (chunk: Buffer) => {
      resetIdle();
      stdoutStream.write(chunk);
      if (options.mirrorOutput) process.stdout.write(chunk);
      buffered += chunk.toString("utf8");
      let newline = buffered.indexOf("\n");
      while (newline >= 0) {
        processLine(buffered.slice(0, newline));
        buffered = buffered.slice(newline + 1);
        newline = buffered.indexOf("\n");
      }
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      resetIdle();
      stderrStream.write(chunk);
      if (options.mirrorOutput) process.stderr.write(chunk);
    });

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(wallTimer);
      clearTimeout(idleTimer);
      options.signal?.removeEventListener("abort", onAbort);
      stdoutStream.end();
      stderrStream.end();
      reject(error);
    });

    child.on("close", (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(wallTimer);
      clearTimeout(idleTimer);
      options.signal?.removeEventListener("abort", onAbort);
      if (buffered.trim()) processLine(buffered);
      stdoutStream.end();
      stderrStream.end();
      resolve({
        code,
        signal,
        timedOut,
        idleTimedOut,
        turnLimitReached,
        stoppedByController,
        startedAt,
        finishedAt: new Date().toISOString(),
        sessionDir: options.sessionDir,
        stdoutLog,
        stderrLog,
        finalText,
        usage,
        parseErrors,
      });
    });
  });
}
