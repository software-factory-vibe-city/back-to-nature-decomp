import type { AssetParser, DecodedOutput, ParsedAsset } from "../registry.ts";

/** xa-v1: CD-ROM XA mode 2 sector chains (Sony CD-ROM XA specification).
 *
 * Evidence basis: the published CD-ROM XA sector layout — a 12-byte sync
 * (00 FF x10 00), BCD minute/second/frame header with mode byte 2, an
 * 8-byte subheader stored twice, then 2048 (form 1) or 2324 (form 2) user
 * bytes followed by EDC/ECC. The headerless 2336-byte form (sync/header
 * stripped by some extraction tools) is accepted only when at least two
 * consecutive 2336-stride sectors validate, because one duplicated
 * subheader pattern is not structural evidence on its own.
 *
 * Observed input arithmetic (extracted/iso/str/*.xa sizes): each file is
 * N x 2352 + a sub-2352 remainder, consistent with raw-sector dumps padded
 * to a 2048-byte boundary; a pure unstripped 2336 dump is impossible for
 * 01.xa (remainder 2784 > 2336). Both forms are probed so deterministic
 * discovery decides on the actual bytes.
 *
 * Not established by this parser: disc LBAs/sector physics, STR frame
 * semantics inside form 1 payloads, and PCM synthesis from XA ADPCM sound
 * groups (raw ADPCM payloads are preserved losslessly instead).
 */

const SYNC = [0x00, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x00] as const;
const RAW_STRIDE = 2352;
const STRIPPED_STRIDE = 2336;
const FORM1_PAYLOAD = 2048;
const FORM2_PAYLOAD = 2324;
/** XA submode bits (CD-ROM XA): EOR 0x01, VIDEO 0x02, AUDIO 0x04,
 * DATA 0x08, TRIGGER 0x10, FORM2 0x20, REALTIME 0x40, EOF 0x80. */
const SUBMODE_AUDIO = 0x04;
const SUBMODE_DATA = 0x08;
const SUBMODE_FORM2 = 0x20;
/** XA audio codingInfo: bits 4-5 select 37800/18900 Hz and mono/stereo,
 * bit 6 marks emphasis; the remaining bits are reserved zero. */
const CODING_RATES: Array<{ sampleRateHz: number; stereo: boolean }> = [
  { sampleRateHz: 37800, stereo: false },
  { sampleRateHz: 37800, stereo: true },
  { sampleRateHz: 18900, stereo: false },
  { sampleRateHz: 18900, stereo: true },
];

export interface XaSubheader { file: number; channel: number; submode: number; coding: number }
interface XaSector extends XaSubheader { payloadOffset: number; payloadSize: number }
export interface XaLayout { form: "raw-2352" | "stripped-2336"; stride: number; sectors: XaSector[]; consumed: number }

function duplicatedSubheader(bytes: Buffer, at: number): XaSubheader | undefined {
  if (at < 0 || at + 8 > bytes.length) return undefined;
  const sub: XaSubheader = { file: bytes[at]!, channel: bytes[at + 1]!, submode: bytes[at + 2]!, coding: bytes[at + 3]! };
  if (bytes[at + 4] !== sub.file || bytes[at + 5] !== sub.channel || bytes[at + 6] !== sub.submode || bytes[at + 7] !== sub.coding) return undefined;
  return sub;
}

function bcd(value: number): boolean { return (value & 0x0f) <= 9 && (value >>> 4) <= 9; }

function validSubheader(sub: XaSubheader): boolean {
  // Some content kind (audio/video/data) must be declared; EOR-only padding
  // sectors are indistinguishable from zero runs and are not accepted.
  if ((sub.submode & 0x0e) === 0) return false;
  if (sub.submode & SUBMODE_AUDIO) {
    // XA audio is always form 2, never mixed with the data bit, and its
    // codingInfo carries only rate/stereo/emphasis bits.
    return (sub.submode & SUBMODE_FORM2) !== 0 && (sub.submode & SUBMODE_DATA) === 0 &&
      (sub.coding & 0x8f) === 0;
  }
  return sub.coding === 0;
}

