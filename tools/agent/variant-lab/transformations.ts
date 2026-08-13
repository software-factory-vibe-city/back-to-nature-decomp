import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { ROOT } from "../decompToolchain.js";
import { loadMacroRegistry } from "../residual-source-search/macro-forms.js";
import { buildSemanticGraph, webLookupId } from "../residual-source-search/semantic-graph.js";
import { analyzeWebs } from "../residual-source-search/web-partitions.js";
import {
  RegionOrderModel,
  parseMemoryToken,
  publicationBarrierDependencies,
  regionDependencies,
  type RegionNodeView,
} from "../residual-source-search/topological-orders.js";
import { projectPath } from "./artifacts.js";
import { findGeneratedGlobalDefinitions, validateVariantSource } from "./manifest.js";
import {
  TRANSFORMATION_TEMPLATES,
  type ExactSourceEdit,
  type TransformationOutput,
  type TransformationSpec,
  type TransformationTemplate,
  type VariantHypothesis,
  type VariantMechanism,
} from "./types.js";

const TEMPLATE_MECHANISM: Record<TransformationTemplate, VariantMechanism> = {
  "fresh-local-vs-reuse": "fresh-vs-reused-web",
  "target-register-reuse": "single-vs-multi-set",
  "direct-vs-named-temporary": "statement-birth-order",
  "fresh-result-vs-input-reuse": "result-vs-input-reuse",
  "constant-around-join": "constant-birth-site",
  "array-vs-struct-address": "address-expression-family",
  "assignment-chain": "result-vs-input-reuse",
  "alias-access": "alias-dependency",
  "sdk-call-order": "statement-birth-order",
};

/** Bounds mirrored from the residual search's SDK-call-order stratum. */
const MIN_SDK_CALLS = 2;
const MAX_SDK_CALLS = 6;

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} must be a non-empty string`);
  return value;
}

function parseEdit(value: unknown, context: string): ExactSourceEdit {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${context} must be an object`);
  const raw = value as Record<string, unknown>;
  const edit: ExactSourceEdit = {
    find: requireString(raw.find, `${context}.find`),
    replace: typeof raw.replace === "string" ? raw.replace : (() => { throw new Error(`${context}.replace must be a string`); })(),
  };
  if (raw.occurrences !== undefined) {
    if (!Number.isInteger(raw.occurrences) || Number(raw.occurrences) < 1) throw new Error(`${context}.occurrences must be a positive integer`);
    edit.occurrences = Number(raw.occurrences);
  }
  return edit;
}

function parseOutput(value: unknown, index: number): TransformationOutput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`outputs[${index}] must be an object`);
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.invariants) || raw.invariants.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`outputs[${index}].invariants must be an array of non-empty strings`);
  }
  if (!Array.isArray(raw.edits) || raw.edits.length === 0) throw new Error(`outputs[${index}].edits must not be empty`);
  const output: TransformationOutput = {
    id: requireString(raw.id, `outputs[${index}].id`),
    expectedEffect: requireString(raw.expectedEffect, `outputs[${index}].expectedEffect`),
    invariants: raw.invariants.map(String),
    edits: raw.edits.map((edit, editIndex) => parseEdit(edit, `outputs[${index}].edits[${editIndex}]`)),
  };
  if (raw.baseline !== undefined) {
    if (typeof raw.baseline !== "boolean") throw new Error(`outputs[${index}].baseline must be boolean`);
    output.baseline = raw.baseline;
  }
  return output;
}

