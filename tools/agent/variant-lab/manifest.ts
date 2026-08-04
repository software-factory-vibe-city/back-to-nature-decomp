import { existsSync, readFileSync } from "node:fs";
import { basename, isAbsolute, join } from "node:path";
import { ROOT } from "../decompToolchain.js";
import { sha256File } from "./artifacts.js";
import {
  VARIANT_MECHANISMS,
  type ResolvedVariantHypothesis,
  type SourceFinding,
  type VariantHypothesis,
  type VariantManifest,
  type VariantMechanism,
} from "./types.js";

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const MECHANISMS = new Set<string>(VARIANT_MECHANISMS);

function object(value: unknown, context: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${context} must be an object`);
  return value as Record<string, unknown>;
}

function nonempty(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} must be a non-empty string`);
  return value.trim();
}

function stringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`${field} must be an array of non-empty strings`);
  }
  return value.map((item) => String(item).trim());
}

export function validateHypothesis(value: unknown, index = 0): VariantHypothesis {
  const raw = object(value, `variants[${index}]`);
  const id = nonempty(raw.id, `variants[${index}].id`);
  if (!ID_PATTERN.test(id)) throw new Error(`variants[${index}].id contains unsafe characters: ${id}`);
  const sourcePath = nonempty(raw.sourcePath, `variants[${index}].sourcePath`);
  const mechanism = nonempty(raw.mechanism, `variants[${index}].mechanism`);
  if (!MECHANISMS.has(mechanism)) throw new Error(`variants[${index}].mechanism is not supported: ${mechanism}`);
  const hypothesis: VariantHypothesis = {
    id,
    sourcePath,
    mechanism: mechanism as VariantMechanism,
    expectedPass: nonempty(raw.expectedPass, `variants[${index}].expectedPass`),
    expectedEffect: nonempty(raw.expectedEffect, `variants[${index}].expectedEffect`),
    invariants: stringArray(raw.invariants, `variants[${index}].invariants`),
  };
  if (raw.baseline !== undefined) {
    if (typeof raw.baseline !== "boolean") throw new Error(`variants[${index}].baseline must be boolean`);
    hypothesis.baseline = raw.baseline;
  }
  return hypothesis;
}

export function validateManifest(value: unknown, functionName?: string): VariantManifest {
  const raw = object(value, "manifest");
  if (raw.schemaVersion !== undefined && raw.schemaVersion !== 1) throw new Error("manifest.schemaVersion must be 1");
  if (raw.function !== undefined && typeof raw.function !== "string") throw new Error("manifest.function must be a string");
  if (functionName && raw.function && raw.function !== functionName) {
    throw new Error(`manifest targets ${raw.function}, not ${functionName}`);
  }
  if (!Array.isArray(raw.variants) || raw.variants.length === 0) throw new Error("manifest.variants must contain at least one hypothesis");
  const variants = raw.variants.map((variant, index) => validateHypothesis(variant, index));
  const ids = new Set<string>();
  let baselines = 0;
  for (const variant of variants) {
    if (ids.has(variant.id)) throw new Error(`duplicate variant id: ${variant.id}`);
    ids.add(variant.id);
    if (variant.baseline) baselines++;
  }
  if (baselines > 1) throw new Error("manifest may mark at most one variant as baseline");
  return { schemaVersion: 1, function: raw.function as string | undefined, variants };
}

export function loadManifest(path: string, functionName: string): VariantManifest {
  const absolute = isAbsolute(path) ? path : join(ROOT, path);
  if (!existsSync(absolute)) throw new Error(`variant manifest not found: ${path}`);
  try {
    return validateManifest(JSON.parse(readFileSync(absolute, "utf8")), functionName);
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(`invalid JSON in variant manifest ${path}: ${error.message}`);
    throw error;
  }
}

