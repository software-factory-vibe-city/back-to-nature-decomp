import { readFileSync, readdirSync, type Dirent } from "node:fs";
import { join } from "node:path";
import { CPP_FLAGS } from "../decompToolchain.js";
import { sha256 } from "../variant-lab/artifacts.js";
import type { MacroRegistry } from "./macro-forms.js";
import {
  declaratorIsArray,
  declaratorIsPointer,
  declaratorName,
  field,
  namedChildren,
  parseC,
  walk,
  type Node,
} from "./tree-sitter-c.js";
import {
  REORDERABLE_BLOCK_KINDS,
  RESIDUAL_SEARCH_SCHEMA_VERSION,
  type GraphParameter,
  type GraphVariable,
  type SemanticBlock,
  type SemanticGraph,
  type SemanticNode,
  type SourceSpan,
} from "./types.js";

export { C_FRONTEND_IDENTITY } from "./tree-sitter-c.js";

/* ------------------------------------------------------------------ */
/* Text helpers used by rendering and canonicalization                 */
/* ------------------------------------------------------------------ */

/** Blank comments in place: byte offsets stay valid against the original source. */
export function stripComments(value: string): string {
  return value
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, (comment) => comment.replace(/[^\n]/g, " "));
}

export function splitTopLevel(value: string): string[] {
  const result: string[] = [];
  let start = 0;
  let parentheses = 0;
  let brackets = 0;
  for (let index = 0; index < value.length; index++) {
    const character = value[index]!;
    if (character === "(") parentheses++;
    else if (character === ")") parentheses--;
    else if (character === "[") brackets++;
    else if (character === "]") brackets--;
    else if (character === "," && parentheses === 0 && brackets === 0) {
      result.push(value.slice(start, index));
      start = index + 1;
    }
  }
  result.push(value.slice(start));
  return result;
}

export function immediateValues(text: string): number[] {
  return [...new Set([...stripComments(text).matchAll(/\b0x[0-9a-f]+\b|\b\d+\b/gi)]
    .map((match) => Number(match[0]))
    .filter((value) => Number.isFinite(value)))].sort((left, right) => left - right);
}

/** Web and reaching lookups for synthetic component nodes resolve via their parent. */
export function webLookupId(nodeId: string): string {
  return nodeId.split("::")[0]!;
}

function lineAt(source: string, offset: number): number {
  return source.slice(0, offset).split("\n").length;
}

function span(source: string, start: number, end: number): SourceSpan {
  return { start, end, lineStart: lineAt(source, start), lineEnd: lineAt(source, Math.max(start, end - 1)) };
}

function nodeSpan(source: string, node: Node): SourceSpan {
  return span(source, node.startIndex, node.endIndex);
}

/* ------------------------------------------------------------------ */
/* Expression model                                                    */
/* ------------------------------------------------------------------ */

/**
 * Node types that carry no runtime value: types, type qualifiers, and struct
 * or union specifiers appearing inside a cast or a declaration.
 */
const TYPE_NODES = new Set([
  "type_descriptor", "type_identifier", "primitive_type", "sized_type_specifier",
  "struct_specifier", "union_specifier", "enum_specifier", "type_qualifier",
  "storage_class_specifier", "macro_type_specifier",
]);

/** The operator token of a unary, update, binary, or field expression. */
function operatorOf(node: Node): string {
  const operator = field(node, "operator");
  if (operator) return operator.text;
  for (let index = 0; index < node.childCount; index++) {
    const child = node.child(index);
    if (child && !child.isNamed) return child.text;
  }
  return "";
}

/** Strip parentheses, casts, and address-of down to the value being named. */
function unwrapValue(node: Node): Node {
  let current = node;
  for (;;) {
    if (current.type === "parenthesized_expression") {
      const inner = namedChildren(current).find((child) => child.type !== "comment");
      if (!inner) return current;
      current = inner;
      continue;
    }
    if (current.type === "cast_expression") {
      const value = field(current, "value");
      if (!value) return current;
      current = value;
      continue;
    }
    if (current.type === "pointer_expression" && operatorOf(current) === "&") {
      const argument = field(current, "argument");
      if (!argument) return current;
      current = argument;
      continue;
    }
    return current;
  }
}

/**
 * Canonical object key for a memory-effect expression: parentheses, casts,
 * address-of, whitespace, and subscript indexes erased, so two spellings of
 * the same object compare equal.
 */
function objectKeyOf(node: Node): string {
  const inner = unwrapValue(node);
  switch (inner.type) {
    case "identifier":
      return inner.text;
    case "field_expression": {
      const argument = field(inner, "argument");
      const name = field(inner, "field");
      if (!argument || !name) break;
      return `${objectKeyOf(argument)}${operatorOf(inner)}${name.text}`;
    }
    case "subscript_expression": {
      const argument = field(inner, "argument");
      if (!argument) break;
      return `${objectKeyOf(argument)}[]`;
    }
    case "pointer_expression": {
      const argument = field(inner, "argument");
      if (!argument) break;
      return `*${objectKeyOf(argument)}`;
    }
    default:
      break;
  }
  return stripComments(inner.text).replace(/\s+/g, "");
}

/** The base identifier a field or subscript chain hangs off, when there is one. */
function chainBase(node: Node): Node | undefined {
  let current = unwrapValue(node);
  for (;;) {
    if (current.type === "identifier") return current;
    if (current.type === "field_expression" || current.type === "subscript_expression") {
      const argument = field(current, "argument");
      if (!argument) return undefined;
      current = unwrapValue(argument);
      continue;
    }
    return undefined;
  }
}

/**
 * The memory-effect token a whole lvalue chain names. A trailing subscript is
 * an element of the array, a trailing member is a field of the object it hangs
 * off, and a bare name that is not a local is a named global object.
 */
function accessToken(node: Node, variables: Set<string>): string | undefined {
  const inner = unwrapValue(node);
  if (inner.type === "subscript_expression") {
    return `element:${objectKeyOf(inner)}`;
  }
  if (inner.type === "field_expression") {
    const argument = field(inner, "argument");
    const name = field(inner, "field");
    if (!argument || !name) return undefined;
    return `field:${objectKeyOf(argument)}:${name.text}`;
  }
  if (inner.type === "pointer_expression" && operatorOf(inner) === "*") {
    const base = unwrapValue(field(inner, "argument") ?? inner);
    if (base.type === "identifier" && variables.has(base.text)) return `object:${base.text}`;
    return undefined;
  }
  if (inner.type === "identifier" && !variables.has(inner.text)) return `global:${inner.text}`;
  return undefined;
}

export interface ExpressionEffects {
  /** Local and parameter names read for their value. */
  reads: string[];
  /** Identifiers that are not locals: candidate globals and enum constants. */
  globals: string[];
  memoryReads: string[];
  /** A call, a nested assignment, an increment, or a volatile access. */
  unsafe: boolean;
}

interface EffectSink {
  reads: Set<string>;
  globals: Set<string>;
  memoryReads: Set<string>;
  unsafe: boolean;
}

/**
 * `(T)(x)` and `f(x)` are the same shape to a context-free grammar. The names
 * that are types in this translation unit come from the tree itself — every
 * `type_identifier` the parser committed to elsewhere in the file — so the
 * decision is evidence, not the guess the hand-rolled parser had to make.
 */
export interface AnalysisContext {
  variables: Set<string>;
  typeNames: Set<string>;
}

const PRIMITIVE_TYPE_NAMES = [
  "char", "short", "int", "long", "float", "double", "signed", "unsigned", "void",
];

function collectTypeNamesInto(root: Node, names: Set<string>): void {
  const visit = (node: Node): void => {
    if (node.type === "type_identifier" || node.type === "primitive_type") names.add(node.text);
    for (const child of namedChildren(node)) visit(child);
  };
  visit(root);
}

