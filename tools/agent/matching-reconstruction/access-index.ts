/**
 * Target-derived memory access index (plan §6 C2).
 *
 * Mines every function's *original* words — matched or not — for anchored
 * address materializations: a `lui`+`addiu`/`ori` pair (or a `lui` completed by
 * a memory operand's `%lo`) fixes an anchor address, and explicit adds or
 * displacements from that anchor witness base-plus-offset structure the
 * original compiler emitted. An anchor is only a witness when the symbol
 * tables know an exact label at it; a constant address difference alone never
 * establishes containment.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "../decompToolchain.js";
import {
  containerTargetPath,
  containersCovering,
  loadContainers,
  vramToRom,
  type Container,
} from "../../lib/container.js";
import { loadFunctionSpans, loadSymbolIndex, resolveAddress, type SymbolIndex } from "../../lib/symbolIndex.js";
import { ensureArtifact, stamped, writeStableJson, type EnsuredArtifact } from "../provenance.js";
import { decodeBytes } from "./exec.js";
import { isBranch, isLoad, isStore, loadSigned, loadWidth, type DecodedInsn } from "./decode.js";
import type { AccessIndex, AccessWitness, OriginAlternative } from "./types.js";

const ACCESS_INDEX_SCHEMA_VERSION = 1;

/** Largest offset-from-anchor worth recording; beyond this it is noise. */
const MAX_ANCHOR_OFFSET = 0x100000;

interface TrackedValue {
  value: number;
  /** Set once a hi/lo pair completed; adds from here keep the anchor. */
  anchor?: number | undefined;
  /** A bare `lui` waiting for its low half. */
  luiOnly: boolean;
}

/** Mine one function's decoded instructions. */
export function mineFunctionWitnesses(
  insns: DecodedInsn[],
  functionName: string,
  containerId: string,
): AccessWitness[] {
  const witnesses: AccessWitness[] = [];
  const labels = new Set<number>();
  for (const insn of insns) {
    if (insn.target !== undefined) labels.add(insn.target);
  }

  let regs = new Map<number, TrackedValue>();
  const record = (witness: AccessWitness) => {
    const offset = witness.address - witness.anchor;
    if (offset >= 0 && offset <= MAX_ANCHOR_OFFSET) witnesses.push(witness);
  };

  for (const insn of insns) {
    /* A join point can arrive with different values per predecessor; the
     * tracker is per straight-line run only. */
    if (labels.has(insn.vram)) regs = new Map();

    const base = regs.get(insn.rs);
    const write = (register: number, value: TrackedValue | undefined) => {
      if (register === 0) return;
      if (value) regs.set(register, value);
      else regs.delete(register);
    };

    switch (insn.op) {
      case "lui":
        write(insn.rt, { value: (insn.uimm << 16) >>> 0, luiOnly: true });
        continue;
      case "addiu": case "addi": {
        if (!base) { write(insn.rt, undefined); continue; }
        const value = (base.value + insn.simm) >>> 0;
        if (base.luiOnly) {
          /* The %lo half: this completes a materialization. */
          write(insn.rt, { value, anchor: value, luiOnly: false });
        } else if (base.anchor !== undefined) {
          write(insn.rt, { value, anchor: base.anchor, luiOnly: false });
          record({ functionName, containerId, vram: insn.vram, kind: "add", address: value, anchor: base.anchor });
        } else {
          write(insn.rt, { value, luiOnly: false });
        }
        continue;
      }
      case "ori": {
        if (!base) { write(insn.rt, undefined); continue; }
        const value = (base.value | insn.uimm) >>> 0;
        write(insn.rt, base.luiOnly ? { value, anchor: value, luiOnly: false } : { ...base, value, luiOnly: false });
        continue;
      }
      case "addu": {
        const left = regs.get(insn.rs);
        const right = regs.get(insn.rt);
        if (left && right) {
          const value = (left.value + right.value) >>> 0;
          const anchor = left.anchor ?? right.anchor;
          write(insn.rd, { value, anchor, luiOnly: false });
          if (anchor !== undefined) {
            record({ functionName, containerId, vram: insn.vram, kind: "add", address: value, anchor });
          }
        } else {
          write(insn.rd, undefined);
        }
        continue;
      }
      default:
        break;
    }

    if (isLoad(insn.op) || isStore(insn.op)) {
      if (base && !Number.isNaN(base.value)) {
        const address = (base.value + insn.simm) >>> 0;
        /* A luiOnly base means the memory operand itself carries the %lo:
         * the whole address is the anchor. */
        const anchor = base.luiOnly ? address : base.anchor;
        if (anchor !== undefined) {
          record({
            functionName, containerId, vram: insn.vram,
            kind: isStore(insn.op) ? "store" : "load",
            address, anchor,
            width: loadWidth(insn.op),
            signed: isLoad(insn.op) ? loadSigned(insn.op) : undefined,
          });
        }
      }
      if (isLoad(insn.op)) regs.delete(insn.rt);
      continue;
    }

    /* Anything else that defines a register drops its tracking; anything
     * whose defs are unknown (calls, unknown words) drops everything. */
    if (insn.op === "jal" || insn.op === "jalr" || insn.op === "unknown") {
      regs = new Map();
      continue;
    }
    if (isBranch(insn.op) || insn.op === "j" || insn.op === "jr" || insn.op === "nop") continue;
    /* Remaining ALU forms define rd or rt. */
    regs.delete(insn.rd);
    regs.delete(insn.rt);
  }

  return witnesses;
}

