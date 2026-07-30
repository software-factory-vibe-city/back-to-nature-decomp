import { sha256 } from "../variant-lab/artifacts.js";
import { stripComments } from "./semantic-graph.js";
import type { SemanticGraph } from "./types.js";

/**
 * Alpha-canonical source hash: comments removed, whitespace collapsed, and
 * every local-variable-like identifier renamed to L<n> in first-occurrence
 * order. Two candidates with equal canonical hashes are the same grammar
 * representation (a proven congruence), so only one is compiled.
 */

export interface CanonicalContext {
  /** Identifiers that must keep their spelling (params, globals, types, fields, keywords). */
  reserved: Set<string>;
}

export function canonicalContext(graph: SemanticGraph, source: string): CanonicalContext {
  const locals = new Set(graph.variables.filter((variable) => variable.kind === "local").map((variable) => variable.name));
  const reserved = new Set<string>([graph.function]);
  for (const parameter of graph.parameters) reserved.add(parameter.name);
  for (const match of stripComments(source).matchAll(/\b[A-Za-z_]\w*\b/g)) {
    if (!locals.has(match[0]!)) reserved.add(match[0]!);
  }
  return { reserved };
}

export function canonicalSourceHash(source: string, context: CanonicalContext): string {
  const stripped = stripComments(source);
  let result = "";
  let index = 0;
  const renames = new Map<string, string>();
  let previous = "";
  let beforePrevious = "";
  let state: "code" | "string" | "char" = "code";
  while (index < stripped.length) {
    const character = stripped[index]!;
    if (state === "string" || state === "char") {
      result += character;
      if (character === "\\") {
        result += stripped[index + 1] ?? "";
        index += 2;
        continue;
      }
      if ((state === "string" && character === '"') || (state === "char" && character === "'")) state = "code";
      index++;
      continue;
    }
    if (character === '"') { state = "string"; result += character; index++; continue; }
    if (character === "'") { state = "char"; result += character; index++; continue; }
    if (/[A-Za-z_]/.test(character)) {
      const match = stripped.slice(index).match(/^[A-Za-z_]\w*/)!;
      const name = match[0];
      const isField = previous === "." || (previous === ">" && beforePrevious === "-");
      let token = name;
      if (!isField && !context.reserved.has(name)) {
        let rename = renames.get(name);
        if (!rename) {
          rename = `L${renames.size}`;
          renames.set(name, rename);
        }
        token = rename;
      }
      result += token;
      index += name.length;
      beforePrevious = previous;
      previous = name[name.length - 1]!;
      continue;
    }
    if (/\s/.test(character)) {
      if (result.length > 0 && !result.endsWith(" ")) result += " ";
      index++;
      continue;
    }
    result += character;
    beforePrevious = previous;
    previous = character;
    index++;
  }
  return sha256(result.replace(/\s+/g, " ").trim());
}
