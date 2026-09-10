/**
 * callee-signature.ts — The signature oracle (S2 of
 * plans/matching-reconstruction-call-signatures.md) and the
 * inference-range estimator (T1 of
 * plans/matching-reconstruction-inferred-call-signatures.md).
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
 *      read back as evidence. For cross-container calls (overlay calling an
 *      exe function), also checks `include/functions.h`.
 *   2. A PSY-Q SDK / library prototype from the vendored headers.
 *   3. ABI / frame evidence: the callee's own target code, with a
 *      conservative arity (an argument register read before definition is a
 *      real parameter) and the return-value proof.
 *   4. Otherwise `{ unknown: <why> }`.
 *
 * "Unknown" is a first-class answer — never fabricate an arity or a type.
 *
 * When the signature is unknown but the callee is a named, direct target,
 * `inferSignatureRange` estimates a bounded range of plausible arities and
 * a returns-value signal from the callee's own machine code and the caller's
 * call-site evidence. The engine enumerates within that range rather than
 * dropping the call.
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
import type { SymExpr } from "./types.js";

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

/** The generated function header for a container, or null. */
function generatedHeaderPath(container: Container): string | null {
  if (container.id === "exe") {
    const path = join(ROOT, "include/functions.h");
    return existsSync(path) ? path : null;
  }
  const overlayId = container.id.replace(/^ovl_/, "");
  const path = join(ROOT, `include/overlays/${overlayId}.h`);
  return existsSync(path) ? path : null;
}

/** The exe's generated function header, for cross-container resolution. */
function exeHeaderPath(): string | null {
  const path = join(ROOT, "include/functions.h");
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
 *
 * For a callee defined in the exe but called from an overlay, also searches
 * `include/functions.h` as a fallback (cross-container reference).
 */
function matchedDefinition(callee: string, container: Container): SignatureResult | null {
  const matched = definitionPrototype(callee);
  if (!matched) return null;

  /* Try the container's own header first (functions.h for exe,
   * overlays/<id>.h for an overlay). */
  const ownHeader = generatedHeaderPath(container);
  if (ownHeader) {
    try {
      const tree = parseC(readFileSync(ownHeader, "utf-8"));
      const parsed = parseHeaderSignature(callee, tree);
      if (parsed) {
        return {
          arity: parsed.arity,
          paramTypes: parsed.paramTypes,
          returnsValue: !parsed.returnsVoid,
          returnType: parsed.returnsVoid ? "void" : "s32",
          source: "matched",
        };
      }
    } catch {
      /* fall through to cross-container check */
    }
  }

  /* Cross-container fallback: an overlay function calling an exe function.
   * The exe's functions.h declares it even if the overlay's header does not. */
  if (container.id !== "exe") {
    const exeHeader = exeHeaderPath();
    if (exeHeader) {
      try {
        const tree = parseC(readFileSync(exeHeader, "utf-8"));
        const parsed = parseHeaderSignature(callee, tree);
        if (parsed) {
          return {
            arity: parsed.arity,
            paramTypes: parsed.paramTypes,
            returnsValue: !parsed.returnsVoid,
            returnType: parsed.returnsVoid ? "void" : "s32",
            source: "matched",
          };
        }
      } catch {
        return null;
      }
    }
  }

  return null;
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
/* Inferred signature range (T1)                                       */
/* ------------------------------------------------------------------ */

export interface InferredSignatureRange {
  arityLo: number;
  arityHi: number;
  returns: "yes" | "no" | "unknown";
}

/**
 * Estimate a bounded range of plausible signatures for an unknown callee.
 *
 * Draws on three sources of evidence, all from bytes — no decompilation:
 *
 *   1. **Callee's own machine code** (via `targetWitness`): the argument
 *      registers the callee reads before writing establish a *lower* bound
 *      on arity (`arityLo`). Whether the callee writes `$v0` before a return
 *      is a returns-value signal (strengthens an existing tier-3 facility).
 *   2. **Caller's argument setup at the call site**: the highest argument
 *      register index into which the caller wrote a *non-passthrough* value
 *      gives an *upper* hint (`arityHi`). A non-passthrough value is any
 *      expression that is not a bare `entry(aN)` — it is an explicit
 *      argument the caller computed. Default 4 when unclear.
 *   3. **Caller's use of `$v0`**: if the caller reads the call's result
 *      (`call-result` for this seq appears in later expressions), then
 *      `returns = "yes"`. If the caller never reads it, `returns =
 *      "unknown"` (NOT "no").
 *
 * Safe defaults when evidence is silent: arityLo = 0, arityHi = 4,
 * returns = "unknown". Clamped to [0, 4].
 *
 * @param name    Resolved callee name (may be null for indirect).
 * @param address Numeric call target address.
 * @param container The caller's container.
 * @param args    Captured argument register values at the call site, in
 *                order [a0, a1, a2, a3] — the same snapshot the executor
 *                stores on the CallEffect.
 * @param consumedCallResults Set of call seq numbers whose call-result
 *                atom appears in a later expression (return value, store
 *                value, or another call's argument).
 * @param seq     The call effect's sequence number, for matching against
 *                consumedCallResults.
 */
export function inferSignatureRange(
  name: string | null | undefined,
  address: number | undefined,
  container: Container,
  args: SymExpr[],
  consumedCallResults: Set<number>,
  seq: number,
): InferredSignatureRange {
  let arityLo = 0;
  let arityHi = 4;
  let returns: "yes" | "no" | "unknown" = "unknown";

  /* 1. Callee's own machine code via targetWitness. */
  if (name) {
    try {
      const scratch = join(ROOT, "build/inferredSignatureRange");
      mkdirSync(scratch, { recursive: true });
      const witness = targetWitness(name, scratch);
      if (witness?.arity) {
        arityLo = witness.arity.min;
      }
      if (witness?.returns) {
        returns = witness.returns.type === "s32" ? "yes" : "no";
      }
    } catch {
      /* targetWitness may fail (stub, undecoded op, etc.) — keep defaults */
    }
  }

  /* 2. Caller's argument setup: the highest arg register with a
   *    non-passthrough value gives an upper hint.
   *    An arg is "non-passthrough" when it is not a bare `entry(aN)`.
   *    When ALL args are passthrough (the caller wrote nothing), arityHi
   *    defaults to 0 — no evidence of any explicit argument. */
  let highestNonPassthrough = -1;
  for (let i = 0; i < 4; i++) {
    const arg = args[i];
    if (arg && !(arg.kind === "entry" && arg.register === `a${i}`)) {
      highestNonPassthrough = i;
    }
  }
  if (highestNonPassthrough >= 0) {
    arityHi = Math.min(highestNonPassthrough + 1, 4);
  } else {
    arityHi = 0;
  }

  /* 3. Caller's use of $v0: if the result is consumed, returns is "yes". */
  if (consumedCallResults.has(seq)) {
    returns = "yes";
  }
  /* Note: if not consumed, returns stays "unknown" — NOT "no". The callee
   * may return a value the caller discards; we cannot prove it does not. */

  /* Clamp: arityLo ≤ arityHi, and both in [0, 4]. */
  arityLo = Math.max(0, Math.min(arityLo, arityHi));
  arityHi = Math.min(arityHi, 4);

  return { arityLo, arityHi, returns };
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