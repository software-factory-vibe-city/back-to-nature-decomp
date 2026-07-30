import { sha256 } from "../variant-lab/artifacts.js";
import type { MacroRegistry } from "./macro-forms.js";
import {
  RESIDUAL_SEARCH_SCHEMA_VERSION,
  type GraphParameter,
  type GraphVariable,
  type SemanticGraph,
  type SemanticNode,
  type SourceSpan,
} from "./types.js";

const KEYWORDS = new Set([
  "auto", "break", "case", "char", "const", "continue", "default", "do", "double", "else", "enum",
  "extern", "float", "for", "goto", "if", "int", "long", "register", "return", "short", "signed",
  "sizeof", "static", "struct", "switch", "typedef", "union", "unsigned", "void", "volatile", "while",
  "s8", "u8", "s16", "u16", "s32", "u32", "s64", "u64", "u_char", "u_short", "u_long", "u_int",
]);

function lineAt(source: string, offset: number): number {
  return source.slice(0, offset).split("\n").length;
}

function span(source: string, start: number, end: number): SourceSpan {
  return { start, end, lineStart: lineAt(source, start), lineEnd: lineAt(source, Math.max(start, end - 1)) };
}

export function stripComments(value: string): string {
  return value
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, "");
}

function stripLiterals(value: string): string {
  return value
    .replace(/"(?:[^"\\\n]|\\.)*"/g, (text) => text.replace(/[^\n]/g, " "))
    .replace(/'(?:[^'\\\n]|\\.)*'/g, (text) => text.replace(/[^\n]/g, " "));
}

export function matchingDelimiter(source: string, start: number, open: string, close: string): number {
  let depth = 0;
  let state: "code" | "string" | "char" | "line-comment" | "block-comment" = "code";
  for (let index = start; index < source.length; index++) {
    const character = source[index]!;
    const next = source[index + 1];
    if (state === "line-comment") {
      if (character === "\n") state = "code";
      continue;
    }
    if (state === "block-comment") {
      if (character === "*" && next === "/") { state = "code"; index++; }
      continue;
    }
    if (state === "string" || state === "char") {
      if (character === "\\") { index++; continue; }
      if ((state === "string" && character === '"') || (state === "char" && character === "'")) state = "code";
      continue;
    }
    if (character === "/" && next === "/") { state = "line-comment"; index++; continue; }
    if (character === "/" && next === "*") { state = "block-comment"; index++; continue; }
    if (character === '"') { state = "string"; continue; }
    if (character === "'") { state = "char"; continue; }
    if (character === open) depth++;
    else if (character === close) {
      depth--;
      if (depth === 0) return index;
    }
  }
  throw new Error(`unterminated ${open}${close} region at byte ${start}`);
}

export function skipTrivia(source: string, start: number, end: number): number {
  let cursor = start;
  while (cursor < end) {
    const character = source[cursor]!;
    if (/\s/.test(character)) { cursor++; continue; }
    if (source.startsWith("/*", cursor)) {
      const close = source.indexOf("*/", cursor + 2);
      if (close < 0 || close + 2 > end) return cursor;
      cursor = close + 2;
      continue;
    }
    if (source.startsWith("//", cursor)) {
      const newline = source.indexOf("\n", cursor + 2);
      if (newline < 0 || newline >= end) return end;
      cursor = newline + 1;
      continue;
    }
    break;
  }
  return cursor;
}

/** Find the end (exclusive, past ';') of a simple statement, or -1 when a '{' opens first. */
function simpleStatementEnd(source: string, start: number, end: number): number {
  let parentheses = 0;
  let state: "code" | "string" | "char" | "line-comment" | "block-comment" = "code";
  for (let index = start; index < end; index++) {
    const character = source[index]!;
    const next = source[index + 1];
    if (state === "line-comment") { if (character === "\n") state = "code"; continue; }
    if (state === "block-comment") {
      if (character === "*" && next === "/") { state = "code"; index++; }
      continue;
    }
    if (state === "string" || state === "char") {
      if (character === "\\") { index++; continue; }
      if ((state === "string" && character === '"') || (state === "char" && character === "'")) state = "code";
      continue;
    }
    if (character === "/" && next === "/") { state = "line-comment"; index++; continue; }
    if (character === "/" && next === "*") { state = "block-comment"; index++; continue; }
    if (character === '"') { state = "string"; continue; }
    if (character === "'") { state = "char"; continue; }
    if (character === "(") parentheses++;
    else if (character === ")") parentheses--;
    else if (character === "{" && parentheses === 0) return -1;
    else if (character === ";" && parentheses === 0) return index + 1;
  }
  throw new Error(`unterminated statement at byte ${start}`);
}