export function validateTransformationSpec(value: unknown): TransformationSpec {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("transformation spec must be an object");
  const raw = value as Record<string, unknown>;
  const template = requireString(raw.template, "template");
  if (!(TRANSFORMATION_TEMPLATES as readonly string[]).includes(template)) throw new Error(`unsupported transformation template: ${template}`);
  const derivesOutputs = template === "sdk-call-order";
  if (derivesOutputs) {
    if (raw.outputs !== undefined) throw new Error("sdk-call-order derives its own outputs; do not supply an outputs list");
    const region = raw.region as Record<string, unknown> | undefined;
    if (!region || typeof region !== "object" || Array.isArray(region)) throw new Error("sdk-call-order requires a region object");
    if (!Array.isArray(region.statements) || region.statements.some((item) => typeof item !== "string" || !item.trim())) {
      throw new Error("region.statements must be an array of non-empty statement strings");
    }
    if (region.statements.length < MIN_SDK_CALLS || region.statements.length > MAX_SDK_CALLS) {
      throw new Error(`region.statements must hold ${MIN_SDK_CALLS} to ${MAX_SDK_CALLS} adjacent SDK macro calls`);
    }
  } else if (!Array.isArray(raw.outputs) || raw.outputs.length === 0) {
    throw new Error("outputs must contain at least one generated variant");
  }
  const spec: TransformationSpec = {
    schemaVersion: 1,
    function: requireString(raw.function, "function"),
    template: template as TransformationTemplate,
    baseSourcePath: requireString(raw.baseSourcePath, "baseSourcePath"),
    expectedPass: requireString(raw.expectedPass, "expectedPass"),
    outputs: derivesOutputs ? [] : (raw.outputs as unknown[]).map(parseOutput),
  };
  if (derivesOutputs) {
    spec.region = { statements: (raw.region as { statements: string[] }).statements.map(String) };
  }
  if (raw.outputDirectory !== undefined) spec.outputDirectory = requireString(raw.outputDirectory, "outputDirectory");
  const ids = new Set<string>();
  for (const output of spec.outputs) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(output.id)) throw new Error(`unsafe transformation output id: ${output.id}`);
    if (ids.has(output.id)) throw new Error(`duplicate transformation output id: ${output.id}`);
    ids.add(output.id);
  }
  if (spec.outputs.filter((output) => output.baseline).length > 1) throw new Error("at most one generated output may be the baseline");
  return spec;
}

function countOccurrences(source: string, find: string): number {
  let count = 0;
  let offset = 0;
  while ((offset = source.indexOf(find, offset)) >= 0) {
    count++;
    offset += find.length;
  }
  return count;
}

export function applyExactEdits(source: string, edits: ExactSourceEdit[]): string {
  let result = source;
  for (const edit of edits) {
    const expected = edit.occurrences ?? 1;
    const actual = countOccurrences(result, edit.find);
    if (actual !== expected) {
      throw new Error(`transformation expected ${expected} occurrence(s), found ${actual}: ${JSON.stringify(edit.find.slice(0, 80))}`);
    }
    result = result.split(edit.find).join(edit.replace);
  }
  return result;
}

/* --- sdk-call-order: derive the admissible orders from the SDK header --- */

export interface SdkCallOrderPlan {
  /** Byte range of the whole run in the base source. */
  span: { start: number; end: number };
  /** Indentation to re-emit each statement with. */
  indent: string;
  calls: Array<{ id: string; macro: string; statement: string; publication: boolean }>;
  dependencies: Array<{ from: string; to: string; kind: string }>;
  /** Each admitted order as indexes into `calls`, current order first. */
  orders: number[][];
  suppressed: string[];
}

/**
 * Locate the run in the base source and enumerate its dependency-valid orders.
 *
 * Every statement has to be a call to a macro the configured SDK header
 * defines and the registry has verified, and the run has to be contiguous —
 * only whitespace may separate the statements. Anything else refuses, because
 * a permutation that silently swallowed a comment, a declaration, or an
 * unrecognized call would be reordering something this has no model of.
 */