export function hypothesesFromPaths(
  paths: string[],
  metadata: { mechanism?: string; expectedPass?: string; expectedEffect?: string; invariants: string[] },
): VariantHypothesis[] {
  if (!metadata.mechanism || !metadata.expectedPass || !metadata.expectedEffect) {
    throw new Error("positional variants require --mechanism, --expected-pass, and --expected-effect; use --manifest for per-variant hypotheses");
  }
  return paths.map((sourcePath, index) => validateHypothesis({
    id: basename(sourcePath, ".c") || `variant-${index + 1}`,
    sourcePath,
    mechanism: metadata.mechanism,
    expectedPass: metadata.expectedPass,
    expectedEffect: metadata.expectedEffect,
    invariants: metadata.invariants,
  }, index));
}

function lineNumber(source: string, offset: number): number {
  return source.slice(0, offset).split("\n").length;
}

export interface VariantSourceValidationOptions {
  allowEmptyMemoryBarriers?: boolean;
  /**
   * Generated-global symbols the baseline source already defines in-file.
   *
   * A translation unit that owns a generated global sometimes has to carry its
   * own tentative definition: some assemblers emit a gp-relative access only
   * for a symbol the file itself declares, so the in-file declaration is the
   * mechanism under test rather than a stray redeclaration. Like an inherited
   * empty memory barrier, such a definition is protected when it comes from
   * the baseline and is still rejected when a candidate introduces a new one.
   */
  inheritedGeneratedGlobals?: readonly string[];
}

const EMPTY_MEMORY_BARRIER = /\b(?:__asm__|__asm)\s*(?:volatile\s*)?\(\s*""\s*:\s*:\s*:\s*"memory"\s*\)\s*;/g;

const GENERATED_GLOBAL = /^[ \t]*(?:extern[ \t]+)?(?:static[ \t]+)?(?:const[ \t]+)?(?:signed[ \t]+|unsigned[ \t]+)?(?:struct[ \t]+\w+|union[ \t]+\w+|enum[ \t]+\w+|[A-Za-z_]\w*)[ \t]+\**[ \t]*(D_[0-9A-Fa-f]{8})\b[ \t]*(?:\[|;|=)/gm;

/**
 * Generated-global definitions the file makes itself, excluding plain `extern`
 * redeclarations: only a definition changes code generation, so only a
 * definition can be an inherited mechanism worth protecting.
 */
export function findGeneratedGlobalDefinitions(source: string): Array<{ start: number; end: number; symbol: string }> {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "));
  const result: Array<{ start: number; end: number; symbol: string }> = [];
  GENERATED_GLOBAL.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = GENERATED_GLOBAL.exec(code)) !== null) {
    if (/^[ \t]*extern\b/.test(match[0])) continue;
    result.push({ start: match.index, end: match.index + match[0].length, symbol: match[1]! });
  }
  return result;
}

export function findEmptyMemoryBarriers(source: string): Array<{ start: number; end: number; text: string; normalized: string }> {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "));
  const result: Array<{ start: number; end: number; text: string; normalized: string }> = [];
  EMPTY_MEMORY_BARRIER.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = EMPTY_MEMORY_BARRIER.exec(code)) !== null) {
    const text = source.slice(match.index, match.index + match[0].length);
    result.push({
      start: match.index,
      end: match.index + match[0].length,
      text,
      normalized: text.replace(/\s+/g, ""),
    });
  }
  return result;
}

