import { classifyRtlEmission, hardRegisterName } from "../compiler-trace/rtl-parser.js";
import type { EmissionAttribution } from "../compiler-trace/emission-attribution.js";
import type { RtlInstruction } from "../compiler-trace/types.js";
import type {
  EmissionAlignmentEntry,
  MachineInstructionRef,
  MachineUidLink,
} from "./types.js";

function machineFamily(instruction: MachineInstructionRef): string {
  const mnemonic = instruction.mnemonic.toLowerCase();
  if (/^(?:lb|lbu|lh|lhu|lw)$/.test(mnemonic)) return `load:${mnemonic}`;
  if (/^(?:sb|sh|sw)$/.test(mnemonic)) return `store:${mnemonic}`;
  if (/^b|^j/.test(mnemonic)) return "control";
  if (/^(?:li|lui)$/.test(mnemonic)) return "constant";
  if (mnemonic === "move") return "move";
  return mnemonic.replace(/u$/, "");
}

function rtlFamily(instruction: RtlInstruction): string {
  if (instruction.control) return "control";
  if (instruction.memoryWrite) {
    const mode = instruction.text.match(/\(mem(?:\/[^:]*)?:([A-Z]+)\b/)?.[1];
    return `store:${mode === "QI" ? "sb" : mode === "HI" ? "sh" : "sw"}`;
  }
  if (instruction.memoryRead) {
    const mode = instruction.text.match(/\(mem(?:\/[^:]*)?:([A-Z]+)\b/)?.[1];
    const unsigned = instruction.operation === "zero_extend";
    return `load:${mode === "QI" ? unsigned ? "lbu" : "lb" : mode === "HI" ? unsigned ? "lhu" : "lh" : "lw"}`;
  }
  switch (instruction.operation) {
    case "const_int": return "constant";
    case "lshiftrt": return "srl";
    case "ashiftrt": return "sra";
    case "ashift": return "sll";
    case "and": return "and";
    case "ior": return "or";
    case "xor": return "xor";
    case "plus": return "add";
    case "minus": return "sub";
    case "reg": return "move";
    default: return instruction.operation || "unknown";
  }
}

function registerName(reference: RtlInstruction["uses"][number] | undefined): string | undefined {
  return reference ? reference.name || hardRegisterName(reference.register) : undefined;
}

function integer(instruction: RtlInstruction): number | undefined {
  const raw = instruction.expression?.match(/\(const_int\s+(-?\d+)/)?.[1];
  return raw === undefined ? undefined : parseInt(raw, 10);
}

function memoryAddress(instruction: RtlInstruction): { base?: string; offset: number; mode?: string } {
  const text = instruction.text;
  const mode = text.match(/\(mem(?:\/[^:]*)?:([A-Z]+)\b/)?.[1];
  const memoryStart = text.indexOf("(mem");
  const memory = memoryStart >= 0 ? text.slice(memoryStart) : text;
  const baseNumber = memory.match(/\(reg(?:\/[a-z]+)*:[A-Z0-9]+\s+(\d+)(?:\s+([^()\s]+))?\)/i);
  const offset = memory.match(/\(const_int\s+(-?\d+)/)?.[1];
  const result: { base?: string; offset: number; mode?: string } = {
    offset: offset ? parseInt(offset, 10) : 0,
  };
  if (baseNumber) result.base = baseNumber[2] || hardRegisterName(parseInt(baseNumber[1]!, 10));
  if (mode) result.mode = mode;
  return result;
}

/**
 * True for an RTL instruction operating in BLKmode — a block move, which emits
 * a multi-instruction packet rather than one machine instruction.
 */
export function isBlockMode(instruction: RtlInstruction): boolean {
  if (instruction.sets.some((operand) => operand.mode === "BLK")) return true;
  if (instruction.uses.some((operand) => operand.mode === "BLK")) return true;
  return /\(mem[^)]*:BLK/.test(instruction.text);
}

/** Canonical forms for final one-insn MIPS patterns; unknown expansions return none. */
export function rtlCanonical(instruction: RtlInstruction): string | undefined {
  const destination = registerName(instruction.sets[0]);
  const uses = instruction.uses.map(registerName).filter((value): value is string => Boolean(value));
  const constant = integer(instruction);
  /* A BLKmode set is a block move: one RTL instruction that emits a whole run
   * of machine instructions whose mnemonics and count come from the backend's
   * output routine, not from the mode. Naming it `sw` here would let it bind
   * to an unrelated store as a score-100 anchor and propagate a wrong UID into
   * delay-slot and scheduler reasoning. Emission attribution answers this; a
   * canonical cannot. */
  if (isBlockMode(instruction)) return undefined;
  if (instruction.memoryWrite) {
    const address = memoryAddress(instruction);
    const source = uses.find((value) => value !== address.base) || uses.at(-1);
    if (!address.base || !source) return undefined;
    const mnemonic = address.mode === "QI" ? "sb" : address.mode === "HI" ? "sh" : "sw";
    return `${mnemonic} ${source},${address.offset}(${address.base})`;
  }
  if (instruction.memoryRead && destination) {
    const address = memoryAddress(instruction);
    if (!address.base) return undefined;
    const mnemonic = address.mode === "QI"
      ? instruction.operation === "zero_extend" || instruction.operation === "mem" ? "lbu" : "lb"
      : address.mode === "HI" ? instruction.operation === "zero_extend" || instruction.operation === "mem" ? "lhu" : "lh" : "lw";
    return `${mnemonic} ${destination},${address.offset}(${address.base})`;
  }
  if (instruction.control || instruction.operation === "if_then_else") {
    if (instruction.text.includes("(return)")) return "jr ra";
    const source = uses[0];
    if (!source) return undefined;
    const labelBeforePc = instruction.expression?.indexOf("(label_ref") ?? -1;
    const pc = instruction.expression?.lastIndexOf("(pc)") ?? -1;
    const mnemonic = labelBeforePc >= 0 && labelBeforePc < pc ? "beqz" : "bnez";
    return `${mnemonic} ${source},<branch-target>`;
  }
  if (!destination) return undefined;
  const source = uses[0];
  if (instruction.operation === "const_int" && constant !== undefined) {
    if (constant === 0) return `move ${destination},zero`;
    if (constant < -32768 || constant > 65535) {
      const unsigned = constant >>> 0;
      if ((unsigned & 0xffff) === 0) return `lui ${destination},${unsigned >>> 16}`;
    }
    return `li ${destination},${constant}`;
  }
  if (instruction.operation === "high") {
    const symbol = instruction.expression?.match(/"(?:D_)?([0-9A-Fa-f]{8})"/)?.[1]?.toLowerCase();
    if (symbol) return `lui ${destination},%hi(${symbol})`;
  }
  if (instruction.operation === "lo_sum" && source) {
    const symbol = instruction.expression?.match(/"(?:D_)?([0-9A-Fa-f]{8})"/)?.[1]?.toLowerCase();
    if (symbol) return `addiu ${destination},${source},%lo(${symbol})`;
  }
  if (instruction.operation === "reg" && source) return `move ${destination},${source}`;
  if (instruction.operation === "zero_extend" && source) {
    const sourceMode = instruction.uses[0]?.mode;
    const mask = sourceMode === "QI" ? 255 : sourceMode === "HI" ? 65535 : undefined;
    if (mask !== undefined) return `andi ${destination},${source},${mask}`;
  }
  if ((instruction.operation === "lshiftrt" || instruction.operation === "ashiftrt" || instruction.operation === "ashift") && source && constant !== undefined) {
    const mnemonic = instruction.operation === "lshiftrt" ? "srl" : instruction.operation === "ashiftrt" ? "sra" : "sll";
    return `${mnemonic} ${destination},${source},${constant}`;
  }
  if ((instruction.operation === "and" || instruction.operation === "ior" || instruction.operation === "xor") && source) {
    const base = instruction.operation === "ior" ? "or" : instruction.operation;
    if (constant !== undefined && constant >= 0 && constant <= 65535) return `${base}i ${destination},${source},${constant}`;
    const second = uses[1];
    if (second) return `${base} ${destination},${source},${second}`;
  }
  if ((instruction.operation === "plus" || instruction.operation === "minus") && source) {
    const base = instruction.operation === "plus" ? "add" : "sub";
    if (constant !== undefined) return `${base}iu ${destination},${source},${constant}`;
    const second = uses[1];
    if (second) return `${base}u ${destination},${source},${second}`;
  }
  if (instruction.operation === "ltu" && source && constant !== undefined) return `sltiu ${destination},${source},${constant}`;
  return undefined;
}

function roleScore(rtl: RtlInstruction, machine: MachineInstructionRef): number {
  if (rtlCanonical(rtl) === machine.canonical) return 100;
  const left = rtlFamily(rtl);
  const right = machineFamily(machine);
  if (left === right) return 90;
  if (left === "constant" && (right === "move" || right === "add")) return 55;
  if (left === "move" && (right === "move" || right === "add" || right === "or")) return 65;
  if (left === "and" && right === "andi") return 80;
  if (left === "or" && right === "ori") return 80;
  if (left === "add" && (right === "add" || right === "addi")) return 75;
  if (left.split(":")[0] === right.split(":")[0] && left !== "unknown") return 60;
  return 0;
}

export interface EmissionAlignmentResult {
  alignment: EmissionAlignmentEntry[];
  links: MachineUidLink[];
  caveats: string[];
  exactCount: boolean;
}

/**
 * Attach UIDs straight from the compiler's own `-dp` attribution. Each packet
 * names the RTL instruction that emitted a run of machine instructions, so a
 * block move or trap packet links its whole span to one UID — many machine
 * indexes to one UID — instead of being guessed at one-to-one.
 *
 * Machine refs are matched to packets by order: `-dp` annotates in emission
 * order and the machine stream is that same stream reparsed, so the k-th
 * emitted line is the k-th ref. Anything left over is reported rather than
 * forced.
 */
function linkFromAttribution(
  machine: MachineInstructionRef[],
  attribution: EmissionAttribution,
): { links: MachineUidLink[]; caveats: string[] } | undefined {
  const emitted: number[] = [];
  for (const packet of attribution.packets) {
    for (let line = 0; line < packet.lines.length; line++) emitted.push(packet.uid);
  }
  if (emitted.length !== machine.length) return undefined;

  const links: MachineUidLink[] = [];
  const spans = new Map<number, number>();
  for (const uid of emitted) spans.set(uid, (spans.get(uid) ?? 0) + 1);

  emitted.forEach((uid, index) => {
    machine[index]!.uid = uid;
    machine[index]!.candidateUids = [uid];
    const span = spans.get(uid) ?? 1;
    links.push({
      machineIndex: index,
      uid,
      confidence: "exact",
      candidateUids: [uid],
      evidence: span > 1
        ? [`cc1 -dp attributes this line to RTL insn ${uid}, one of ${span} it emitted; the run is one instruction, not ${span} scheduling participants.`]
        : [`cc1 -dp attributes this line to RTL insn ${uid}.`],
    });
  });

  const packets = attribution.packets.filter((packet) => packet.lines.length > 1);
  const caveats = packets.map((packet) =>
    `RTL insn ${packet.uid} (${packet.pattern}) emitted ${packet.lines.length} machine instructions; ` +
    "its members are one compiler decision and cannot be reordered through source statement order.");
  return { links, caveats };
}

/** Align final RTL forms to emitted instructions without discarding unknown forms. */
export function alignFinalRtlToMachine(
  machine: MachineInstructionRef[],
  finalInstructions: RtlInstruction[],
  attribution?: EmissionAttribution,
): EmissionAlignmentResult {
  /* The compiler's own attribution outranks every heuristic below it. */
  if (attribution && attribution.packets.length > 0) {
    const attributed = linkFromAttribution(machine, attribution);
    if (attributed) {
      /* Attribution supplies the links, but the zero-width classification is
       * separate evidence about the RTL itself. Returning an empty alignment
       * made the report claim zero proven zero-width nodes where the trace
       * still contains them. */
      const zeroWidthOnly: EmissionAlignmentEntry[] = finalInstructions
        .map((instruction) => ({ instruction, emission: classifyRtlEmission(instruction) }))
        .filter((item) => item.emission.classification === "zero-width")
        .map((item) => ({
          rtlUid: item.instruction.uid,
          rtlOrder: item.instruction.order,
          kind: "zero-width" as const,
          confidence: item.emission.confidence,
          evidence: item.emission.evidence,
        }));
      return {
        alignment: zeroWidthOnly,
        links: attributed.links,
        caveats: [
          "Emission links come from cc1 -dp, not from canonical matching.",
          ...attributed.caveats,
        ],
        exactCount: true,
      };
    }
  }

  const emissions = finalInstructions.map((instruction) => ({
    instruction,
    emission: classifyRtlEmission(instruction),
  }));
  const zeroWidth = emissions.filter((item) => item.emission.classification === "zero-width");
  const possibleEmits = emissions.filter((item) => item.emission.classification !== "zero-width");
  const alignment: EmissionAlignmentEntry[] = zeroWidth.map((item) => ({
    rtlUid: item.instruction.uid,
    rtlOrder: item.instruction.order,
    kind: "zero-width",
    confidence: item.emission.confidence,
    evidence: item.emission.evidence,
  }));
  const links: MachineUidLink[] = [];
  const caveats: string[] = [];

  /* First attach exact canonical RTL/machine anchors, independent of delay-slot chain order. */
  const rtlByCanonical = new Map<string, typeof possibleEmits>();
  for (const item of possibleEmits) {
    const canonical = rtlCanonical(item.instruction);
    if (!canonical) continue;
    const values = rtlByCanonical.get(canonical) || [];
    values.push(item);
    rtlByCanonical.set(canonical, values);
  }
  const machineByCanonical = new Map<string, number[]>();
  for (let index = 0; index < machine.length; index++) {
    const values = machineByCanonical.get(machine[index]!.canonical) || [];
    values.push(index);
    machineByCanonical.set(machine[index]!.canonical, values);
  }
  const assignedRtl = new Set<number>();
  const assignedMachine = new Set<number>();
  for (const [canonical, rtlItems] of rtlByCanonical) {
    const machineIndexes = machineByCanonical.get(canonical) || [];
    if (rtlItems.length !== machineIndexes.length || rtlItems.length === 0) continue;
    for (let occurrence = 0; occurrence < rtlItems.length; occurrence++) {
      const rtl = rtlItems[occurrence]!.instruction;
      const machineIndex = machineIndexes[occurrence]!;
      const confidence = rtlItems.length === 1 ? "exact" as const : "reconstructed" as const;
      const evidence = [rtlItems.length === 1
        ? `Unique final RTL canonical emission matches machine instruction ${canonical}.`
        : `Occurrence ${occurrence + 1}/${rtlItems.length} of duplicate canonical emission ${canonical} was paired deterministically.`];
      links.push({ machineIndex, uid: rtl.uid, candidateUids: [rtl.uid], confidence, evidence });
      alignment.push({ rtlUid: rtl.uid, rtlOrder: rtl.order, machineIndex, kind: "emitted", score: 100, confidence, evidence });
      machine[machineIndex]!.uid = rtl.uid;
      machine[machineIndex]!.candidateUids = [rtl.uid];
      if (rtl.block !== undefined) machine[machineIndex]!.block = rtl.block;
      assignedRtl.add(rtl.uid);
      assignedMachine.add(machineIndex);
    }
  }

  const remainingEmits = possibleEmits.filter((item) => !assignedRtl.has(item.instruction.uid));
  const remainingMachine = machine.map((_item, index) => index).filter((index) => !assignedMachine.has(index));
  if (remainingEmits.length === remainingMachine.length && remainingEmits.every((item) => item.emission.classification === "emits")) {
    for (let remaining = 0; remaining < remainingMachine.length; remaining++) {
      const index = remainingMachine[remaining]!;
      const rtl = remainingEmits[remaining]!.instruction;
      const link: MachineUidLink = {
        machineIndex: index,
        uid: rtl.uid,
        candidateUids: [rtl.uid],
        confidence: "reconstructed",
        evidence: ["Unmatched final RTL and machine suffixes have equal counts after exact canonical anchors and proven zero-width removal."],
      };
      links.push(link);
      alignment.push({ rtlUid: rtl.uid, rtlOrder: rtl.order, machineIndex: index, kind: "emitted", score: 80, confidence: "reconstructed", evidence: [...link.evidence] });
      machine[index]!.uid = rtl.uid;
      machine[index]!.candidateUids = [rtl.uid];
      if (rtl.block !== undefined) machine[index]!.block = rtl.block;
    }
    links.sort((left, right) => left.machineIndex - right.machineIndex);
    alignment.sort((left, right) => (left.rtlOrder ?? Number.MAX_SAFE_INTEGER) - (right.rtlOrder ?? Number.MAX_SAFE_INTEGER));
    caveats.push(`${zeroWidth.length} proven zero-width final RTL instruction(s) were skipped; ${links.length} emitted instructions retain unique UID links.`);
    return { alignment, links, caveats, exactCount: true };
  }

  if (possibleEmits.length === machine.length && possibleEmits.every((item) => item.emission.classification === "emits") && links.length === 0) {
    for (let index = 0; index < machine.length; index++) {
      const rtl = possibleEmits[index]!.instruction;
      const link: MachineUidLink = {
        machineIndex: index,
        uid: rtl.uid,
        candidateUids: [rtl.uid],
        confidence: "reconstructed",
        evidence: [
          "Final RTL emission order maps monotonically to normalized cc1 instruction order after removing only proven zero-width forms.",
        ],
      };
      links.push(link);
      alignment.push({
        rtlUid: rtl.uid,
        rtlOrder: rtl.order,
        machineIndex: index,
        kind: "emitted",
        score: 100,
        confidence: "reconstructed",
        evidence: [...link.evidence],
      });
      machine[index]!.uid = rtl.uid;
      machine[index]!.candidateUids = [rtl.uid];
      if (rtl.block !== undefined) machine[index]!.block = rtl.block;
    }
    alignment.sort((left, right) => (left.rtlOrder ?? Number.MAX_SAFE_INTEGER) - (right.rtlOrder ?? Number.MAX_SAFE_INTEGER));
    caveats.push(`${zeroWidth.length} proven zero-width final RTL instruction(s) were skipped; ${links.length} emitted instructions retain unique UID links.`);
    return { alignment, links, caveats, exactCount: true };
  }

  /* Fail-closed fallback: retain only unique high-scoring monotonic anchors. */
  let rtlStart = 0;
  for (const machineIndex of remainingMachine) {
    const scored = remainingEmits.slice(rtlStart).map((item, offset) => ({
      item,
      rtlIndex: rtlStart + offset,
      score: roleScore(item.instruction, machine[machineIndex]!),
    })).filter((item) => item.score >= 60).sort((left, right) => right.score - left.score || left.rtlIndex - right.rtlIndex);
    const best = scored[0];
    const tied = best ? scored.filter((item) => item.score === best.score) : [];
    if (!best || tied.length !== 1) {
      links.push({
        machineIndex,
        candidateUids: tied.map((item) => item.item.instruction.uid),
        confidence: "inferred",
        evidence: [best ? "Multiple monotonic RTL forms have the same role-signature score." : "No monotonic RTL form met the role-signature threshold."],
      });
      alignment.push({ machineIndex, kind: "machine-only", confidence: "inferred", evidence: [...links[links.length - 1]!.evidence] });
      continue;
    }
    const rtl = best.item.instruction;
    const link: MachineUidLink = {
      machineIndex,
      uid: rtl.uid,
      candidateUids: [rtl.uid],
      confidence: "inferred",
      evidence: [`Unique monotonic RTL/machine role-signature anchor scored ${best.score}.`],
    };
    links.push(link);
    alignment.push({ rtlUid: rtl.uid, rtlOrder: rtl.order, machineIndex, kind: "emitted", score: best.score, confidence: "inferred", evidence: [...link.evidence] });
    machine[machineIndex]!.uid = rtl.uid;
    machine[machineIndex]!.candidateUids = [rtl.uid];
    if (rtl.block !== undefined) machine[machineIndex]!.block = rtl.block;
    rtlStart = best.rtlIndex + 1;
  }
  links.sort((left, right) => left.machineIndex - right.machineIndex);
  for (const item of remainingEmits.slice(rtlStart)) {
    alignment.push({
      rtlUid: item.instruction.uid,
      rtlOrder: item.instruction.order,
      kind: item.emission.classification === "unknown" ? "rtl-only-unknown" : "rtl-only-unknown",
      confidence: "inferred",
      evidence: item.emission.evidence,
    });
  }
  caveats.push(`Final RTL/machine counts remain ${possibleEmits.length}/${machine.length} after proven skips; ${links.filter((link) => link.uid !== undefined).length} unique canonical/role anchors were retained and unknown forms were not discarded.`);
  return { alignment, links, caveats, exactCount: false };
}
