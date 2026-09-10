/**
 * callee-signature.ts — The signature oracle (S2 of
 * plans/matching-reconstruction-call-signatures.md).
 *
 * Resolve a callee to a `CalleeSignature` — arity, parameter types, and return
 * type — drawing on evidence in this priority order:
 *
 *   1. The callee's own matched definition, parsed from the generated
 *      function header for its container (`include/functions.h` for the exe,
 *      `include/overlays/<id>.h` for an overlay) with the tree-sitter front
 *      end. The callee must be genuinely matched (its `src/` file is real C,
 *      not an `INCLUDE_ASM` stub) — `definitionPrototype` from `calleeTruth.ts`
 *      already encodes that rule, so a stub's generated signature is never
 *      read back as evidence.
 *   2. A PSY-Q SDK / library prototype from the vendored headers.
 *   3. ABI / frame evidence: the callee's own target code, with a
 *      conservative arity (an argument register read before definition is a
 *      real parameter) and the return-value proof.
 *   4. Otherwise `{ unknown: <why> }`.
 *
 * "Unknown" is a first-class answer — never fabricate an arity or a type.
 */

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Container } from "../../lib/container.js";
import { ROOT } from "../decompToolchain.js";
import { definitionPrototype, sdkPrototypes, targetWitness } from "../calleeTruth.js";
import {
  children,
  field,
  parseC,
  walk,
  type Node,
} from "../residual-source-search/tree-sitter-c.js";

/* ------------------------------------------------------------------ */
/* CalleeSignature                                                     */
/* ------------------------------------------------------------------ */

export type SignatureSource = "matched" | "sdk" | "abi";

export interface CalleeSignature {
  arity: number;
  paramTypes: string[];
  returnsValue: boolean;
  returnType: string;
  /** Which evidence tier produced this signature. */
  source: SignatureSource;
}

export type SignatureResult = CalleeSignature | { unknown: string };