export function planSdkCallOrder(
  functionName: string,
  source: string,
  statements: string[],
): SdkCallOrderPlan {
  const registry = loadMacroRegistry();
  /* The same front end and web analysis the residual search uses, so the
   * edges here are the edges there — a fallback that disagreed with the
   * automatic stratum would be worse than no fallback. */
  const graph = buildSemanticGraph(functionName, `${functionName}.c`, source, registry);
  const view = analyzeWebs(graph);
  const variableNames = new Set(graph.variables.map((variable) => variable.name));

  const spans: Array<{ start: number; end: number }> = [];
  for (const statement of statements) {
    const trimmed = statement.trim();
    if (countOccurrences(source, trimmed) !== 1) {
      throw new Error(`sdk-call-order statement must appear exactly once in the base source: ${JSON.stringify(trimmed)}`);
    }
    const start = source.indexOf(trimmed);
    spans.push({ start, end: start + trimmed.length });
  }
  for (let index = 1; index < spans.length; index++) {
    if (spans[index]!.start < spans[index - 1]!.end) throw new Error("sdk-call-order statements overlap");
    const between = source.slice(spans[index - 1]!.end, spans[index]!.start);
    if (between.trim() !== "") {
      throw new Error(
        `sdk-call-order statements must be adjacent; ${JSON.stringify(between.trim().slice(0, 40))} sits between them`);
    }
  }

  const lineStart = source.lastIndexOf("\n", spans[0]!.start) + 1;
  const indent = source.slice(lineStart, spans[0]!.start);
  if (indent.trim() !== "") throw new Error("the first sdk-call-order statement must start its own line");

  const calls = statements.map((statement, index) => {
    const trimmed = statement.trim();
    const span = spans[index]!;
    const node = graph.nodes.find((candidate) =>
      candidate.span.start === span.start && candidate.span.end === span.end);
    if (!node) {
      throw new Error(`sdk-call-order statement is not a modelled statement of ${functionName}: ${JSON.stringify(trimmed)}`);
    }
    if (node.kind !== "known-macro" || node.macro === undefined) {
      throw new Error(
        `sdk-call-order statement is not a verified SDK macro call: ${JSON.stringify(trimmed)} — ` +
        (node.evidence[0] ?? "unclassified"));
    }
    /* Every call must leave the pointer variables alone, or the run's webs
     * are not the single webs the ordering model assumes. */
    if (node.writes.length > 0) {
      throw new Error(`sdk-call-order statement writes a scalar variable and cannot be permuted atomically: ${JSON.stringify(trimmed)}`);
    }
    return { id: `c${index}`, macro: node.macro, statement: trimmed, publication: node.publishes === true, node };
  });

  const views: RegionNodeView[] = calls.map((call) => {
    const lookup = webLookupId(call.node.id);
    const webAt = (variable: string) =>
      view.reaching.get(lookup)?.get(variable) ?? view.defWebs.get(lookup)?.get(variable);
    return {
      id: call.id,
      node: call.node,
      reads: new Set(call.node.reads),
      writes: new Set(call.node.writes),
      memoryReads: call.node.memoryReads.map((token) => parseMemoryToken(token, webAt, (name) => variableNames.has(name))),
      memoryWrites: call.node.memoryWrites.map((token) => parseMemoryToken(token, webAt, (name) => variableNames.has(name))),
    };
  });
  const dataflow = regionDependencies(views);
  const barriers = publicationBarrierDependencies(views)
    .filter((edge) => !dataflow.some((existing) => existing.from === edge.from && existing.to === edge.to));
  const dependencies = [...dataflow, ...barriers];

  const model = RegionOrderModel.fromDependencies(calls.map((call) => call.id), dependencies);
  const total = model.count();
  const orders: number[][] = [];
  for (let rank = 0n; rank < total; rank++) orders.push(model.unrank(rank));

  const suppressed: string[] = [];
  let unconstrained = 1n;
  for (let index = 2n; index <= BigInt(calls.length); index++) unconstrained *= index;
  if (dataflow.length > 0) {
    suppressed.push(`${dataflow.length} dataflow edge(s): ${dataflow.map((edge) => `${edge.from}->${edge.to} (${edge.kind})`).join(", ")}`);
  }
  if (barriers.length > 0) {
    suppressed.push(`${barriers.length} publication barrier edge(s): ${barriers.map((edge) => `${edge.from}->${edge.to} (${edge.kind})`).join(", ")}`);
  }
  suppressed.push(`${unconstrained - total} of ${unconstrained} orders excluded`);

  return {
    span: { start: spans[0]!.start, end: spans[spans.length - 1]!.end },
    indent,
    calls: calls.map(({ id, macro, statement, publication }) => ({ id, macro, statement, publication })),
    dependencies,
    orders,
    suppressed,
  };
}

