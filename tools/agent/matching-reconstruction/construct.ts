/**
 * Typed clean-C constructors (plan §6 C4).
 *
 * Each constructor consumes the recovered scan relation plus one point in the
 * origin × layout × control choice space and emits a complete C89 translation
 * unit. Every constant in the emitted source — counts, strides, offsets,
 * parent displacements, return values — comes from the relation or the origin
 * evidence; nothing is keyed on the function's name or address.
 *
 * Candidates are emitted into an isolated bundle and compiled there; the
 * emitted context (view typedefs, extern declarations) is provisional, and the
 * winner's integration plan names where each piece would live under the
 * project's header roles. Nothing here touches live sources.
 */

import type {
  ConstructionChoice,
  FieldTest,
  LayoutAlternative,
  ReturnSpec,
  ScanRelation,
} from "./types.js";

/* ---- a small typed C AST -------------------------------------------------- */

export type CBinaryOp =
  | "==" | "!=" | "&&" | "<" | "<=" | ">" | ">="
  | "+" | "-" | "*"
  | "<<" | ">>"
  | "&" | "|" | "^";

export type CExpr =
  | { kind: "id"; name: string }
  | { kind: "int"; value: number; hex?: boolean }
  | { kind: "index"; base: CExpr; index: CExpr }
  | { kind: "member"; base: CExpr; field: string; arrow: boolean }
  | { kind: "cast"; type: string; expr: CExpr }
  | { kind: "unaryop"; op: "~" | "-"; expr: CExpr }
  | { kind: "postfix"; op: "++" | "--"; expr: CExpr }
  | { kind: "prefix"; op: "++" | "--"; expr: CExpr }
  | { kind: "binary"; op: CBinaryOp; left: CExpr; right: CExpr };

export type CStmt =
  | { kind: "assign"; target: CExpr; value: CExpr }
  | { kind: "exprstmt"; expr: CExpr }
  | { kind: "declare"; type: string; name: string; init?: CExpr }
  | { kind: "if"; cond: CExpr; body: CStmt[]; elseBody?: CStmt[] }
  | { kind: "for"; init: string; cond: CExpr; step: string; body: CStmt[] }
  | { kind: "return"; expr?: CExpr }
  | { kind: "break" };

export const id = (name: string): CExpr => ({ kind: "id", name });
export const int = (value: number, hex = false): CExpr => ({ kind: "int", value, hex });

/* C's own precedence order, compressed; only relative order matters here. */
const PRECEDENCE: Record<string, number> = {
  "*": 13, "+": 12, "-": 12, "<<": 11, ">>": 11,
  "<": 10, "<=": 10, ">": 10, ">=": 10,
  "==": 9, "!=": 9, "&": 8, "^": 7, "|": 6, "&&": 5,
};

export function renderExpr(expr: CExpr, parentPrecedence = 0): string {
  switch (expr.kind) {
    case "id": return expr.name;
    case "int": {
      if (expr.hex) {
        const magnitude = Math.abs(expr.value).toString(16).toUpperCase();
        return `${expr.value < 0 ? "-" : ""}0x${magnitude}`;
      }
      return String(expr.value);
    }
    case "index": return `${renderExpr(expr.base, 15)}[${renderExpr(expr.index)}]`;
    case "member": return `${renderExpr(expr.base, 15)}${expr.arrow ? "->" : "."}${expr.field}`;
    case "cast": return `((${expr.type})${renderExpr(expr.expr, 15)})`;
    case "unaryop": {
      const text = `${expr.op}${renderExpr(expr.expr, 14)}`;
      return parentPrecedence > 14 ? `(${text})` : text;
    }
    case "postfix": return `${renderExpr(expr.expr, 15)}${expr.op}`;
    case "prefix": return `${expr.op}${renderExpr(expr.expr, 14)}`;
    case "binary": {
      const precedence = PRECEDENCE[expr.op]!;
      const text = `${renderExpr(expr.left, precedence)} ${expr.op} ${renderExpr(expr.right, precedence + 1)}`;
      return precedence < parentPrecedence ? `(${text})` : text;
    }
  }
}

