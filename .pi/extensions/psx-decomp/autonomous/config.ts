import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import type { AutodecompConfig, ModelTierConfig } from "./types.ts";

export const DEFAULT_CONFIG: AutodecompConfig = {
  runtimeDir: "run_output/autodecomp",
  parallelism: 1,
  requireCleanTrackedTree: true,
  matching: {
    models: [{ thinking: "high", maxAttempts: 2 }],
    turnLimit: 60,
    timeoutMinutes: 90,
    idleTimeoutMinutes: 15,
  },
  refinement: {
    targetedEveryMatches: 5,
    targetedBatchSize: 2,
    projectEveryMatches: 25,
    projectAtFinalization: true,
  },
  retry: {
    retryParkedAfterEpoch: true,
    retryOnNeighborHashChange: true,
    blockedSleepMinutes: 30,
  },
  integration: {
    mode: "patch",
    allowCommits: false,
    allowedRoots: ["src", "include", "configs"],
  },
  budgets: {
    maxCostUsd: null,
    maxRuntimeHours: null,
    maxAttemptsPerFunctionPerEpoch: 4,
  },
  sourcePolicy: {
    allowEmptyMemoryBarrier: true,
    allowlist: {},
  },
};

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function rejectUnknown(value: Record<string, unknown>, allowed: string[], field: string): void {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) throw new Error(`${field} contains unknown field(s): ${unknown.join(", ")}`);
}