let cachedIncludeTypeNames: Set<string> | undefined;

/**
 * Type names the compiler sees through the configured include path. A
 * translation unit keeps its `#include` lines, so `u16` is only a type because
 * a configured header says so; reading those headers is how the front end
 * knows, rather than guessing from the shape of `(u16)(x)`.
 */
function includeTypeNames(): Set<string> {
  if (cachedIncludeTypeNames) return cachedIncludeTypeNames;
  const names = new Set<string>(PRIMITIVE_TYPE_NAMES);
  const seen = new Set<string>();
  const scan = (directory: string, depth: number): void => {
    if (depth > 4) return;
    let entries: Dirent[];
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        scan(path, depth + 1);
        continue;
      }
      if (!entry.name.endsWith(".h") || seen.has(path)) continue;
      seen.add(path);
      try {
        collectTypeNamesInto(parseC(readFileSync(path, "utf8")).rootNode, names);
      } catch {
        /* An unreadable or unparsable header contributes no names. */
      }
    }
  };
  for (const flag of CPP_FLAGS) {
    if (flag.startsWith("-I")) scan(flag.slice(2), 0);
  }
  cachedIncludeTypeNames = names;
  return names;
}

export function collectTypeNames(root: Node): Set<string> {
  const names = new Set<string>(includeTypeNames());
  collectTypeNamesInto(root, names);
  return names;
}

/** The lone identifier a parenthesized expression names, when there is one. */
function parenthesizedName(node: Node): string | undefined {
  if (node.type !== "parenthesized_expression") return undefined;
  const inner = namedChildren(node).filter((child) => child.type !== "comment");
  return inner.length === 1 && inner[0]!.type === "identifier" ? inner[0]!.text : undefined;
}

function namesAType(node: Node | undefined, context: AnalysisContext): boolean {
  const name = node ? parenthesizedName(node) : undefined;
  return name !== undefined && context.typeNames.has(name) && !context.variables.has(name);
}

/**
 * The value of a cast the context-free grammar could not see as one.
 *
 * `(T)(x)` reads as a call and `(T)&x` reads as a bitwise and, because only a
 * type name distinguishes them and the grammar has none. The configured
 * headers supply the type names, so the resolution is evidence rather than the
 * shape-based guess the hand-rolled parser had to make.
 */
function castValueOf(node: Node, context: AnalysisContext): Node | undefined {
  if (node.type === "call_expression") {
    if (!namesAType(field(node, "function"), context)) return undefined;
    const args = field(node, "arguments");
    if (!args) return undefined;
    const values = namedChildren(args).filter((child) => child.type !== "comment");
    return values.length === 1 ? values[0]! : undefined;
  }
  if (node.type === "binary_expression") {
    if (!["&", "*", "-", "+"].includes(operatorOf(node))) return undefined;
    if (!namesAType(field(node, "left"), context)) return undefined;
    return field(node, "right");
  }
  return undefined;
}

/** A declaration the context-free grammar read as a call, such as `T (*f)(int);`. */
export function isTypeNamedCall(node: Node, context: AnalysisContext): boolean {
  let current: Node | undefined = node;
  while (current && current.type === "call_expression") {
    const callee: Node | undefined = field(current, "function");
    if (callee?.type === "identifier") {
      return context.typeNames.has(callee.text) && !context.variables.has(callee.text);
    }
    current = callee;
  }
  return false;
}

/**
 * Value reads. A field name is a member selector, a cast names a type, a
 * `sizeof` operand is never loaded, and a callee is not a variable unless the
 * call goes through a function pointer that is one.
 */
function collectReads(node: Node, context: AnalysisContext, sink: EffectSink): void {
  if (node.type === "comment" || TYPE_NODES.has(node.type)) return;
  if (node.type === "sizeof_expression" || node.type === "offsetof_expression") return;
  const castValue = castValueOf(node, context);
  if (castValue) {
    collectReads(castValue, context, sink);
    return;
  }
  if (node.type === "identifier") {
    if (context.variables.has(node.text)) sink.reads.add(node.text);
    else sink.globals.add(node.text);
    return;
  }
  if (node.type === "gnu_asm_expression") {
    sink.unsafe = true;
    return;
  }
  if (node.type === "call_expression") {
    sink.unsafe = true;
    const callee = field(node, "function");
    /* A call through a function-pointer variable really does read it. */
    if (callee && !(callee.type === "identifier" && !context.variables.has(callee.text))) {
      collectReads(callee, context, sink);
    }
    const args = field(node, "arguments");
    if (args) collectReads(args, context, sink);
    return;
  }
  if (node.type === "assignment_expression" || node.type === "update_expression") sink.unsafe = true;
  if (node.type === "cast_expression") {
    const value = field(node, "value");
    if (value) collectReads(value, context, sink);
    return;
  }
  for (const child of namedChildren(node)) collectReads(child, context, sink);
}

/**
 * Memory-read tokens for a value expression. Only the outermost access of a
 * chain is recorded — the model names the object a statement touches, not
 * every intermediate load — and an address-of path computes an address without
 * reading through it.
 */
function collectMemoryReads(node: Node, context: AnalysisContext, sink: EffectSink): void {
  if (node.type === "comment" || TYPE_NODES.has(node.type)) return;
  if (node.type === "sizeof_expression" || node.type === "offsetof_expression") return;
  const castValue = castValueOf(node, context);
  if (castValue) {
    collectMemoryReads(castValue, context, sink);
    return;
  }
  if (node.type === "cast_expression") {
    const value = field(node, "value");
    if (value) collectMemoryReads(value, context, sink);
    return;
  }
  if (node.type === "pointer_expression" && operatorOf(node) === "&") return;
  if (node.type === "field_expression" || node.type === "subscript_expression") {
    const base = chainBase(node);
    if (base && !context.variables.has(base.text)) sink.memoryReads.add(`global:${base.text}`);
    else {
      const token = accessToken(node, context.variables);
      if (token) sink.memoryReads.add(token);
    }
    return;
  }
  if (node.type === "pointer_expression") {
    const token = accessToken(node, context.variables);
    if (token) sink.memoryReads.add(token);
    return;
  }
  for (const child of namedChildren(node)) collectMemoryReads(child, context, sink);
}

function analyzeExpression(node: Node | undefined, context: AnalysisContext): ExpressionEffects {
  const sink: EffectSink = { reads: new Set(), globals: new Set(), memoryReads: new Set(), unsafe: false };
  if (node) {
    collectReads(node, context, sink);
    collectMemoryReads(node, context, sink);
  }
  return {
    reads: [...sink.reads].sort(),
    globals: [...sink.globals].sort(),
    memoryReads: [...sink.memoryReads].sort(),
    unsafe: sink.unsafe,
  };
}

/** Memory-read tokens of one expression, by text. Exposed for tests. */
export function memoryReadTokens(code: string, variables: Set<string>): string[] {
  const expression = parseExpression(code);
  if (!expression) return [];
  const sink: EffectSink = { reads: new Set(), globals: new Set(), memoryReads: new Set(), unsafe: false };
  collectMemoryReads(expression, { variables, typeNames: new Set(PRIMITIVE_TYPE_NAMES) }, sink);
  return [...sink.memoryReads].sort();
}

/** Parse a bare expression by wrapping it in a statement the grammar accepts. */
function parseExpression(code: string): Node | undefined {
  const tree = parseC(`void __e(void){(${code});}`);
  const definition = namedChildren(tree.rootNode).find((node) => node.type === "function_definition");
  const body = definition ? field(definition, "body") : undefined;
  const statement = body ? namedChildren(body).find((node) => node.type === "expression_statement") : undefined;
  const outer = statement ? namedChildren(statement)[0] : undefined;
  return outer ? unwrapParentheses(outer) : undefined;
}

