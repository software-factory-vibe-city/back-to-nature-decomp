import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import type { LoopConfig, LoopTier, ThinkingLevel } from "./types.ts";

const THINKING_LEVELS: ThinkingLevel[] = ["off", "minimal", "low", "medium", "high", "xhigh"];

/**
 * The escalation ladder.
 *
 * Cheapest and most local first: the local Qwen does the bulk of the work for
 * free, and each rung above it is only paid for by a function the rung below
 * could not finish. The last rung is also the policy court of appeal — nothing
 * above it can adjudicate an assembly exemption, so a function that needs one
 * there is parked for a human instead.
 */
export const DEFAULT_LADDER: LoopTier[] = [
  { provider: "qwen36-llama", model: "qwen3.6-27b", thinking: "medium", label: "qwen3.6-27b (local)" },
  { provider: "openrouter", model: "deepseek/deepseek-v4-flash-0731", thinking: "high", label: "deepseek-v4-flash" },
  { provider: "openrouter", model: "moonshotai/kimi-k3", thinking: "high", label: "kimi-k3" },
  { provider: "openai-codex", model: "gpt-5.6-sol", thinking: "xhigh", label: "gpt-5.6-sol" },
];

export const DEFAULT_LOOP_CONFIG: Omit<LoopConfig, "runtimeDir"> = {
  ladder: DEFAULT_LADDER,
  returnsPerTier: 2,
  maxFunctions: 25,
  clearContextBetween: true,
  handoffSummary: true,
  updateFileGroupings: true,
  commitOnMatch: true,
  approvalsDir: "notes/human-needed-approvals",
};

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function rejectUnknown(value: Record<string, unknown>, allowed: string[], field: string): void {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) throw new Error(`${field} contains unknown field(s): ${unknown.join(", ")}`);
}

function positiveInteger(value: unknown, fallback: number, field: string): number {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${field} must be a positive integer`);
  }
  return value;
}

export function parseLadder(value: unknown): LoopTier[] {
  if (value === undefined) return DEFAULT_LADDER;
  if (!Array.isArray(value) || value.length === 0) throw new Error("ladder must be a non-empty array");
  return value.map((raw, index) => {
    const tier = object(raw);
    rejectUnknown(tier, ["provider", "model", "thinking", "label"], `ladder[${index}]`);
    const provider = tier.provider;
    const model = tier.model;
    if (typeof provider !== "string" || !provider) throw new Error(`ladder[${index}].provider must be a non-empty string`);
    if (typeof model !== "string" || !model) throw new Error(`ladder[${index}].model must be a non-empty string`);
    const thinking = tier.thinking ?? "high";
    if (!THINKING_LEVELS.includes(thinking as ThinkingLevel)) {
      throw new Error(`ladder[${index}].thinking must be one of ${THINKING_LEVELS.join(", ")}`);
    }
    if (tier.label !== undefined && typeof tier.label !== "string") {
      throw new Error(`ladder[${index}].label must be a string`);
    }
    return {
      provider,
      model,
      thinking: thinking as ThinkingLevel,
      label: (tier.label as string) ?? model,
    };
  });
}

export function loadLoopConfig(projectRoot: string): LoopConfig {
  const path = resolve(projectRoot, ".pi", "autoloop.json");
  const raw = existsSync(path) ? object(JSON.parse(readFileSync(path, "utf8"))) : {};
  rejectUnknown(
    raw,
    [
      "ladder",
      "returnsPerTier",
      "maxFunctions",
      "clearContextBetween",
      "handoffSummary",
      "updateFileGroupings",
      "commitOnMatch",
      "runtimeDir",
      "approvalsDir",
    ],
    "autoloop config",
  );

  const runtimeDir = typeof raw.runtimeDir === "string" ? raw.runtimeDir : "run_output/autoloop";
  const approvalsDir = typeof raw.approvalsDir === "string" ? raw.approvalsDir : DEFAULT_LOOP_CONFIG.approvalsDir;
  if (isAbsolute(approvalsDir) || approvalsDir.includes("..")) {
    throw new Error("approvalsDir must be a safe project-relative path");
  }

  return {
    ladder: parseLadder(raw.ladder),
    returnsPerTier: positiveInteger(raw.returnsPerTier, DEFAULT_LOOP_CONFIG.returnsPerTier, "returnsPerTier"),
    maxFunctions: positiveInteger(raw.maxFunctions, DEFAULT_LOOP_CONFIG.maxFunctions, "maxFunctions"),
    clearContextBetween:
      raw.clearContextBetween === undefined
        ? DEFAULT_LOOP_CONFIG.clearContextBetween
        : Boolean(raw.clearContextBetween),
    handoffSummary:
      raw.handoffSummary === undefined ? DEFAULT_LOOP_CONFIG.handoffSummary : Boolean(raw.handoffSummary),
    updateFileGroupings:
      raw.updateFileGroupings === undefined
        ? DEFAULT_LOOP_CONFIG.updateFileGroupings
        : Boolean(raw.updateFileGroupings),
    commitOnMatch: raw.commitOnMatch === undefined ? DEFAULT_LOOP_CONFIG.commitOnMatch : Boolean(raw.commitOnMatch),
    runtimeDir: isAbsolute(runtimeDir) ? runtimeDir : resolve(projectRoot, runtimeDir),
    approvalsDir,
  };
}
