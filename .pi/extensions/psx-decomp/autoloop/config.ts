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
  { provider: "openrouter", model: "deepseek/deepseek-v4-flash-0731", thinking: "xhigh", label: "deepseek-v4-flash" },
  // { provider: "openrouter", model: "moonshotai/kimi-k3", thinking: "high", label: "kimi-k3" },
  { provider: "openai-codex", model: "gpt-5.6-sol", thinking: "xhigh", label: "gpt-5.6-sol" },
];

export const DEFAULT_LOOP_CONFIG: Omit<LoopConfig, "runtimeDir"> = {
  ladder: DEFAULT_LADDER,
  returnsPerTier: 2,
  maxReturnsPerTier: 8,
  tierMinutes: 25,
  parkAfterStalledMeasurements: 6,
  singleTier: false,
  maxFunctions: 25,
  clearContextBetween: true,
  compactAtTokens: 350_000,
  handoffSummary: true,
  updateFileGroupings: true,
  commitOnMatch: true,
  commitOnPark: true,
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

/** A ceiling that 0 turns off, so switching compaction off needs no second field. */
function threshold(value: unknown, fallback: number, field: string): number {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative integer`);
  }
  return value;
}

export function parseLadder(value: unknown): LoopTier[] {
  if (value === undefined) return DEFAULT_LADDER;
  if (!Array.isArray(value) || value.length === 0) throw new Error("ladder must be a non-empty array");
  return value.map((raw, index) => {
    const tier = object(raw);
    rejectUnknown(tier, ["provider", "model", "thinking", "label", "role"], `ladder[${index}]`);
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
    if (tier.role !== undefined && tier.role !== "prep") {
      throw new Error(`ladder[${index}].role must be "prep" or omitted`);
    }
    return {
      provider,
      model,
      thinking: thinking as ThinkingLevel,
      label: (tier.label as string) ?? model,
      ...(tier.role === "prep" ? { role: "prep" as const } : {}),
    };
  });
}

/** Both the loop and its shared gates read this configuration file. */
export const LOOP_CONFIG_FIELDS = [
  "ladder",
  "returnsPerTier",
  "maxReturnsPerTier",
  "tierMinutes",
  "parkAfterStalledMeasurements",
  "singleTier",
  "maxFunctions",
  "clearContextBetween",
  "compactAtTokens",
  "handoffSummary",
  "updateFileGroupings",
  "commitOnMatch",
  "commitOnPark",
  "runtimeDir",
  "approvalsDir",
  "integration",
  "sourcePolicy",
];

export function loadLoopConfig(projectRoot: string): LoopConfig {
  const path = resolve(projectRoot, ".pi", "autoloop.json");
  const raw = existsSync(path) ? object(JSON.parse(readFileSync(path, "utf8"))) : {};
  rejectUnknown(raw, LOOP_CONFIG_FIELDS, "autoloop config");

  const runtimeDir = typeof raw.runtimeDir === "string" ? raw.runtimeDir : "run_output/autoloop";
  const approvalsDir = typeof raw.approvalsDir === "string" ? raw.approvalsDir : DEFAULT_LOOP_CONFIG.approvalsDir;
  if (isAbsolute(approvalsDir) || approvalsDir.includes("..")) {
    throw new Error("approvalsDir must be a safe project-relative path");
  }

  const ladder = parseLadder(raw.ladder);
  if (ladder[ladder.length - 1].role === "prep") {
    throw new Error("autoloop config: a prep tier needs a later matching tier (omit role on that tier)");
  }
  const singleTier = raw.singleTier === undefined ? DEFAULT_LOOP_CONFIG.singleTier : Boolean(raw.singleTier);
  /* A one-rung ladder is a legitimate configuration — one API key, one model —
     and it is also three silent losses: no escalation, no handoff (captureHandoff
     needs a rung above), and no policy adjudication, so every forbidden
     construct becomes an immediate human park. Refusing without the
     acknowledgement is what turns that from an accident into a choice. */
  if (ladder.length === 1 && !singleTier) {
    throw new Error(
      "autoloop config: the ladder has one rung. That disables escalation, the tier handoff, and " +
        "policy adjudication — with no rung above it, any forbidden construct parks the function " +
        'for a human immediately. Add more rungs, or set "singleTier": true to say you meant it.',
    );
  }
  const returnsPerTier = positiveInteger(raw.returnsPerTier, DEFAULT_LOOP_CONFIG.returnsPerTier, "returnsPerTier");
  const maxReturnsPerTier = positiveInteger(
    raw.maxReturnsPerTier, Math.max(DEFAULT_LOOP_CONFIG.maxReturnsPerTier, returnsPerTier), "maxReturnsPerTier");
  if (maxReturnsPerTier < returnsPerTier) {
    throw new Error("autoloop config: maxReturnsPerTier must be at least returnsPerTier");
  }

  return {
    ladder,
    singleTier,
    returnsPerTier,
    maxReturnsPerTier,
    tierMinutes: threshold(raw.tierMinutes, DEFAULT_LOOP_CONFIG.tierMinutes, "tierMinutes"),
    parkAfterStalledMeasurements: positiveInteger(
      raw.parkAfterStalledMeasurements,
      DEFAULT_LOOP_CONFIG.parkAfterStalledMeasurements,
      "parkAfterStalledMeasurements",
    ),
    maxFunctions: positiveInteger(raw.maxFunctions, DEFAULT_LOOP_CONFIG.maxFunctions, "maxFunctions"),
    clearContextBetween:
      raw.clearContextBetween === undefined
        ? DEFAULT_LOOP_CONFIG.clearContextBetween
        : Boolean(raw.clearContextBetween),
    compactAtTokens: threshold(raw.compactAtTokens, DEFAULT_LOOP_CONFIG.compactAtTokens, "compactAtTokens"),
    handoffSummary:
      raw.handoffSummary === undefined ? DEFAULT_LOOP_CONFIG.handoffSummary : Boolean(raw.handoffSummary),
    updateFileGroupings:
      raw.updateFileGroupings === undefined
        ? DEFAULT_LOOP_CONFIG.updateFileGroupings
        : Boolean(raw.updateFileGroupings),
    commitOnMatch: raw.commitOnMatch === undefined ? DEFAULT_LOOP_CONFIG.commitOnMatch : Boolean(raw.commitOnMatch),
    commitOnPark: raw.commitOnPark === undefined ? DEFAULT_LOOP_CONFIG.commitOnPark : Boolean(raw.commitOnPark),
    runtimeDir: isAbsolute(runtimeDir) ? runtimeDir : resolve(projectRoot, runtimeDir),
    approvalsDir,
  };
}
