import { closeSync, mkdirSync, openSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { loadConfig } from "./config.ts";
import { readStatus, statusText, writeControl, writeRequest } from "./controller.ts";
import type { ControlRequest } from "./types.ts";

function processAlive(pid: number | undefined): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function startDetached(projectRoot: string, extraArgs: string[] = []): number {
  const config = loadConfig(projectRoot);
  mkdirSync(config.runtimeDir, { recursive: true });
  const logPath = join(config.runtimeDir, "controller.log");
  const logFd = openSync(logPath, "a");
  const controller = join(projectRoot, ".pi", "extensions", "psx-decomp", "autonomous", "controller.ts");
  const child = spawn("npx", ["tsx", controller, "start", ...extraArgs], {
    cwd: projectRoot,
    detached: true,
    stdio: ["ignore", logFd, logFd],
    env: { ...process.env, AUTODECOMP_CONTROLLER: "1" },
  });
  child.unref();
  closeSync(logFd);
  if (!child.pid) throw new Error("Unable to start autonomous controller");
  return child.pid;
}

export function registerAutodecompCommands(pi: ExtensionAPI, projectRoot: string): void {
  pi.registerCommand("autodecomp", {
    description: "Control the durable autonomous decompilation supervisor",
    handler: async (args, ctx) => {
      const [command = "status", target, ...rest] = args.trim().split(/\s+/).filter(Boolean);
      try {
        if (command === "start") {
          const state = readStatus(projectRoot);
          if (processAlive(state.controllerPid)) {
            ctx.ui.notify(`Autodecomp already runs as PID ${state.controllerPid}`, "warning");
            return;
          }
          writeControl(projectRoot, "resume");
          const allowed = rest.filter((arg) => ["--dry-run", "--once"].includes(arg));
          const pid = startDetached(projectRoot, target?.startsWith("--") ? [target, ...allowed] : allowed);
          ctx.ui.notify(`Autodecomp started as PID ${pid}. Use /autodecomp status for progress.`, "info");
          return;
        }
        if (command === "status") {
          ctx.ui.notify(statusText(readStatus(projectRoot)), "info");
          return;
        }
        if (command === "pause" || command === "stop") {
          writeControl(projectRoot, command);
          ctx.ui.notify(`Autodecomp ${command} requested.`, "info");
          return;
        }
        if (command === "resume") {
          writeControl(projectRoot, "resume");
          const state = readStatus(projectRoot);
          if (!processAlive(state.controllerPid)) {
            const pid = startDetached(projectRoot);
            ctx.ui.notify(`Autodecomp resumed as PID ${pid}.`, "info");
          } else {
            ctx.ui.notify("Autodecomp resume requested.", "info");
          }
          return;
        }
        if (command === "retry" || command === "skip" || command === "unblock") {
          if (!target) {
            ctx.ui.notify(`Usage: /autodecomp ${command} <function-or-vram>`, "warning");
            return;
          }
          writeRequest(projectRoot, command as ControlRequest["action"], target);
          ctx.ui.notify(`Autodecomp ${command} queued for ${target}.`, "info");
          return;
        }
        if (command === "logs") {
          ctx.ui.notify(`Autodecomp logs: ${loadConfig(projectRoot).runtimeDir}`, "info");
          return;
        }
        ctx.ui.notify("Usage: /autodecomp start|status|pause|resume|stop|retry|skip|unblock|logs", "warning");
      } catch (error) {
        ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
      }
    },
  });
}
