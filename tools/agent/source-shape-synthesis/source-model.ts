import { sha256 } from "../variant-lab/artifacts.js";
import type {
  SourceDeclaration,
  SourceModel,
  SourceParameter,
  SourceSpan,
  SourceStatement,
} from "./types.js";

const KEYWORDS = new Set([
  "auto", "break", "case", "char", "const", "continue", "default", "do", "double", "else", "enum",
  "extern", "float", "for", "goto", "if", "int", "long", "register", "return", "short", "signed",
  "sizeof", "static", "struct", "switch", "typedef", "union", "unsigned", "void", "volatile", "while",
  "s8", "u8", "s16", "u16", "s32", "u32", "s64", "u64",
]);

const KNOWN_MACROS: Record<string, { memoryWrites: (args: string[]) => string[]; evidence: string }> = {
  setSprt: {
    memoryWrites: (args) => [`${args[0] || "unknown"}.len`, `${args[0] || "unknown"}.code`],
    evidence: "Configured PSY-Q setSprt writes only the primitive length and code fields and evaluates its pointer argument twice.",
  },
  setlen: {
    memoryWrites: (args) => [`${args[0] || "unknown"}.len`],
    evidence: "Configured PSY-Q setlen writes the primitive length field.",
  },
  setcode: {
    memoryWrites: (args) => [`${args[0] || "unknown"}.code`],
    evidence: "Configured PSY-Q setcode writes the primitive code field.",
  },
};

function lineAt(source: string, offset: number): number {
  return source.slice(0, offset).split("\n").length;
}

function span(source: string, start: number, end: number): SourceSpan {
  return { start, end, lineStart: lineAt(source, start), lineEnd: lineAt(source, Math.max(start, end - 1)) };
}

function matchingDelimiter(source: string, start: number, open: string, close: string): number {
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
      if (character === "*" && next === "/") {
        state = "code";
        index++;
      }
      continue;
    }
    if (state === "string" || state === "char") {
      if (character === "\\") {
        index++;
        continue;
      }
      if ((state === "string" && character === '"') || (state === "char" && character === "'")) state = "code";
      continue;
    }
    if (character === "/" && next === "/") {
      state = "line-comment";
      index++;
      continue;
    }
    if (character === "/" && next === "*") {
      state = "block-comment";
      index++;
      continue;
    }
    if (character === '"') {
      state = "string";
      continue;
    }
    if (character === "'") {
      state = "char";
      continue;
    }
    if (character === open) depth++;
    else if (character === close) {
      depth--;
      if (depth === 0) return index;
    }
  }
  throw new Error(`unterminated ${open}${close} region at byte ${start}`);
}

function splitTopLevel(value: string, separator = ","): string[] {
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
    else if (character === separator && parentheses === 0 && brackets === 0) {
      result.push(value.slice(start, index));
      start = index + 1;
    }
  }
  result.push(value.slice(start));
  return result;
}

function identifiers(value: string): string[] {
  return [...new Set([...value.matchAll(/\b[A-Za-z_]\w*\b/g)]
    .map((match) => match[0])
    .filter((name) => !KEYWORDS.has(name)))]
    .sort();
}

function skipLeadingTrivia(source: string, start: number, end: number): number {
  let cursor = start;
  while (cursor < end) {
    if (/\s/.test(source[cursor]!)) {
      cursor++;
      continue;
    }
    if (source.startsWith("/*", cursor)) {
      const close = source.indexOf("*/", cursor + 2);
      if (close < 0 || close >= end) return cursor;
      cursor = close + 2;
      continue;
    }
    if (source.startsWith("//", cursor)) {
      const newline = source.indexOf("\n", cursor + 2);
      if (newline < 0 || newline >= end) return cursor;
      cursor = newline + 1;
      continue;
    }
    break;
  }
  return cursor;
}

function stripComments(value: string): string {
  return value
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, "");
}

function parseCallArguments(value: string): string[] {
  const open = value.indexOf("(");
  const close = value.lastIndexOf(")");
  if (open < 0 || close < open) return [];
  return splitTopLevel(value.slice(open + 1, close)).map((item) => item.trim());
}

