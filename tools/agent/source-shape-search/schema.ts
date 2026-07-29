import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { ROOT } from "../decompToolchain.js";
import { VARIANT_MECHANISMS, type ExactSourceEdit, type VariantMechanism } from "../variant-lab/types.js";
import {
  SOURCE_SHAPE_SEARCH_SCHEMA_VERSION,
  type ChoiceConstraint,
  type SourceShapeAlternative,
  type SourceShapeConstraints,
  type SourceShapeDimension,
  type ScheduleComparisonConfig,
  type SourceShapeSearchSpec,
} from "./types.js";

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function object(value: unknown, context: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${context} must be an object`);
  return value as Record<string, unknown>;
}

function strict(raw: Record<string, unknown>, allowed: string[], context: string): void {
  const unknown = Object.keys(raw).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) throw new Error(`${context} contains unsupported field(s): ${unknown.join(", ")}`);
}

function string(value: unknown, context: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${context} must be a non-empty string`);
  return value.trim();
}

function optionalBoolean(value: unknown, context: string): boolean {
  if (value === undefined) return false;
  if (typeof value !== "boolean") throw new Error(`${context} must be boolean`);
  return value;
}

function scheduleComparison(value: unknown): ScheduleComparisonConfig {
  if (value === undefined) return { enabled: false, analyze: "traced-classes", maxInterventions: 3 };
  const raw = object(value, "scheduleComparison");
  strict(raw, ["enabled", "analyze", "maxInterventions"], "scheduleComparison");
  const enabled = optionalBoolean(raw.enabled, "scheduleComparison.enabled");
  const analyze = raw.analyze === undefined ? "traced-classes" : string(raw.analyze, "scheduleComparison.analyze");
  if (analyze !== "traced-classes") throw new Error(`scheduleComparison.analyze is unsupported: ${analyze}`);
  const maxInterventions = raw.maxInterventions === undefined ? 3 : Number(raw.maxInterventions);
  if (!Number.isInteger(maxInterventions) || maxInterventions < 1 || maxInterventions > 8) {
    throw new Error("scheduleComparison.maxInterventions must be an integer from 1 to 8");
  }
  return { enabled, analyze, maxInterventions };
}

function strings(value: unknown, context: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`${context} must be an array of non-empty strings`);
  }
  return value.map((item) => String(item).trim());
}

function edit(value: unknown, context: string): ExactSourceEdit {
  const raw = object(value, context);
  strict(raw, ["find", "replace", "occurrences"], context);
  const result: ExactSourceEdit = { find: string(raw.find, `${context}.find`), replace: typeof raw.replace === "string" ? raw.replace : (() => { throw new Error(`${context}.replace must be a string`); })() };
  if (raw.occurrences !== undefined) {
    if (!Number.isInteger(raw.occurrences) || Number(raw.occurrences) < 1) throw new Error(`${context}.occurrences must be a positive integer`);
    result.occurrences = Number(raw.occurrences);
  }
  return result;
}

function alternative(value: unknown, context: string): SourceShapeAlternative {
  const raw = object(value, context);
  strict(raw, ["id", "edits", "useBase", "expectedEffect", "invariants", "naturalPriority"], context);
  const id = string(raw.id, `${context}.id`);
  if (!ID.test(id)) throw new Error(`${context}.id contains unsafe characters`);
  const hasEdits = Array.isArray(raw.edits) && raw.edits.length > 0;
  const useBase = raw.useBase === true;
  if (Number(hasEdits) + Number(useBase) !== 1) throw new Error(`${context} must provide exactly one concrete generation action: non-empty edits or useBase:true`);
  const result: SourceShapeAlternative = {
    id,
    expectedEffect: raw.expectedEffect === undefined ? "" : string(raw.expectedEffect, `${context}.expectedEffect`),
    invariants: strings(raw.invariants ?? [], `${context}.invariants`),
  };
  if (hasEdits) result.edits = (raw.edits as unknown[]).map((item, index) => edit(item, `${context}.edits[${index}]`));
  if (useBase) result.useBase = true;
  if (raw.naturalPriority !== undefined) {
    if (!Number.isInteger(raw.naturalPriority) || Number(raw.naturalPriority) < 0) throw new Error(`${context}.naturalPriority must be a non-negative integer`);
    result.naturalPriority = Number(raw.naturalPriority);
  }
  return result;
}

