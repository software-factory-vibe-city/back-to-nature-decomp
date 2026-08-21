/**
 * overlayReferences.ts — what overlay code reaches, and where.
 *
 * Deliverable 2 of plans/overlay-decompilation-enablement.md rests on one
 * observation: `jal` targets are absolute, so the overlay-to-EXE call graph can
 * be recovered before any overlay load address is known. That makes this the
 * first payoff of the container work and the input to corrected liveness.
 *
 * Every consumer must range-check before counting. Embedded data words whose
 * top six bits happen to be opcode 3 decode as `jal` to addresses like
 * 0x8FF40000 that no PS1 ever executes; the measured floor is around 1% of all
 * `jal`-shaped words, concentrated in the small members.
 */

import { findLuiPairs, isValidRamAddress, jalTarget } from "./mips.js";
import { codeMembers, loadManifest, readMemberBytes, type OverlayManifest } from "./overlayManifest.js";
import { loadPsxExeInfo } from "./psxExeInfo.js";

export interface ReferenceCount {
  /** Number of referencing sites across all members. */
  sites: number;
  /** Container ids that reference it. */
  members: string[];
}

export interface MemberReferenceSummary {
  id: string;
  size: number;
  /** Distinct PS-X EXE addresses this member calls. */
  exeTargets: number;
  /** `jal` sites into the PS-X EXE. */
  exeCallSites: number;
  /** `jal` sites to addresses outside the EXE image — the member's own slot. */
  selfCallSites: number;
  /** `jal`-shaped words rejected by the RAM-range check. */
  rejectedJalWords: number;
  /** Self-call targets bucketed by their top 16 bits, the slot evidence. */
  slotBuckets: Record<string, number>;
}

export interface OverlayReferenceScan {
  /** PS-X EXE entry points reached by `jal` from overlay code. */
  exeCallTargets: Map<number, ReferenceCount>;
  /** `jal` targets in valid RAM but outside the EXE image: overlay slot space. */
  slotCallTargets: Map<number, ReferenceCount>;
  /** Literal 32-bit words that are valid PS1 RAM addresses — data-level references. */
  literalReferences: Map<number, ReferenceCount>;
  /** Addresses reconstructed from `lui` + low-half pairs, the RAM-map input. */
  resolvedAddresses: Map<number, ReferenceCount>;
  perMember: MemberReferenceSummary[];
  exeImage: { start: number; end: number };
  totalRejectedJalWords: number;
}

function bump(map: Map<number, ReferenceCount>, address: number, member: string): void {
  const entry = map.get(address);
  if (entry) {
    entry.sites++;
    if (!entry.members.includes(member)) entry.members.push(member);
  } else {
    map.set(address, { sites: 1, members: [member] });
  }
}

export interface MemberBytes {
  id: string;
  size: number;
  bytes: Buffer;
}

/**
 * The scan itself, over bytes already in hand. Separated from the IO so it can
 * be tested against synthetic members whose reference structure is known.
 */
export function scanMembers(
  members: readonly MemberBytes[],
  exeImage: { start: number; end: number }
): OverlayReferenceScan {
  const scan: OverlayReferenceScan = {
    exeCallTargets: new Map(),
    slotCallTargets: new Map(),
    literalReferences: new Map(),
    resolvedAddresses: new Map(),
    perMember: [],
    exeImage,
    totalRejectedJalWords: 0,
  };

  for (const member of members) {
    const bytes = member.bytes;
    const exeTargets = new Set<number>();
    let exeCallSites = 0;
    let selfCallSites = 0;
    let rejectedJalWords = 0;
    const slotBuckets: Record<string, number> = {};

    for (let offset = 0; offset + 4 <= bytes.length; offset += 4) {
      const word = bytes.readUInt32LE(offset);

      /* The overlay's own PC is unknown until the base is solved, but every PS1
         code address is in KSEG0, so the top nibble is fixed at 0x8. */
      const target = jalTarget(word, 0x80000000);
      if (target !== null) {
        if (!isValidRamAddress(target)) {
          rejectedJalWords++;
        } else if (target >= exeImage.start && target < exeImage.end) {
          exeTargets.add(target);
          exeCallSites++;
          bump(scan.exeCallTargets, target, member.id);
        } else {
          selfCallSites++;
          const bucket = `0x${(target >>> 16).toString(16).padStart(4, "0")}`;
          slotBuckets[bucket] = (slotBuckets[bucket] ?? 0) + 1;
          bump(scan.slotCallTargets, target, member.id);
        }
      }

      if (isValidRamAddress(word)) bump(scan.literalReferences, word, member.id);
    }

    for (const pair of findLuiPairs(bytes)) {
      if (isValidRamAddress(pair.address)) bump(scan.resolvedAddresses, pair.address, member.id);
    }

    scan.totalRejectedJalWords += rejectedJalWords;
    scan.perMember.push({
      id: member.id,
      size: member.size,
      exeTargets: exeTargets.size,
      exeCallSites,
      selfCallSites,
      rejectedJalWords,
      slotBuckets,
    });
  }

  scan.perMember.sort((a, b) => b.size - a.size);
  return scan;
}

let cached: OverlayReferenceScan | null | undefined;

/**
 * Scan every code member. Returns null when no manifest exists yet, so callers
 * can fall back to EXE-only liveness and say that is what they did.
 */
export function scanOverlayReferences(manifest?: OverlayManifest | null): OverlayReferenceScan | null {
  if (manifest === undefined && cached !== undefined) return cached;
  const resolved = manifest ?? loadManifest();
  if (!resolved) {
    if (manifest === undefined) cached = null;
    return null;
  }

  const exe = loadPsxExeInfo();
  const members = codeMembers(resolved).map((member) => ({
    id: member.id,
    size: member.size,
    bytes: readMemberBytes(resolved, member),
  }));

  const scan = scanMembers(members, { start: exe.loadAddr, end: exe.loadAddr + exe.payloadSize });
  if (manifest === undefined) cached = scan;
  return scan;
}

/**
 * PS-X EXE addresses any overlay references, by call or by stored pointer.
 *
 * This is the set `progress.ts` and `callGraph.ts` must union into their own
 * liveness. Empty when no manifest exists, which makes the fallback to EXE-only
 * liveness a no-op rather than a silent behaviour change.
 */
export function overlayReferencedExeAddresses(): Set<number> {
  const scan = scanOverlayReferences();
  const addresses = new Set<number>();
  if (!scan) return addresses;
  for (const address of scan.exeCallTargets.keys()) addresses.add(address);
  for (const [address, count] of scan.literalReferences) {
    if (address >= scan.exeImage.start && address < scan.exeImage.end && count.sites > 0) {
      addresses.add(address);
    }
  }
  return addresses;
}

/** Is overlay evidence available at all? Consumers report their liveness basis from this. */
export function overlayLivenessAvailable(): boolean {
  return scanOverlayReferences() !== null;
}
