/**
 * Instantiation — turn a donor's C into a candidate for a target, by editing
 * the donor's *syntax tree*, never its text.
 *
 * Two kinds of edit, and the distinction matters:
 *
 *   - **Identity.** The donor's function name, and every name derived from it
 *     (a view typedef carrying the donor's address, a static local), become
 *     the target's. Two translation units that define the same type name
 *     differently do not link, so a transfer that renamed only the function
 *     would produce a family whose members collide.
 *   - **Substitution.** Each hole the anti-unification found becomes a
 *     concrete edit at the donor C site that produced the donor's value.
 *
 * The site question — *which* literal in the donor's C produced a given
 * machine constant — has no single syntactic answer. A donor with one `0xAC`
 * has one candidate; a donor with three has three, and only one of them is the
 * field offset. This module does not guess: it enumerates the bounded
 * alternatives and lets the byte oracle decide, which is the only authority in
 * this repository that may.
 *
 * A literal is rewritten in the donor's own spelling — hex stays hex, at the
 * donor's digit count and case, and a suffix is preserved — because a
 * candidate a human has to read is part of the product.
 */

import { children, parseC, walk, type Node } from "../residual-source-search/tree-sitter-c.js";
import type { Substitution } from "./anti-unify.js";

export interface Edit {
  start: number;
  end: number;
  text: string;
  /** What this edit is for, for the candidate's own header comment. */
  reason: string;
}

export interface InstantiationPlan {
  /** Edits every candidate carries: identity renames. */
  identity: Edit[];
  /** One entry per substitution: the alternative sites it could apply at. */
  choices: Array<{
    substitution: Substitution;
    /** Mutually exclusive edit sets; each is one reading of the donor's C. */
    alternatives: Edit[][];
  }>;
  /** Substitutions with no site in the donor's C — the transfer cannot proceed. */
  unplaceable: Substitution[];
}

/* ---- identity ------------------------------------------------------------- */

/**
 * Every name in the donor that must become the target's.
 *
 * Matching is by containment of the donor's own name, and of the bare address
 * suffix the project's naming convention puts in symbol names, so
 * `D8006C838Lookup_800D5B3C` follows `ovl_11_func_800D5B3C` without anyone
 * maintaining a list of derived-name patterns.
 */
export function identityEdits(source: string, donorName: string, targetName: string): Edit[] {
  const tree = parseC(source);
  const edits: Edit[] = [];
  const donorSuffix = donorName.match(/([0-9A-Fa-f]{6,8})$/)?.[1];
  const targetSuffix = targetName.match(/([0-9A-Fa-f]{6,8})$/)?.[1];

  walk(tree.rootNode, (node) => {
    if (node.type !== "identifier" && node.type !== "type_identifier" && node.type !== "field_identifier") return true;
    const text = node.text;
    if (text === donorName) {
      edits.push({ start: node.startIndex, end: node.endIndex, text: targetName, reason: "function identity" });
      return true;
    }
    if (text.includes(donorName)) {
      edits.push({
        start: node.startIndex,
        end: node.endIndex,
        text: text.split(donorName).join(targetName),
        reason: "name derived from the donor's function name",
      });
      return true;
    }
    if (donorSuffix && targetSuffix && donorSuffix !== targetSuffix && text.includes(donorSuffix)) {
      edits.push({
        start: node.startIndex,
        end: node.endIndex,
        text: text.split(donorSuffix).join(targetSuffix),
        reason: "name derived from the donor's address",
      });
    }
    return true;
  });
  return edits;
}

/* ---- literal sites -------------------------------------------------------- */