function positiveNumber(value: unknown, fallback: number, field: string): number {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${field} must be a positive number`);
  }
  return value;
}

function nullablePositive(value: unknown, fallback: number | null, field: string): number | null {
  if (value === undefined || value === null) return value === null ? null : fallback;
  return positiveNumber(value, fallback ?? 1, field);
}

function modelTiers(value: unknown): ModelTierConfig[] {
  if (value === undefined) return DEFAULT_CONFIG.matching.models;
  if (!Array.isArray(value) || value.length === 0) throw new Error("matching.models must be a non-empty array");
  return value.map((raw, index) => {
    const tier = object(raw);
    rejectUnknown(tier, ["model", "thinking", "maxAttempts"], `matching.models[${index}]`);
    const thinking = tier.thinking ?? "high";
    if (!["off", "minimal", "low", "medium", "high", "xhigh"].includes(String(thinking))) {
      throw new Error(`matching.models[${index}].thinking is invalid`);
    }
    if (tier.model !== undefined && typeof tier.model !== "string") {
      throw new Error(`matching.models[${index}].model must be a string`);
    }
    return {
      ...(tier.model ? { model: tier.model } : {}),
      thinking: thinking as ModelTierConfig["thinking"],
      maxAttempts: positiveNumber(tier.maxAttempts, 2, `matching.models[${index}].maxAttempts`),
    };
  });
}

export function loadConfig(projectRoot: string): AutodecompConfig {
  const path = resolve(projectRoot, ".pi", "autodecomp.json");
  const raw = existsSync(path) ? object(JSON.parse(readFileSync(path, "utf8"))) : {};
  const matching = object(raw.matching);
  const refinement = object(raw.refinement);
  const retry = object(raw.retry);
  const integration = object(raw.integration);
  const budgets = object(raw.budgets);
  const sourcePolicy = object(raw.sourcePolicy);

  rejectUnknown(raw, ["runtimeDir", "parallelism", "requireCleanTrackedTree", "matching", "refinement", "retry", "integration", "budgets", "sourcePolicy"], "autodecomp config");
  rejectUnknown(matching, ["models", "turnLimit", "timeoutMinutes", "idleTimeoutMinutes"], "matching");
  rejectUnknown(refinement, ["targetedEveryMatches", "targetedBatchSize", "projectEveryMatches", "projectAtFinalization"], "refinement");
  rejectUnknown(retry, ["retryParkedAfterEpoch", "retryOnNeighborHashChange", "blockedSleepMinutes"], "retry");
  rejectUnknown(integration, ["mode", "allowCommits", "allowedRoots"], "integration");
  rejectUnknown(budgets, ["maxCostUsd", "maxRuntimeHours", "maxAttemptsPerFunctionPerEpoch"], "budgets");
  rejectUnknown(sourcePolicy, ["allowEmptyMemoryBarrier", "allowlist"], "sourcePolicy");

  if (raw.parallelism !== undefined && raw.parallelism !== 1) {
    throw new Error("Only parallelism: 1 is supported by the transactional integration backend");
  }
  if (integration.mode !== undefined && integration.mode !== "patch") {
    throw new Error("Only integration.mode=patch is supported");
  }
  if (integration.allowCommits === true) {
    throw new Error("Autonomous commits are not implemented; integration.allowCommits must remain false");
  }

  const runtimeDir = typeof raw.runtimeDir === "string" ? raw.runtimeDir : DEFAULT_CONFIG.runtimeDir;
  const allowedRoots = integration.allowedRoots === undefined
    ? DEFAULT_CONFIG.integration.allowedRoots
    : integration.allowedRoots;
  if (!Array.isArray(allowedRoots) || allowedRoots.some((entry) => typeof entry !== "string" || !entry || isAbsolute(entry) || entry.includes(".."))) {
    throw new Error("integration.allowedRoots must contain safe project-relative paths");
  }

  const allowlistRaw = sourcePolicy.allowlist ?? DEFAULT_CONFIG.sourcePolicy.allowlist;
  if (!allowlistRaw || typeof allowlistRaw !== "object" || Array.isArray(allowlistRaw)) {
    throw new Error("sourcePolicy.allowlist must be an object");
  }
  const allowlist: Record<string, string[]> = {};
  for (const [identity, kinds] of Object.entries(allowlistRaw as Record<string, unknown>)) {
    if (!Array.isArray(kinds) || kinds.some((kind) => typeof kind !== "string")) {
      throw new Error(`sourcePolicy.allowlist.${identity} must be an array of strings`);
    }
    allowlist[identity.toLowerCase()] = [...kinds] as string[];
  }

  return {
    runtimeDir: isAbsolute(runtimeDir) ? runtimeDir : resolve(projectRoot, runtimeDir),
    parallelism: 1,
    requireCleanTrackedTree: raw.requireCleanTrackedTree === undefined
      ? DEFAULT_CONFIG.requireCleanTrackedTree
      : Boolean(raw.requireCleanTrackedTree),
    matching: {
      models: modelTiers(matching.models),
      turnLimit: positiveNumber(matching.turnLimit, DEFAULT_CONFIG.matching.turnLimit, "matching.turnLimit"),
      timeoutMinutes: positiveNumber(matching.timeoutMinutes, DEFAULT_CONFIG.matching.timeoutMinutes, "matching.timeoutMinutes"),
      idleTimeoutMinutes: positiveNumber(matching.idleTimeoutMinutes, DEFAULT_CONFIG.matching.idleTimeoutMinutes, "matching.idleTimeoutMinutes"),
    },
    refinement: {
      targetedEveryMatches: positiveNumber(refinement.targetedEveryMatches, DEFAULT_CONFIG.refinement.targetedEveryMatches, "refinement.targetedEveryMatches"),
      targetedBatchSize: positiveNumber(refinement.targetedBatchSize, DEFAULT_CONFIG.refinement.targetedBatchSize, "refinement.targetedBatchSize"),
      projectEveryMatches: positiveNumber(refinement.projectEveryMatches, DEFAULT_CONFIG.refinement.projectEveryMatches, "refinement.projectEveryMatches"),
      projectAtFinalization: refinement.projectAtFinalization === undefined
        ? DEFAULT_CONFIG.refinement.projectAtFinalization
        : Boolean(refinement.projectAtFinalization),
    },
    retry: {
      retryParkedAfterEpoch: retry.retryParkedAfterEpoch === undefined
        ? DEFAULT_CONFIG.retry.retryParkedAfterEpoch
        : Boolean(retry.retryParkedAfterEpoch),
      retryOnNeighborHashChange: retry.retryOnNeighborHashChange === undefined
        ? DEFAULT_CONFIG.retry.retryOnNeighborHashChange
        : Boolean(retry.retryOnNeighborHashChange),
      blockedSleepMinutes: positiveNumber(retry.blockedSleepMinutes, DEFAULT_CONFIG.retry.blockedSleepMinutes, "retry.blockedSleepMinutes"),
    },
    integration: {
      mode: "patch",
      allowCommits: false,
      allowedRoots: [...allowedRoots] as string[],
    },
    budgets: {
      maxCostUsd: nullablePositive(budgets.maxCostUsd, DEFAULT_CONFIG.budgets.maxCostUsd, "budgets.maxCostUsd"),
      maxRuntimeHours: nullablePositive(budgets.maxRuntimeHours, DEFAULT_CONFIG.budgets.maxRuntimeHours, "budgets.maxRuntimeHours"),
      maxAttemptsPerFunctionPerEpoch: positiveNumber(
        budgets.maxAttemptsPerFunctionPerEpoch,
        DEFAULT_CONFIG.budgets.maxAttemptsPerFunctionPerEpoch,
        "budgets.maxAttemptsPerFunctionPerEpoch",
      ),
    },
    sourcePolicy: {
      allowEmptyMemoryBarrier: sourcePolicy.allowEmptyMemoryBarrier === undefined
        ? DEFAULT_CONFIG.sourcePolicy.allowEmptyMemoryBarrier
        : Boolean(sourcePolicy.allowEmptyMemoryBarrier),
      allowlist,
    },
  };
}