function mineContainer(container: Container, index: SymbolIndex): AccessIndex {
  const image = readFileSync(containerTargetPath(container));
  const witnesses: AccessWitness[] = [];
  for (const span of loadFunctionSpans(container)) {
    const rom = vramToRom(container, span.vram);
    const bytes = image.subarray(rom, rom + span.size);
    const insns = decodeBytes(bytes, span.vram);
    for (const witness of mineFunctionWitnesses(insns, span.name, container.id)) {
      /* Only anchors the symbol tables know exactly are witnesses. */
      const resolved = resolveAddress(index, witness.anchor);
      if (!resolved || resolved.offset !== 0) continue;
      witnesses.push({ ...witness, anchorSymbol: resolved.symbol });
    }
  }
  return { schemaVersion: ACCESS_INDEX_SCHEMA_VERSION, containerId: container.id, witnesses };
}

/**
 * The access index for one container, cached under `build/` with full
 * provenance: the container's image, its splat config, and its symbol tables
 * all invalidate it, as does this tool's own code.
 */
export function ensureAccessIndex(container: Container): EnsuredArtifact<AccessIndex> {
  const artifactPath = join(ROOT, "build/matchingReconstruction/access-index", `${container.id}.json`);
  return ensureArtifact<AccessIndex>({
    artifactPath,
    label: `access index for ${container.id}`,
    functionName: container.id,
    inputs: {
      files: [
        container.targetPath,
        container.paths.splat,
        container.paths.symbolAddrs,
        container.paths.undefinedSyms,
        container.paths.undefinedFuncs,
      ],
      values: { schemaVersion: ACCESS_INDEX_SCHEMA_VERSION },
      implementation: [
        "tools/agent/matching-reconstruction/access-index.ts",
        "tools/agent/matching-reconstruction/decode.ts",
      ],
    },
    costHint: "decodes every function in the container",
    produce: (provenance) => {
      const index = mineContainer(container, loadSymbolIndex(container));
      writeStableJson(artifactPath, stamped(index, provenance));
      return index;
    },
    read: (stored) => {
      const value = stored as AccessIndex;
      if (value.schemaVersion !== ACCESS_INDEX_SCHEMA_VERSION || !Array.isArray(value.witnesses)) {
        throw new Error("stored access index has the wrong shape");
      }
      return value;
    },
  });
}