function sectorAt(bytes: Buffer, offset: number, form: XaLayout["form"]): XaSector | undefined {
  const stride = form === "raw-2352" ? RAW_STRIDE : STRIPPED_STRIDE;
  if (offset < 0 || offset + stride > bytes.length) return undefined;
  if (form === "raw-2352") {
    for (let i = 0; i < SYNC.length; i++) if (bytes[offset + i] !== SYNC[i]) return undefined;
    if (bytes[offset + 15] !== 2) return undefined;
    const minute = bytes[offset + 12]!, second = bytes[offset + 13]!, frame = bytes[offset + 14]!;
    if (!bcd(minute) || !bcd(second) || !bcd(frame) || second >= 0x60 || frame >= 0x75) return undefined;
  }
  const sub = duplicatedSubheader(bytes, form === "raw-2352" ? offset + 16 : offset);
  if (!sub || !validSubheader(sub)) return undefined;
  const form2 = (sub.submode & SUBMODE_FORM2) !== 0;
  return { ...sub, payloadOffset: offset + (form === "raw-2352" ? 24 : 8), payloadSize: form2 ? FORM2_PAYLOAD : FORM1_PAYLOAD };
}

function detectForm(bytes: Buffer, offset: number): XaLayout["form"] | undefined {
  if (sectorAt(bytes, offset, "raw-2352")) return "raw-2352";
  if (sectorAt(bytes, offset, "stripped-2336")) return "stripped-2336";
  return undefined;
}

export function walkXa(bytes: Buffer, offset: number): XaLayout {
  const form = detectForm(bytes, offset);
  if (!form) throw new Error("Not a CD-ROM XA mode 2 sector chain");
  const stride = form === "raw-2352" ? RAW_STRIDE : STRIPPED_STRIDE;
  const sectors: XaSector[] = [];
  for (let at = offset; at + stride <= bytes.length; at += stride) {
    const sector = sectorAt(bytes, at, form);
    if (!sector) break;
    sectors.push(sector);
  }
  // Headerless 2336 sectors carry no sync/header evidence, so a single
  // duplicated-subheader pattern is not structural proof of a chain.
  if (!sectors.length || (form === "stripped-2336" && sectors.length < 2)) {
    throw new Error("Not a CD-ROM XA sector chain: headerless form requires at least two consecutive sectors");
  }
  return { form, stride, sectors, consumed: sectors.length * stride };
}

export function parseXa(bytes: Buffer, offset: number): ParsedAsset {
  if (offset < 0 || offset >= bytes.length) throw new Error("Invalid XA resource offset");
  const layout = walkXa(bytes, offset);
  // Interior alignment is rejected when the bytes immediately before the
  // chain already form a valid sector of the same form: the resource starts
  // at the earlier sector, not here. This keeps every standalone stream and
  // embedded chain to exactly one match at its first sector.
  if (offset >= layout.stride && sectorAt(bytes, offset - layout.stride, layout.form)) {
    throw new Error("XA chain begins after a valid sector; interior alignment is not a resource start");
  }
  const audio = layout.sectors.filter(sector => (sector.submode & SUBMODE_AUDIO) !== 0);
  const distinct = (values: number[]): number[] => [...new Set(values)].sort((a, b) => a - b);
  return { length: layout.consumed, metadata: {
    form: layout.form,
    stride: layout.stride,
    sectors: layout.sectors.length,
    audioSectors: audio.length,
    dataSectors: layout.sectors.length - audio.length,
    channels: distinct(audio.map(sector => sector.channel)),
    fileNumbers: distinct(layout.sectors.map(sector => sector.file)),
    trailingBytes: bytes.length - offset - layout.consumed,
  } };
}

