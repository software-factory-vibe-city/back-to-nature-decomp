/**
 * emission-attribution.ts — read GCC's own RTL-instruction-to-assembly
 * attribution out of `-dp` output.
 *
 * One RTL instruction can emit several machine instructions. Modelling that
 * boundary from the outside is ill-posed: the MIPS block mover's output
 * depends on a mutable file-scope `set_noreorder` counter, on which hard
 * registers reload assigned, and on batch-wide state, so it is not a function
 * of the copy's geometry. The compiler already knows the answer and will print
 * it — `final.c:output_asm_name` emits, against the *first* assembly line of
 * each RTL instruction:
 *
 *     <asm>\t # <uid>\t<pattern>[/<alternative>]\t[length = <n>]
 *
 * and then clears its marker so no later line of the same instruction is
 * annotated. That comment is the segmentation rule, taken from the source
 * rather than inferred: an annotated line opens a packet and every following
 * unannotated line belongs to it.
 *
 * Two cautions this module encodes rather than leaves to callers:
 *
 * - Declared `length` is in instructions, not bytes, and is an unrefined upper
 *   bound. `movstrsi_internal` declares 20 and routinely emits 5. It is
 *   reported for citation and must not be used as an emission width.
 * - maspsx post-processes this assembly, inserting load-delay nops that no RTL
 *   instruction emitted. Those carry a `# DEBUG:` marker and are recorded
 *   separately so a packet's compiler-emitted lines stay distinguishable from
 *   the assembler's.
 */

/** One RTL instruction and the assembly it emitted, in order. */
export interface EmissionPacket {
  /** RTL instruction UID, matching the `.mach`/`.dbr` dumps. */
  uid: number;
  /** `define_insn` name, e.g. `movstrsi_internal`. */
  pattern: string;
  /** 1-based constraint alternative, when the pattern has more than one. */
  alternative?: number;
  /** Declared length in *instructions* — an upper bound, not a width. */
  declaredLength?: number;
  /** Compiler-emitted assembly lines owned by this instruction. */
  lines: string[];
  /** Labels emitted inside the packet, e.g. `div_trap_normal`'s local `1:`. */
  labels: string[];
  /** Lines maspsx inserted inside this packet's span. */
  assemblerInserted: string[];
}

export interface EmissionAttribution {
  packets: EmissionPacket[];
  /** Instructions emitted before any annotation; never absorbed into a packet. */
  unattributed: string[];
  caveats: string[];
}

/* `\t%s %d\t%s` with ASM_COMMENT_START `#`, an optional `/alternative`, then
 * `\t[length = %d]`. Anchored at end of line so an ordinary `# high` operand
 * comment on the same line cannot match. */
const ANNOTATION = /#\s+(\d+)\t([^\t]+?)\t\[length\s*=\s*(\d+)\]\s*$/;
const LABEL = /^(?:[A-Za-z_.$][\w.$]*|\d+):/;
const ASSEMBLER_INSERTED = /#\s*DEBUG:/;

/** True for a packet whose emitted line count exceeds one. */
export function isMultiInstruction(packet: EmissionPacket): boolean {
  return packet.lines.length > 1;
}

export function parseEmissionAttribution(assembly: string): EmissionAttribution {
  const packets: EmissionPacket[] = [];
  const unattributed: string[] = [];
  const caveats: string[] = [];
  let open: EmissionPacket | undefined;

  for (const raw of assembly.split("\n")) {
    const line = raw.trim();
    if (line === "") continue;
    /* A whole-line comment is neither emission nor insertion. maspsx writes
     * `#nop # DEBUG: ...` when it decides a nop is *not* required. */
    if (line.startsWith("#")) continue;
    if (line.startsWith(".")) continue;

    const annotation = line.match(ANNOTATION);
    if (annotation) {
      const uid = annotation[1]!;
      const nameField = annotation[2]!;
      const length = annotation[3]!;
      const alternative = nameField.match(/^(.*)\/(\d+)$/);
      const packet: EmissionPacket = {
        uid: Number(uid),
        pattern: alternative ? alternative[1]! : nameField,
        lines: [line],
        labels: [],
        assemblerInserted: [],
      };
      if (alternative) packet.alternative = Number(alternative[2]!);
      packet.declaredLength = Number(length);
      packets.push(packet);
      open = packet;
      continue;
    }

    if (LABEL.test(line)) {
      /* A label inside a packet is part of it — this is what makes
       * `div_trap_normal`'s branch-over-trap legible as one instruction. */
      if (open) open.labels.push(line);
      continue;
    }

    if (!open) {
      unattributed.push(line);
      continue;
    }

    if (ASSEMBLER_INSERTED.test(line)) open.assemblerInserted.push(line);
    else open.lines.push(line);
  }

  if (packets.length === 0) {
    caveats.push(
      "no -dp annotations found; the assembly was compiled without -dp, so " +
      "emission boundaries are unknown rather than one-to-one",
    );
  }
  if (unattributed.length > 0) {
    caveats.push(
      `${unattributed.length} instruction(s) precede the first annotation and ` +
      "were left unattributed rather than assigned to a neighbouring packet",
    );
  }
  const multi = packets.filter(isMultiInstruction);
  if (multi.length > 0) {
    caveats.push(
      `${multi.length} RTL instruction(s) emitted more than one machine ` +
      "instruction; their members are not independent scheduling participants",
    );
  }
  return { packets, unattributed, caveats };
}

/** Packets keyed by UID, for joining against parsed final RTL. */
export function packetsByUid(attribution: EmissionAttribution): Map<number, EmissionPacket> {
  const byUid = new Map<number, EmissionPacket>();
  for (const packet of attribution.packets) byUid.set(packet.uid, packet);
  return byUid;
}

export function renderEmissionAttribution(attribution: EmissionAttribution): string[] {
  const lines: string[] = [];
  const multi = attribution.packets.filter(isMultiInstruction);
  lines.push(
    `  ${attribution.packets.length} RTL instruction(s) attributed; ` +
    `${multi.length} emitted more than one machine instruction`,
  );
  for (const packet of multi) {
    const span = packet.lines.length + packet.labels.length;
    lines.push(`  uid ${packet.uid}  ${packet.pattern}  -> ${span} line(s), declared length ${packet.declaredLength ?? "?"} (upper bound, instructions)`);
    for (const line of packet.lines) lines.push(`    | ${line}`);
    for (const label of packet.labels) lines.push(`    | ${label}`);
  }
  for (const caveat of attribution.caveats) lines.push(`  caveat: ${caveat}`);
  return lines;
}