function dimension(value: unknown, index: number): SourceShapeDimension {
  const context = `dimensions[${index}]`;
  const raw = object(value, context);
  strict(raw, ["id", "mechanism", "expectedPass", "invariants", "alternatives"], context);
  const id = string(raw.id, `${context}.id`);
  if (!ID.test(id)) throw new Error(`${context}.id contains unsafe characters`);
  const mechanism = string(raw.mechanism, `${context}.mechanism`);
  if (!(VARIANT_MECHANISMS as readonly string[]).includes(mechanism)) throw new Error(`${context}.mechanism is unsupported: ${mechanism}`);
  if (!Array.isArray(raw.alternatives) || raw.alternatives.length < 2) throw new Error(`${context}.alternatives must contain at least two finite alternatives`);
  const alternatives = raw.alternatives.map((item, alternativeIndex) => alternative(item, `${context}.alternatives[${alternativeIndex}]`));
  for (const item of alternatives) {
    if (!item.expectedEffect) item.expectedEffect = `evaluate supplied ${id}:${item.id} source shape`;
  }
  const ids = new Set<string>();
  for (const item of alternatives) {
    if (ids.has(item.id)) throw new Error(`${context} has duplicate alternative ${item.id}`);
    ids.add(item.id);
  }
  return {
    id,
    mechanism: mechanism as VariantMechanism,
    expectedPass: string(raw.expectedPass, `${context}.expectedPass`),
    invariants: strings(raw.invariants, `${context}.invariants`),
    alternatives,
  };
}

function ranges(value: unknown): Array<[number, number]> {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("constraints.preserveTargetRanges must be an array");
  return value.map((item, index) => {
    if (!Array.isArray(item) || item.length !== 2 || !item.every(Number.isInteger) || item[0] < 0 || item[1] < item[0]) {
      throw new Error(`constraints.preserveTargetRanges[${index}] must be [start,end] non-negative integers`);
    }
    return [Number(item[0]), Number(item[1])];
  });
}

function choiceConstraints(value: unknown, context: string): ChoiceConstraint[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`${context} must be an array`);
  return value.map((item, index) => {
    const raw = object(item, `${context}[${index}]`);
    strict(raw, ["choices"], `${context}[${index}]`);
    return { choices: strings(raw.choices, `${context}[${index}].choices`) };
  });
}

