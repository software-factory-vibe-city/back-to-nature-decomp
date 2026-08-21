/**
 * archiveIndex.ts — format detection for a paired index/data archive.
 *
 * A PSX disc holds its overlays in a flat container with a separate index
 * file, and the index format is never documented. Rather than hardcode one
 * game's layout, this module states a small hypothesis set and scores each
 * against invariants that hold for any sector-based container: boundaries
 * inside the data, strictly increasing, sector-aligned, tiling the file.
 *
 * Nothing here knows which game it is reading. A hypothesis wins only by a
 * stated margin; when nothing does, the verdict is `undetermined`, because a
 * plausible default here silently corrupts every artifact downstream of it.
 */

/** CD-ROM Mode 2 Form 1 user-data sector, the alignment unit every PSX archive uses. */
export const SECTOR_SIZE = 2048;

export interface MemberBoundary {
  index: number;
  start: number;
  end: number;
}

/** One scored invariant. `value` is in [0,1]; `detail` explains the number. */
export interface Criterion {
  name: string;
  weight: number;
  value: number;
  detail: string;
}

export interface HypothesisScore {
  id: string;
  description: string;
  /** null when the index cannot be read under this hypothesis at all. */
  members: MemberBoundary[] | null;
  score: number;
  criteria: Criterion[];
  /** Sub-decisions the decode made from direct evidence, e.g. sentinel presence. */
  notes: string[];
}

export type ArchiveIndexVerdict =
  | {
      kind: "resolved";
      format: string;
      description: string;
      members: MemberBoundary[];
      score: number;
      margin: number;
      runnerUp: string | null;
      criteria: Criterion[];
      notes: string[];
      candidates: HypothesisScore[];
    }
  | {
      kind: "undetermined";
      reason: string;
      candidates: HypothesisScore[];
    };

/** A hypothesis wins only above this absolute score. */
export const MIN_SCORE = 0.9;
/** …and only this far clear of the runner-up. */
export const MIN_MARGIN = 0.15;

interface Hypothesis {
  id: string;
  description: string;
  decode(entries: number[], dataSize: number): { members: MemberBoundary[]; notes: string[] } | null;
}

/**
 * Boundaries from a table of start positions.
 *
 * Whether the table carries a trailing sentinel is decided by direct evidence
 * — the final entry equalling the data size — not by competing hypotheses that
 * would differ only in one degenerate zero-length member.
 */
function fromStarts(starts: number[], dataSize: number): { members: MemberBoundary[]; notes: string[] } | null {
  if (starts.length < 2) return null;
  const last = starts[starts.length - 1]!;
  const sentinel = last === dataSize;
  const bounds = sentinel ? starts : [...starts, dataSize];
  const notes = [
    sentinel
      ? `final entry equals the data size (${dataSize}), read as a trailing sentinel: ${bounds.length - 1} members`
      : `final entry (${last}) is not the data size (${dataSize}), read as a start: ${bounds.length - 1} members`,
  ];
  const members: MemberBoundary[] = [];
  for (let i = 0; i + 1 < bounds.length; i++) {
    members.push({ index: i, start: bounds[i]!, end: bounds[i + 1]! });
  }
  return { members, notes };
}

function fromPairs(
  entries: number[],
  scaleStart: number,
  scaleSize: number
): { members: MemberBoundary[]; notes: string[] } | null {
  if (entries.length < 2 || entries.length % 2 !== 0) return null;
  const members: MemberBoundary[] = [];
  for (let i = 0; i * 2 + 1 < entries.length; i++) {
    const start = entries[i * 2]! * scaleStart;
    const size = entries[i * 2 + 1]! * scaleSize;
    members.push({ index: i, start, end: start + size });
  }
  return { members, notes: [`${members.length} (start, size) pairs`] };
}

const HYPOTHESES: Hypothesis[] = [
  {
    id: "u32-offset-table",
    description: "little-endian u32 byte offsets, one per member, trailing sentinel if the last equals the file size",
    decode: (entries, dataSize) => fromStarts(entries, dataSize),
  },
  {
    id: "u32-sector-table",
    description: "little-endian u32 sector numbers, one per member, trailing sentinel if the last equals the file size",
    decode: (entries, dataSize) => fromStarts(entries.map((e) => e * SECTOR_SIZE), dataSize),
  },
  {
    id: "u32-offset-size-pairs",
    description: "little-endian (byte offset, byte size) u32 pairs",
    decode: (entries) => fromPairs(entries, 1, 1),
  },
  {
    id: "u32-sector-size-pairs",
    description: "little-endian (sector number, byte size) u32 pairs",
    decode: (entries) => fromPairs(entries, SECTOR_SIZE, 1),
  },
  {
    id: "u32-sector-sectorcount-pairs",
    description: "little-endian (sector number, sector count) u32 pairs",
    decode: (entries) => fromPairs(entries, SECTOR_SIZE, SECTOR_SIZE),
  },
];