/** Parse a C integer literal's value and remember how it was spelled. */
function literalValue(text: string): { value: number; render: (next: number) => string } | null {
  const match = text.match(/^([+-]?)(0[xX][0-9a-fA-F]+|0[bB][01]+|0[0-7]+|\d+)([uUlL]*)$/);
  if (!match) return null;
  const [, sign, digits, suffix] = match;
  const magnitude = digits!.toLowerCase().startsWith("0x")
    ? parseInt(digits!.slice(2), 16)
    : digits!.toLowerCase().startsWith("0b")
      ? parseInt(digits!.slice(2), 2)
      : /^0[0-7]+$/.test(digits!)
        ? parseInt(digits!.slice(1), 8)
        : parseInt(digits!, 10);
  const value = sign === "-" ? -magnitude : magnitude;

  const render = (next: number): string => {
    const negative = next < 0;
    const absolute = Math.abs(next);
    if (digits!.toLowerCase().startsWith("0x")) {
      const upperDigits = /[A-F]/.test(digits!.slice(2));
      const prefix = digits![1] === "X" ? "0X" : "0x";
      const width = digits!.length - 2;
      let body = absolute.toString(16);
      if (upperDigits) body = body.toUpperCase();
      if (body.length < width) body = body.padStart(width, "0");
      return `${negative ? "-" : ""}${prefix}${body}${suffix}`;
    }
    return `${negative ? "-" : ""}${absolute}${suffix}`;
  };

  return { value, render };
}

/**
 * Candidate C sites for one substitution.
 *
 * A numeric hole looks for number literals of the donor's value; a symbol hole
 * looks for identifiers naming the donor's symbol. Both search the donor's
 * whole translation unit, because a field offset can appear inside a cast, a
 * struct declaration, or an arithmetic expression, and the transfer has no
 * business deciding in advance which of those a donor used.
 */
function sitesFor(source: string, substitution: Substitution): Edit[][] {
  const tree = parseC(source);
  const numeric: Array<{ node: Node; render: (next: number) => string }> = [];
  const symbolic: Node[] = [];

  /* Per site, the reading that made the donor's literal match — and therefore
   * the same reading applied to the target's value. A `lui`-materialized
   * constant matches shifted down by 16, so its replacement must be too. */
  const readings = new Map<Node, (targetValue: number) => number>();

  walk(tree.rootNode, (node) => {
    if (node.type === "number_literal") {
      const parsed = literalValue(node.text);
      const reading = parsed ? matchDonorValue(parsed.value, substitution) : null;
      if (parsed && reading) {
        numeric.push({ node, render: parsed.render });
        readings.set(node, reading);
      }
      return true;
    }
    if (node.type === "identifier" && substitution.donorSymbol && node.text === substitution.donorSymbol) {
      symbolic.push(node);
    }
    return true;
  });

  if (substitution.donorSymbol) {
    if (symbolic.length === 0) return [];
    const replacement = substitution.targetSymbol;
    if (!replacement) return [];
    /* A symbol reference is unambiguous: every occurrence of the donor's
     * symbol names the same object, so they all move together. */
    return [symbolic.map((node) => ({
      start: node.startIndex,
      end: node.endIndex,
      text: replacement,
      reason: `symbol ${substitution.donorSymbol} → ${replacement}`,
    }))];
  }

  if (numeric.length === 0) return [];
  const all = numeric.map(({ node, render }) => {
    const replacement = render(readings.get(node)!(substitution.targetValue));
    return {
      start: node.startIndex,
      end: node.endIndex,
      text: replacement,
      reason: `${substitution.kind} ${node.text} → ${replacement}`,
    };
  });

  /* Alternatives, cheapest reading first: all sites together (the usual case
   * when one constant appears once), then each site alone. The oracle picks. */
  const alternatives: Edit[][] = [all];
  if (all.length > 1) for (const edit of all) alternatives.push([edit]);
  return alternatives;
}