export function classifyStatement(source: string, id: string, statementSpan: SourceSpan): SourceStatement {
  const text = source.slice(statementSpan.start, statementSpan.end);
  const code = stripComments(text).trim();
  if (/^\b(?:__asm__|__asm|asm)\b/.test(code)) {
    return {
      id,
      kind: "barrier",
      span: statementSpan,
      text,
      reads: [],
      writes: [],
      memoryReads: [],
      memoryWrites: ["*memory*"],
      movable: false,
      evidence: ["Embedded assembly is a source-shape boundary and is never synthesized or moved."],
    };
  }

  const assignment = code.match(/^([A-Za-z_]\w*)\s*(>>=|<<=|\+=|-=|\*=|\/=|%=|&=|\|=|\^=|=)\s*([\s\S]*);$/);
  if (assignment) {
    const lhs = assignment[1]!;
    const operator = assignment[2]!;
    const rhs = assignment[3]!.trim();
    const rhsReads = identifiers(rhs);
    const hasCall = /\b[A-Za-z_]\w*\s*\(/.test(rhs.replace(/^\s*\([A-Za-z_]\w*\s*\)/, ""));
    const hasUnsafeEffect = hasCall || /(?:\+\+|--|\bvolatile\b)/.test(rhs);
    return {
      id,
      kind: "assignment",
      span: statementSpan,
      text,
      reads: [...new Set([...(operator === "=" ? [] : [lhs]), ...rhsReads])].sort(),
      writes: [lhs],
      memoryReads: [],
      memoryWrites: [],
      operator,
      lhs,
      rhs,
      movable: !hasUnsafeEffect,
      evidence: hasUnsafeEffect
        ? ["The assignment contains a call, increment, decrement, or volatile token and is not moved automatically."]
        : ["The assignment has one scalar destination and a side-effect-free token expression."],
    };
  }

  const call = code.match(/^([A-Za-z_]\w*)\s*\([\s\S]*\)\s*;$/);
  if (call) {
    const macro = call[1]!;
    const definition = KNOWN_MACROS[macro];
    const args = parseCallArguments(code);
    if (definition) {
      return {
        id,
        kind: "known-macro",
        span: statementSpan,
        text,
        reads: [...new Set(args.flatMap(identifiers))].sort(),
        writes: [],
        memoryReads: [],
        memoryWrites: definition.memoryWrites(args),
        macro,
        movable: true,
        evidence: [definition.evidence],
      };
    }
    return {
      id,
      kind: "expression",
      span: statementSpan,
      text,
      reads: identifiers(code),
      writes: [],
      memoryReads: ["*unknown*"],
      memoryWrites: ["*unknown*"],
      macro,
      movable: false,
      evidence: [`${macro} is not in the configured pure/field-write macro registry.`],
    };
  }

  return {
    id,
    kind: "unknown",
    span: statementSpan,
    text,
    reads: identifiers(code),
    writes: [],
    memoryReads: ["*unknown*"],
    memoryWrites: ["*unknown*"],
    movable: false,
    evidence: ["The conservative source model could not classify this statement."],
  };
}

function declaration(source: string, id: string, statementSpan: SourceSpan): SourceDeclaration | undefined {
  const text = source.slice(statementSpan.start, statementSpan.end);
  const code = stripComments(text).trim();
  const match = code.match(/^((?:(?:const|signed|unsigned|struct\s+\w+|union\s+\w+|enum\s+\w+|[A-Za-z_]\w*)\s+)+\**\s*)([A-Za-z_]\w*)\s*(?:=\s*([\s\S]*?))?;$/);
  if (!match) return undefined;
  return {
    id,
    name: match[2]!,
    typeText: match[1]!.trim(),
    ...(match[3] !== undefined ? { initializer: match[3].trim() } : {}),
    span: statementSpan,
    text,
  };
}

function parameters(source: string, open: number, close: number): SourceParameter[] {
  const text = source.slice(open + 1, close);
  let relativeOffset = 0;
  return splitTopLevel(text).flatMap((raw, index) => {
    const localOffset = text.indexOf(raw, relativeOffset);
    relativeOffset = localOffset + raw.length;
    const value = raw.trim();
    if (!value || value === "void") return [];
    const match = value.match(/^([\s\S]*?\b)([A-Za-z_]\w*)\s*(?:\[[^\]]*\])?$/);
    if (!match) return [];
    const start = open + 1 + localOffset + raw.indexOf(value);
    return [{
      id: `param-${index}`,
      name: match[2]!,
      typeText: match[1]!.trim(),
      index,
      pointer: match[1]!.includes("*"),
      span: span(source, start, start + value.length),
    }];
  });
}

