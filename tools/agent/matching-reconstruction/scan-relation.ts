/**
 * Fit a decision DAG to the fixed-stride scan template, and verify the fit by
 * rebuilding the template's own DAG in the same arena.
 *
 * The fit proposes parameters (base, stride, count, tests, returns) by walking
 * the DAG record by record; the *verification* is exact: the template's DAG is
 * built from the proposed parameters over the same load atoms, and hash-consing
 * makes semantic equality a root-id comparison. A proposal that walks but does
 * not verify is rejected, so a lucky parse can never smuggle in a wrong
 * relation (plan §6 C1: an unaccounted path is an unsupported case).
 */

import { DagArena, canon, constExpr } from "./exec.js";
import type {
  ArgUse,
  DagRef,
  FieldTest,
  Predicate,
  ReturnSpec,
  RhsSpec,
  ScanRelation,
  SymExpr,
} from "./types.js";

export interface FitFailure {
  fitted: false;
  reason: string;
}

export interface FitSuccess {
  fitted: true;
  relation: ScanRelation;
}

export type FitResult = FitSuccess | FitFailure;

const ARG_REGISTERS = new Set(["a0", "a1", "a2", "a3"]);

/** Classify a right-hand side as the template's vocabulary, or nothing. */
function classifyRhs(expr: SymExpr): RhsSpec | undefined {
  if (expr.kind === "const") return { kind: "const", value: expr.value | 0 };
  if (expr.kind === "entry" && ARG_REGISTERS.has(expr.register)) {
    return { kind: "arg", use: { register: expr.register, conversion: "raw" } };
  }
  if (expr.kind === "unary" && expr.operand.kind === "entry" && ARG_REGISTERS.has(expr.operand.register)) {
    return { kind: "arg", use: { register: expr.operand.register, conversion: expr.op } };
  }
  return undefined;
}

function rhsKey(rhs: RhsSpec): string {
  return rhs.kind === "const" ? `#${rhs.value}` : `${rhs.use.register}:${rhs.use.conversion}`;
}

interface ParsedTest {
  address: number;
  width: 1 | 2 | 4;
  signed: boolean;
  op: "eq" | "ne";
  rhs: RhsSpec;
}

interface ParsedRecord {
  tests: ParsedTest[];
  /** Where every failed test goes: the next record, or the exhaust leaf. */
  failTarget: DagRef;
  /** The leaf every passed chain ends in. */
  successLeaf: DagRef;
}

/**
 * Parse one record's short-circuit chain starting at `entry`. Each test node
 * has one edge that continues the chain (or reaches the success leaf) and one
 * edge that abandons the record; all abandoning edges must agree on a single
 * fail target. Both polarities are tried per node, so `== 0 continues` and
 * `!= 0 continues` cost the same; every consistent parse is returned and the
 * template verification picks the true one.
 */
function parseRecordChains(arena: DagArena, entry: DagRef, maxTests = 8): ParsedRecord[] {
  const results: ParsedRecord[] = [];

  const descend = (ref: DagRef, tests: ParsedTest[], failTarget: DagRef | undefined): void => {
    if (tests.length > maxTests) return;
    const node = arena.node(ref);
    if (node.kind === "leaf") {
      if (failTarget !== undefined && tests.length > 0) {
        results.push({ tests, failTarget, successLeaf: ref });
      }
      return;
    }
    const pred = node.pred;
    if (pred.op !== "eq" || pred.right === undefined) return;
    const sides = [
      { load: pred.left, rhs: pred.right },
      { load: pred.right, rhs: pred.left },
    ];
    for (const side of sides) {
      if (side.load.kind !== "load") continue;
      /* The scan template addresses records absolutely; a pointer-based or
       * post-store atom belongs to a different class. */
      if (side.load.base || side.load.epoch) continue;
      const rhs = classifyRhs(side.rhs);
      if (!rhs) continue;
      const base = { address: side.load.address, width: side.load.width, signed: side.load.signed, rhs };
      /* pass on true — the test reads `field == rhs`. */
      tryEdge({ ...base, op: "eq" as const }, node.onTrue, node.onFalse);
      /* pass on false — the test reads `field != rhs`. */
      tryEdge({ ...base, op: "ne" as const }, node.onFalse, node.onTrue);
    }

    function tryEdge(test: ParsedTest, pass: DagRef, fail: DagRef): void {
      if (failTarget !== undefined && fail !== failTarget) return;
      descend(pass, [...tests, test], failTarget ?? fail);
    }
  };

  descend(entry, [], undefined);
  return results;
}