function unwrapParentheses(node: Node): Node {
  if (node.type !== "parenthesized_expression") return node;
  const inner = namedChildren(node).find((child) => child.type !== "comment");
  return inner ?? node;
}

/* ------------------------------------------------------------------ */
/* Statement model                                                     */
/* ------------------------------------------------------------------ */

const EMPTY_BARRIER = /^(?:__asm__|__asm)\s*(?:volatile\s*)?\(\s*""\s*:\s*:\s*:\s*"memory"\s*\)\s*;$/;

interface BuildState {
  source: string;
  context: AnalysisContext;
  registry: MacroRegistry;
  nodes: SemanticNode[];
  blocks: SemanticBlock[];
  caveats: string[];
  nextNode: number;
  /** Locals declared with an array declarator; their name is an address. */
  arrayLocals: Set<string>;
}

function newNodeId(state: BuildState): string {
  return `n${state.nextNode++}`;
}

/** Expression forms that stand alone as a statement in a `for` header. */
const EXPRESSION_TYPES = new Set([
  "assignment_expression", "update_expression", "call_expression", "gnu_asm_expression",
]);

/** Statement forms this grammar version freezes verbatim. */
const CONTROL_CONSTRUCTS = new Set([
  "for_statement", "while_statement", "do_statement", "switch_statement",
  "goto_statement", "break_statement", "continue_statement", "labeled_statement",
  "case_statement",
]);

/** Names the construct a frozen node stands for, for the caveat line. */
function constructLabel(node: Node): string {
  switch (node.type) {
    case "for_statement": return "for loop";
    case "while_statement": return "while loop";
    case "do_statement": return "do/while loop";
    case "switch_statement": return "switch";
    case "goto_statement": return "goto";
    case "break_statement": return "break";
    case "continue_statement": return "continue";
    case "labeled_statement": return "label";
    case "compound_statement": return "bare compound statement";
    case "ERROR": return "unparsable region";
    default: return node.type.replace(/_/g, " ");
  }
}

function frozenNode(state: BuildState, blockIndex: number, node: Node, evidence: string): SemanticNode {
  const effects = analyzeExpression(node, state.context);
  return {
    id: newNodeId(state),
    kind: "unknown",
    block: blockIndex,
    span: nodeSpan(state.source, node),
    text: node.text,
    reads: effects.reads,
    writes: effects.reads,
    killingWrite: false,
    memoryReads: ["*unknown*"],
    memoryWrites: ["*unknown*"],
    movable: false,
    evidence: [evidence],
  };
}

/** The write token of an assignment target. */
function storeToken(target: Node, variables: Set<string>): string {
  return accessToken(target, variables) ?? `global:${objectKeyOf(target)}`;
}

/**
 * Classify one statement node. `allowDeclaration` is false past the first
 * executable statement of a block: a declaration there is not a C89 block-top
 * declaration, and the conservative model freezes it.
 */
function classifyStatement(
  state: BuildState,
  blockIndex: number,
  node: Node,
  allowDeclaration: boolean,
): SemanticNode {
  const { source, context } = state;
  const variables = context.variables;
  const statementSpan = nodeSpan(source, node);
  const text = node.text;
  const base = {
    block: blockIndex,
    span: statementSpan,
    text,
    reads: [] as string[],
    writes: [] as string[],
    killingWrite: false,
    memoryReads: [] as string[],
    memoryWrites: [] as string[],
    evidence: [] as string[],
  };

  if (EMPTY_BARRIER.test(stripComments(text).trim())) {
    return {
      ...base,
      id: newNodeId(state),
      kind: "barrier",
      movable: false,
      memoryReads: ["*unknown*"],
      memoryWrites: ["*unknown*"],
      evidence: ["Inherited empty memory barrier: immutable position, orders all memory effects."],
    };
  }

  if (node.type === "declaration") {
    const declarators = namedChildren(node).filter((child) =>
      child.type === "init_declarator" || child.type.endsWith("declarator") || child.type === "identifier");
    const only = declarators.length === 1 ? declarators[0]! : undefined;
    const name = only ? declaratorName(only) : undefined;
    /* `register T *p __asm__("v0");` binds storage to a hard register. That is
     * not an ordinary local, so the model refuses to reason about it. */
    if (namedChildren(node).some((child) => child.type === "gnu_asm_expression")) {
      return frozenNode(state, blockIndex, node,
        "Declaration pinned to a hard register; storage identity is outside the model.");
    }
    if (allowDeclaration && only && name) {
      const initializer = only.type === "init_declarator" ? field(only, "value") : undefined;
      const effects = analyzeExpression(initializer, context);
      const declType = source.slice(node.startIndex, name.startIndex).trim().replace(/\s+/g, " ");
      const declaration: SemanticNode = {
        ...base,
        id: newNodeId(state),
        kind: "declaration",
        movable: false,
        declName: name.text,
        declType,
        reads: effects.reads,
        writes: initializer ? [name.text] : [],
        killingWrite: Boolean(initializer),
        memoryReads: initializer
          ? [...new Set([...effects.globals.map((item) => `global:${item}`), ...effects.memoryReads])].sort()
          : [],
        evidence: ["C89 block-top declaration."],
      };
      if (declaratorIsArray(only)) state.arrayLocals.add(name.text);
      if (initializer) {
        declaration.initializer = initializer.text;
        if (effects.unsafe) {
          declaration.memoryReads = ["*unknown*"];
          declaration.memoryWrites = ["*unknown*"];
          declaration.evidence.push("Initializer contains a call or side effect; treated as an unknown-effect definition.");
        }
      }
      return declaration;
    }
    return frozenNode(state, blockIndex, node, declarators.length > 1
      ? "A declaration of more than one name is outside the flat variable model."
      : "A declaration past the first executable statement is not a C89 block-top declaration.");
  }

  if (node.type === "return_statement") {
    const expression = namedChildren(node).find((child) => child.type !== "comment");
    const effects = analyzeExpression(expression, context);
    return {
      ...base,
      id: newNodeId(state),
      kind: "return",
      movable: false,
      reads: effects.reads,
      memoryReads: effects.unsafe
        ? ["*unknown*"]
        : [...new Set([...effects.globals.map((item) => `global:${item}`), ...effects.memoryReads])].sort(),
      memoryWrites: effects.unsafe ? ["*unknown*"] : [],
      evidence: ["Function return anchors the end of its block."],
    };
  }

  if (node.type === "expression_statement" || EXPRESSION_TYPES.has(node.type)) {
    /* A `for` header holds bare expressions where a block holds statements. */
    const expression = node.type === "expression_statement"
      ? namedChildren(node).find((child) => child.type !== "comment")
      : node;
    if (!expression) {
      return frozenNode(state, blockIndex, node, "The conservative statement model could not classify this statement.");
    }
    if (expression.type === "gnu_asm_expression") {
      return {
        ...base,
        id: newNodeId(state),
        kind: "unknown",
        movable: false,
        memoryReads: ["*unknown*"],
        memoryWrites: ["*unknown*"],
        evidence: ["Non-empty embedded assembly is outside the semantic model."],
      };
    }
    if (expression.type === "call_expression") {
      /* `T (*fn)(int);` is a declaration a context-free grammar has to read as
       * a call. The type name gives it away, and the model freezes it. */
      if (isTypeNamedCall(expression, context)) {
        return frozenNode(state, blockIndex, node,
          "A function-pointer or unsupported declarator is outside the flat variable model.");
      }
      return classifyCall(state, blockIndex, node, expression, base);
    }
    if (expression.type === "assignment_expression" || expression.type === "update_expression") {
      return classifyAssignment(state, blockIndex, expression, base);
    }
    return frozenNode(state, blockIndex, node, "The conservative statement model could not classify this statement.");
  }

  if (node.type === "compound_statement") {
    return frozenNode(state, blockIndex, node, "Bare compound statement introduces a scope; frozen verbatim.");
  }
  if (LOOP_TYPES.has(node.type)) return buildLoop(state, blockIndex, node);
  if (node.type === "switch_statement") return buildSwitch(state, blockIndex, node);
  return frozenNode(state, blockIndex, node, CONTROL_CONSTRUCTS.has(node.type)
    ? `A ${constructLabel(node)} is frozen verbatim in this grammar version.`
    : `A ${constructLabel(node)} is outside the conservative statement model.`);
}

