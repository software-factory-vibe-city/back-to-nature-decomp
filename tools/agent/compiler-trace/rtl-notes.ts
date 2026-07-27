import type {
  InstructionMetadata,
  RtlInstruction,
  RtlLoopRegion,
  RtlNote,
  RtlStageMetadata,
} from "./types.js";

interface StreamEntity {
  uid: number;
  kind: "instruction" | "note";
  order: number;
}

interface OpenLoop {
  region: RtlLoopRegion;
}

const FORM_START = /^\((insn|jump_insn|call_insn|note)\s+(\d+)\b/gm;
const REGISTER = /\(reg((?:\/[a-z]+)*):([A-Z0-9]+)\s+(\d+)(?:\s+[^()\s]+)?\)/gi;

function streamEntities(content: string): StreamEntity[] {
  const result: StreamEntity[] = [];
  for (const match of content.matchAll(FORM_START)) {
    result.push({
      uid: parseInt(match[2], 10),
      kind: match[1] === "note" ? "note" : "instruction",
      order: result.length,
    });
  }
  return result;
}

function normalizeRegisters(expression: string): string {
  return expression.replace(REGISTER, (_whole, flags: string, mode: string, rawRegister: string) => {
    const register = parseInt(rawRegister, 10);
    const identity = register >= 80 ? "pseudo" : `hard-${register}`;
    return `(reg${flags.toLowerCase()}:${mode.toUpperCase()} ${identity})`;
  });
}

/** A pseudo- and UID-independent description suitable for aligning metadata regions. */
export function semanticInstructionSignature(instruction: RtlInstruction): string {
  const expression = normalizeRegisters(instruction.expression || "")
    .replace(/\s+/g, " ")
    .trim();
  return [
    instruction.kind,
    instruction.operation || "unknown",
    expression,
    instruction.memoryRead ? "read" : "",
    instruction.memoryWrite ? "write" : "",
    instruction.control ? "control" : "",
  ].join("|");
}

export function describeSemanticInstruction(instruction: {
  operation?: string;
  expression?: string;
  memoryRead: boolean;
  memoryWrite: boolean;
  control: boolean;
}): string {
  const expression = instruction.expression || "";
  if (instruction.operation === "sign_extend" && /\(mem(?:\/[a-z]+)*:HI\b/i.test(expression)) {
    return "signed 16-bit memory load";
  }
  if (instruction.operation === "zero_extend" && /\(mem(?:\/[a-z]+)*:(QI|HI)\b/i.test(expression)) {
    return "unsigned memory load";
  }
  if (instruction.memoryRead) return "memory load";
  if (instruction.memoryWrite) return "memory store";
  if (instruction.control) return "control instruction";
  return `${instruction.operation || "RTL"} instruction`;
}

export function reconstructRtlMetadata(
  content: string,
  stage: string,
  instructions: RtlInstruction[],
  notes: RtlNote[],
): RtlStageMetadata {
  const instructionByUid = new Map(instructions.map((instruction) => [instruction.uid, instruction]));
  const noteByUid = new Map(notes.map((note) => [note.uid, note]));
  const metadata: InstructionMetadata[] = [];
  const loops: RtlLoopRegion[] = [];
  const stack: OpenLoop[] = [];
  const caveats: string[] = [];
  let block: number | undefined;

  for (const entity of streamEntities(content)) {
    if (entity.kind === "note") {
      const note = noteByUid.get(entity.uid);
      if (!note) continue;
      if (note.kind === "basic-block" && note.block !== undefined) block = note.block;
      if (note.kind === "loop-begin") {
        const region: RtlLoopRegion = {
          beginUid: note.uid,
          depth: stack.length + 1,
          confidence: "reconstructed",
          instructionUids: [],
          semanticInstructionSignatures: [],
          executableControlUids: [],
        };
        loops.push(region);
        stack.push({ region });
      } else if (note.kind === "loop-end") {
        const open = stack.pop();
        if (open) {
          open.region.endUid = note.uid;
          open.region.confidence = "exact";
        } else caveats.push(`[reconstructed] Unmatched NOTE_INSN_LOOP_END UID ${note.uid} in .${stage}.`);
      } else if (note.kind === "loop-continue" && stack.length === 0) {
        caveats.push(`[reconstructed] NOTE_INSN_LOOP_CONT UID ${note.uid} is outside a reconstructed loop in .${stage}.`);
      }
      continue;
    }

    const instruction = instructionByUid.get(entity.uid);
    if (!instruction) continue;
    const item: InstructionMetadata = {
      uid: instruction.uid,
      loopDepth: stack.length,
      enclosingLoopNotes: stack.map((open) => open.region.beginUid),
    };
    const instructionBlock = block ?? instruction.block;
    if (instructionBlock !== undefined) item.block = instructionBlock;
    metadata.push(item);

    const signature = semanticInstructionSignature(instruction);
    for (const open of stack) {
      open.region.instructionUids.push(instruction.uid);
      open.region.semanticInstructionSignatures.push(signature);
      if (instruction.control) open.region.executableControlUids.push(instruction.uid);
    }
  }

  for (const open of stack) {
    caveats.push(`[reconstructed] Unmatched NOTE_INSN_LOOP_BEG UID ${open.region.beginUid} in .${stage}.`);
  }

  return {
    stage,
    notes,
    instructions: metadata,
    loopRegions: loops,
    caveats,
  };
}
