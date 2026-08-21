/**
 * memberClassification.ts — does an archive member hold code, and on what evidence?
 *
 * The question is decided against a *reference body of known code from the same
 * project* — the main executable's own `.text` — rather than against thresholds
 * calibrated on one game's archive. Return density and decodability are
 * properties of compiled MIPS, and the reference supplies what those properties
 * measure for this compiler and this codebase. A different game brings its own
 * reference with it.
 *
 * Where the code sits inside a member is not decided here. That is a toolchain
 * question, and it is answered by the strategy registry in
 * tools/lib/overlayStrategies.ts, which runs only the strategies the detected
 * toolchain profile supports.
 *
 * Three verdicts. A member whose measurements fall between the reference and
 * nothing is `undetermined`, which is a real outcome and not a shrug.
 */

import type { MemberClassification } from "./overlayManifest.js";
import { isDecodableInstruction, isJrRa, isStackPrologue, isValidRamAddress, jalTarget } from "./mips.js";
import { deriveLayoutByStrategy, type CodeSpan } from "./overlayStrategies.js";
import { UNKNOWN_TOOLCHAIN, type ToolchainProfile } from "./toolchainProfile.js";

/**
 * Known-compiled-code measurements, taken from a body this project already
 * knows is code.
 */
export interface CodeReference {
  /** Where the measurement came from, for the evidence line. */
  source: string;
  returnsPerKb: number;
  decodeRatio: number;
}

/*
 * The two tolerances, and what each is a statement about.
 *
 * Neither is calibrated on any particular archive; both say something about
 * compiled code in general, measured relative to the reference body.
 */
/** Real code disassembles completely. A couple of words of inline data is the
 *  most a code region should fail to decode. */
export const DECODE_TOLERANCE = 0.02;
/** A member whose average function is more than this many times the reference
 *  body's is not the same kind of artifact. Four is generous: it admits a body
 *  of unusually large functions and still excludes data holding a stray return. */
export const MAX_FUNCTION_SIZE_RATIO = 4;
/** Below this many words a "code region" is too small to measure a density on. */
export const MIN_CODE_WORDS = 16;

export interface Measurement {
  words: number;
  decodable: number;
  returns: number;
  prologues: number;
  jalInRam: number;
  jalTotal: number;
  kilobytes: number;
}

export function measureMemberBytes(bytes: Buffer, from = 0, to = bytes.length): Measurement {
  const start = Math.max(0, from);
  const end = Math.min(bytes.length, to);
  let decodable = 0;
  let returns = 0;
  let prologues = 0;
  let jalInRam = 0;
  let jalTotal = 0;
  let words = 0;

  for (let offset = start; offset + 4 <= end; offset += 4) {
    const word = bytes.readUInt32LE(offset);
    words++;
    if (isDecodableInstruction(word)) decodable++;
    if (isJrRa(word)) returns++;
    if (isStackPrologue(word)) prologues++;
    /* The PC's top nibble is unknown before the base is solved; every PS1 code
       address is in KSEG0, so 0x8 is the only nibble worth testing here. */
    const target = jalTarget(word, 0x80000000);
    if (target !== null) {
      jalTotal++;
      if (isValidRamAddress(target)) jalInRam++;
    }
  }

  return { words, decodable, returns, prologues, jalInRam, jalTotal, kilobytes: (end - start) / 1024 };
}

/** Measure a reference from a body already known to be code. */
export function measureCodeReference(bytes: Buffer, from: number, to: number, source: string): CodeReference {
  const m = measureMemberBytes(bytes, from, to);
  return {
    source,
    returnsPerKb: m.kilobytes === 0 ? 0 : m.returns / m.kilobytes,
    decodeRatio: m.words === 0 ? 0 : m.decodable / m.words,
  };
}

interface MagicHit {
  format: string;
  detail: string;
}

/** Formats that declare themselves in their first words. */
function detectMagic(bytes: Buffer): MagicHit | null {
  if (bytes.length < 8) return null;
  const w0 = bytes.readUInt32LE(0);
  const w1 = bytes.readUInt32LE(4);

  if (w0 === 0x56414270) return { format: "VAB", detail: `VABp header, version ${w1}` };
  if (w0 === 0x70474156) return { format: "VAG", detail: "VAGp header" };
  if (w0 === 0x53455170) return { format: "SEQ", detail: "pQES header" };
  if (w0 === 0x00000041) return { format: "TMD", detail: "TMD id 0x41" };
  if (w0 === 0x00000010 && (w1 & ~0x0000000b) === 0) {
    return { format: "TIM", detail: `TIM id 0x10, flags 0x${w1.toString(16)}` };
  }
  const mdec = detectMdecFrames(bytes);
  if (mdec) return mdec;
  return null;
}

/**
 * Sector-aligned MDEC video frames.
 *
 * A v2/v3 STR frame chunk carries the bitstream magic 0x3800 in its header, at
 * a fixed offset, in every chunk. Requiring it at several consecutive sector
 * boundaries is what separates a video stream from a data word that happens to
 * be 0x3800.
 */
function detectMdecFrames(bytes: Buffer): MagicHit | null {
  const SECTOR = 2048;
  const MAGIC_OFFSET = 6;
  const probes = Math.min(8, Math.floor(bytes.length / SECTOR));
  if (probes < 4) return null;
  let hits = 0;
  for (let i = 0; i < probes; i++) {
    const at = i * SECTOR + MAGIC_OFFSET;
    if (at + 2 > bytes.length) break;
    if (bytes.readUInt16LE(at) === 0x3800) hits++;
  }
  return hits === probes
    ? { format: "MDEC", detail: `bitstream magic 0x3800 at every one of ${probes} probed sector headers` }
    : null;
}