/**
 * Whether a C literal is *this* hole's donor value, and under which reading.
 *
 * The reading is returned rather than a boolean because the same reading has
 * to be applied to the target's value. Three exist:
 *
 *   - the literal is the machine value (the ordinary case);
 *   - the literal is the machine value read with the other signedness, which
 *     a 16-bit displacement is written in C either way;
 *   - the literal is the machine value shifted down by 16, which is what a
 *     `lui`-materialized constant looks like in source.
 *
 * Returning the wrong reading substitutes a number that compiles and does not
 * reproduce the target, so each is kept distinct rather than merged.
 */
function matchDonorValue(
  literal: number,
  substitution: Substitution,
): ((targetValue: number) => number) | null {
  const donor = substitution.donorValue;
  if (literal === donor) return (target) => target;
  if (literal === (donor >>> 0)) return (target) => target >>> 0;
  if (literal === ((donor << 16) >> 16)) return (target) => (target << 16) >> 16;
  if (substitution.kind === "immediate-hi") {
    if (literal === (donor >>> 16)) return (target) => target >>> 16;
    if (literal === ((donor >> 16) | 0)) return (target) => (target >> 16) | 0;
  }
  return null;
}

/* ---- planning and application --------------------------------------------- */

export function planInstantiation(
  source: string,
  donorName: string,
  targetName: string,
  substitutions: Substitution[],
): InstantiationPlan {
  const identity = identityEdits(source, donorName, targetName);
  const choices: InstantiationPlan["choices"] = [];
  const unplaceable: Substitution[] = [];
  for (const substitution of substitutions) {
    const alternatives = sitesFor(source, substitution);
    if (alternatives.length === 0) unplaceable.push(substitution);
    else choices.push({ substitution, alternatives });
  }
  return { identity, choices, unplaceable };
}

/**
 * Every candidate the plan admits, in a deterministic order.
 *
 * The product of the per-substitution alternatives is capped: a donor with
 * several ambiguous constants can generate more readings than are worth
 * compiling, and the cap is reported rather than applied silently.
 */
export function enumerateCandidates(
  plan: InstantiationPlan,
  limit = 24,
): { candidates: Array<{ edits: Edit[]; label: string }>; truncated: number } {
  let combinations: Array<{ edits: Edit[]; label: string[] }> = [{ edits: [...plan.identity], label: [] }];
  for (const choice of plan.choices) {
    const next: Array<{ edits: Edit[]; label: string[] }> = [];
    choice.alternatives.forEach((alternative, index) => {
      for (const existing of combinations) {
        next.push({
          edits: [...existing.edits, ...alternative],
          label: [...existing.label, `${choice.substitution.kind}${choice.alternatives.length > 1 ? `#${index}` : ""}`],
        });
      }
    });
    combinations = next;
  }
  const truncated = Math.max(0, combinations.length - limit);
  return {
    candidates: combinations.slice(0, limit).map((combination, index) => ({
      edits: combination.edits,
      label: combination.label.length > 0 ? combination.label.join("-") : `identity-${index}`,
    })),
    truncated,
  };
}

/**
 * Apply edits to the donor's text.
 *
 * Applied back-to-front so earlier offsets stay valid, and refused outright
 * when two edits overlap: an overlapping pair means the plan located one site
 * twice, and applying either silently would produce text nobody asked for.
 */
export function applyEdits(source: string, edits: Edit[]): string {
  const ordered = [...edits].sort((left, right) => right.start - left.start || right.end - left.end);
  for (let index = 1; index < ordered.length; index++) {
    if (ordered[index]!.end > ordered[index - 1]!.start) {
      throw new Error(
        `overlapping edits at ${ordered[index]!.start}..${ordered[index]!.end} and ` +
        `${ordered[index - 1]!.start}..${ordered[index - 1]!.end}`,
      );
    }
  }
  let text = source;
  for (const edit of ordered) text = text.slice(0, edit.start) + edit.text + text.slice(edit.end);
  return text;
}

/** Every child, anonymous tokens included — used by the guard checks. */
export function everyChild(node: Node, visit: (item: Node) => void): void {
  visit(node);
  for (const child of children(node)) everyChild(child, visit);
}