/**
 * Origin alternatives for a scan of `count` records of `stride` bytes starting
 * at `base`, run by a function in `targetContainer`.
 *
 * The scanned window need not start at the table's first record: the original
 * loop may visit records [k, k + count) of a table whose base sits `k` strides
 * earlier. So candidate table bases are `base - k*stride` for small `k`, and
 * each needs its own independent evidence — an exact label there, or a
 * witnessed access family reaching it. Embedded parents come from functions
 * whose original code explicitly computed anchor + offset into the table's
 * range; a constant address difference alone never qualifies (plan §6 C2).
 *
 * The namespace rule (plan §4 A2): a witness from another container only
 * counts when the addresses live in storage both containers share — an
 * address inside any overlay's own range is private to that overlay.
 */
export function deriveOrigins(
  targetContainer: Container,
  targetFunction: string,
  base: number,
  stride: number,
  count: number,
  extent: number,
  indexes: AccessIndex[],
): { origins: OriginAlternative[]; notes: string[] } {
  const origins: OriginAlternative[] = [];
  const notes: string[] = [];
  const containers = loadContainers();
  const overlaysCovering = (address: number) =>
    containersCovering(address, containers).filter((container) => container.kind === "overlay");
  const shared = overlaysCovering(base).length === 0;

  /** Witnesses usable for this target, grouped by anchor. */
  const usable: AccessWitness[] = [];
  for (const index of indexes) {
    for (const witness of index.witnesses) {
      if (!witness.anchorSymbol) continue;
      /* The scanned function witnessing itself is not independent evidence. */
      if (witness.functionName === targetFunction) continue;
      const sameContainer = witness.containerId === targetContainer.id;
      const anchorShared = overlaysCovering(witness.anchor).length === 0;
      if (!sameContainer && !(shared && anchorShared)) continue;
      usable.push(witness);
    }
  }

  const symbolIndex = loadSymbolIndex(targetContainer);
  const MAX_START = 8;

  for (let startIndex = 0; startIndex <= MAX_START; startIndex++) {
    const tableBase = base - startIndex * stride;
    if (tableBase <= 0) break;

    const atBase = resolveAddress(symbolIndex, tableBase);
    const labelled = atBase !== null && atBase.offset === 0;
    /* A non-zero start needs positive evidence that the table begins earlier:
     * an exact label there, or a witnessed access at exactly that address. */
    const witnessedBase = usable.some((witness) => witness.address === tableBase && witness.anchor < tableBase);
    if (startIndex > 0 && !labelled && !witnessedBase) continue;

    if (labelled) {
      origins.push({
        kind: "standalone",
        symbol: atBase!.symbol,
        startIndex,
        evidence: [
          `symbol tables name ${atBase!.symbol} at 0x${tableBase.toString(16)}` +
          (startIndex > 0 ? `; the scan starts at record ${startIndex}` : ""),
        ],
      });
    } else if (startIndex === 0) {
      notes.push(`no exact label at 0x${tableBase.toString(16)}; the standalone origin is unavailable`);
    }

    const families = new Map<string, AccessWitness[]>();
    for (const witness of usable) {
      if (witness.anchor >= tableBase || witness.address < tableBase || witness.address >= base + extent) continue;
      const key = `${witness.anchorSymbol}@${witness.anchor}`;
      families.set(key, [...(families.get(key) ?? []), witness]);
    }

    for (const family of [...families.values()].sort((a, b) => a[0]!.anchor - b[0]!.anchor)) {
      const baseWitness = family.find((witness) => witness.address === tableBase);
      /* A non-zero start additionally needs the family to witness the table's
       * own base, or the earlier records are an invention. */
      if (startIndex > 0 && !baseWitness) continue;
      const exemplar = baseWitness ?? family[0]!;
      origins.push({
        kind: "embedded",
        parentSymbol: exemplar.anchorSymbol!,
        parentAddress: exemplar.anchor,
        offset: tableBase - exemplar.anchor,
        startIndex,
        evidence: [
          `${family.length} witness(es), e.g. ${exemplar.functionName} at 0x${exemplar.vram.toString(16)} ` +
          `computes ${exemplar.anchorSymbol} + 0x${(exemplar.address - exemplar.anchor).toString(16)} (${exemplar.kind})` +
          (startIndex > 0 ? `; the scan starts at record ${startIndex}` : ""),
        ],
      });
    }
  }

  return { origins, notes };
}