/**
 * Remove sizeof expressions and type casts so identifier extraction sees only
 * value reads. A parenthesized single identifier is treated as a cast only
 * when it is not a known variable and is followed by the start of an operand.
 */
export function stripTypeSyntax(code: string, variables: Set<string>): string {
  let result = code.replace(/\bsizeof\s*\([^()]*\)/g, " 0 ");
  const cast = /\(\s*(?:const\s+)?(?:volatile\s+)?(?:unsigned\s+|signed\s+)?(?:struct\s+|union\s+|enum\s+)?([A-Za-z_]\w*)((?:\s+[A-Za-z_]\w*)*)\s*(\**)\s*\)/g;
  let previous: string;
  do {
    previous = result;
    result = result.replace(cast, (whole, first: string, rest: string, stars: string, offset: number, text: string) => {
      if (variables.has(first)) return whole;
      if (KEYWORDS.has(first) || rest.trim().length > 0 || stars.length > 0) return " ";
      const following = text.slice(offset + whole.length).match(/^\s*(.)/)?.[1];
      if (following !== undefined && /[A-Za-z_0-9(&~!\-+*"']/.test(following)) return " ";
      return whole;
    });
  } while (result !== previous);
  return result;
}

function stripFieldSelectors(code: string): string {
  return code.replace(/(?:->|\.)\s*[A-Za-z_]\w*/g, " ");
}

/** Variable reads plus non-variable object identifiers (candidate globals). */
export function extractReads(code: string, variables: Set<string>): { reads: string[]; globals: string[] } {
  const cleaned = stripFieldSelectors(stripTypeSyntax(stripLiterals(stripComments(code)), variables));
  const reads = new Set<string>();
  const globals = new Set<string>();
  for (const match of cleaned.matchAll(/\b[A-Za-z_]\w*\b/g)) {
    const name = match[0]!;
    if (KEYWORDS.has(name)) continue;
    if (variables.has(name)) reads.add(name);
    else globals.add(name);
  }
  return { reads: [...reads].sort(), globals: [...globals].sort() };
}

export function immediateValues(text: string): number[] {
  return [...new Set([...stripComments(text).matchAll(/\b0x[0-9a-f]+\b|\b\d+\b/gi)]
    .map((match) => Number(match[0]))
    .filter((value) => Number.isFinite(value)))].sort((left, right) => left - right);
}

function hasCall(code: string, variables: Set<string>): boolean {
  const cleaned = stripTypeSyntax(stripLiterals(stripComments(code)), variables);
  return /[A-Za-z_]\w*\s*\(/.test(cleaned) || /\)\s*\(/.test(cleaned);
}

export function hasUnsafeEffect(code: string, variables: Set<string>): boolean {
  const stripped = stripComments(code)
    .replace(/<<=|>>=/g, " ")
    .replace(/[=!<>]=/g, " ")
    .replace(/[+\-*/%&|^]=/g, " ");
  return hasCall(code, variables) || /\+\+|--|\bvolatile\b|=/.test(stripped);
}

/** Canonical object key for a memory-effect expression: parens, casts, and whitespace removed. */
export function objectKey(expression: string, variables: Set<string>): string {
  let text = stripTypeSyntax(stripComments(expression), variables).trim();
  let previous: string;
  do {
    previous = text;
    text = text.trim();
    if (text.startsWith("(") && text.endsWith(")")) {
      try {
        if (matchingDelimiter(text, 0, "(", ")") === text.length - 1) text = text.slice(1, -1);
      } catch {
        break;
      }
    }
    if (text.startsWith("&")) text = text.slice(1);
  } while (text !== previous);
  return text.replace(/\s+/g, "");
}

/** Variable names appearing inside a memory-effect token's object key. */
export function baseVariablesOfToken(token: string, variables: Set<string>): string[] {
  const match = token.match(/^(field|object|element):(.*?)(?::[A-Za-z_]\w*)?$/);
  const key = match ? match[2]! : token;
  return [...new Set([...key.matchAll(/\b[A-Za-z_]\w*\b/g)]
    .map((item) => item[0]!)
    .filter((name) => variables.has(name)))].sort();
}

interface LvalueSegment {
  kind: "field" | "index";
  name?: string;
}

interface Lvalue {
  base: string;
  segments: LvalueSegment[];
  raw: string;
  end: number;
}

function parseLvalue(code: string): Lvalue | undefined {
  const match = code.match(/^\s*([A-Za-z_]\w*)/);
  if (!match) return undefined;
  const base = match[1]!;
  let cursor = match[0]!.length;
  const segments: LvalueSegment[] = [];
  while (cursor < code.length) {
    const rest = code.slice(cursor);
    const field = rest.match(/^\s*(->|\.)\s*([A-Za-z_]\w*)/);
    if (field) {
      segments.push({ kind: "field", name: field[2]! });
      cursor += field[0]!.length;
      continue;
    }
    if (/^\s*\[/.test(rest)) {
      const open = cursor + rest.indexOf("[");
      const close = matchingDelimiter(code, open, "[", "]");
      segments.push({ kind: "index" });
      cursor = close + 1;
      continue;
    }
    break;
  }
  return { base, segments, raw: code.slice(0, cursor), end: cursor };
}

/**
 * Memory-read tokens for a value expression: field, element, and deref loads
 * through named bases. Address-of paths compute addresses and read nothing.
 */
export function memoryReadTokens(code: string, variables: Set<string>): string[] {
  const cleaned = stripTypeSyntax(stripLiterals(stripComments(code)), variables);
  const tokens = new Set<string>();
  const identifier = /[A-Za-z_]\w*/g;
  let match: RegExpExecArray | null;
  while ((match = identifier.exec(cleaned)) !== null) {
    const name = match[0];
    let before = match.index - 1;
    while (before >= 0 && /\s/.test(cleaned[before]!)) before--;
    const previous = before >= 0 ? cleaned[before]! : "";
    if (previous === "." || (previous === ">" && cleaned[before - 1] === "-")) continue;
    const lvalue = parseLvalue(cleaned.slice(match.index));
    if (lvalue && lvalue.segments.length > 0) {
      identifier.lastIndex = match.index + lvalue.end;
      if (previous === "&") continue;
      if (!variables.has(name)) {
        if (!KEYWORDS.has(name)) tokens.add(`global:${name}`);
        continue;
      }
      tokens.add(storeToken(lvalue, variables));
      continue;
    }
    if (previous === "*" && variables.has(name)) {
      let deeper = before - 1;
      while (deeper >= 0 && /\s/.test(cleaned[deeper]!)) deeper--;
      const beforeStar = deeper >= 0 ? cleaned[deeper]! : "";
      if (beforeStar === "" || /[-(=+*/%&|^<>!~?:,[{;]/.test(beforeStar)) tokens.add(`object:${name}`);
    }
  }
  return [...tokens].sort();
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

/** Classify one synthesized statement outside any parsed function body. */
export function classifySyntheticStatement(
  text: string,
  variables: Set<string>,
  registry: MacroRegistry,
): SemanticNode {
  const state: ParseState = {
    source: text,
    variables,
    registry,
    nodes: [],
    blocks: [{ index: 0, kind: "entry", nodeIds: [] }],
    caveats: [],
    nextNode: 0,
  };
  return classifySimple(state, 0, { start: 0, end: text.length, lineStart: 1, lineEnd: 1 }, false);
}

/** Web and reaching lookups for synthetic component nodes resolve via their parent. */
export function webLookupId(nodeId: string): string {
  return nodeId.split("::")[0]!;
}

function parameters(source: string, open: number, close: number): GraphParameter[] {
  const text = source.slice(open + 1, close);
  let relativeOffset = 0;
  return splitTopLevel(text).flatMap((raw, index) => {
    const localOffset = text.indexOf(raw, relativeOffset);
    relativeOffset = localOffset + raw.length;
    const value = stripComments(raw).trim();
    if (!value || value === "void") return [];
    const match = value.match(/^([\s\S]*?[\s*])([A-Za-z_]\w*)\s*(?:\[[^\]]*\])?$/);
    if (!match) return [];
    const start = open + 1 + localOffset + raw.indexOf(value.split(/\s/)[0]!);
    return [{
      name: match[2]!,
      typeText: match[1]!.trim().replace(/\s+/g, " "),
      index,
      pointer: match[1]!.includes("*") || /\[[^\]]*\]\s*$/.test(value),
      span: span(source, start, start + value.length),
    }];
  });
}

const EMPTY_BARRIER = /^(?:__asm__|__asm)\s*(?:volatile\s*)?\(\s*""\s*:\s*:\s*:\s*"memory"\s*\)\s*;$/;

const DECLARATION = /^((?:(?:const|static|volatile|signed|unsigned|struct\s+\w+|union\s+\w+|enum\s+\w+|[A-Za-z_]\w*)\s+)+\**\s*)([A-Za-z_]\w*)\s*(?:=\s*([\s\S]*?))?;$/;

interface ParseState {
  source: string;
  variables: Set<string>;
  registry: MacroRegistry;
  nodes: SemanticNode[];
  blocks: SemanticGraph["blocks"];
  caveats: string[];
  nextNode: number;
}

function newNodeId(state: ParseState): string {
  return `n${state.nextNode++}`;
}

function storeToken(lvalue: Lvalue, variables: Set<string>): string {
  const last = lvalue.segments[lvalue.segments.length - 1];
  if (!last) {
    /* Scalar name that is not a local/parameter: a named global object. */
    return `global:${lvalue.base}`;
  }
  if (last.kind === "index") {
    return `element:${objectKey(lvalue.raw.replace(/\[[^\]]*\]/g, "[]"), variables)}`;
  }
  const objectText = lvalue.raw.slice(0, lvalue.raw.lastIndexOf(last.name!)).replace(/(?:->|\.)\s*$/, "");
  return `field:${objectKey(objectText.replace(/\[[^\]]*\]/g, "[]"), variables)}:${last.name}`;
}

function classifySimple(state: ParseState, blockIndex: number, statementSpan: SourceSpan, allowDeclaration: boolean): SemanticNode {
  const { source, variables } = state;
  const id = newNodeId(state);
  const text = source.slice(statementSpan.start, statementSpan.end);
  const code = stripComments(text).trim();
  const base = {
    id,
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

  if (EMPTY_BARRIER.test(code)) {
    return {
      ...base,
      kind: "barrier",
      movable: false,
      memoryReads: ["*unknown*"],
      memoryWrites: ["*unknown*"],
      evidence: ["Inherited empty memory barrier: immutable position, orders all memory effects."],
    };
  }
  if (/^\b(?:__asm__|__asm|asm)\b/.test(code)) {
    return {
      ...base,
      kind: "unknown",
      movable: false,
      memoryReads: ["*unknown*"],
      memoryWrites: ["*unknown*"],
      evidence: ["Non-empty embedded assembly is outside the semantic model."],
    };
  }

  if (allowDeclaration) {
    const declaration = code.match(DECLARATION);
    if (declaration) {
      const typeText = declaration[1]!.trim();
      const firstToken = typeText.split(/\s+/)[0]!.replace(/\*+$/, "");
      const isDeclaration = !/[,()[\]]/.test(typeText) &&
        (KEYWORDS.has(firstToken) || /^(?:struct|union|enum)$/.test(firstToken) || !variables.has(firstToken));
      if (isDeclaration) {
        const initializer = declaration[3]?.trim();
        const effects = initializer !== undefined ? extractReads(initializer, variables) : { reads: [], globals: [] };
        const node: SemanticNode = {
          ...base,
          kind: "declaration",
          movable: false,
          declName: declaration[2]!,
          declType: typeText.replace(/\s+/g, " "),
          reads: effects.reads,
          writes: initializer !== undefined ? [declaration[2]!] : [],
          killingWrite: initializer !== undefined,
          memoryReads: initializer !== undefined
            ? [...new Set([...effects.globals.map((name) => `global:${name}`), ...memoryReadTokens(initializer, variables)])].sort()
            : [],
          evidence: ["C89 block-top declaration."],
        };
        if (initializer !== undefined) {
          node.initializer = initializer;
          if (hasUnsafeEffect(initializer, variables)) {
            node.memoryReads = ["*unknown*"];
            node.memoryWrites = ["*unknown*"];
            node.evidence.push("Initializer contains a call or side effect; treated as an unknown-effect definition.");
          }
        }
        return node;
      }
    }
  }

  if (/^return\b/.test(code)) {
    const expression = code.slice("return".length).replace(/;$/, "").trim();
    const effects = expression ? extractReads(expression, variables) : { reads: [], globals: [] };
    return {
      ...base,
      kind: "return",
      movable: false,
      reads: effects.reads,
      memoryReads: expression && hasUnsafeEffect(expression, variables)
        ? ["*unknown*"]
        : [...new Set([...effects.globals.map((name) => `global:${name}`), ...(expression ? memoryReadTokens(expression, variables) : [])])].sort(),
      memoryWrites: expression && hasUnsafeEffect(expression, variables) ? ["*unknown*"] : [],
      evidence: ["Function return anchors the end of its block."],
    };
  }

  /* Known macro or unknown call statement: name(...) ; */
  const call = code.match(/^([A-Za-z_]\w*)\s*\(([\s\S]*)\)\s*;$/);
  if (call) {
    const rebuilt = `(${call[2]})`;
    let balanced = false;
    try {
      balanced = matchingDelimiter(rebuilt, 0, "(", ")") === rebuilt.length - 1;
    } catch {
      balanced = false;
    }
    if (balanced) {
      const name = call[1]!;
      const args = splitTopLevel(call[2]!).map((argument) => argument.trim()).filter((argument) => argument.length > 0);
      const macro = state.registry.active.get(name);
      if (macro && macro.argCount === args.length && !args.some((argument) => hasUnsafeEffect(argument, variables))) {
        const reads = new Set<string>();
        const memoryReads = new Set<string>();
        const memoryWrites = new Set<string>();
        for (const argument of args) {
          const extracted = extractReads(argument, variables);
          for (const value of extracted.reads) reads.add(value);
          for (const globalName of extracted.globals) memoryReads.add(`global:${globalName}`);
          for (const token of memoryReadTokens(argument, variables)) memoryReads.add(token);
        }
        for (const effect of macro.effects) {
          const argument = args[effect.argIndex];
          if (argument === undefined) continue;
          const key = objectKey(argument, variables);
          if (effect.kind === "whole-object-write") memoryWrites.add(`object:${key}`);
          else if (effect.kind === "field-write") memoryWrites.add(`field:${key}:${effect.field}`);
          else memoryReads.add(`field:${key}:${effect.field}`);
        }
        return {
          ...base,
          kind: "known-macro",
          movable: true,
          macro: name,
          reads: [...reads].sort(),
          memoryReads: [...memoryReads].sort(),
          memoryWrites: [...memoryWrites].sort(),
          evidence: [
            `${name} effects verified against ${macro.header} (definition hash ${macro.definitionHash.slice(0, 12)}).`,
            macro.evidence,
          ],
        };
      }
      const effects = extractReads(code, variables);
      return {
        ...base,
        kind: "call",
        movable: false,
        reads: effects.reads,
        writes: effects.reads,
        memoryReads: ["*unknown*"],
        memoryWrites: ["*unknown*"],
        evidence: [macro
          ? `${name} is registered but the call shape or argument purity did not match; treated as unknown effect.`
          : `${name} is not in the configured known-macro registry; treated as an unknown-effect call.`],
      };
    }
  }

  /* Assignment, compound assignment, store, or increment/decrement. */
  const prefixIncrement = code.match(/^(\+\+|--)\s*([A-Za-z_]\w*)\s*;$/);
  const lvalue = prefixIncrement ? parseLvalue(`${prefixIncrement[2]!};`) : parseLvalue(code);
  if (lvalue) {
    const rest = prefixIncrement ? ";" : code.slice(lvalue.end);
    const operator = prefixIncrement
      ? prefixIncrement[1]!
      : rest.match(/^\s*(>>=|<<=|\+=|-=|\*=|\/=|%=|&=|\|=|\^=|\+\+|--|=(?![=]))/)?.[1];
    if (operator) {
      const isIncrement = operator === "++" || operator === "--";
      const rhs = isIncrement ? "" : rest.slice(rest.indexOf(operator) + operator.length).replace(/;\s*$/, "").trim();
      const rhsEffects = rhs ? extractReads(rhs, variables) : { reads: [], globals: [] };
      const unsafe = rhs ? hasUnsafeEffect(rhs, variables) : false;
      const reads = new Set(rhsEffects.reads);
      const memoryReads = new Set([
        ...rhsEffects.globals.map((name) => `global:${name}`),
        ...(rhs ? memoryReadTokens(rhs, variables) : []),
      ]);
      const memoryWrites = new Set<string>();
      const writes = new Set<string>();
      let kind: SemanticNode["kind"] = "assign";
      let killing = false;
      const scalar = lvalue.segments.length === 0 && variables.has(lvalue.base);
      if (scalar) {
        writes.add(lvalue.base);
        if (operator === "=") killing = true;
        else reads.add(lvalue.base);
      } else {
        kind = "store";
        const lvalueEffects = extractReads(lvalue.raw, variables);
        for (const value of lvalueEffects.reads) reads.add(value);
        const token = storeToken(lvalue, variables);
        memoryWrites.add(token);
        if (operator !== "=") memoryReads.add(token);
      }
      const node: SemanticNode = {
        ...base,
        kind,
        movable: !unsafe,
        reads: [...reads].sort(),
        writes: [...writes].sort(),
        killingWrite: killing,
        memoryReads: unsafe ? ["*unknown*"] : [...memoryReads].sort(),
        memoryWrites: unsafe ? ["*unknown*"] : [...memoryWrites].sort(),
        operator,
        lhs: lvalue.raw.trim(),
        evidence: unsafe
          ? ["The right-hand side contains a call, nested assignment, increment, decrement, or volatile token; position frozen."]
          : ["Single-destination statement with a side-effect-free token expression."],
      };
      if (!isIncrement) node.rhs = rhs;
      return node;
    }
  }

  const effects = extractReads(code, variables);
  return {
    ...base,
    kind: "unknown",
    movable: false,
    reads: effects.reads,
    writes: effects.reads,
    memoryReads: ["*unknown*"],
    memoryWrites: ["*unknown*"],
    evidence: ["The conservative statement model could not classify this statement."],
  };
}

function parseBlockBody(state: ParseState, blockIndex: number, start: number, end: number): void {
  const { source } = state;
  const block = state.blocks[blockIndex]!;
  let cursor = skipTrivia(source, start, end);
  let sawExecutable = false;
  while (cursor < end) {
    const rest = source.slice(cursor);

    if (/^if\b/.test(rest)) {
      parseIf(state, blockIndex, cursor, end);
      const ifNode = state.nodes.find((node) => node.id === block.nodeIds[block.nodeIds.length - 1]!)!;
      sawExecutable = true;
      cursor = skipTrivia(source, ifNode.span.end, end);
      continue;
    }

    if (/^(?:while|for|do|switch|goto|break|continue)\b/.test(rest) || (/^[A-Za-z_]\w*\s*:(?!=)/.test(rest) && !/^default\b/.test(rest))) {
      const constructEnd = consumeUnsupportedConstruct(source, cursor, end);
      const text = source.slice(cursor, constructEnd);
      const effects = extractReads(text, state.variables);
      const id = newNodeId(state);
      state.nodes.push({
        id,
        kind: "unknown",
        block: blockIndex,
        span: span(source, cursor, constructEnd),
        text,
        reads: effects.reads,
        writes: effects.reads,
        killingWrite: false,
        memoryReads: ["*unknown*"],
        memoryWrites: ["*unknown*"],
        movable: false,
        evidence: ["Loop, switch, jump, or label constructs are frozen verbatim in this grammar version."],
      });
      block.nodeIds.push(id);
      state.caveats.push(`Unsupported control construct frozen at line ${lineAt(source, cursor)}.`);
      sawExecutable = true;
      cursor = skipTrivia(source, constructEnd, end);
      continue;
    }

    if (source[cursor] === "{") {
      const close = matchingDelimiter(source, cursor, "{", "}");
      const text = source.slice(cursor, close + 1);
      const effects = extractReads(text, state.variables);
      const id = newNodeId(state);
      state.nodes.push({
        id,
        kind: "unknown",
        block: blockIndex,
        span: span(source, cursor, close + 1),
        text,
        reads: effects.reads,
        writes: effects.reads,
        killingWrite: false,
        memoryReads: ["*unknown*"],
        memoryWrites: ["*unknown*"],
        movable: false,
        evidence: ["Bare compound statement introduces a scope; frozen verbatim."],
      });
      block.nodeIds.push(id);
      state.caveats.push(`Bare compound statement frozen at line ${lineAt(source, cursor)}.`);
      sawExecutable = true;
      cursor = skipTrivia(source, close + 1, end);
      continue;
    }

    const statementEnd = simpleStatementEnd(source, cursor, end);
    if (statementEnd < 0) throw new Error(`unexpected compound statement at line ${lineAt(source, cursor)}`);
    const node = classifySimple(state, blockIndex, span(source, cursor, statementEnd), !sawExecutable);
    if (node.kind !== "declaration") sawExecutable = true;
    state.nodes.push(node);
    block.nodeIds.push(node.id);
    cursor = skipTrivia(source, statementEnd, end);
  }
}

function parseIf(state: ParseState, blockIndex: number, start: number, end: number): void {
  const { source } = state;
  const block = state.blocks[blockIndex]!;
  const condOpen = source.indexOf("(", start + 2);
  const condClose = matchingDelimiter(source, condOpen, "(", ")");
  const condition = source.slice(condOpen + 1, condClose);
  const conditionReads = extractReads(condition, state.variables);
  const ifId = newNodeId(state);
  const thenIndex = state.blocks.length;
  state.blocks.push({ index: thenIndex, parent: blockIndex, kind: "then", nodeIds: [], controllingIf: ifId });

  let bodyCursor = skipTrivia(source, condClose + 1, end);
  let constructEnd: number;
  if (source[bodyCursor] === "{") {
    const close = matchingDelimiter(source, bodyCursor, "{", "}");
    parseBlockBody(state, thenIndex, bodyCursor + 1, close);
    constructEnd = close + 1;
  } else if (/^if\b/.test(source.slice(bodyCursor))) {
    parseIf(state, thenIndex, bodyCursor, end);
    constructEnd = state.nodes[state.nodes.length - 1]!.span.end;
  } else {
    const statementEnd = simpleStatementEnd(source, bodyCursor, end);
    if (statementEnd < 0) throw new Error(`unexpected compound branch statement at line ${lineAt(source, bodyCursor)}`);
    const node = classifySimple(state, thenIndex, span(source, bodyCursor, statementEnd), false);
    state.nodes.push(node);
    state.blocks[thenIndex]!.nodeIds.push(node.id);
    constructEnd = statementEnd;
  }

  let elseIndex: number | undefined;
  const afterThen = skipTrivia(source, constructEnd, end);
  if (/^else\b/.test(source.slice(afterThen))) {
    elseIndex = state.blocks.length;
    state.blocks.push({ index: elseIndex, parent: blockIndex, kind: "else", nodeIds: [], controllingIf: ifId });
    const elseCursor = skipTrivia(source, afterThen + 4, end);
    if (source[elseCursor] === "{") {
      const close = matchingDelimiter(source, elseCursor, "{", "}");
      parseBlockBody(state, elseIndex, elseCursor + 1, close);
      constructEnd = close + 1;
    } else if (/^if\b/.test(source.slice(elseCursor))) {
      parseIf(state, elseIndex, elseCursor, end);
      constructEnd = state.nodes[state.nodes.length - 1]!.span.end;
    } else {
      const statementEnd = simpleStatementEnd(source, elseCursor, end);
      if (statementEnd < 0) throw new Error(`unexpected compound branch statement at line ${lineAt(source, elseCursor)}`);
      const node = classifySimple(state, elseIndex, span(source, elseCursor, statementEnd), false);
      state.nodes.push(node);
      state.blocks[elseIndex]!.nodeIds.push(node.id);
      constructEnd = statementEnd;
    }
  }

  const node: SemanticNode = {
    id: ifId,
    kind: "if",
    block: blockIndex,
    span: span(source, start, constructEnd),
    text: source.slice(start, constructEnd),
    reads: conditionReads.reads,
    writes: [],
    killingWrite: false,
    memoryReads: [...new Set([
      ...conditionReads.globals.map((name) => `global:${name}`),
      ...memoryReadTokens(condition, state.variables),
    ])].sort(),
    memoryWrites: [],
    movable: false,
    evidence: ["Conditional region: branch structure is immutable in this grammar version."],
    condition: stripComments(condition).trim(),
    condSpan: span(source, condOpen + 1, condClose),
    thenBlock: thenIndex,
  };
  if (elseIndex !== undefined) node.elseBlock = elseIndex;
  if (hasUnsafeEffect(condition, state.variables)) {
    node.memoryReads = ["*unknown*"];
    node.memoryWrites = ["*unknown*"];
    node.evidence.push("Branch condition contains a call or side effect; treated as an unknown-effect read.");
  }
  state.nodes.push(node);
  block.nodeIds.push(ifId);
}

function consumeUnsupportedConstruct(source: string, start: number, end: number): number {
  /* Consume through the construct's braces and any do-while tail. */
  let cursor = start;
  const isDo = /^do\b/.test(source.slice(start));
  while (cursor < end) {
    const character = source[cursor]!;
    if (character === "{") {
      cursor = matchingDelimiter(source, cursor, "{", "}") + 1;
      if (isDo) {
        const tail = skipTrivia(source, cursor, end);
        if (/^while\b/.test(source.slice(tail))) {
          const open = source.indexOf("(", tail);
          const close = matchingDelimiter(source, open, "(", ")");
          const semi = skipTrivia(source, close + 1, end);
          return source[semi] === ";" ? semi + 1 : close + 1;
        }
      }
      return cursor;
    }
    if (character === ";") return cursor + 1;
    if (character === "(") {
      cursor = matchingDelimiter(source, cursor, "(", ")") + 1;
      continue;
    }
    cursor++;
  }
  return end;
}

function collectVariableNames(source: string, bodyOpen: number, bodyClose: number, parameterNames: string[]): Set<string> {
  /* Pre-pass: parameters plus every block-top declaration name. */
  const names = new Set(parameterNames);
  const body = stripLiterals(stripComments(source.slice(bodyOpen + 1, bodyClose)));
  for (const match of body.matchAll(/(?<=^|[;{])\s*((?:(?:const|static|volatile|signed|unsigned|struct\s+\w+|union\s+\w+|enum\s+\w+|[A-Za-z_]\w*)\s+)+\**\s*)([A-Za-z_]\w*)\s*(?:=[^;]*)?;/g)) {
    const head = match[1]!.trim().split(/\s+/)[0]!.replace(/\*+$/, "");
    if (/^(?:return|goto|else|if|while|do)$/.test(head)) continue;
    if (names.has(head)) continue;
    names.add(match[2]!);
  }
  return names;
}

export function buildSemanticGraph(
  functionName: string,
  sourcePath: string,
  source: string,
  registry: MacroRegistry,
): SemanticGraph {
  const nameOffset = source.indexOf(functionName);
  if (nameOffset < 0) throw new Error(`function symbol ${functionName} was not found in ${sourcePath}`);
  const parameterOpen = source.indexOf("(", nameOffset + functionName.length);
  if (parameterOpen < 0) throw new Error(`function ${functionName} has no parameter list`);
  const parameterClose = matchingDelimiter(source, parameterOpen, "(", ")");
  const bodyOpen = source.indexOf("{", parameterClose);
  if (bodyOpen < 0) throw new Error(`function ${functionName} has no body`);
  const bodyClose = matchingDelimiter(source, bodyOpen, "{", "}");
  const parsedParameters = parameters(source, parameterOpen, parameterClose);
  const variables = collectVariableNames(source, bodyOpen, bodyClose, parsedParameters.map((parameter) => parameter.name));

  const state: ParseState = {
    source,
    variables,
    registry,
    nodes: [],
    blocks: [{ index: 0, kind: "entry", nodeIds: [] }],
    caveats: [],
    nextNode: 0,
  };
  parseBlockBody(state, 0, bodyOpen + 1, bodyClose);

  const declarationNodes = state.nodes.filter((node) => node.kind === "declaration" && node.declName);
  const duplicateNames = new Set<string>();
  const seenNames = new Set<string>();
  for (const node of declarationNodes) {
    if (seenNames.has(node.declName!)) duplicateNames.add(node.declName!);
    seenNames.add(node.declName!);
  }
  if (duplicateNames.size > 0) {
    state.caveats.push(`Shadowed declarations frozen: ${[...duplicateNames].sort().join(", ")}.`);
  }

  const escaped = new Set<string>();
  const bodyCode = stripLiterals(stripComments(source.slice(bodyOpen, bodyClose + 1)));
  for (const match of bodyCode.matchAll(/&\s*([A-Za-z_]\w*)\b(?!\s*(?:->|\.|\[))/g)) {
    if (variables.has(match[1]!)) escaped.add(match[1]!);
  }
  const unsupportedTouch = new Set<string>();
  for (const node of state.nodes) {
    if (node.kind === "unknown" || node.kind === "call") {
      for (const name of [...node.reads, ...node.writes]) unsupportedTouch.add(name);
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
      supported: !unsupportedTouch.has(parameter.name),
      evidence: unsupportedTouch.has(parameter.name)
        ? ["Accessed by an unknown-effect node; renaming and web analysis are frozen."]
        : [],
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
    functionSpan: span(source, nameOffset, bodyClose + 1),
    bodySpan: span(source, bodyOpen, bodyClose + 1),
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

  const followerOf = (blockIndex: number, position: number): string | undefined => {
    const block = blockOf.get(blockIndex)!;
    if (position + 1 < block.nodeIds.length) return block.nodeIds[position + 1];
    if (block.parent === undefined) return undefined;
    const parent = blockOf.get(block.parent)!;
    return followerOf(block.parent, parent.nodeIds.indexOf(block.controllingIf!));
  };

  for (const block of graph.blocks) {
    for (let position = 0; position < block.nodeIds.length; position++) {
      const id = block.nodeIds[position]!;
      const node = byId.get(id)!;
      if (node.kind === "if") {
        const follower = followerOf(block.index, position);
        const targets: Array<string | undefined> = [];
        targets.push(blockOf.get(node.thenBlock!)!.nodeIds[0] ?? follower);
        if (node.elseBlock !== undefined) targets.push(blockOf.get(node.elseBlock)!.nodeIds[0] ?? follower);
        else targets.push(follower);
        successors.set(id, [...new Set(targets.filter((target): target is string => target !== undefined))]);
      } else if (node.kind === "return") {
        successors.set(id, []);
      } else {
        const follower = followerOf(block.index, position);
        successors.set(id, follower !== undefined ? [follower] : []);
      }
    }
  }

  /* Deterministic program order: block-structured pre-order walk. */
  const order: string[] = [];
  const walk = (blockIndex: number): void => {
    for (const id of blockOf.get(blockIndex)!.nodeIds) {
      order.push(id);
      const node = byId.get(id)!;
      if (node.kind === "if") {
        walk(node.thenBlock!);
        if (node.elseBlock !== undefined) walk(node.elseBlock);
      }
    }
  };
  walk(0);

  const flow: GraphFlow = { successors, order };
  const entry = blockOf.get(0)!.nodeIds[0];
  if (entry !== undefined) flow.entry = entry;
  return flow;
}