export function buildSourceModel(functionName: string, sourcePath: string, source: string): SourceModel {
  const nameOffset = source.indexOf(functionName);
  if (nameOffset < 0) throw new Error(`function symbol ${functionName} was not found in ${sourcePath}`);
  const parameterOpen = source.indexOf("(", nameOffset + functionName.length);
  if (parameterOpen < 0) throw new Error(`function ${functionName} has no parameter list`);
  const parameterClose = matchingDelimiter(source, parameterOpen, "(", ")");
  const bodyOpen = source.indexOf("{", parameterClose);
  if (bodyOpen < 0) throw new Error(`function ${functionName} has no body`);
  const bodyClose = matchingDelimiter(source, bodyOpen, "{", "}");
  const parsedParameters = parameters(source, parameterOpen, parameterClose);

  const declarations: SourceDeclaration[] = [];
  const prologueStatements: SourceStatement[] = [];
  const caveats: string[] = [];
  let segmentStart = bodyOpen + 1;
  let parentheses = 0;
  let brackets = 0;
  let state: "code" | "string" | "char" | "line-comment" | "block-comment" = "code";
  let sawExecutable = false;

  for (let index = bodyOpen + 1; index < bodyClose; index++) {
    const character = source[index]!;
    const next = source[index + 1];
    if (state === "line-comment") {
      if (character === "\n") state = "code";
      continue;
    }
    if (state === "block-comment") {
      if (character === "*" && next === "/") {
        state = "code";
        index++;
      }
      continue;
    }
    if (state === "string" || state === "char") {
      if (character === "\\") {
        index++;
        continue;
      }
      if ((state === "string" && character === '"') || (state === "char" && character === "'")) state = "code";
      continue;
    }
    if (character === "/" && next === "/") {
      state = "line-comment";
      index++;
      continue;
    }
    if (character === "/" && next === "*") {
      state = "block-comment";
      index++;
      continue;
    }
    if (character === '"') {
      state = "string";
      continue;
    }
    if (character === "'") {
      state = "char";
      continue;
    }
    if (character === "(") parentheses++;
    else if (character === ")") parentheses--;
    else if (character === "[") brackets++;
    else if (character === "]") brackets--;
    else if (character === "{" && parentheses === 0 && brackets === 0) {
      caveats.push(`Prologue modeling stopped before compound statement at line ${lineAt(source, index)}.`);
      break;
    } else if (character === ";" && parentheses === 0 && brackets === 0) {
      const coreStart = skipLeadingTrivia(source, segmentStart, index + 1);
      const statementSpan = span(source, coreStart, index + 1);
      if (coreStart < index + 1) {
        const parsedDeclaration = !sawExecutable ? declaration(source, `decl-${declarations.length}`, statementSpan) : undefined;
        if (parsedDeclaration) declarations.push(parsedDeclaration);
        else {
          sawExecutable = true;
          const parsed = classifyStatement(source, `stmt-${prologueStatements.length}`, statementSpan);
          if (parsed.kind === "barrier") {
            caveats.push(`Prologue modeling stopped at protected source barrier on line ${parsed.span.lineStart}.`);
            break;
          }
          if (!parsed.movable) {
            caveats.push(`Prologue modeling stopped at ${parsed.id}: ${parsed.evidence.join(" ")}`);
            break;
          }
          prologueStatements.push(parsed);
        }
      }
      segmentStart = index + 1;
    }
  }

  let declarationRegion: SourceSpan | undefined;
  if (declarations.length > 0) declarationRegion = span(source, declarations[0]!.span.start, declarations[declarations.length - 1]!.span.end);
  let prologueRegion: SourceSpan | undefined;
  if (prologueStatements.length > 0) {
    const first = prologueStatements[0]!;
    const last = prologueStatements[prologueStatements.length - 1]!;
    const betweenHasComment = prologueStatements.slice(0, -1).some((statement, index) => {
      const following = prologueStatements[index + 1]!;
      return /\/\*|\/\//.test(source.slice(statement.span.end, following.span.start));
    });
    if (betweenHasComment) caveats.push("Prologue statements contain intervening comments, so automatic reordering is disabled.");
    else prologueRegion = span(source, first.span.start, last.span.end);
  }

  return {
    schemaVersion: 1,
    function: functionName,
    sourcePath,
    sourceHash: sha256(source),
    functionSpan: span(source, nameOffset, bodyClose + 1),
    bodySpan: span(source, bodyOpen, bodyClose + 1),
    parameters: parsedParameters,
    declarations,
    prologueStatements,
    ...(declarationRegion ? { declarationRegion } : {}),
    ...(prologueRegion ? { prologueRegion } : {}),
    caveats,
  };
}
