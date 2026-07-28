import type {
  RawDependencyReference,
  RegisterReference,
  RtlEmission,
  RtlInstruction,
  RtlNote,
  RtlNoteKind,
} from "./types.js";

export const FIRST_PSEUDO_REGISTER = 80;

const HARD_REGISTER_NAMES = [
  "zero", "at", "v0", "v1", "a0", "a1", "a2", "a3",
  "t0", "t1", "t2", "t3", "t4", "t5", "t6", "t7",
  "s0", "s1", "s2", "s3", "s4", "s5", "s6", "s7",
  "t8", "t9", "k0", "k1", "gp", "sp", "fp", "ra",
];

const REGISTER_PATTERN = /\(reg((?:\/[a-z]+)*):([A-Z0-9]+)\s+(\d+)(?:\s+([^()\s]+))?\)/gi;
const INSTRUCTION_START = /^\((insn|jump_insn|call_insn)(?:\/[a-z]+)*\s+(\d+)\b/gm;
const NOTE_START = /^\(note\s+(\d+)\b/gm;
const RTL_FORM_START = /^\((?:(?:insn|jump_insn|call_insn)(?:\/[a-z]+)*|note)\s+\d+\b/gm;

const NOTE_KINDS: Record<string, RtlNoteKind> = {
  NOTE_INSN_LOOP_BEG: "loop-begin",
  NOTE_INSN_LOOP_END: "loop-end",
  NOTE_INSN_LOOP_CONT: "loop-continue",
  NOTE_INSN_BASIC_BLOCK: "basic-block",
  NOTE_INSN_DELETED: "deleted",
};

export function hardRegisterName(register: number): string {
  return HARD_REGISTER_NAMES[register] || `hard-${register}`;
}

export function parseRegisterReferences(text: string): RegisterReference[] {
  const result: RegisterReference[] = [];
  for (const match of text.matchAll(REGISTER_PATTERN)) {
    const reference: RegisterReference = {
      register: parseInt(match[3], 10),
      mode: match[2].toUpperCase(),
      flags: match[1].split("/").filter(Boolean),
    };
    if (match[4]) reference.name = match[4];
    result.push(reference);
  }
  return result;
}

function lineAt(content: string, offset: number): number {
  let line = 1;
  for (let index = 0; index < offset; index++) {
    if (content.charCodeAt(index) === 10) line++;
  }
  return line;
}

function balancedForm(content: string, start: number, stage: string, kind: "instruction" | "note" = "instruction"): string {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < content.length; index++) {
    const char = content[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "(") depth++;
    else if (char === ")") {
      depth--;
      if (depth === 0) return content.slice(start, index + 1);
    }
  }
  throw new Error(`RTL parse error in .${stage} at line ${lineAt(content, start)}: unterminated ${kind} form`);
}

function firstSExpression(text: string, start: number): string | undefined {
  const open = text.indexOf("(", start);
  if (open < 0) return undefined;
  let depth = 0;
  for (let index = open; index < text.length; index++) {
    if (text[index] === "(") depth++;
    else if (text[index] === ")") {
      depth--;
      if (depth === 0) return text.slice(open, index + 1);
    }
  }
  return undefined;
}

function setParts(text: string): { destination?: string; source?: string } {
  const set = text.indexOf("(set ");
  if (set < 0) return {};
  const destination = firstSExpression(text, set + 5);
  if (!destination) return {};
  const source = firstSExpression(text, set + 5 + destination.length);
  return { destination, source };
}

function normalizeExpression(expression: string): string {
  return expression.replace(/\s+/g, " ").trim().slice(0, 240);
}

function sameReference(left: RegisterReference, right: RegisterReference): boolean {
  return left.register === right.register && left.mode === right.mode;
}

function parseDependencies(text: string): RawDependencyReference[] {
  const result: RawDependencyReference[] = [];
  const seen = new Set<string>();
  const pattern = /\(insn_list(?:\/[a-z]+)*(?::(REG_DEP_ANTI|REG_DEP_OUTPUT))?\s+(\d+)\b/g;
  for (const match of text.matchAll(pattern)) {
    const predecessorUid = parseInt(match[2], 10);
    const key = `${predecessorUid}:${match[1] || "true"}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const reference: RawDependencyReference = { predecessorUid };
    if (match[1]) reference.note = match[1] as RawDependencyReference["note"];
    result.push(reference);
  }
  return result;
}

function blockMarkers(content: string): Array<{ offset: number; block: number }> {
  const markers: Array<{ offset: number; block: number }> = [];
  const pattern = /^;; Start of basic block (\d+),/gm;
  for (const match of content.matchAll(pattern)) {
    markers.push({ offset: match.index!, block: parseInt(match[1], 10) });
  }
  return markers;
}

function blockAt(markers: Array<{ offset: number; block: number }>, offset: number): number | undefined {
  let block: number | undefined;
  for (const marker of markers) {
    if (marker.offset > offset) break;
    block = marker.block;
  }
  return block;
}

export function parseRtlNotes(content: string, stage: string): RtlNote[] {
  const result: RtlNote[] = [];
  const formOrders = new Map<number, number>();
  let formOrder = 0;
  RTL_FORM_START.lastIndex = 0;
  for (const match of content.matchAll(RTL_FORM_START)) formOrders.set(match.index!, formOrder++);

  NOTE_START.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = NOTE_START.exec(content)) !== null) {
    const text = balancedForm(content, match.index, stage, "note");
    const rawKind = text.match(/\b(NOTE_INSN_[A-Z_]+)\b/)?.[1];
    const source = rawKind ? undefined : text.match(/^\(note\s+\d+\s+\d+\s+\d+\s+"([^"]+)"\s+(\d+)\s*\)$/s);
    const kind: RtlNoteKind = source ? "source-line" : NOTE_KINDS[rawKind || ""] || "other";
    const note: RtlNote = {
      uid: parseInt(match[1], 10),
      stage,
      order: formOrders.get(match.index) ?? result.length,
      kind,
    };
    const block = text.match(/\[bb\s+(\d+)\]/)?.[1];
    if (block !== undefined) note.block = parseInt(block, 10);
    if (source) {
      note.sourceFile = source[1];
      note.sourceLine = parseInt(source[2], 10);
    }
    result.push(note);
    NOTE_START.lastIndex = match.index + text.length;
  }

  if (/^\(note\b/m.test(content) && result.length === 0) {
    throw new Error(`RTL parse error in .${stage}: note markers were present but none could be parsed`);
  }
  return result;
}

export function parseRtlInstructions(content: string, stage: string): RtlInstruction[] {
  const result: RtlInstruction[] = [];
  const markers = blockMarkers(content);
  const formOrders = new Map<number, number>();
  let formOrder = 0;
  RTL_FORM_START.lastIndex = 0;
  for (const form of content.matchAll(RTL_FORM_START)) formOrders.set(form.index!, formOrder++);
  INSTRUCTION_START.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = INSTRUCTION_START.exec(content)) !== null) {
    const text = balancedForm(content, match.index, stage);
    const headerLength = text.match(/^\((?:insn|jump_insn|call_insn)(?:\/[a-z]+)*\s+\d+\s+\d+\s+\d+\s+/)?.[0].length;
    const pattern = headerLength ? firstSExpression(text, headerLength) : undefined;
    const parts = setParts(pattern || text);
    const destinationRefs = parts.destination ? parseRegisterReferences(parts.destination) : [];
    const sets = parts.destination && !parts.destination.startsWith("(mem")
      ? destinationRefs.slice(0, 1)
      : [];
    /* REG_EQUIV/REG_DEAD notes describe metadata, not additional operand uses. */
    const allRefs = parseRegisterReferences(pattern || text);
    const uses = [...allRefs];
    for (const set of sets) {
      const remove = uses.findIndex((reference) => sameReference(reference, set));
      if (remove >= 0) uses.splice(remove, 1);
    }

    const deaths: RegisterReference[] = [];
    const deathPattern = /REG_DEAD\s+(\(reg(?:\/[a-z]+)*:[A-Z0-9]+\s+\d+(?:\s+[^()\s]+)?\))/gi;
    for (const death of text.matchAll(deathPattern)) {
      const reference = parseRegisterReferences(death[1])[0];
      if (reference) deaths.push(reference);
    }

    const source = parts.source;
    const operation = source?.match(/^\(([a-z_][a-z0-9_]*)/i)?.[1]?.toLowerCase();
    const instruction: RtlInstruction = {
      uid: parseInt(match[2], 10),
      kind: match[1] as RtlInstruction["kind"],
      stage,
      order: result.length,
      text,
      sets,
      uses,
      deaths,
      memoryRead: Boolean(source?.includes("(mem")),
      memoryWrite: Boolean(parts.destination?.startsWith("(mem")),
      control: match[1] === "jump_insn" || Boolean(source?.includes("(pc)")) || text.includes("(return)"),
      dependencies: parseDependencies(text),
    };
    const chainOrder = formOrders.get(match.index);
    if (chainOrder !== undefined) instruction.chainOrder = chainOrder;
    const block = blockAt(markers, match.index);
    if (block !== undefined) instruction.block = block;
    if (source) instruction.expression = normalizeExpression(source);
    if (operation) instruction.operation = operation;
    result.push(instruction);

    /* Avoid matching a parenthesized fragment within the form just consumed. */
    INSTRUCTION_START.lastIndex = match.index + text.length;
  }

  if (/^\((?:insn|jump_insn|call_insn)(?:\/[a-z]+)*\b/m.test(content) && result.length === 0) {
    throw new Error(`RTL parse error in .${stage}: instruction markers were present but none could be parsed`);
  }
  return result;
}

export function classifyRtlEmission(instruction: RtlInstruction): RtlEmission {
  if (/\(asm_operands\/v\s+\(""\)\s+\(""\)/s.test(instruction.text)) {
    return {
      uid: instruction.uid,
      stage: instruction.stage,
      classification: "zero-width",
      reason: "empty-volatile-asm",
      confidence: "exact",
      evidence: [
        "The final RTL pattern is a volatile asm_operands with an exactly empty template.",
        "Its parallel memory clobber constrains scheduling but emits no machine operation.",
      ],
    };
  }
  if (/^\((?:insn|jump_insn|call_insn)(?:\/[a-z]+)*\b[\s\S]*?\s\((?:use|clobber)\b/s.test(instruction.text) && !instruction.text.includes("(set ")) {
    return {
      uid: instruction.uid,
      stage: instruction.stage,
      classification: "zero-width",
      reason: "use-or-clobber",
      confidence: "reconstructed",
      evidence: ["The final standalone USE/CLOBBER constrains compiler dataflow but has no machine template; neighboring canonical anchors confirm zero emitted operations."],
    };
  }
  if (instruction.operation === "asm_operands" || instruction.text.includes("(unspec")) {
    return {
      uid: instruction.uid,
      stage: instruction.stage,
      classification: "unknown",
      reason: "unknown-pattern",
      confidence: "inferred",
      evidence: ["An unrecognized asm/UNSPEC pattern was retained; zero-width emission was not assumed."],
    };
  }
  return {
    uid: instruction.uid,
    stage: instruction.stage,
    classification: "emits",
    reason: "recognized-machine-pattern",
    confidence: "reconstructed",
    evidence: ["The final RTL form is an ordinary SET/control machine pattern and is not a recognized zero-width form."],
  };
}

export function pseudoRegisters(instruction: RtlInstruction): Set<number> {
  const result = new Set<number>();
  for (const reference of [...instruction.sets, ...instruction.uses, ...instruction.deaths]) {
    if (reference.register >= FIRST_PSEUDO_REGISTER) result.add(reference.register);
  }
  return result;
}

export function registerAccess(instruction: RtlInstruction): { sets: Set<number>; uses: Set<number> } {
  return {
    sets: new Set(instruction.sets.map((reference) => reference.register)),
    uses: new Set(instruction.uses.map((reference) => reference.register)),
  };
}