export function validateSourceShapeSpec(value: unknown, functionName?: string): SourceShapeSearchSpec {
  const raw = object(value, "search spec");
  strict(raw, [
    "schemaVersion", "function", "baseSourcePath", "analysisPath", "maxVariants", "dimensions",
    "constraints", "traceAllPreprocessed", "assembleUniqueDbr", "scheduleComparison",
  ], "search spec");
  if (typeof raw.schemaVersion !== "number") throw new Error("search spec is missing schemaVersion");
  if (raw.schemaVersion > SOURCE_SHAPE_SEARCH_SCHEMA_VERSION) throw new Error(`search schema ${raw.schemaVersion} is newer than supported schema ${SOURCE_SHAPE_SEARCH_SCHEMA_VERSION}`);
  if (raw.schemaVersion !== 1 && raw.schemaVersion !== SOURCE_SHAPE_SEARCH_SCHEMA_VERSION) throw new Error(`unsupported search schema ${raw.schemaVersion}`);
  const targetFunction = string(raw.function, "function");
  if (functionName && targetFunction !== functionName) throw new Error(`search spec targets ${targetFunction}, not ${functionName}`);
  if (!Array.isArray(raw.dimensions) || raw.dimensions.length === 0) throw new Error("dimensions must contain at least one explicit finite dimension");
  const dimensions = raw.dimensions.map(dimension);
  const dimensionIds = new Set<string>();
  for (const item of dimensions) {
    if (dimensionIds.has(item.id)) throw new Error(`duplicate dimension id: ${item.id}`);
    dimensionIds.add(item.id);
  }
  const maxVariants = raw.maxVariants === undefined ? 5000 : Number(raw.maxVariants);
  if (!Number.isInteger(maxVariants) || maxVariants < 1 || maxVariants > 100000) throw new Error("maxVariants must be an integer from 1 to 100000");
  const constraintRaw = raw.constraints === undefined ? {} : object(raw.constraints, "constraints");
  strict(constraintRaw, [
    "preserveTargetRanges", "preserveOpcodeStream", "forbidInstructionCountGrowth",
    "preserveExistingEmptyMemoryBarriers", "incompatibleAlternatives", "requiredAlternatives",
  ], "constraints");
  const constraints: SourceShapeConstraints = {
    preserveTargetRanges: ranges(constraintRaw.preserveTargetRanges),
    preserveOpcodeStream: optionalBoolean(constraintRaw.preserveOpcodeStream, "constraints.preserveOpcodeStream"),
    forbidInstructionCountGrowth: optionalBoolean(constraintRaw.forbidInstructionCountGrowth, "constraints.forbidInstructionCountGrowth"),
    preserveExistingEmptyMemoryBarriers: optionalBoolean(
      constraintRaw.preserveExistingEmptyMemoryBarriers,
      "constraints.preserveExistingEmptyMemoryBarriers",
    ),
    incompatibleAlternatives: choiceConstraints(constraintRaw.incompatibleAlternatives, "constraints.incompatibleAlternatives"),
    requiredAlternatives: strings(constraintRaw.requiredAlternatives ?? [], "constraints.requiredAlternatives"),
  };
  const knownChoices = new Set(dimensions.flatMap((item) => item.alternatives.map((alternative) => `${item.id}:${alternative.id}`)));
  for (const choice of [...constraints.requiredAlternatives, ...constraints.incompatibleAlternatives.flatMap((item) => item.choices)]) {
    if (!knownChoices.has(choice)) throw new Error(`constraint references unknown choice: ${choice}`);
  }
  const tracing = optionalBoolean(raw.traceAllPreprocessed, "traceAllPreprocessed");
  const comparison = scheduleComparison(raw.scheduleComparison);
  if (comparison.enabled && !tracing) {
    throw new Error("scheduleComparison.enabled requires traceAllPreprocessed:true so machine-equivalent compiler classes are not hidden");
  }
  const result: SourceShapeSearchSpec = {
    schemaVersion: SOURCE_SHAPE_SEARCH_SCHEMA_VERSION,
    function: targetFunction,
    baseSourcePath: string(raw.baseSourcePath, "baseSourcePath"),
    maxVariants,
    dimensions,
    constraints,
    traceAllPreprocessed: tracing,
    assembleUniqueDbr: optionalBoolean(raw.assembleUniqueDbr, "assembleUniqueDbr"),
    scheduleComparison: comparison,
  };
  if (raw.analysisPath !== undefined) result.analysisPath = string(raw.analysisPath, "analysisPath");
  return result;
}

export function resolveProjectInput(path: string, context: string): string {
  const absolute = isAbsolute(path) ? resolve(path) : resolve(ROOT, path);
  const related = relative(ROOT, absolute).replace(/\\/g, "/");
  if (related.startsWith("../")) throw new Error(`${context} must stay within the project tree`);
  if (!existsSync(absolute)) throw new Error(`${context} not found: ${path}`);
  return absolute;
}

export function loadSourceShapeSpec(path: string, functionName: string): SourceShapeSearchSpec {
  const absolute = resolveProjectInput(path, "search spec");
  try {
    return validateSourceShapeSpec(JSON.parse(readFileSync(absolute, "utf8")), functionName);
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(`invalid JSON in search spec ${path}: ${error.message}`);
    throw error;
  }
}