export function renderStmts(stmts: CStmt[], indent: string): string[] {
  const lines: string[] = [];
  for (const stmt of stmts) {
    switch (stmt.kind) {
      case "assign":
        lines.push(`${indent}${renderExpr(stmt.target)} = ${renderExpr(stmt.value)};`);
        break;
      case "exprstmt":
        lines.push(`${indent}${renderExpr(stmt.expr)};`);
        break;
      case "declare":
        lines.push(`${indent}${stmt.type} ${stmt.name}${stmt.init ? ` = ${renderExpr(stmt.init)}` : ""};`);
        break;
      case "if":
        lines.push(`${indent}if (${renderExpr(stmt.cond)}) {`);
        lines.push(...renderStmts(stmt.body, `${indent}    `));
        if (stmt.elseBody && stmt.elseBody.length > 0) {
          lines.push(`${indent}} else {`);
          lines.push(...renderStmts(stmt.elseBody, `${indent}    `));
        }
        lines.push(`${indent}}`);
        break;
      case "for":
        lines.push(`${indent}for (${stmt.init}; ${renderExpr(stmt.cond)}; ${stmt.step}) {`);
        lines.push(...renderStmts(stmt.body, `${indent}    `));
        lines.push(`${indent}}`);
        break;
      case "return":
        lines.push(stmt.expr ? `${indent}return ${renderExpr(stmt.expr)};` : `${indent}return;`);
        break;
      case "break":
        lines.push(`${indent}break;`);
        break;
    }
  }
  return lines;
}

/* ---- derived pieces ------------------------------------------------------- */

export const elementType = (width: 1 | 2 | 4, signed: boolean): string =>
  width === 1 ? (signed ? "s8" : "u8") : width === 2 ? (signed ? "s16" : "u16") : signed ? "s32" : "u32";

export const STANDALONE_TYPEDEF_BLOCK = [
  "typedef signed char s8;",
  "typedef unsigned char u8;",
  "typedef signed short s16;",
  "typedef unsigned short u16;",
  "typedef signed int s32;",
  "typedef unsigned int u32;",
].join("\n");

export interface ParamSpec {
  name: string;
  type: string;
  register: string;
}

/**
 * Parameter list from the relation's argument uses. A use through `zext16`
 * proves an unsigned 16-bit parameter — the machine's own narrowing is the
 * evidence, and changing it to a signed halfword is a different relation.
 */
export function deriveParams(relation: ScanRelation): ParamSpec[] | { invalid: string } {
  const order = ["a0", "a1", "a2", "a3"];
  const byRegister = new Map<string, string>();
  for (const test of relation.tests) {
    if (test.rhs.kind !== "arg") continue;
    const type =
      test.rhs.use.conversion === "zext16" ? "u16"
      : test.rhs.use.conversion === "zext8" ? "u8"
      : test.rhs.use.conversion === "sext16" ? "s16"
      : test.rhs.use.conversion === "sext8" ? "s8"
      : "s32";
    const existing = byRegister.get(test.rhs.use.register);
    if (existing && existing !== type) {
      return { invalid: `argument ${test.rhs.use.register} is used with two conversions (${existing}, ${type})` };
    }
    byRegister.set(test.rhs.use.register, type);
  }
  const used = order.filter((register) => byRegister.has(register));
  if (used.length === 0) return [];
  const last = order.indexOf(used[used.length - 1]!);
  return order.slice(0, last + 1).map((register, index) => ({
    name: `arg${index}`,
    type: byRegister.get(register) ?? "s32",
    register,
  }));
}

interface LayoutPieces {
  /** Typedefs the layout needs, in order. */
  typedefs: string[];
  /** The element declaration inside a containing view: `s16 records[5][6];` */
  memberDecl: string;
  /** Declared type for a standalone extern of the whole table. */
  standaloneDecl: (symbol: string) => string;
  /** Field access at record `i`, test `t`, given the record-array expression. */
  access: (records: CExpr, index: CExpr, test: FieldTest) => CExpr;
}