/** Collapse a tree-sitter subtree to one-line text, comments removed. */
function flatten(node: Node): string {
  const tokens: string[] = [];
  const collect = (item: Node): void => {
    if (item.type === "comment") return;
    const kids = children(item);
    if (kids.length === 0) {
      tokens.push(item.text);
      return;
    }
    for (const kid of kids) collect(kid);
  };
  collect(node);
  return tokens
    .join(" ")
    .replace(/\s+([,)\];])/g, "$1")
    .replace(/([(\[])\s+/g, "$1")
    .replace(/\*\s+/g, "*")
    .trim();
}

/**
 * Find one function declaration for `callee` in parsed header text and read
 * its arity, parameter types, and return type. Returns null when the
 * declaration is absent or unreadable.
 */
function parseHeaderSignature(
  callee: string,
  tree: ReturnType<typeof parseC>,
): { arity: number; paramTypes: string[]; returnsVoid: boolean; line: number } | null {
  let result: { arity: number; paramTypes: string[]; returnsVoid: boolean; line: number } | null = null;
  walk(tree.rootNode, (node) => {
    if (result) return false;
    if (node.type !== "declaration") return true;
    const returnType = field(node, "type");
    if (!returnType) return false;
    for (const declarator of node.childrenForFieldName("declarator")) {
      if (!declarator) continue;
      /* Unwrap pointer declarators so `TYPE (*f)(...)` reads as f. */
      let core = declarator;
      while (core.type === "pointer_declarator") {
        const inner = field(core, "declarator");
        if (!inner) break;
        core = inner;
      }
      if (core.type !== "function_declarator") continue;
      const nameNode = field(core, "declarator");
      const params = field(core, "parameters");
      if (!nameNode || !params || nameNode.type !== "identifier") continue;
      if (nameNode.text !== callee) continue;

      const paramDecls = children(params).filter((child) => child.type === "parameter_declaration");
      const voidParam = paramDecls.length === 1 && flatten(paramDecls[0]!) === "void";
      const arity = voidParam ? 0 : paramDecls.length;
      const paramTypes = voidParam ? [] : paramDecls.map((decl) => {
        const typeNode = field(decl, "type");
        return typeNode ? flatten(typeNode) : "s32";
      });
      const returnsVoid = flatten(returnType) === "void";
      result = { arity, paramTypes, returnsVoid, line: node.startPosition.row + 1 };
      return false;
    }
    return false;
  });
  return result;
}

/** The generated function header for a callee's container, or null. */
function generatedHeaderPath(container: Container): string | null {
  if (container.id === "exe") {
    const path = join(ROOT, "include/functions.h");
    return existsSync(path) ? path : null;
  }
  const overlayId = container.id.replace(/^ovl_/, "");
  const path = join(ROOT, `include/overlays/${overlayId}.h`);
  return existsSync(path) ? path : null;
}

/* ------------------------------------------------------------------ */
/* Tier 1 — the callee's own matched definition                        */
/* ------------------------------------------------------------------ */

/**
 * The callee's matched signature from the generated header for its container.
 *
 * Gated on `definitionPrototype`, which only answers for a genuinely matched
 * callee — a `src/` file that is real C, not an `INCLUDE_ASM` stub. Trusting
 * the generated header for a stub would be reading a guess back; the gate
 * keeps that circularity out.
 */
function matchedDefinition(callee: string, container: Container): SignatureResult | null {
  const matched = definitionPrototype(callee);
  if (!matched) return null;

  const headerPath = generatedHeaderPath(container);
  if (!headerPath) return null;
  let tree;
  try {
    tree = parseC(readFileSync(headerPath, "utf-8"));
  } catch {
    return null;
  }
  const parsed = parseHeaderSignature(callee, tree);
  if (!parsed) return null;

  return {
    arity: parsed.arity,
    paramTypes: parsed.paramTypes,
    returnsValue: !parsed.returnsVoid,
    returnType: parsed.returnsVoid ? "void" : "s32",
    source: "matched",
  };
}

/* ------------------------------------------------------------------ */
/* Tier 2 — SDK / library prototype                                    */
/* ------------------------------------------------------------------ */

/**
 * A PSY-Q library entry point from the vendored SDK headers.
 * `parameters === null` means a K&R `()` list, which declares nothing — not
 * evidence of zero arguments. Variadic functions also return null because
 * their arity cannot be bounded from the prototype alone — v1 refuses
 * honestly rather than guess a fixed count.
 */
function sdkPrototype(callee: string): SignatureResult | null {
  const proto = sdkPrototypes().get(callee);
  if (!proto || proto.parameters === null || proto.variadic) return null;
  return {
    arity: proto.parameters,
    paramTypes: [],
    returnsValue: !proto.returnsVoid,
    returnType: proto.returnsVoid ? "void" : "s32",
    source: "sdk",
  };
}

/* ------------------------------------------------------------------ */
/* Tier 3 — ABI / frame evidence                                       */
/* ------------------------------------------------------------------ */

/**
 * What the callee's own target code proves: a conservative arity floor from
 * its read-before-write argument registers, and the return-value proof.
 * An argument register the callee reads before defining is a real parameter;
 * the frame map contributes stack parameters. Marked `abi`, lower confidence.
 */
function abiEvidence(callee: string): SignatureResult | null {
  const scratch = join(ROOT, "build/calleeSignature");
  mkdirSync(scratch, { recursive: true });
  const witness = targetWitness(callee, scratch);
  if (!witness?.arity) {
    return { unknown: `the target code of ${callee} could not be disassembled or yields no frame evidence` };
  }
  const returns = witness.returns;
  return {
    arity: witness.arity.min,
    paramTypes: [],
    returnsValue: returns?.type === "s32",
    returnType: returns?.type === "void" ? "void" : "s32",
    source: "abi",
  };
}

/* ------------------------------------------------------------------ */
/* Public API                                                           */
/* ------------------------------------------------------------------ */

/**
 * Resolve a callee to its signature, or say honestly why it is unknown.
 *
 * @param name    The resolved symbol name (S1). Null when the target was
 *                not resolvable, or the call was indirect.
 * @param address The numeric call target (S1).
 * @param container The container in which the call site lives — used to pick
 *                the generated header (functions.h vs overlays/<id>.h).
 */
export function resolveSignature(
  name: string | null | undefined,
  address: number | undefined,
  container: Container,
): SignatureResult {
  if (!name) {
    return { unknown: address === undefined ? "indirect call target is not resolvable to a symbol" : `no symbol resolves the call target 0x${(address >>> 0).toString(16)}` };
  }
  const matched = matchedDefinition(name, container);
  if (matched) return matched;
  const sdk = sdkPrototype(name);
  if (sdk) return sdk;
  const abi = abiEvidence(name);
  if (abi) return abi;
  return { unknown: `no signature evidence for ${name} — not matched, not an SDK entry point, and its target code gives none` };
}