/** TIM v1: strict lengths and VRAM rectangles; a magic word alone is never a match. */
export interface Tim {
  length: number; mode: number; width: number; height: number; words: number;
  x: number; y: number; pixels: number; rowBytes: number;
  palette?: { offset: number; colors: number; banks: number };
}
export function parseTim(bytes: Buffer, offset = 0): Tim {
  if (offset < 0 || offset + 8 > bytes.length || bytes.readUInt32LE(offset) !== 0x10) throw new Error("Not a TIM header");
  const flags = bytes.readUInt32LE(offset + 4);
  if ((flags & ~0xb) !== 0) throw new Error("Unsupported TIM flags/mixed mode");
  const mode = flags & 3;
  if (mode < 2 && !(flags & 8)) throw new Error("Indexed TIM has no palette");
  let at = offset + 8;
  function block(): { data: number; x: number; y: number; w: number; h: number } {
    if (at + 12 > bytes.length) throw new Error("Truncated TIM block");
    const length = bytes.readUInt32LE(at);
    const x = bytes.readUInt16LE(at + 4), y = bytes.readUInt16LE(at + 6);
    const w = bytes.readUInt16LE(at + 8), h = bytes.readUInt16LE(at + 10);
    if (w === 0 || h === 0 || x + w > 1024 || y + h > 512 || length !== 12 + w * h * 2 || at + length > bytes.length) throw new Error("Invalid TIM block length/rectangle");
    const data = at + 12;
    at += length;
    return { data, x, y, w, h };
  }
  let palette: Tim["palette"];
  if (flags & 8) {
    const clut = block();
    const colors = mode === 0 ? 16 : 256;
    if (mode < 2) {
      if (clut.w % colors !== 0) throw new Error("Incomplete TIM palette");
      palette = { offset: clut.data, colors, banks: clut.w * clut.h / colors };
    }
  }
  const image = block();
  const rowBytes = image.w * 2;
  const width = mode === 0 ? image.w * 4 : mode === 1 ? image.w * 2 : mode === 2 ? image.w : Math.floor(rowBytes / 3);
  if (!width) throw new Error("Empty TIM image");
  return { length: at - offset, mode, width, height: image.h, words: image.w, x: image.x, y: image.y, pixels: image.data, rowBytes, ...(palette ? { palette } : {}) };
}
function color(word: number): [number, number, number, number] {
  const expand = (value: number): number => (value << 3) | (value >>> 2);
  return [expand(word & 31), expand((word >>> 5) & 31), expand((word >>> 10) & 31), word === 0 ? 0 : 255];
}
export function decodeTim(bytes: Buffer, bank: number, maxBytes: number): { rgba: Buffer; stp: Buffer; ppm: Buffer; metadata: Record<string, unknown> } {
  const tim = parseTim(bytes);
  if (tim.length !== bytes.length) throw new Error("TIM resource has trailing bytes");
  const pixels = tim.width * tim.height;
  // RGBA, STP and PPM all count toward the output budget before allocation.
  if (!Number.isSafeInteger(bank) || bank < 0 || bank >= (tim.palette?.banks ?? 1)) throw new Error("Invalid palette bank");
  const header = Buffer.from(`P6\n${tim.width} ${tim.height}\n255\n`);
  if (pixels * 8 + header.length > maxBytes) throw new Error("budget-exhausted: TIM decoded/export bytes");
  const rgba = Buffer.alloc(pixels * 4), stp = Buffer.alloc(pixels), rgb = Buffer.alloc(pixels * 3);
  for (let y = 0; y < tim.height; y++) for (let x = 0; x < tim.width; x++) {
    const index = y * tim.width + x;
    const row = tim.pixels + y * tim.rowBytes;
    let channels: [number, number, number, number];
    if (tim.mode === 3) channels = [bytes[row + x * 3]!, bytes[row + x * 3 + 1]!, bytes[row + x * 3 + 2]!, 255];
    else {
      let word: number;
      if (tim.mode === 2) word = bytes.readUInt16LE(row + x * 2);
      else {
        const palette = tim.palette!;
        const packed = bytes[row + (tim.mode === 0 ? x >>> 1 : x)]!;
        const entry = tim.mode === 0 ? (packed >>> ((x & 1) * 4)) & 15 : packed;
        word = bytes.readUInt16LE(palette.offset + (bank * palette.colors + entry) * 2);
      }
      channels = color(word);
      stp[index] = word >>> 15;
    }
    rgba.set(channels, index * 4);
    rgb.set(channels.slice(0, 3), index * 3);
  }
  return { rgba, stp, ppm: Buffer.concat([header, rgb]), metadata: {
    width: tim.width, height: tim.height, mode: tim.mode, paletteBank: bank,
    rgbaConvention: "zero color is transparent; STP stored separately, not approximated by alpha",
    ppmLoss: "PPM discards transparency and STP; RGBA and STP blobs are authoritative",
    rowPaddingBytes: tim.mode === 3 ? tim.rowBytes - tim.width * 3 : 0,
  } };
}

export function parseExe(bytes: Buffer): { load: number; entry: number; offset: number; length: number; gp: number } | undefined {
  if (bytes.length < 0x800 || bytes.toString("ascii", 0, 8) !== "PS-X EXE") return undefined;
  const entry = bytes.readUInt32LE(0x10), gp = bytes.readUInt32LE(0x14);
  const load = bytes.readUInt32LE(0x18), length = bytes.readUInt32LE(0x1c);
  if (!length || (load & 3) || (entry & 3) || load + length > 0x100000000 || 0x800 + length > bytes.length || entry < load || entry >= load + length) throw new Error("Invalid PS-X EXE load/entry/payload extent");
  return { load, entry, offset: 0x800, length, gp };
}
