import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { ROOT } from "../decompToolchain.js";
import { projectPath } from "./artifacts.js";
import { validateVariantSource } from "./manifest.js";
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
};

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
  if (!Array.isArray(raw.outputs) || raw.outputs.length === 0) throw new Error("outputs must contain at least one generated variant");
  const spec: TransformationSpec = {
    schemaVersion: 1,
    function: requireString(raw.function, "function"),
    template: template as TransformationTemplate,
    baseSourcePath: requireString(raw.baseSourcePath, "baseSourcePath"),
    expectedPass: requireString(raw.expectedPass, "expectedPass"),
    outputs: raw.outputs.map(parseOutput),
  };
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

  return spec.outputs.map((output) => {
    const transformed = applyExactEdits(base, output.edits);
    const findings = validateVariantSource(transformed);
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
