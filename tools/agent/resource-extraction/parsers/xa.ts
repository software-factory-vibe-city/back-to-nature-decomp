import type { AssetParser, DecodedOutput, ParsedAsset } from "../registry.ts";
import { decodeXaWav, validateXaAudio, xaCoding } from "./xa-audio.ts";

/** CD-ROM XA mode 2 sector chains, parser revision 3.
 * https://psx-spx.consoledev.net/ps1/cdr/cdromformat/
 * Supports raw 2352-byte sectors and 2336-byte sectors with only sync/MSF
 * removed (subheaders MUST remain). Headerless sound-group payloads, including
 * ISO extractions missing sector metadata, cannot establish rate, mono/stereo,
 * bit depth or file/channel interleave and are not guessed from filenames.
 * Audio exports retain ADPCM and add native-rate 16-bit PCM WAV per witnessed
 * file/channel segment. Non-audio payloads are data, not decoded STR/MDEC video.
 * Interleave padding and the terminal untyped EOF sector are preserved but
 * never decoded as audio/data. EDC is validated (zero EDC is permitted for
 * form 2); ECC/EDC repair, nonstandard channel numbers, console resampling
 * and de-emphasis remain unsupported. */
const SYNC = [0x00, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x00] as const;
const RAW_STRIDE = 2352, STRIPPED_STRIDE = 2336;
const SUBMODE_AUDIO = 0x04, SUBMODE_FORM2 = 0x20;

export interface XaSubheader { file: number; channel: number; submode: number; coding: number }
interface XaSector extends XaSubheader { payloadOffset: number; payloadSize: number }
export interface XaLayout { form: "raw-2352" | "stripped-2336"; stride: number; sectors: XaSector[]; consumed: number }
interface AudioStream { file: number; channel: number; segment: number; coding: number; sectors: XaSector[]; ended: boolean }

/** CD-ROM EDC: reflected polynomial D8018001h, zero init/no final XOR. */
export function xaEdc(bytes: Buffer, offset: number, length: number): number {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 || offset + length > bytes.length) throw new Error("Invalid XA EDC extent");
  let crc = 0;
  for (let at = offset; at < offset + length; at++) {
    crc ^= bytes[at]!;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xd8018001 : 0);
  }
  return crc >>> 0;
}