export function validateVariantSource(source: string, options: VariantSourceValidationOptions = {}): SourceFinding[] {
  const findings: SourceFinding[] = [];
  let code = source.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "));
  if (options.allowEmptyMemoryBarriers) {
    const characters = code.split("");
    for (const barrier of findEmptyMemoryBarriers(source)) {
      for (let index = barrier.start; index < barrier.end; index++) {
        if (characters[index] !== "\n") characters[index] = " ";
      }
    }
    code = characters.join("");
  }
  if (options.inheritedGeneratedGlobals?.length) {
    const inherited = new Set(options.inheritedGeneratedGlobals);
    const characters = code.split("");
    for (const definition of findGeneratedGlobalDefinitions(source)) {
      if (!inherited.has(definition.symbol)) continue;
      for (let index = definition.start; index < definition.end; index++) {
        if (characters[index] !== "\n") characters[index] = " ";
      }
    }
    code = characters.join("");
  }
  const patterns: Array<{ pattern: RegExp; kind: SourceFinding["kind"]; message: string; raw?: boolean; symbolGroup?: number }> = [
    { pattern: /\bINCLUDE_ASM\s*\(/g, kind: "forbidden-construct", message: "assembly stubs are forbidden" },
    { pattern: /\b(?:__asm__|__asm|asm)\s*(?:volatile\s*)?\(/g, kind: "forbidden-construct", message: "embedded assembly is forbidden" },
    { pattern: /\bregister\b[^;\n]*\b(?:__asm__|__asm)\s*\(/g, kind: "forbidden-construct", message: "hard-register pinning is forbidden" },
    { pattern: /^\s*#\s*pragma\b/gm, kind: "forbidden-construct", message: "per-source compiler pragmas are forbidden" },
    { pattern: /\/\//g, kind: "c99", message: "C++ line comments are not valid project C89 style", raw: true },
    { pattern: /\bfor\s*\(\s*(?:const\s+)?(?:char|short|int|long|signed|unsigned|s\d+|u\d+)\s+[A-Za-z_]/g, kind: "c99", message: "for-loop declarations require C99" },
    { pattern: /\b(?:inline|restrict|_Bool)\b/g, kind: "c99", message: "C99-only keyword is forbidden" },
    { pattern: GENERATED_GLOBAL, kind: "generated-global", message: "generated globals must come from the designated header", symbolGroup: 1 },
  ];
  for (const rule of patterns) {
    rule.pattern.lastIndex = 0;
    const input = rule.raw ? source : code;
    let match: RegExpExecArray | null;
    while ((match = rule.pattern.exec(input)) !== null) {
      /* Report the symbol itself, not the start of the leading whitespace run. */
      const symbol = rule.symbolGroup === undefined ? undefined : match[rule.symbolGroup];
      const offset = symbol === undefined ? match.index : match.index + match[0].indexOf(symbol);
      findings.push({
        line: lineNumber(input, offset),
        kind: rule.kind,
        message: symbol === undefined ? rule.message : `${rule.message}: ${symbol}`,
      });
      if (match[0].length === 0) rule.pattern.lastIndex++;
    }
  }
  return findings;
}

export function resolveHypotheses(hypotheses: VariantHypothesis[]): ResolvedVariantHypothesis[] {
  const ids = new Set<string>();
  let baselines = 0;
  for (const hypothesis of hypotheses) {
    if (ids.has(hypothesis.id)) throw new Error(`duplicate variant id: ${hypothesis.id}`);
    ids.add(hypothesis.id);
    if (hypothesis.baseline) baselines++;
  }
  if (baselines !== 1) throw new Error(`exactly one baseline is required after input resolution; found ${baselines}`);
  return hypotheses.map((hypothesis) => {
    const absoluteSourcePath = isAbsolute(hypothesis.sourcePath)
      ? hypothesis.sourcePath
      : join(ROOT, hypothesis.sourcePath);
    if (!existsSync(absoluteSourcePath)) throw new Error(`variant source not found: ${hypothesis.sourcePath}`);
    if (!hypothesis.sourcePath.endsWith(".c")) throw new Error(`variant source must be a .c file: ${hypothesis.sourcePath}`);
    const source = readFileSync(absoluteSourcePath, "utf8");
    const findings = validateVariantSource(source);
    if (findings.length > 0) {
      const first = findings[0];
      throw new Error(`${hypothesis.sourcePath}:${first.line}: ${first.message}`);
    }
    return { ...hypothesis, absoluteSourcePath, sourceHash: sha256File(absoluteSourcePath) };
  });
}