function xaVariants(bytes: Buffer): Array<Record<string, unknown>> {
  const layout = walkXa(bytes, 0);
  const audio = layout.sectors.filter(sector => (sector.submode & SUBMODE_AUDIO) !== 0);
  const variants: Array<Record<string, unknown>> = [...new Set(audio.map(sector => sector.channel))].sort((a, b) => a - b)
    .map(channel => ({ kind: "audio", channel }));
  if (audio.length !== layout.sectors.length) variants.push({ kind: "data" });
  return variants;
}

function xaDecode(bytes: Buffer, variant: Record<string, unknown>, maxBytes: number): DecodedOutput {
  const layout = walkXa(bytes, 0);
  if (layout.consumed !== bytes.length) throw new Error("XA decode requires the exact sector extent");
  const audio = layout.sectors.filter(sector => (sector.submode & SUBMODE_AUDIO) !== 0);
  let selected: XaSector[], kind: string, extension: string;
  if (variant.kind === "audio") {
    const channel = variant.channel;
    if (typeof channel !== "number" || !Number.isInteger(channel) || channel < 0 || channel > 255) throw new Error("Invalid XA audio channel variant");
    selected = audio.filter(sector => sector.channel === channel);
    if (!selected.length) throw new Error("No XA audio sectors for the requested channel");
    kind = "xa-audio-adpcm";
    extension = "adpcm";
  } else if (variant.kind === "data") {
    selected = layout.sectors.filter(sector => (sector.submode & SUBMODE_AUDIO) === 0);
    if (!selected.length) throw new Error("No XA form 1 data sectors");
    kind = "xa-data";
    extension = "bin";
  } else throw new Error("Unknown XA decode variant");
  const payloadSize = selected[0]!.payloadSize;
  const total = selected.length * payloadSize;
  if (total > maxBytes) throw new Error("budget-exhausted: XA decoded bytes");
  const output = Buffer.alloc(total);
  let at = 0;
  for (const sector of selected) {
    bytes.copy(output, at, sector.payloadOffset, sector.payloadOffset + payloadSize);
    at += payloadSize;
  }
  const codings = [...new Set(selected.map(sector => sector.coding))].sort((a, b) => a - b);
  const metadata: Record<string, unknown> = {
    form: layout.form, stride: layout.stride, sectors: selected.length, payloadBytes: payloadSize, codings,
  };
  if (kind === "xa-audio-adpcm") {
    metadata.channel = variant.channel;
    metadata.adpcm = "raw XA sound groups preserved; PCM synthesis is not performed";
    if (codings.length === 1) {
      const rate = CODING_RATES[(codings[0]! >> 4) & 3]!;
      metadata.sampleRateHz = rate.sampleRateHz;
      metadata.stereo = rate.stereo;
      metadata.emphasis = (codings[0]! & 0x40) !== 0;
    }
  } else metadata.interpretation = "form 1 payload concatenation only; member/frame semantics unresolved";
  return { kind, extension, stage: "decoding", bytes: output, metadata };
}

export const XA_PARSER: AssetParser = {
  id: "xa-v1",
  format: "XA",
  version: 1,
  category: "video",
  rawExtension: "xa",
  probe: (bytes, offset) => {
    if (offset < 0 || offset + 24 > bytes.length) return false;
    // Raw mode 2: the 8-byte subheader duplication is a cheap filter; the
    // sync/mode check runs only after it hits.
    const rawSub = duplicatedSubheader(bytes, offset + 16);
    if (rawSub) {
      let sync = true;
      for (let i = 0; i < SYNC.length; i++) if (bytes[offset + i] !== SYNC[i]) { sync = false; break; }
      if (sync && bytes[offset + 15] === 2 && validSubheader(rawSub)) return true;
    }
    const stripped = duplicatedSubheader(bytes, offset);
    return stripped !== undefined && validSubheader(stripped);
  },
  parse: parseXa,
  variants: xaVariants,
  decode: (bytes, variant, maximum) => [xaDecode(bytes, variant, maximum)],
};