function sdkCallOrderOutputs(source: string, spec: TransformationSpec): TransformationOutput[] {
  const plan = planSdkCallOrder(spec.function, source, spec.region!.statements);
  const original = source.slice(plan.span.start, plan.span.end);
  return plan.orders.map((order, index) => {
    const replacement = order
      .map((position, slot) => `${slot === 0 ? "" : plan.indent}${plan.calls[position]!.statement}`)
      .join("\n");
    const identity = order.every((position, slot) => position === slot);
    return {
      id: `p${String(index).padStart(2, "0")}`,
      expectedEffect:
        `SDK call birth order ${order.map((position) => plan.calls[position]!.macro).join(" -> ")}` +
        (identity ? " (the source's current order)" : ""),
      invariants: [
        "every statement is one complete verified SDK macro call; no macro expansion is split",
        `dependency edges preserved: ${plan.dependencies.length === 0 ? "none" : plan.dependencies.map((edge) => edge.kind).join(", ")}`,
        ...plan.suppressed,
      ],
      edits: [{ find: original, replace: replacement }],
      ...(identity ? { baseline: true } : {}),
    };
  });
}

export function generateTransformationVariants(specPath: string, functionName: string): VariantHypothesis[] {
  const absoluteSpec = isAbsolute(specPath) ? specPath : join(ROOT, specPath);
  if (!existsSync(absoluteSpec)) throw new Error(`transformation spec not found: ${specPath}`);
  const spec = validateTransformationSpec(JSON.parse(readFileSync(absoluteSpec, "utf8")));
  if (spec.function !== functionName) throw new Error(`transformation spec targets ${spec.function}, not ${functionName}`);
  const basePath = isAbsolute(spec.baseSourcePath) ? spec.baseSourcePath : join(ROOT, spec.baseSourcePath);
  if (!existsSync(basePath)) throw new Error(`transformation base source not found: ${spec.baseSourcePath}`);
  const base = readFileSync(basePath, "utf8");
  const outputDirectory = resolve(ROOT, spec.outputDirectory || join("build/variant-lab/generated", functionName, spec.template));
  const related = relative(ROOT, outputDirectory).replace(/\\/g, "/");
  if (related.startsWith("../") || (related !== "build" && !related.startsWith("build/"))) {
    throw new Error("generated transformation outputDirectory must be under build/");
  }
  mkdirSync(outputDirectory, { recursive: true });

  /* Generated-global definitions the base source already owns carry through a
   * transformation; only one the edits newly introduce is a policy violation. */
  const inheritedGeneratedGlobals = findGeneratedGlobalDefinitions(base).map((definition) => definition.symbol);

  /* `sdk-call-order` is the only template that authors its own outputs: the
   * admissible orders are derived from the configured SDK header's verified
   * macro effects, so an operator names the region and never a permutation. */
  const outputs = spec.template === "sdk-call-order" ? sdkCallOrderOutputs(base, spec) : spec.outputs;

  return outputs.map((output) => {
    const transformed = applyExactEdits(base, output.edits);
    const findings = validateVariantSource(transformed, { inheritedGeneratedGlobals });
    if (findings.length > 0) {
      const first = findings[0];
      throw new Error(`generated ${output.id}.c:${first.line}: ${first.message}`);
    }
    const path = join(outputDirectory, `${output.id}.c`);
    writeFileSync(path, transformed);
    return {
      id: output.id,
      sourcePath: projectPath(path),
      mechanism: TEMPLATE_MECHANISM[spec.template],
      expectedPass: spec.expectedPass,
      expectedEffect: output.expectedEffect,
      invariants: output.invariants,
      baseline: output.baseline,
    };
  });
}