/* ------------------------------------------------------------------ */
/* Loops and switches: structure without capability                    */
/* ------------------------------------------------------------------ */

const LOOP_TYPES = new Set(["for_statement", "while_statement", "do_statement"]);

const LOOP_FORMS: Record<string, "for" | "while" | "do-while"> = {
  for_statement: "for",
  while_statement: "while",
  do_statement: "do-while",
};

/** Flatten a comma expression: `i--, ent--` is two statements in a header. */
function commaOperands(node: Node): Node[] {
  if (node.type !== "comma_expression") return [node];
  const left = field(node, "left");
  const right = field(node, "right");
  if (!left || !right) return [node];
  return [...commaOperands(left), ...commaOperands(right)];
}

/**
 * A `continue` belonging to this loop. It skips the body tail but still runs a
 * `for` header's update, so it decides whether an update statement may move
 * between the two — which is why the loop records it.
 */
function containsOwnContinue(node: Node): boolean {
  let found = false;
  const visit = (item: Node): void => {
    if (found) return;
    if (item.type === "continue_statement") {
      found = true;
      return;
    }
    /* A nested loop owns its own continues. */
    if (item !== node && LOOP_TYPES.has(item.type)) return;
    for (const child of namedChildren(item)) visit(child);
  };
  visit(node);
  return found;
}

/** Statements that transfer control somewhere the block model cannot follow. */
const CASE_ESCAPE_TYPES = new Set([
  "break_statement", "continue_statement", "goto_statement", "return_statement", "labeled_statement",
]);

/**
 * The statements of one `case`, with the label and comments removed and a lone
 * brace unwrapped.
 *
 * `case X: { ... }` is the ordinary C89 spelling whenever the case needs a
 * local, because a declaration needs a block to live in. The braces buy that
 * declaration a scope and change nothing about control flow, so the body they
 * hold is the case's body. Braces followed by anything else are left alone —
 * that is not the idiom, and unwrapping would lose the statements after them.
 */
function caseBodyStatements(item: Node, label: Node | undefined): Node[] {
  const direct = namedChildren(item).filter((child) => child.type !== "comment" && child.id !== label?.id);
  if (direct.length !== 1 || direct[0]!.type !== "compound_statement") return direct;
  return namedChildren(direct[0]!).filter((child) => child.type !== "comment");
}

/**
 * Whether a `case` body is a plain statement sequence: one entry at the label,
 * one exit at the terminator, and no control transfer from its interior.
 *
 * Such a body is a basic-block sequence exactly like a `then` block, so its
 * statements can be ordered and can join the causal closure. The predicate is
 * deliberately syntactic and refuses on anything it cannot see through — a
 * nested `switch` or loop owns its own `break`, but proving which one a given
 * `break` belongs to is the control-flow modelling this schema still lacks, so
 * a body containing one is refused rather than assumed.
 *
 * `statements` is the case's statement list with the label and comments
 * already removed, and with a lone brace unwrapped — see `caseBodyStatements`.
 */
export function caseBodyIsSequential(statements: Node[]): { ok: true } | { ok: false; reason: string } {
  if (statements.length === 0) return { ok: false, reason: "the case is empty and falls through" };
  const last = statements[statements.length - 1]!;
  if (last.type !== "break_statement" && last.type !== "return_statement") {
    return { ok: false, reason: "the case does not terminate in break or return" };
  }
  const body = last.type === "break_statement" ? statements.slice(0, -1) : statements;

  for (const statement of body) {
    let escape: string | undefined;
    walk(statement, (item) => {
      if (escape !== undefined) return false;
      if (CASE_ESCAPE_TYPES.has(item.type)) {
        escape = item.type;
        return false;
      }
      return true;
    });
    if (escape !== undefined) {
      return { ok: false, reason: `a ${escape.replace("_statement", "")} inside the case body leaves it by a path the schema does not model` };
    }
  }
  return { ok: true };
}

/**
 * Model one header expression as a statement node in its own block. `for`
 * headers hold bare expressions rather than statements, so the span is the
 * expression's own.
 */
function buildHeaderBlock(
  state: BuildState,
  parent: number,
  owner: string,
  kind: "loop-init" | "loop-update",
  expression: Node | undefined,
): number {
  const index = state.blocks.length;
  state.blocks.push({ index, parent, kind, nodeIds: [], controllingConstruct: owner });
  if (!expression) return index;
  for (const operand of commaOperands(expression)) {
    const node = classifyStatement(state, index, operand, false);
    state.nodes.push({ ...node, movable: false });
    state.blocks[index]!.nodeIds.push(node.id);
  }
  return index;
}

function buildBodyBlock(state: BuildState, parent: number, owner: string, body: Node | undefined): number {
  const index = state.blocks.length;
  state.blocks.push({ index, parent, kind: "loop-body", nodeIds: [], controllingConstruct: owner });
  if (body) buildBlockBody(state, index, branchStatements(body));
  return index;
}

/**
 * A loop keeps the conservative whole-construct summary it has always had —
 * unknown effects, immovable — and gains the structure a later grammar version
 * needs: its header blocks, its body block, and whether a `continue` pins the
 * update. Nothing inside it is reorderable until loop-carried dependencies can
 * constrain it.
 */
function buildLoop(state: BuildState, blockIndex: number, statement: Node): SemanticNode {
  const { source } = state;
  const id = newNodeId(state);
  const form = LOOP_FORMS[statement.type]!;
  const initializer = statement.type === "for_statement" ? field(statement, "initializer") : undefined;
  const update = statement.type === "for_statement" ? field(statement, "update") : undefined;
  const condition = field(statement, "condition");
  const conditionInner = condition ? unwrapParentheses(condition) : undefined;

  const initBlock = statement.type === "for_statement"
    ? buildHeaderBlock(state, blockIndex, id, "loop-init", initializer)
    : undefined;
  const bodyBlock = buildBodyBlock(state, blockIndex, id, field(statement, "body"));
  const updateBlock = statement.type === "for_statement"
    ? buildHeaderBlock(state, blockIndex, id, "loop-update", update)
    : undefined;

  /* The loop node is the test. Its header and body are modelled as blocks of
   * their own, so the node carries only the condition's effects — and stays
   * immovable, which keeps it a barrier in the block that contains it. */
  const effects = analyzeExpression(conditionInner, state.context);
  const node: SemanticNode = {
    id,
    kind: "unknown",
    block: blockIndex,
    span: nodeSpan(source, statement),
    text: statement.text,
    reads: effects.reads,
    writes: [],
    killingWrite: false,
    memoryReads: [...new Set([...effects.globals.map((item) => `global:${item}`), ...effects.memoryReads])].sort(),
    memoryWrites: [],
    movable: false,
    evidence: [`A ${form} loop's header and body are modelled; the construct itself is never moved or reshaped.`],
    loopForm: form,
    bodyBlock,
    hasContinue: containsOwnContinue(statement),
  };
  if (effects.unsafe) {
    node.memoryReads = ["*unknown*"];
    node.memoryWrites = ["*unknown*"];
    node.evidence.push("Loop condition contains a call or side effect; treated as an unknown-effect read.");
  }
  if (conditionInner) {
    node.condition = stripComments(conditionInner.text).trim();
    node.condSpan = nodeSpan(source, conditionInner);
  }
  if (initBlock !== undefined) node.initBlock = initBlock;
  if (updateBlock !== undefined) node.updateBlock = updateBlock;
  return node;
}