function duplicatedSubheader(bytes: Buffer, at: number): XaSubheader | undefined {
  if (at < 0 || at + 8 > bytes.length) return undefined;
  const sub: XaSubheader = { file: bytes[at]!, channel: bytes[at + 1]!, submode: bytes[at + 2]!, coding: bytes[at + 3]! };
  if (bytes[at + 4] !== sub.file || bytes[at + 5] !== sub.channel || bytes[at + 6] !== sub.submode || bytes[at + 7] !== sub.coding) return undefined;
  return sub;
}
function bcd(value: number): boolean { return (value & 0x0f) <= 9 && (value >>> 4) <= 9; }
function unusedSector(sub: XaSubheader): boolean { return (sub.submode & 0x0e) === 0; }
function terminalSector(sub: XaSubheader): boolean { return unusedSector(sub) && (sub.submode & 0x80) !== 0; }
function validSubheader(sub: XaSubheader): boolean {
  if (sub.channel > 31) return false;
  if (sub.submode & SUBMODE_AUDIO) {
    // CI: bit 0 stereo, bit 2 half rate, bit 4 eight-bit, bit 6 emphasis.
    return (sub.submode & SUBMODE_FORM2) !== 0 && (sub.submode & 0x0a) === 0 && (sub.coding & 0xaa) === 0;
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
  const sector = { ...sub, payloadOffset: offset + (form === "raw-2352" ? 24 : 8), payloadSize: sub.submode & SUBMODE_FORM2 ? 2324 : 2048 };
  const edc = bytes.readUInt32LE(sector.payloadOffset + sector.payloadSize);
  if ((!(sub.submode & SUBMODE_FORM2) || edc !== 0) && edc !== xaEdc(bytes, sector.payloadOffset - 8, 8 + sector.payloadSize)) return undefined;
  if (sub.submode & SUBMODE_AUDIO) {
    try { validateXaAudio(bytes, sector, sub.coding); } catch { return undefined; }
  }
  return sector;
}
function detectForm(bytes: Buffer, offset: number): XaLayout["form"] | undefined {
  if (sectorAt(bytes, offset, "raw-2352")) return "raw-2352";
  if (sectorAt(bytes, offset, "stripped-2336")) return "stripped-2336";
  return undefined;
}
export function walkXa(bytes: Buffer, offset: number): XaLayout {
  const form = detectForm(bytes, offset);
  if (!form) throw new Error("Not a CD-ROM XA mode 2 sector chain");
  const stride = form === "raw-2352" ? RAW_STRIDE : STRIPPED_STRIDE, sectors: XaSector[] = [];
  for (let at = offset; at + stride <= bytes.length; at += stride) {
    const sector = sectorAt(bytes, at, form);
    if (!sector) break;
    sectors.push(sector);
    if (terminalSector(sector)) break;
  }
  if (!sectors.length || (form === "stripped-2336" && sectors.length < 2)) throw new Error("Not a CD-ROM XA sector chain: headerless form requires at least two consecutive sectors with subheaders");
  if (sectors.every(unusedSector)) throw new Error("Not a CD-ROM XA resource: only unused sectors");
  return { form, stride, sectors, consumed: sectors.length * stride };
}
export function parseXa(bytes: Buffer, offset: number): ParsedAsset {
  if (offset < 0 || offset >= bytes.length) throw new Error("Invalid XA resource offset");
  const form = detectForm(bytes, offset);
  if (!form) throw new Error("Not a CD-ROM XA mode 2 sector chain");
  const stride = form === "raw-2352" ? RAW_STRIDE : STRIPPED_STRIDE;
  const previous = offset >= stride ? sectorAt(bytes, offset - stride, form) : undefined;
  // Reject interior starts before walking: byte-wise scanning must not re-read
  // every remaining sector at each sector boundary (quadratic on real files).
  if (previous && !terminalSector(previous)) throw new Error("XA chain begins after a valid sector; interior alignment is not a resource start");
  const layout = walkXa(bytes, offset);
  const audio = layout.sectors.filter(sector => (sector.submode & SUBMODE_AUDIO) !== 0);
  const padding = layout.sectors.filter(unusedSector);
  const distinct = (values: number[]): number[] => [...new Set(values)].sort((a, b) => a - b);
  return { length: layout.consumed, metadata: { form: layout.form, stride: layout.stride, sectors: layout.sectors.length,
    audioSectors: audio.length, dataSectors: layout.sectors.length - audio.length - padding.length, paddingSectors: padding.length,
    channels: distinct(audio.map(sector => sector.channel)), fileNumbers: distinct(layout.sectors.map(sector => sector.file)),
    trailingBytes: bytes.length - offset - layout.consumed } };
}
function audioStreams(layout: XaLayout): AudioStream[] {
  const active = new Map<string, AudioStream>(), streams: AudioStream[] = [];
  for (const sector of layout.sectors) {
    if (!(sector.submode & SUBMODE_AUDIO)) continue;
    const key = `${sector.file}:${sector.channel}`;
    let stream = active.get(key);
    if (!stream || stream.ended || stream.coding !== sector.coding) {
      stream = { file: sector.file, channel: sector.channel, segment: stream ? stream.segment + 1 : 0, coding: sector.coding, sectors: [], ended: false };
      active.set(key, stream); streams.push(stream);
    }
    stream.sectors.push(sector);
    stream.ended = (sector.submode & 0x81) !== 0; // EOR/EOF terminate this segment.
  }
  return streams;
}
function exactLayout(bytes: Buffer): XaLayout {
  const layout = walkXa(bytes, 0);
  if (layout.consumed !== bytes.length) throw new Error("XA decode requires the exact sector extent");
  return layout;
}
function xaVariants(bytes: Buffer): Array<Record<string, unknown>> {
  const layout = exactLayout(bytes);
  const variants: Array<Record<string, unknown>> = audioStreams(layout).map(({ file, channel, segment }) => ({ kind: "audio", file, channel, segment }));
  if (layout.sectors.some(sector => !(sector.submode & SUBMODE_AUDIO) && !unusedSector(sector))) variants.push({ kind: "data" });
  return variants;
}
function payloads(bytes: Buffer, sectors: XaSector[], maximum: number): Buffer {
  const size = sectors.reduce((sum, sector) => sum + sector.payloadSize, 0);
  if (size > maximum) throw new Error("budget-exhausted: XA payload bytes");
  const output = Buffer.alloc(size);
  let at = 0;
  for (const sector of sectors) { bytes.copy(output, at, sector.payloadOffset, sector.payloadOffset + sector.payloadSize); at += sector.payloadSize; }
  return output;
}
function xaDecode(bytes: Buffer, variant: Record<string, unknown>, maximum: number): DecodedOutput[] {
  const layout = exactLayout(bytes);
  if (variant.kind === "audio") {
    const stream = audioStreams(layout).find(s => s.file === variant.file && s.channel === variant.channel && s.segment === variant.segment);
    if (!stream) throw new Error("Invalid XA audio stream variant");
    const rawSize = stream.sectors.length * 2324;
    // Account for ALL outputs, including the WAV header, before allocating.
    const wav = decodeXaWav(bytes, stream.sectors, stream.coding, maximum - rawSize);
    const metadata = { form: layout.form, stride: layout.stride, sectors: stream.sectors.length, payloadBytes: 2324,
      file: stream.file, channel: stream.channel, segment: stream.segment, codings: [stream.coding], ...xaCoding(stream.coding) };
    return [
      { kind: "xa-audio-adpcm", extension: "adpcm", stage: "decoding", bytes: payloads(bytes, stream.sectors, rawSize), metadata: { ...metadata, adpcm: "Original XA sound groups and sector padding preserved; WAV is the playable derivative" } },
      { kind: "xa-audio", extension: "wav", stage: "export", bytes: wav.bytes, metadata: { ...metadata, ...wav.metadata } },
    ];
  }
  if (variant.kind !== "data") throw new Error("Unknown XA decode variant");
  const selected = layout.sectors.filter(sector => !(sector.submode & SUBMODE_AUDIO) && !unusedSector(sector));
  if (!selected.length) throw new Error("No XA data sectors");
  return [{ kind: "xa-data", extension: "bin", stage: "decoding", bytes: payloads(bytes, selected, maximum), metadata: {
    form: layout.form, stride: layout.stride, sectors: selected.length, payloadSizes: [...new Set(selected.map(sector => sector.payloadSize))].sort((a, b) => a - b),
    interpretation: "Non-audio payload concatenation only; not decoded video or established member/frame semantics" } }];
}

export const XA_PARSER: AssetParser = {
  id: "xa-v1", format: "XA", version: 3,
  category: metadata => typeof metadata.audioSectors === "number" && metadata.audioSectors > 0 ? "sound" : "data",
  rawExtension: "xa",
  probe: (bytes, offset) => {
    if (offset < 0 || offset + 24 > bytes.length) return false;
    const rawSub = duplicatedSubheader(bytes, offset + 16);
    if (rawSub) {
      let sync = true;
      for (let i = 0; i < SYNC.length; i++) if (bytes[offset + i] !== SYNC[i]) { sync = false; break; }
      if (sync && bytes[offset + 15] === 2 && validSubheader(rawSub)) return true;
    }
    const stripped = duplicatedSubheader(bytes, offset);
    // A typeless stripped sector is not a discovery signature: otherwise
    // ordinary zero-filled data would trigger a full sector walk at every byte.
    return stripped !== undefined && !unusedSector(stripped) && validSubheader(stripped);
  },
  parse: parseXa, variants: xaVariants, decode: xaDecode,
};