function layoutPieces(
  relation: ScanRelation,
  layout: LayoutAlternative,
  totalRecords: number,
): LayoutPieces | { invalid: string } {
  const tests = relation.tests;
  const uniformWidth = tests.every((test) => test.width === tests[0]!.width && test.signed === tests[0]!.signed);

  if (layout.kind === "rows" || layout.kind === "flat") {
    if (!uniformWidth) return { invalid: "field widths differ; element-array layouts need one element type" };
    const width = tests[0]!.width;
    if (relation.stride % width !== 0 || tests.some((test) => test.offset % width !== 0)) {
      return { invalid: "stride or a field offset is not a multiple of the element width" };
    }
    const columns = relation.stride / width;
    const type = elementType(width, tests[0]!.signed);
    if (layout.kind === "rows") {
      return {
        typedefs: [],
        memberDecl: `${type} records[${totalRecords}][${columns}];`,
        standaloneDecl: (symbol) => `extern ${type} ${symbol}[${totalRecords}][${columns}];`,
        access: (records, index, test) => ({
          kind: "index",
          base: { kind: "index", base: records, index },
          index: int(test.offset / width),
        }),
      };
    }
    return {
      typedefs: [],
      memberDecl: `${type} records[${totalRecords * columns}];`,
      standaloneDecl: (symbol) => `extern ${type} ${symbol}[${totalRecords * columns}];`,
      access: (records, index, test) => ({
        kind: "index",
        base: records,
        index: {
          kind: "binary",
          op: "+",
          left: { kind: "binary", op: "*", left: index, right: int(columns) },
          right: int(test.offset / width),
        },
      }),
    };
  }

  /* scalar-record: named fields at their witnessed offsets, padded to stride. */
  const fields = [...new Map(tests.map((test) => [test.offset, test])).values()].sort((a, b) => a.offset - b.offset);
  for (const field of fields) {
    if (field.offset % field.width !== 0) return { invalid: "a field offset is not naturally aligned for a scalar member" };
  }
  const lines: string[] = ["typedef struct {"];
  let cursor = 0;
  for (const field of fields) {
    if (field.offset > cursor) lines.push(`    char pad_${cursor.toString(16).toUpperCase()}[0x${(field.offset - cursor).toString(16).toUpperCase()}];`);
    lines.push(`    ${elementType(field.width, field.signed)} unk${field.offset.toString(16).toUpperCase()};`);
    cursor = field.offset + field.width;
  }
  if (cursor > relation.stride) return { invalid: "a field extends past the record stride" };
  if (cursor < relation.stride) lines.push(`    char pad_${cursor.toString(16).toUpperCase()}[0x${(relation.stride - cursor).toString(16).toUpperCase()}];`);
  lines.push("} ReconRecord;");
  return {
    typedefs: [lines.join("\n")],
    memberDecl: `ReconRecord records[${totalRecords}];`,
    standaloneDecl: (symbol) => `extern ReconRecord ${symbol}[${totalRecords}];`,
    access: (records, index, test) => ({
      kind: "member",
      base: { kind: "index", base: records, index },
      field: `unk${test.offset.toString(16).toUpperCase()}`,
      arrow: false,
    }),
  };
}

/* ---- the constructor ------------------------------------------------------ */

export interface ConstructedCandidate {
  source: string;
  /** Where each emitted context piece would live on authorized integration. */
  integrationPlan: string[];
}

function testCondition(access: CExpr, test: FieldTest, params: ParamSpec[]): CExpr {
  const rhs: CExpr = test.rhs.kind === "const"
    ? int(test.rhs.value)
    : id(params.find((param) => param.register === (test.rhs as { use: { register: string } }).use.register)!.name);
  return { kind: "binary", op: test.op === "eq" ? "==" : "!=", left: access, right: rhs };
}