/**
 * A switch keeps its conservative summary and gains one block per case, so a
 * later grammar version can weigh a jump table against a compare chain.
 */
function buildSwitch(state: BuildState, blockIndex: number, statement: Node): SemanticNode {
  const { source } = state;
  const id = newNodeId(state);
  const condition = field(statement, "condition");
  const conditionInner = condition ? unwrapParentheses(condition) : undefined;
  const body = field(statement, "body");
  const caseBlocks: number[] = [];
  const frozenItems: Node[] = [];
  for (const item of body ? namedChildren(body) : []) {
    if (item.type !== "case_statement") continue;
    const index = state.blocks.length;
    const label = field(item, "value");
    const block: SemanticBlock = {
      index,
      parent: blockIndex,
      kind: "case",
      nodeIds: [],
      controllingConstruct: id,
    };
    if (label) block.caseLabel = stripComments(label.text).trim();
    const statements = caseBodyStatements(item, label);

    /* Admissibility is decided before the body is built, so `blockIsFrozen`
     * gives the same answer during the build as it will afterwards. */
    const sequential = caseBodyIsSequential(statements);
    const name = block.caseLabel === undefined ? "default" : `case ${block.caseLabel}`;
    if (sequential.ok) {
      block.sequentialCase = true;
    } else {
      block.caseRefusal = sequential.reason;
      frozenItems.push(item);
      state.caveats.push(
        `${name} at line ${lineAt(source, item.startIndex)} stays inside the switch summary: ${sequential.reason}.`,
      );
    }

    state.blocks.push(block);
    caseBlocks.push(index);
    buildBlockBody(state, index, statements);
  }

  /* The summary covers the dispatch and every case the schema could not open.
   * A sequential case is covered by its own statement nodes and its own flow
   * edges instead, so naming its variables here too would be no safer — it
   * would only mark them touched by an unknown-effect node, which freezes
   * their webs and renaming for no reason. Memory stays `*unknown*`: the
   * construct is a barrier wherever it sits, and a frozen case's stores have
   * nowhere else to be recorded. */
  const conditionEffects = analyzeExpression(conditionInner, state.context);
  const frozenNames = frozenItems.flatMap((item) => analyzeExpression(item, state.context).reads);
  const summarized = [...new Set([...conditionEffects.reads, ...frozenNames])].sort();
  const sequentialCount = caseBlocks.filter((index) => state.blocks[index]!.sequentialCase === true).length;
  const node: SemanticNode = {
    id,
    kind: "unknown",
    block: blockIndex,
    span: nodeSpan(source, statement),
    text: statement.text,
    reads: summarized,
    /* A frozen construct may write anything it mentions. */
    writes: summarized,
    killingWrite: false,
    memoryReads: ["*unknown*"],
    memoryWrites: ["*unknown*"],
    movable: false,
    evidence: [
      "The switch construct itself is never moved or reshaped, and its memory effects stay an unknown-effect summary.",
      `${sequentialCount} of ${caseBlocks.length} cases are sequential; their statements are modelled individually, ` +
      `and the summary names only the condition and the ${frozenItems.length} case(s) that stayed frozen.`,
    ],
    bodyBlock: caseBlocks[0],
    caseBlocks,
  };
  if (conditionInner) {
    node.condition = stripComments(conditionInner.text).trim();
    node.condSpan = nodeSpan(source, conditionInner);
  }
  return node;
}

type NodeBase = Omit<SemanticNode, "id" | "kind" | "movable">;

function classifyCall(
  state: BuildState,
  blockIndex: number,
  statement: Node,
  call: Node,
  base: NodeBase,
): SemanticNode {
  const { context } = state;
  const variables = context.variables;
  const callee = field(call, "function");
  const argumentList = field(call, "arguments");
  const args = argumentList
    ? namedChildren(argumentList).filter((child) => child.type !== "comment")
    : [];
  const name = callee?.type === "identifier" ? callee.text : undefined;
  const macro = name !== undefined ? state.registry.active.get(name) : undefined;

  if (macro && macro.argCount === args.length) {
    const perArgument = args.map((argument) => analyzeExpression(argument, context));
    if (!perArgument.some((effects) => effects.unsafe)) {
      const reads = new Set<string>();
      const memoryReads = new Set<string>();
      const memoryWrites = new Set<string>();
      for (const effects of perArgument) {
        for (const value of effects.reads) reads.add(value);
        for (const value of effects.globals) memoryReads.add(`global:${value}`);
        for (const token of effects.memoryReads) memoryReads.add(token);
      }
      for (const effect of macro.effects) {
        const argument = args[effect.argIndex];
        if (argument === undefined) continue;
        const key = objectKeyOf(argument);
        if (effect.kind === "whole-object-write") memoryWrites.add(`object:${key}`);
        else if (effect.kind === "field-write") memoryWrites.add(`field:${key}:${effect.field}`);
        else memoryReads.add(`field:${key}:${effect.field}`);
      }
      return {
        ...base,
        id: newNodeId(state),
        kind: "known-macro",
        movable: true,
        macro: name,
        ...(macro.publication === true ? { publishes: true } : {}),
        reads: [...reads].sort(),
        memoryReads: [...memoryReads].sort(),
        memoryWrites: [...memoryWrites].sort(),
        evidence: [
          `${name} effects verified against ${macro.header} (definition hash ${macro.definitionHash.slice(0, 12)}).`,
          macro.evidence,
          ...(macro.publication === true
            ? ["Publication point: statements touching the published object are ordered against this call by default."]
            : []),
        ],
      };
    }
  }

  const effects = analyzeExpression(statement, context);

  /* An unregistered callee's memory effects are unknown, but its effect on the
   * caller's scalars is not. C passes them by value: the callee cannot write
   * one back. The single channel that would let it — a pointer to a local —
   * is `&x` in the argument list, which is visible here and is the whole of
   * this node's scalar writes. Claiming instead to write every name read was
   * conservative in the wrong currency: it marked those names touched by an
   * unknown-effect node, which froze their webs, and a local that is passed to
   * any call is most locals. Reads stay over-approximate, which only merges
   * webs; writes do not, because a spurious write invents a definition and
   * cuts the web at the call. */
  const escapes = addressEscapingNames(statement, variables);
  return {
    ...base,
    id: newNodeId(state),
    kind: "call",
    movable: false,
    reads: effects.reads,
    writes: [...escapes].sort(),
    memoryReads: ["*unknown*"],
    memoryWrites: ["*unknown*"],
    evidence: [
      macro
        ? `${name} is registered but the call shape or argument purity did not match; memory effects are unknown.`
        : `${name ?? "the callee"} is not in the configured known-macro registry; memory effects are unknown.`,
      escapes.size === 0
        ? "No local's address is passed, so the call writes no scalar this model tracks."
        : `Writes only the local(s) whose address is passed: ${[...escapes].sort().join(", ")}.`,
    ],
  };
}