function signature(tests: ParsedTest[], recordBase: number): string {
  return tests
    .map((test) => `${test.address - recordBase}/${test.width}${test.signed ? "s" : "u"}/${test.op}/${rhsKey(test.rhs)}`)
    .join("|");
}

const leafConst = (arena: DagArena, ref: DagRef): number | undefined => {
  const node = arena.node(ref);
  if (node.kind !== "leaf" || node.value.kind !== "const") return undefined;
  /* A leaf that also stored something is not a pure scan outcome. */
  if (node.effects.length > 0) return undefined;
  return node.value.value | 0;
};

function fitReturns(values: number[]): ReturnSpec | undefined {
  if (values.every((value) => value === values[0])) return { kind: "const", value: values[0]! };
  if (values.length >= 2) {
    const scale = values[1]! - values[0]!;
    const offset = values[0]!;
    if (values.every((value, index) => value === scale * index + offset)) {
      return { kind: "affine", scale, offset };
    }
  }
  return undefined;
}

/**
 * Build the template's decision DAG for a proposed relation, over the same
 * atom spelling the executor uses, in the same arena.
 */
export function buildTemplateDag(arena: DagArena, relation: ScanRelation): DagRef {
  const rhsExpr = (rhs: RhsSpec): SymExpr => {
    if (rhs.kind === "const") return constExpr(rhs.value);
    const entry: SymExpr = { kind: "entry", register: rhs.use.register };
    return rhs.use.conversion === "raw" ? entry : { kind: "unary", op: rhs.use.conversion, operand: entry };
  };
  const successValue = (k: number): number =>
    relation.successReturn.kind === "const"
      ? relation.successReturn.value
      : relation.successReturn.scale * k + relation.successReturn.offset;

  const exhaust = arena.leaf(constExpr(relation.failReturn));

  const record = (k: number): DagRef => {
    if (k >= relation.count) return exhaust;
    const fail = record(k + 1);
    const success = arena.leaf(constExpr(successValue(k)));
    let next = success;
    for (let index = relation.tests.length - 1; index >= 0; index--) {
      const test = relation.tests[index]!;
      const pred: Predicate = {
        op: "eq",
        left: { kind: "load", address: relation.base + relation.stride * k + test.offset, width: test.width, signed: test.signed },
        right: rhsExpr(test.rhs),
      };
      next = test.op === "eq" ? arena.test(pred, next, fail) : arena.test(pred, fail, next);
    }
    return next;
  };

  /* Build from the last record backward so shared fail targets intern first. */
  return record(0);
}

/** Try to fit the DAG rooted at `root` to the scan template. */
export function fitScanRelation(arena: DagArena, root: DagRef): FitResult {
  const rootNode = arena.node(root);
  if (rootNode.kind === "leaf") return { fitted: false, reason: "the function is a single unconditional return, not a scan" };

  /* Parse record 0 every consistent way; each parse fixes the signature the
   * remaining records must repeat. */
  const firstParses = parseRecordChains(arena, root);
  if (firstParses.length === 0) {
    return { fitted: false, reason: "the entry decision structure is not a short-circuit chain of supported field tests" };
  }

  const failures: string[] = [];
  for (const first of firstParses) {
    const attempt = fitFromFirstRecord(arena, root, first);
    if (attempt.fitted) return attempt;
    failures.push(attempt.reason);
  }
  return { fitted: false, reason: failures[failures.length - 1]! };
}