function fraction(matching: number, total: number): number {
  return total === 0 ? 0 : matching / total;
}

function scoreMembers(members: MemberBoundary[], dataSize: number): Criterion[] {
  const n = members.length;

  const inRange = members.filter((m) => m.start >= 0 && m.start <= m.end && m.end <= dataSize).length;
  const increasing = members.slice(1).filter((m, i) => m.start > members[i]!.start).length;
  const aligned = members.filter((m) => m.start % SECTOR_SIZE === 0).length;
  const nonEmpty = members.filter((m) => m.end > m.start).length;

  const contiguous = members.every((m, i) => (i === 0 ? m.start === 0 : m.start === members[i - 1]!.end));
  const tiles = contiguous && n > 0 && members[n - 1]!.end === dataSize;
  const endsAtDataSize = n > 0 && members[n - 1]!.end === dataSize;

  return [
    {
      name: "inRange",
      weight: 0.25,
      value: fraction(inRange, n),
      detail: `${inRange}/${n} members satisfy 0 <= start <= end <= ${dataSize}`,
    },
    {
      name: "strictlyIncreasing",
      weight: 0.2,
      value: fraction(increasing, Math.max(n - 1, 0)),
      detail: `${increasing}/${Math.max(n - 1, 0)} consecutive starts increase`,
    },
    {
      name: "sectorAligned",
      weight: 0.15,
      value: fraction(aligned, n),
      detail: `${aligned}/${n} starts are ${SECTOR_SIZE}-byte aligned`,
    },
    {
      name: "nonEmpty",
      weight: 0.15,
      value: fraction(nonEmpty, n),
      detail: `${nonEmpty}/${n} members have a positive size`,
    },
    {
      name: "tilesExactly",
      weight: 0.15,
      value: tiles ? 1 : 0,
      detail: tiles ? "members tile the file with no gap or overlap" : "members do not tile the file",
    },
    {
      name: "endsAtDataSize",
      weight: 0.1,
      value: endsAtDataSize ? 1 : 0,
      detail: endsAtDataSize ? `last member ends at ${dataSize}` : `last member does not end at ${dataSize}`,
    },
  ];
}

/** Little-endian u32 words of the index file; null when the length is not a multiple of 4. */
export function readIndexEntries(index: Uint8Array): number[] | null {
  if (index.length === 0 || index.length % 4 !== 0) return null;
  const view = new DataView(index.buffer, index.byteOffset, index.byteLength);
  const entries: number[] = [];
  for (let i = 0; i < index.length; i += 4) entries.push(view.getUint32(i, true));
  return entries;
}

/**
 * Score every hypothesis against the index/data pair and pick a winner, or
 * report `undetermined`. `dataSize` is the length of the archive's data file.
 */
export function detectArchiveIndex(index: Uint8Array, dataSize: number): ArchiveIndexVerdict {
  const entries = readIndexEntries(index);
  if (!entries) {
    return {
      kind: "undetermined",
      reason: `index length ${index.length} is not a positive multiple of 4, so no u32 table reading applies`,
      candidates: [],
    };
  }

  const candidates: HypothesisScore[] = HYPOTHESES.map((h) => {
    const decoded = h.decode(entries, dataSize);
    if (!decoded) {
      return { id: h.id, description: h.description, members: null, score: 0, criteria: [], notes: ["does not decode"] };
    }
    const criteria = scoreMembers(decoded.members, dataSize);
    const score = criteria.reduce((sum, c) => sum + c.weight * c.value, 0);
    return { id: h.id, description: h.description, members: decoded.members, score, criteria, notes: decoded.notes };
  }).sort((a, b) => b.score - a.score);

  const best = candidates[0];
  if (!best || !best.members) {
    return { kind: "undetermined", reason: "no hypothesis decoded the index", candidates };
  }
  const runnerUp = candidates[1];
  const margin = best.score - (runnerUp?.score ?? 0);

  if (best.score < MIN_SCORE) {
    return {
      kind: "undetermined",
      reason: `best hypothesis ${best.id} scores ${best.score.toFixed(3)}, below the ${MIN_SCORE} bar`,
      candidates,
    };
  }
  if (margin < MIN_MARGIN) {
    return {
      kind: "undetermined",
      reason:
        `${best.id} (${best.score.toFixed(3)}) does not clear ${runnerUp?.id ?? "the runner-up"} ` +
        `(${(runnerUp?.score ?? 0).toFixed(3)}) by the required ${MIN_MARGIN} margin`,
      candidates,
    };
  }

  return {
    kind: "resolved",
    format: best.id,
    description: best.description,
    members: best.members,
    score: best.score,
    margin,
    runnerUp: runnerUp?.id ?? null,
    criteria: best.criteria,
    notes: best.notes,
    candidates,
  };
}