function classifyAssignment(
  state: BuildState,
  blockIndex: number,
  expression: Node,
  base: NodeBase,
): SemanticNode {
  const { context } = state;
  const variables = context.variables;
  const increment = expression.type === "update_expression";
  const target = increment ? field(expression, "argument") : field(expression, "left");
  const rhs = increment ? undefined : field(expression, "right");
  if (!target) {
    return frozenNode(state, blockIndex, expression, "The conservative statement model could not classify this statement.");
  }
  const operator = operatorOf(expression);
  const rhsEffects = analyzeExpression(rhs, context);
  const reads = new Set(rhsEffects.reads);
  const memoryReads = new Set([
    ...rhsEffects.globals.map((item) => `global:${item}`),
    ...rhsEffects.memoryReads,
  ]);
  const memoryWrites = new Set<string>();
  const writes = new Set<string>();
  let kind: SemanticNode["kind"] = "assign";
  let killing = false;

  const inner = unwrapValue(target);
  const scalar = inner.type === "identifier" && variables.has(inner.text);
  if (scalar) {
    writes.add(inner.text);
    if (operator === "=") killing = true;
    else reads.add(inner.text);
  } else {
    kind = "store";
    const targetEffects = analyzeExpression(target, context);
    for (const value of targetEffects.reads) reads.add(value);
    const token = storeToken(target, variables);
    memoryWrites.add(token);
    if (operator !== "=") memoryReads.add(token);
  }

  const node: SemanticNode = {
    ...base,
    id: newNodeId(state),
    kind,
    movable: !rhsEffects.unsafe,
    reads: [...reads].sort(),
    writes: [...writes].sort(),
    killingWrite: killing,
    memoryReads: rhsEffects.unsafe ? ["*unknown*"] : [...memoryReads].sort(),
    memoryWrites: rhsEffects.unsafe ? ["*unknown*"] : [...memoryWrites].sort(),
    operator,
    lhs: target.text,
    evidence: rhsEffects.unsafe
      ? ["The right-hand side contains a call, nested assignment, increment, decrement, or volatile token; position frozen."]
      : ["Single-destination statement with a side-effect-free token expression."],
  };
  if (!increment && rhs) node.rhs = rhs.text;
  return node;
}

/** Classify one synthesized statement outside any parsed function body. */
export function classifySyntheticStatement(
  text: string,
  variables: Set<string>,
  registry: MacroRegistry,
): SemanticNode {
  const wrapper = `void __s(void){\n${text}\n}`;
  const tree = parseC(wrapper);
  const definition = namedChildren(tree.rootNode).find((node) => node.type === "function_definition");
  const body = definition ? field(definition, "body") : undefined;
  const statement = body ? namedChildren(body).find((node) => node.type !== "comment") : undefined;
  const state: BuildState = {
    source: wrapper,
    context: { variables, typeNames: collectTypeNames(tree.rootNode) },
    registry,
    nodes: [],
    blocks: [{ index: 0, kind: "entry", nodeIds: [] }],
    caveats: [],
    nextNode: 0,
    arrayLocals: new Set(),
  };
  if (!statement) {
    return {
      id: "n0",
      kind: "unknown",
      block: 0,
      span: { start: 0, end: text.length, lineStart: 1, lineEnd: 1 },
      text,
      reads: [],
      writes: [],
      killingWrite: false,
      memoryReads: ["*unknown*"],
      memoryWrites: ["*unknown*"],
      movable: false,
      evidence: ["The conservative statement model could not classify this statement."],
    };
  }
  const node = classifyStatement(state, 0, statement, false);
  /* Synthetic statements have no place in the original source. */
  return { ...node, span: { start: 0, end: text.length, lineStart: 1, lineEnd: 1 }, text };
}

/* ------------------------------------------------------------------ */
/* Block structure                                                     */
/* ------------------------------------------------------------------ */

/**
 * True when the block sits inside a construct the grammar cannot reason about,
 * directly or through an enclosing `if`. Everything under a frozen construct is
 * frozen with it. A `case` block is frozen unless it was admitted as sequential
 * when the switch was built.
 */
export function blockIsFrozen(blocks: SemanticBlock[], index: number): boolean {
  let current: SemanticBlock | undefined = blocks[index];
  while (current) {
    if (!REORDERABLE_BLOCK_KINDS.has(current.kind)) return true;
    if (current.kind === "case" && current.sequentialCase !== true) return true;
    current = current.parent === undefined ? undefined : blocks[current.parent];
  }
  return false;
}

function buildBlockBody(state: BuildState, blockIndex: number, statements: Node[]): void {
  const block = state.blocks[blockIndex]!;
  /* A loop body or a case is recorded structurally but stays inert: nothing in
   * it may be reordered until loop-carried dependencies can constrain it, and
   * a declaration there opens a scope the flat variable model does not have. */
  const inert = blockIsFrozen(state.blocks, blockIndex);
  let sawExecutable = inert;
  for (const statement of statements) {
    if (statement.type === "comment") continue;
    if (statement.type === "if_statement") {
      buildIf(state, blockIndex, statement);
      sawExecutable = true;
      continue;
    }
    const node = classifyStatement(state, blockIndex, statement, !sawExecutable);
    if (node.kind !== "declaration") sawExecutable = true;
    if (!inert) {
      const line = lineAt(state.source, statement.startIndex);
      if (node.loopForm !== undefined) {
        state.caveats.push(`${constructLabel(statement)} at line ${line}: header and body modelled, the construct itself immovable.`);
      } else if (node.kind === "unknown" && CONTROL_CONSTRUCTS.has(statement.type)) {
        state.caveats.push(`${constructLabel(statement)} frozen at line ${line}.`);
      } else if (statement.type === "compound_statement") {
        state.caveats.push(`Bare compound statement frozen at line ${line}.`);
      }
    }
    state.nodes.push(inert ? { ...node, movable: false } : node);
    block.nodeIds.push(node.id);
  }
}

/** The statements of a branch: a braced block's children, or the lone statement. */
function branchStatements(node: Node): Node[] {
  return node.type === "compound_statement"
    ? namedChildren(node).filter((child) => child.type !== "comment")
    : [node];
}

function buildIf(state: BuildState, blockIndex: number, statement: Node): void {
  const { source } = state;
  const block = state.blocks[blockIndex]!;
  const condition = field(statement, "condition");
  const conditionInner = condition ? unwrapParentheses(condition) : undefined;
  const effects = analyzeExpression(conditionInner, state.context);

  /* Pre-order ids, post-order nodes: the branch bodies are modelled before
   * the conditional that owns them, exactly as the flow walk expects. */
  const ifId = newNodeId(state);
  const thenIndex = state.blocks.length;
  state.blocks.push({ index: thenIndex, parent: blockIndex, kind: "then", nodeIds: [], controllingIf: ifId });
  const consequence = field(statement, "consequence");
  if (consequence) buildBranch(state, thenIndex, consequence);

  let elseIndex: number | undefined;
  const alternative = field(statement, "alternative");
  if (alternative) {
    elseIndex = state.blocks.length;
    state.blocks.push({ index: elseIndex, parent: blockIndex, kind: "else", nodeIds: [], controllingIf: ifId });
    const body = alternative.type === "else_clause"
      ? namedChildren(alternative).find((child) => child.type !== "comment")
      : alternative;
    if (body) buildBranch(state, elseIndex, body);
  }

  const node: SemanticNode = {
    id: ifId,
    kind: "if",
    block: blockIndex,
    span: nodeSpan(source, statement),
    text: statement.text,
    reads: effects.reads,
    writes: [],
    killingWrite: false,
    memoryReads: [...new Set([...effects.globals.map((item) => `global:${item}`), ...effects.memoryReads])].sort(),
    memoryWrites: [],
    movable: false,
    evidence: ["Conditional region: branch structure is immutable in this grammar version."],
    condition: conditionInner ? stripComments(conditionInner.text).trim() : "",
    condSpan: condition
      ? span(source, condition.startIndex + 1, condition.endIndex - 1)
      : nodeSpan(source, statement),
    thenBlock: thenIndex,
  };
  if (elseIndex !== undefined) node.elseBlock = elseIndex;
  if (effects.unsafe) {
    node.memoryReads = ["*unknown*"];
    node.memoryWrites = ["*unknown*"];
    node.evidence.push("Branch condition contains a call or side effect; treated as an unknown-effect read.");
  }
  state.nodes.push(node);
  block.nodeIds.push(ifId);
}