/**
 * The success value as an expression over the loop variable. The relation's
 * affine form is in the *window* index; a loop that starts at `startIndex`
 * shifts the constant term so the value per visited record is unchanged.
 */
function returnExpr(spec: ReturnSpec, indexName: string, startIndex: number): CExpr {
  if (spec.kind === "const") return int(spec.value);
  const offset = spec.offset - spec.scale * startIndex;
  let expr: CExpr = id(indexName);
  if (spec.scale !== 1) expr = { kind: "binary", op: "*", left: expr, right: int(spec.scale) };
  if (offset !== 0) expr = { kind: "binary", op: "+", left: expr, right: int(offset) };
  return expr;
}

export function constructCandidate(
  functionName: string,
  relation: ScanRelation,
  choice: ConstructionChoice,
): ConstructedCandidate | { invalid: string } {
  const params = deriveParams(relation);
  if (!Array.isArray(params)) return params;
  const startIndex = choice.origin.startIndex;
  const totalRecords = startIndex + relation.count;
  const pieces = layoutPieces(relation, choice.layout, totalRecords);
  if ("invalid" in pieces) return pieces;
  if (choice.loop === "cursor" && choice.layout.kind !== "scalar-record") {
    return { invalid: "the cursor loop form is only constructed over scalar-record layouts" };
  }
  if (choice.loop === "cursor" && startIndex !== 0) {
    return { invalid: "the cursor loop form is only constructed from the table's first record" };
  }

  const integrationPlan: string[] = [];
  const header: string[] = [];
  const decls: string[] = [];

  if (choice.context === "umbrella") {
    header.push(`#include "common.h"`);
  } else {
    header.push(STANDALONE_TYPEDEF_BLOCK);
  }

  /* The record-array expression, per origin. */
  let records: CExpr;
  if (choice.origin.kind === "embedded") {
    const view = [
      "typedef struct {",
      `    char pad[0x${choice.origin.offset.toString(16).toUpperCase()}];`,
      `    ${pieces.memberDecl}`,
      "} ReconView;",
    ].join("\n");
    decls.push(...pieces.typedefs, view);
    if (choice.context === "standalone") decls.push(`extern u8 ${choice.origin.parentSymbol}[];`);
    records = {
      kind: "member",
      base: { kind: "cast", type: "ReconView *", expr: id(choice.origin.parentSymbol) },
      field: "records",
      arrow: true,
    };
    integrationPlan.push(
      `move the ReconView typedef (records at +0x${choice.origin.offset.toString(16)} of ${choice.origin.parentSymbol}) into the shared type header named by the generated profile`,
      `${choice.origin.parentSymbol} keeps its existing declaration; the view is accessed by cast, not redeclaration`,
    );
  } else {
    decls.push(...pieces.typedefs);
    if (choice.context === "standalone") {
      decls.push(pieces.standaloneDecl(choice.origin.symbol));
      records = id(choice.origin.symbol);
      integrationPlan.push(
        `give ${choice.origin.symbol} its table type in the override header named by the generated profile`,
      );
    } else {
      /* The umbrella headers already declare the label; go through a cast so
       * the emitted unit never redeclares a generated global. */
      if (choice.layout.kind === "scalar-record") {
        records = { kind: "cast", type: "ReconRecord *", expr: id(choice.origin.symbol) };
      } else {
        const width = relation.tests[0]!.width;
        const type = elementType(width, relation.tests[0]!.signed);
        records = choice.layout.kind === "rows"
          ? { kind: "cast", type: `${type} (*)[${relation.stride / width}]`, expr: id(choice.origin.symbol) }
          : { kind: "cast", type: `${type} *`, expr: id(choice.origin.symbol) };
      }
      integrationPlan.push(
        `give ${choice.origin.symbol} its table type in the override header named by the generated profile`,
      );
    }
  }

  /* The loop body: short-circuit tests, then the success action. */
  const indexName = "i";
  const cursorName = "record";
  const accessAt = (test: FieldTest): CExpr =>
    choice.loop === "cursor"
      ? { kind: "member", base: id(cursorName), field: `unk${test.offset.toString(16).toUpperCase()}`, arrow: true }
      : pieces.access(records, id(indexName), test);

  const success: CStmt[] = choice.result === "break-flag"
    ? [
        { kind: "assign", target: id("found"), value: returnExpr(relation.successReturn, indexName, startIndex) },
        { kind: "break" },
      ]
    : [{ kind: "return", expr: returnExpr(relation.successReturn, indexName, startIndex) }];

  let body: CStmt[];
  if (choice.condition === "conjunction") {
    const cond = relation.tests
      .map((test) => testCondition(accessAt(test), test, params))
      .reduce((left, right) => ({ kind: "binary", op: "&&", left, right } as CExpr));
    body = [{ kind: "if", cond, body: success }];
  } else {
    body = success;
    for (let index = relation.tests.length - 1; index >= 0; index--) {
      const test = relation.tests[index]!;
      body = [{ kind: "if", cond: testCondition(accessAt(test), test, params), body }];
    }
  }

  const loop: CStmt = {
    kind: "for",
    init: `${indexName} = ${startIndex}`,
    cond: { kind: "binary", op: "<", left: id(indexName), right: int(totalRecords) },
    step: choice.loop === "cursor" ? `${indexName}++, ${cursorName}++` : `${indexName}++`,
    body,
  };

  const localDecls: string[] = [];
  if (choice.result === "break-flag") localDecls.push("    s32 found;");
  localDecls.push("    s32 i;");
  if (choice.loop === "cursor") localDecls.push(`    ReconRecord *${cursorName};`);

  const bodyStmts: CStmt[] = [];
  if (choice.result === "break-flag") {
    bodyStmts.push({ kind: "assign", target: id("found"), value: int(relation.failReturn) });
  }
  if (choice.loop === "cursor") {
    bodyStmts.push({ kind: "assign", target: id(cursorName), value: records });
  }
  bodyStmts.push(loop);
  bodyStmts.push({
    kind: "return",
    expr: choice.result === "break-flag" ? id("found") : int(relation.failReturn),
  });

  const signature = params.length === 0
    ? `s32 ${functionName}(void)`
    : `s32 ${functionName}(${params.map((param) => `${param.type} ${param.name}`).join(", ")})`;

  const source = [
    ...header,
    "",
    ...decls.flatMap((decl) => [decl, ""]),
    `${signature} {`,
    ...localDecls,
    "",
    ...renderStmts(bodyStmts, "    "),
    "}",
    "",
  ].join("\n");

  integrationPlan.push(
    "write the function body into its container's source directory with the project umbrella includes",
  );

  return { source, integrationPlan };
}