/**
 * A count followed by that many absolute PS1 RAM pointers.
 *
 * Recognised as a format so a member that is a dispatch table rather than an
 * overlay is classified on its structure instead of on its call count.
 */
function detectPointerTable(bytes: Buffer): MagicHit | null {
  if (bytes.length < 12) return null;
  const count = bytes.readUInt32LE(0);
  const available = Math.floor(bytes.length / 4) - 1;
  if (count < 2 || count > available) return null;
  let valid = 0;
  for (let i = 0; i < count; i++) {
    if (isValidRamAddress(bytes.readUInt32LE(4 + i * 4))) valid++;
  }
  if (valid !== count) return null;
  return { format: "pointer-table", detail: `leading count ${count} followed by ${count} valid PS1 RAM pointers` };
}

export interface ClassifyOptions {
  /** Known-code measurements to judge against. Required for a `code` verdict. */
  reference?: CodeReference;
  /** Selects which layout strategies may run. */
  profile?: ToolchainProfile;
}

export function classifyMemberBytes(
  bytes: Buffer,
  leadingWordLabel: string,
  options: ClassifyOptions = {}
): MemberClassification {
  const profile = options.profile ?? UNKNOWN_TOOLCHAIN;
  const whole = measureMemberBytes(bytes);
  const evidence: string[] = [
    `${whole.words} words, ${((whole.decodable / Math.max(whole.words, 1)) * 100).toFixed(1)}% decode as R3000 instructions overall`,
    `${whole.returns} jr ra, ${whole.prologues} stack prologues`,
    `${whole.jalInRam}/${whole.jalTotal} jal-shaped words target valid PS1 RAM`,
  ];

  const magic = detectMagic(bytes);
  const pointerTable = detectPointerTable(bytes);
  if (magic) evidence.push(`magic: ${magic.detail}`);
  if (pointerTable) evidence.push(`structure: ${pointerTable.detail}`);
  if (!magic && !pointerTable) evidence.push("no recognised asset magic in the leading words");
  evidence.push(`leading word ${leadingWordLabel}`);

  /* Where the code is, if any, comes from the strategy registry — which runs
     only what the detected toolchain supports. */
  const consensus = deriveLayoutByStrategy({ id: leadingWordLabel, bytes, exeImage: { start: 0, end: 0 } }, profile);
  evidence.push(...consensus.evidence);

  const spans: CodeSpan[] = consensus.spans.filter((span) => (span.end - span.start) / 4 >= MIN_CODE_WORDS);
  if (spans.length === 0) {
    return {
      verdict: "data",
      format: magic?.format ?? pointerTable?.format ?? null,
      evidence: [...evidence, "no code region of measurable size was found by any applicable strategy"],
    };
  }

  const inSpans = spans.reduce(
    (acc, span) => {
      const m = measureMemberBytes(bytes, span.start, span.end);
      return {
        words: acc.words + m.words,
        decodable: acc.decodable + m.decodable,
        returns: acc.returns + m.returns,
        kilobytes: acc.kilobytes + m.kilobytes,
      };
    },
    { words: 0, decodable: 0, returns: 0, kilobytes: 0 }
  );

  const decodeRatio = inSpans.words === 0 ? 0 : inSpans.decodable / inSpans.words;
  const returnsPerKb = inSpans.kilobytes === 0 ? 0 : inSpans.returns / inSpans.kilobytes;
  evidence.push(
    `within the ${spans.length} code region(s): ${(decodeRatio * 100).toFixed(1)}% decode, ` +
      `${returnsPerKb.toFixed(2)} returns/KB over ${inSpans.kilobytes.toFixed(1)}KB`
  );

  const reference = options.reference;
  if (!reference) {
    return {
      verdict: "undetermined",
      format: magic?.format ?? pointerTable?.format ?? null,
      evidence: [
        ...evidence,
        "undetermined: no reference body of known code was supplied, so these measurements have nothing to be judged against",
      ],
    };
  }

  evidence.push(
    `reference (${reference.source}): ${(reference.decodeRatio * 100).toFixed(1)}% decode, ${reference.returnsPerKb.toFixed(2)} returns/KB`
  );

  const decodeFloor = reference.decodeRatio - DECODE_TOLERANCE;
  const returnFloor = reference.returnsPerKb / MAX_FUNCTION_SIZE_RATIO;
  const decodeOk = decodeRatio >= decodeFloor;
  const returnsOk = returnsPerKb >= returnFloor;

  if (decodeOk && returnsOk) {
    return {
      verdict: "code",
      format: magic ? `mixed (${magic.format} magic collides with the leading word)` : null,
      evidence: [
        ...evidence,
        `code: decode ${(decodeRatio * 100).toFixed(1)}% >= ${(decodeFloor * 100).toFixed(1)}% and ` +
          `${returnsPerKb.toFixed(2)} >= ${returnFloor.toFixed(2)} returns/KB (reference / ${MAX_FUNCTION_SIZE_RATIO})`,
      ],
    };
  }

  return {
    verdict: "undetermined",
    format: magic?.format ?? pointerTable?.format ?? null,
    evidence: [
      ...evidence,
      `undetermined: ${!decodeOk ? `decode ${(decodeRatio * 100).toFixed(1)}% is below ${(decodeFloor * 100).toFixed(1)}%` : ""}` +
        `${!decodeOk && !returnsOk ? " and " : ""}` +
        `${!returnsOk ? `${returnsPerKb.toFixed(2)} returns/KB is below ${returnFloor.toFixed(2)}` : ""}`,
    ],
  };
}