function buildBranch(state: BuildState, blockIndex: number, body: Node): void {
  if (body.type === "if_statement") {
    buildIf(state, blockIndex, body);
    return;
  }
  buildBlockBody(state, blockIndex, branchStatements(body));
}

/* ------------------------------------------------------------------ */
/* Declarations and variables                                          */
/* ------------------------------------------------------------------ */

/** Descend a pointer- or parenthesis-wrapped declarator to the function itself. */
function functionDeclarator(node: Node | undefined): Node | undefined {
  let current = node;
  while (current) {
    if (current.type === "function_declarator") return current;
    const next = field(current, "declarator");
    if (!next || next.id === current.id) return undefined;
    current = next;
  }
  return undefined;
}

function parameterList(source: string, declarator: Node | undefined): GraphParameter[] {
  const signature = functionDeclarator(declarator);
  const list = signature ? field(signature, "parameters") : undefined;
  if (!list) return [];
  const entries = namedChildren(list).filter((child) => child.type !== "comment");
  const parameters: GraphParameter[] = [];
  entries.forEach((entry, index) => {
    if (entry.type === "identifier") {
      /* An old-style parameter list names the parameter; its type arrives in a
       * separate declaration between the list and the body. */
      parameters.push({
        name: entry.text,
        typeText: "",
        index,
        pointer: false,
        span: nodeSpan(source, entry),
      });
      return;
    }
    if (entry.type !== "parameter_declaration") return;
    const name = declaratorName(field(entry, "declarator"));
    if (!name) return;
    parameters.push({
      name: name.text,
      typeText: source.slice(entry.startIndex, name.startIndex).trim().replace(/\s+/g, " "),
      index,
      pointer: declaratorIsPointer(field(entry, "declarator")),
      span: nodeSpan(source, entry),
    });
  });
  return parameters;
}

/** Every declaration name in the body, in document order. */
function collectDeclaredNames(body: Node, known: Set<string>): Set<string> {
  const names = new Set(known);
  const visit = (node: Node): void => {
    if (node.type === "declaration" && !namedChildren(node).some((child) => child.type === "gnu_asm_expression")) {
      const typeNode = field(node, "type");
      const head = typeNode?.text.trim().split(/\s+/)[0];
      /* `a * b;` is a declaration to the grammar and a multiplication to a
       * reader when `a` is already a name in scope. Keep the reader's view. */
      if (!head || !names.has(head)) {
        for (const child of namedChildren(node)) {
          const name = child.type === "init_declarator" || child.type.endsWith("declarator") || child.type === "identifier"
            ? declaratorName(child)
            : undefined;
          if (name) names.add(name.text);
        }
      }
    }
    for (const child of namedChildren(node)) visit(child);
  };
  visit(body);
  return names;
}

function addressEscapingNames(body: Node, variables: Set<string>): Set<string> {
  const escaped = new Set<string>();
  const visit = (node: Node): void => {
    if (node.type === "pointer_expression" && operatorOf(node) === "&") {
      const argument = field(node, "argument");
      if (argument && argument.type === "identifier" && variables.has(argument.text)) escaped.add(argument.text);
    }
    for (const child of namedChildren(node)) visit(child);
  };
  visit(body);
  return escaped;
}

/**
 * The definition of `functionName`, never a mention of it. A banner comment is
 * a comment node, and a forward prototype is a declaration rather than a
 * function definition, so neither can misdirect the search.
 */
function findFunctionDefinition(root: Node, functionName: string): Node | undefined {
  const visit = (node: Node): Node | undefined => {
    if (node.type === "function_definition") {
      const name = declaratorName(field(node, "declarator"));
      if (name?.text === functionName) return node;
    }
    for (const child of namedChildren(node)) {
      const found = visit(child);
      if (found) return found;
    }
    return undefined;
  };
  return visit(root);
}

export function buildSemanticGraph(
  functionName: string,
  sourcePath: string,
  source: string,
  registry: MacroRegistry,
): SemanticGraph {
  const tree = parseC(source);
  const definition = findFunctionDefinition(tree.rootNode, functionName);
  if (!definition) throw new Error(`function definition ${functionName} was not found in ${sourcePath}`);
  const declarator = field(definition, "declarator");
  const nameNode = declaratorName(declarator)!;
  const body = field(definition, "body");
  if (!body) throw new Error(`function definition ${functionName} has no body in ${sourcePath}`);

  const parsedParameters = parameterList(source, declarator);
  const variables = collectDeclaredNames(body, new Set(parsedParameters.map((parameter) => parameter.name)));

  const state: BuildState = {
    source,
    context: { variables, typeNames: collectTypeNames(tree.rootNode) },
    registry,
    nodes: [],
    blocks: [{ index: 0, kind: "entry", nodeIds: [] }],
    caveats: [],
    nextNode: 0,
    arrayLocals: new Set(),
  };
  buildBlockBody(state, 0, namedChildren(body).filter((child) => child.type !== "comment"));

  const declarationNodes = state.nodes.filter((node) => node.kind === "declaration" && node.declName);
  const duplicateNames = new Set<string>();
  /* A parameter counts as already seen. An entry-block declaration can never
   * shadow one — that is the same scope — but a sequential case body is a
   * scope of its own, so opening those bodies made the collision reachable. */
  const seenNames = new Set<string>(parsedParameters.map((parameter) => parameter.name));
  for (const node of declarationNodes) {
    if (seenNames.has(node.declName!)) duplicateNames.add(node.declName!);
    seenNames.add(node.declName!);
  }
  if (duplicateNames.size > 0) {
    state.caveats.push(`Shadowed declarations frozen: ${[...duplicateNames].sort().join(", ")}.`);
  }

  /* An array's name is its address, so an array local can never be renamed
   * into another web or merged with a scalar. */
  const escaped = addressEscapingNames(body, variables);
  for (const name of state.arrayLocals) escaped.add(name);
  /* A name an unknown node touches is frozen: that node's read and write sets
   * are summaries over a subtree, so the model can neither place a definition
   * in it nor rewrite the text it holds. A `call` node is not that. Its scalar
   * reads and writes are exact (see `classifyCall`) and its argument list is
   * ordinary renameable text, so a call is no longer a reason to freeze the
   * locals it takes — which is what emptied the partition axis on any function
   * whose locals reach a callee. */
  const unsupportedTouch = new Set<string>();
  for (const node of state.nodes) {
    if (node.kind === "unknown") {
      for (const name of [...node.reads, ...node.writes]) unsupportedTouch.add(name);
    }
  }

  /* Old-style definitions type their parameters between the list and the body. */
  const parameterTypes = new Map<string, { typeText: string; pointer: boolean }>();
  for (const child of namedChildren(definition)) {
    if (child.type !== "declaration") continue;
    const name = declaratorName(namedChildren(child)[namedChildren(child).length - 1]);
    if (!name) continue;
    parameterTypes.set(name.text, {
      typeText: source.slice(child.startIndex, name.startIndex).trim().replace(/\s+/g, " "),
      pointer: declaratorIsPointer(field(child, "declarator")),
    });
  }
  for (const parameter of parsedParameters) {
    const typed = parameterTypes.get(parameter.name);
    if (typed && parameter.typeText.length === 0) {
      parameter.typeText = typed.typeText;
      parameter.pointer = typed.pointer;
    }
  }

  const graphVariables: GraphVariable[] = [];
  for (const parameter of parsedParameters) {
    graphVariables.push({
      name: parameter.name,
      kind: "parameter",
      typeText: parameter.typeText,
      pointer: parameter.pointer,
      addressEscapes: escaped.has(parameter.name),
      /* Shadowing freezes both ends. A case-body local of the same name is a
       * different variable that the flat model cannot tell from this one, so
       * neither may be renamed or web-analyzed. */
      supported: !unsupportedTouch.has(parameter.name) && !duplicateNames.has(parameter.name),
      evidence: [
        ...unsupportedTouch.has(parameter.name)
          ? ["Accessed by an unknown-effect node; renaming and web analysis are frozen."]
          : [],
        ...duplicateNames.has(parameter.name)
          ? ["A local of the same name shadows this parameter; the flat variable model freezes both."]
          : [],
      ],
    });
  }
  for (const node of declarationNodes) {
    const name = node.declName!;
    if (graphVariables.some((variable) => variable.name === name)) continue;
    const isStatic = /\bstatic\b/.test(node.declType!);
    const unsupported = unsupportedTouch.has(name) || duplicateNames.has(name) || isStatic;
    const evidence: string[] = [];
    if (unsupportedTouch.has(name)) evidence.push("Accessed by an unknown-effect node; renaming and web analysis are frozen.");
    if (duplicateNames.has(name)) evidence.push("Declared more than once (shadowing); the flat variable model freezes it.");
    if (isStatic) evidence.push("Static storage duration; renaming would change linkage-visible state.");
    graphVariables.push({
      name,
      kind: "local",
      typeText: node.declType!,
      pointer: node.declType!.includes("*"),
      declarationId: node.id,
      addressEscapes: escaped.has(name),
      supported: !unsupported,
      evidence,
    });
  }
  for (const name of variables) {
    if (!graphVariables.some((variable) => variable.name === name)) {
      graphVariables.push({
        name,
        kind: "local",
        typeText: "",
        pointer: false,
        addressEscapes: escaped.has(name),
        supported: false,
        evidence: ["Declared inside an unsupported construct or with an unsupported declarator."],
      });
    }
  }

  return {
    schemaVersion: RESIDUAL_SEARCH_SCHEMA_VERSION,
    function: functionName,
    sourcePath,
    sourceHash: sha256(source),
    functionSpan: span(source, nameNode.startIndex, definition.endIndex),
    bodySpan: nodeSpan(source, body),
    parameters: parsedParameters,
    variables: graphVariables.sort((left, right) => left.name.localeCompare(right.name)),
    blocks: state.blocks,
    nodes: state.nodes,
    caveats: state.caveats,
  };
}

