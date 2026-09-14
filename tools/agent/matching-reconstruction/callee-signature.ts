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
 *   1b. A verified recovery published to the recovered-artifact overlay this
 *      run. The overlay holds only sources the relocated-byte oracle matched,
 *      so the definition's own parameter list is a declaration — and it is the
 *      tier that lets a campaign's success reach its callers, which are still
 *      looking at a stub in `src/`.
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
import { contextMode, warmContextAllowed } from "./context-mode.js";
import { overlayRevision, overlaySourceFor } from "../campaign/artifact-overlay.js";

/* ------------------------------------------------------------------ */
/* CalleeSignature                                                     */
/* ------------------------------------------------------------------ */

export type SignatureSource = "matched" | "recovered" | "sdk" | "abi";

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
 * One parameter's type, *including* the decoration its declarator carries.
 *
 * The `type` field of a `parameter_declaration` holds only the specifier:
 * `Vec3 *dest` yields `Vec3`, because the star belongs to the declarator. A
 * signature rebuilt from the specifier alone turns every pointer parameter
 * into a value parameter — which is how `void CopyVec3(Vec3 *, Vec3 *)` was
 * re-emitted as `void CopyVec3(Vec3, Vec3)` and stopped compiling. Pointer
 * depth and array-to-pointer decay are read off the declarator instead.
 */