function fitFromFirstRecord(arena: DagArena, root: DagRef, first: ParsedRecord): FitResult {
  const recordBase = Math.min(...first.tests.map((test) => test.address));
  const expected = signature(first.tests, recordBase);

  const records: ParsedRecord[] = [first];
  const bases: number[] = [recordBase];
  let cursor = first.failTarget;

  for (let k = 1; k <= 4096; k++) {
    const node = arena.node(cursor);
    if (node.kind === "leaf") break;
    const parses = parseRecordChains(arena, cursor);
    const matching = parses.find((parse) => {
      const base = Math.min(...parse.tests.map((test) => test.address));
      return signature(parse.tests, base) === expected;
    });
    if (!matching) {
      return { fitted: false, reason: `record ${k} does not repeat record 0's test signature` };
    }
    records.push(matching);
    bases.push(Math.min(...matching.tests.map((test) => test.address)));
    cursor = matching.failTarget;
  }

  const count = records.length;
  if (count < 2) return { fitted: false, reason: "fewer than two records — not a scan" };

  const stride = bases[1]! - bases[0]!;
  if (stride <= 0) return { fitted: false, reason: "records do not advance through memory in ascending order" };
  if (!bases.every((base, k) => base === bases[0]! + stride * k)) {
    return { fitted: false, reason: "record bases are not affine in the record index" };
  }

  const failReturn = leafConst(arena, cursor);
  if (failReturn === undefined) return { fitted: false, reason: "the exhaust return value is not a constant" };
  const successValues: number[] = [];
  for (const record of records) {
    const value = leafConst(arena, record.successLeaf);
    if (value === undefined) return { fitted: false, reason: "a success return value is not a constant" };
    successValues.push(value);
  }
  const successReturn = fitReturns(successValues);
  if (!successReturn) return { fitted: false, reason: "success return values are neither constant nor affine in the record index" };

  const tests: FieldTest[] = first.tests.map((test) => ({
    offset: test.address - recordBase,
    width: test.width,
    signed: test.signed,
    op: test.op,
    rhs: test.rhs,
  }));

  const lastByte = Math.max(...tests.map((test) => test.offset + test.width));
  const relation: ScanRelation = {
    base: recordBase,
    stride,
    count,
    tests,
    successReturn,
    failReturn,
    witnessedExtent: stride * (count - 1) + lastByte,
    evidence: [
      `${count} records of stride ${stride} at 0x${recordBase.toString(16)}, tests [${expected}]`,
    ],
  };

  /* The exact check: the template's DAG must be the machine's DAG. */
  const templateRoot = buildTemplateDag(arena, relation);
  if (templateRoot !== root) {
    return { fitted: false, reason: "the proposed scan template is not semantically identical to the recovered decision structure" };
  }
  return { fitted: true, relation };
}

/** Human-readable summary, for reports. */
export function describeRelation(relation: ScanRelation): string {
  const tests = relation.tests
    .map((test) => {
      const field = `${test.signed ? "s" : "u"}${test.width * 8} @+0x${test.offset.toString(16)}`;
      const rhs = test.rhs.kind === "const"
        ? `0x${(test.rhs.value >>> 0).toString(16)}`
        : `${test.rhs.use.conversion}(${test.rhs.use.register})`;
      return `${field} ${test.op === "eq" ? "==" : "!="} ${rhs}`;
    })
    .join(" && ");
  const success = relation.successReturn.kind === "const"
    ? `${relation.successReturn.value}`
    : `${relation.successReturn.scale}*k+${relation.successReturn.offset}`;
  return (
    `scan of ${relation.count} records, stride ${relation.stride}, base 0x${relation.base.toString(16)}: ` +
    `match when ${tests}; return ${success} on match, ${relation.failReturn} otherwise`
  );
}