/* ------------------------------------------------------------------ */
/* Statement-level CFG                                                 */
/* ------------------------------------------------------------------ */

export interface GraphFlow {
  successors: Map<string, string[]>;
  order: string[];
  entry?: string;
}

export function buildFlow(graph: SemanticGraph): GraphFlow {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const blockOf = new Map(graph.blocks.map((block) => [block.index, block]));
  const successors = new Map<string, string[]>(graph.nodes.map((node) => [node.id, []]));
  const isLoop = (node: SemanticNode): boolean => node.loopForm !== undefined;
  const firstOf = (index: number | undefined): string | undefined =>
    index === undefined ? undefined : blockOf.get(index)!.nodeIds[0];

  /**
   * Control enters a `for` through its initialiser, which runs once, and only
   * then reaches the test. Every other statement is entered directly.
   */
  const entryOf = (id: string | undefined): string | undefined => {
    if (id === undefined) return undefined;
    const node = byId.get(id)!;
    return isLoop(node) ? firstOf(node.initBlock) ?? id : id;
  };

  const followerOf = (blockIndex: number, position: number): string | undefined => {
    const block = blockOf.get(blockIndex)!;
    if (position + 1 < block.nodeIds.length) return entryOf(block.nodeIds[position + 1]);
    if (block.parent === undefined) return undefined;
    const owner = block.controllingConstruct ? byId.get(block.controllingConstruct) : undefined;
    if (owner) {
      /* The initialiser falls into the test; the body falls into the update
       * and the update back into the test. That back edge is what makes a
       * loop-carried definition reach the top of the body. */
      if (block.kind === "loop-init") return owner.id;
      if (block.kind === "loop-body") return firstOf(owner.updateBlock) ?? owner.id;
      if (block.kind === "loop-update") return owner.id;
    }
    const parent = blockOf.get(block.parent)!;
    return followerOf(block.parent, parent.nodeIds.indexOf(block.controllingIf ?? block.controllingConstruct ?? ""));
  };

  /**
   * The live cases of a switch: the ones admitted as sequential. A frozen case
   * contributes no edges, exactly as every case did before schema 6 — its
   * effects stay covered by the switch node's own unknown-effect summary, so
   * leaving it out of the flow under-approximates nothing.
   */
  const liveCaseEntries = (node: SemanticNode): string[] => (node.caseBlocks ?? [])
    .filter((index) => !blockIsFrozen(graph.blocks, index))
    .map((index) => entryOf(firstOf(index)))
    .filter((id): id is string => id !== undefined);

  for (const block of graph.blocks) {
    if (blockIsFrozen(graph.blocks, block.index)) continue;
    for (let position = 0; position < block.nodeIds.length; position++) {
      const id = block.nodeIds[position]!;
      const node = byId.get(id)!;
      const follower = followerOf(block.index, position);
      if (node.kind === "if") {
        const targets: Array<string | undefined> = [];
        targets.push(firstOf(node.thenBlock) ?? follower);
        if (node.elseBlock !== undefined) targets.push(firstOf(node.elseBlock) ?? follower);
        else targets.push(follower);
        successors.set(id, [...new Set(targets.filter((target): target is string => target !== undefined))]);
      } else if (isLoop(node)) {
        /* A do/while always runs its body once; treating the exit as reachable
         * from the test as well only widens the reaching-definition sets. */
        const targets = [firstOf(node.bodyBlock) ?? firstOf(node.updateBlock) ?? follower, follower];
        successors.set(id, [...new Set(targets.filter((target): target is string => target !== undefined))]);
      } else if (node.caseBlocks !== undefined) {
        /* The switch reaches each live case, and reaches past itself: no case
         * need match, and a frozen case is only visible as the fall-past edge.
         * Every live case ends in `break` or `return`, so a case body never
         * reaches its neighbour — which is what `followerOf` already returns
         * for a case block. */
        const targets = [...liveCaseEntries(node), follower];
        successors.set(id, [...new Set(targets.filter((target): target is string => target !== undefined))]);
      } else if (node.kind === "return") {
        successors.set(id, []);
      } else {
        successors.set(id, follower !== undefined ? [follower] : []);
      }
    }
  }

  /* Deterministic program order: block-structured pre-order walk. */
  const order: string[] = [];
  const walkBlock = (blockIndex: number): void => {
    for (const id of blockOf.get(blockIndex)!.nodeIds) {
      order.push(id);
      const node = byId.get(id)!;
      if (node.kind === "if") {
        walkBlock(node.thenBlock!);
        if (node.elseBlock !== undefined) walkBlock(node.elseBlock);
      } else if (isLoop(node)) {
        if (node.initBlock !== undefined) walkBlock(node.initBlock);
        if (node.bodyBlock !== undefined) walkBlock(node.bodyBlock);
        if (node.updateBlock !== undefined) walkBlock(node.updateBlock);
      } else if (node.caseBlocks !== undefined) {
        /* Only live cases: a frozen case has no successors, and a node in the
         * order without successors would shrink the live sets computed over it. */
        for (const index of node.caseBlocks) {
          if (!blockIsFrozen(graph.blocks, index)) walkBlock(index);
        }
      }
    }
  };
  walkBlock(0);

  const flow: GraphFlow = { successors, order };
  const entry = blockOf.get(0)!.nodeIds[0];
  if (entry !== undefined) flow.entry = entry;
  return flow;
}