function parameterType(declaration: Node): string {
  const typeNode = field(declaration, "type");
  const base = typeNode ? flatten(typeNode) : "s32";
  let stars = "";
  let declarator = field(declaration, "declarator");
  while (declarator) {
    if (declarator.type === "pointer_declarator") {
      stars += "*";
      declarator = field(declarator, "declarator");
      continue;
    }
    if (declarator.type === "array_declarator") {
      /* An array parameter is a pointer parameter; its bound is not part of
       * the callee's interface. */
      stars += "*";
      declarator = field(declarator, "declarator");
      continue;
    }
    if (declarator.type === "abstract_pointer_declarator") {
      stars += "*";
      declarator = field(declarator, "declarator");
      continue;
    }
    if (declarator.type === "abstract_array_declarator") {
      stars += "*";
      declarator = field(declarator, "declarator");
      continue;
    }
    break;
  }
  return stars ? `${base} ${stars}` : base;
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
      const paramTypes = voidParam ? [] : paramDecls.map(parameterType);
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
/* A generated header is parsed once per run and reused: resolveSignature is
 * called once per call site, and a function with hundreds of call sites would
 * otherwise re-read and tree-sitter-parse the whole header hundreds of times
 * (seconds per function). The headers do not change during a run. */
const parsedHeaderCache = new Map<string, ReturnType<typeof parseC>>();
function parsedHeader(path: string): ReturnType<typeof parseC> {
  const cached = parsedHeaderCache.get(path);
  if (cached) return cached;
  const tree = parseC(readFileSync(path, "utf-8"));
  parsedHeaderCache.set(path, tree);
  return tree;
}

function matchedDefinition(callee: string, container: Container): SignatureResult | null {
  /* Cold mode withholds recovered game C, and a matched definition is exactly
   * that: somebody already wrote this callee's signature. The lower tiers —
   * the SDK's own declarations and the callee's machine code — stay, because
   * neither is recovered material. */
  if (!warmContextAllowed()) return null;
  const matched = definitionPrototype(callee);
  if (!matched) return null;

  /* Try the container's own header first (functions.h for exe,
   * overlays/<id>.h for an overlay). */
  const ownHeader = generatedHeaderPath(container);
  if (ownHeader) {
    try {
      const tree = parsedHeader(ownHeader);
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
        const tree = parsedHeader(exeHeader);
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
/* Tier 1b — a verified recovery published this run                     */
/* ------------------------------------------------------------------ */

/**
 * The signature the overlay's own recovered C declares.
 *
 * Without this tier a campaign's successes are invisible to its callers: the
 * callee is still a stub in `src/`, so tier 1 answers nothing and the caller
 * falls through to the ABI floor — a bound to enumerate over rather than a
 * signature to use. The recovered definition is a declaration, because the
 * overlay only holds sources the byte oracle matched, and a function's own
 * matching definition is the strongest statement of its interface there is.
 *
 * It is parsed from the *definition*, not from a generated header: the overlay
 * is not in any header, and re-deriving a declaration from it would be a second
 * spelling of a fact the source already states.
 */
function publishedDefinition(callee: string): SignatureResult | null {
  const published = overlaySourceFor(callee);
  if (!published) return null;
  let parsed: ReturnType<typeof parseDefinitionSignature>;
  try {
    parsed = parseDefinitionSignature(callee, parseC(published.text));
  } catch {
    return null;
  }
  if (!parsed) return null;
  return {
    arity: parsed.arity,
    paramTypes: parsed.paramTypes,
    returnsValue: !parsed.returnsVoid,
    returnType: parsed.returnsVoid ? "void" : "s32",
    source: "recovered",
  };
}

/** The signature a function *definition* states, as opposed to a declaration. */
function parseDefinitionSignature(
  callee: string,
  tree: ReturnType<typeof parseC>,
): { arity: number; paramTypes: string[]; returnsVoid: boolean } | null {
  let result: { arity: number; paramTypes: string[]; returnsVoid: boolean } | null = null;
  walk(tree.rootNode, (node) => {
    if (result) return false;
    if (node.type !== "function_definition") return true;
    const returnType = field(node, "type");
    const declarator = field(node, "declarator");
    if (!returnType || !declarator) return false;
    let core = declarator;
    while (core.type === "pointer_declarator") {
      const inner = field(core, "declarator");
      if (!inner) break;
      core = inner;
    }
    if (core.type !== "function_declarator") return false;
    const nameNode = field(core, "declarator");
    const params = field(core, "parameters");
    if (!nameNode || !params || nameNode.text !== callee) return false;
    const paramDecls = children(params).filter((child) => child.type === "parameter_declaration");
    const voidParam = paramDecls.length === 1 && flatten(paramDecls[0]!) === "void";
    result = {
      arity: voidParam ? 0 : paramDecls.length,
      paramTypes: voidParam ? [] : paramDecls.map(parameterType),
      returnsVoid: flatten(returnType) === "void",
    };
    return false;
  });
  return result;
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
  args: Array<SymExpr | null>,
  consumedCallResults: Set<number>,
  seq: number,
): InferredSignatureRange {
  let arityLo = 0;
  /* The upper hint may exceed four: an outgoing-argument-area slot the caller
   * wrote is a fifth or later argument, and clamping to four is how a
   * five-argument call was made to look like a four-argument one. */
  let arityHi = Math.max(4, args.length);
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

  /* 2. Caller's argument setup: the highest arg register the caller actually
   *    wrote. An arg is "non-passthrough" when it is not a bare `entry(aN)`.
   *
   *    This is an *upper* hint only. An untouched `$aN` at a call site is
   *    indistinguishable from the caller forwarding its own parameter of the
   *    same index — `f(arg0, arg1)` compiles to no instructions at all, because
   *    the values are already in place — so silence here is not evidence of
   *    absence, and it can never lower a floor the callee's own code proved.
   *    Letting it do so is how a two-argument callee whose caller forwards both
   *    parameters is reported as taking none, and every hypothesis built from
   *    that range then calls it with the wrong arity. */
  let highestNonPassthrough = -1;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;
    /* A stack slot the caller wrote is always explicit; a register slot is
     * explicit only when it is not the caller's own untouched entry value. */
    if (i >= 4 || !(arg.kind === "entry" && arg.register === `a${i}`)) {
      highestNonPassthrough = i;
    }
  }
  const callerHint = highestNonPassthrough >= 0 ? highestNonPassthrough + 1 : 0;
  /* A written outgoing slot proves the arity is at least that high, whatever
   * the callee's own code showed. */
  if (args.length > 4 && args[4] !== null && args[4] !== undefined) {
    arityLo = Math.max(arityLo, 5);
  }

  /* 3. Caller's use of $v0: if the result is consumed, returns is "yes". */
  if (consumedCallResults.has(seq)) {
    returns = "yes";
  }
  /* Note: if not consumed, returns stays "unknown" — NOT "no". The callee
   * may return a value the caller discards; we cannot prove it does not. */

  /* The range spans both bounds. `arityLo` is what the callee's own code reads
   * and is never narrowed; `arityHi` is the wider of the two hints. Both may
   * exceed four when the outgoing argument area is in use; the O32 upper bound
   * this model handles is eight. */
  arityLo = Math.min(Math.max(0, arityLo), 8);
  arityHi = Math.min(Math.max(callerHint, arityLo), 8);

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
/* resolveSignature is pure in (name, address, container) for a process run,
 * but its tiers are expensive — tier 3 (abiEvidence/targetWitness) assembles
 * and disassembles the callee's target code. A caller with hundreds of call
 * sites resolves the same handful of callees repeatedly; without this the
 * signature pass alone costs tens of seconds per such function. Memoized for
 * the process lifetime. */
const signatureCache = new Map<string, SignatureResult>();

export function resolveSignature(
  name: string | null | undefined,
  address: number | undefined,
  container: Container,
): SignatureResult {
  if (!name) {
    return { unknown: address === undefined ? "indirect call target is not resolvable to a symbol" : `no symbol resolves the call target 0x${(address >>> 0).toString(16)}` };
  }
  /* The mode is part of the cache key: the same callee resolves differently
   * warm and cold, and a cache that ignored that would report a warm answer in
   * a cold run. */
  /* The overlay's revision is part of the key: publishing a callee's recovered
   * C changes what this function answers, and a cache that outlived the
   * publication would keep serving the ABI bound it replaced. */
  const cacheKey = `${contextMode()}|${overlayRevision()}|${container.id}|${name}|${address ?? ""}`;
  const cached = signatureCache.get(cacheKey);
  if (cached) return cached;
  const result = computeSignature(name, address, container);
  signatureCache.set(cacheKey, result);
  return result;
}

function computeSignature(
  name: string,
  address: number | undefined,
  container: Container,
): SignatureResult {
  const matched = matchedDefinition(name, container);
  if (matched) return matched;
  const recovered = publishedDefinition(name);
  if (recovered) return recovered;
  const sdk = sdkPrototype(name);
  if (sdk) return sdk;
  const abi = abiEvidence(name);
  if (abi) return abi;
  return { unknown: `no signature evidence for ${name} — not matched, not an SDK entry point, and its target code gives none` };
}