/* ---- the bounded choice space --------------------------------------------- */

/**
 * The deterministic enumeration order. Origins come in the order derived
 * (standalone first, then witnessed parents by ascending base); within an
 * origin the axes vary innermost-first so the order is stable and documented.
 * No alternative is pruned by another's score (plan §7 D2) — the enumerator
 * runs the list as given.
 */
export function enumerateChoices(
  relation: ScanRelation,
  origins: ConstructionChoice["origin"][],
): ConstructionChoice[] {
  const layouts: LayoutAlternative[] = [
    { kind: "rows", elementWidth: relation.tests[0]!.width, signed: relation.tests[0]!.signed, columns: 0 },
    { kind: "scalar-record" },
    { kind: "flat", elementWidth: relation.tests[0]!.width, signed: relation.tests[0]!.signed },
  ];
  const choices: ConstructionChoice[] = [];
  for (const origin of origins) {
    for (const context of ["standalone", "umbrella"] as const) {
      for (const layout of layouts) {
        for (const loop of ["index", "cursor"] as const) {
          for (const result of ["break-flag", "direct-return"] as const) {
            for (const condition of ["nested", "conjunction"] as const) {
              choices.push({ origin, layout, loop, result, condition, context });
            }
          }
        }
      }
    }
  }
  return choices;
}
