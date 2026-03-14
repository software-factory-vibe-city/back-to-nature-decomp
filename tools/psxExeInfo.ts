/**
 * psxExeInfo.ts — Shared constants module for PSX-EXE binaries
 *
 * Reads the PSX-EXE binary header + configs/splat.yaml header to derive
 * all constants. Every tool imports this instead of hardcoding values.
 *
 * Also provides section layout reading from build/sectionLayout.json.
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(__dirname, "..");

export interface PsxExeInfo {
  binaryPath: string;
  loadAddr: number;
  entryPoint: number;
  payloadOffset: number;
  payloadSize: number;
  gpValue: number;
  fileEnd: number;
}

export interface SectionLayout {
  rodataStart: number;
  textStart: number;
  dataStart: number;
  sdataStart: number;
  fileEnd: number;
}

/**
 * Parse configs/splat.yaml header fields without a full YAML parser.
 * Returns target_path and gp_value if present.
 */
function parseSplatYamlHeader(): { targetPath?: string; gpValue?: number } {
  const yamlPath = join(ROOT, "configs/splat.yaml");
  if (!existsSync(yamlPath)) return {};

  const content = readFileSync(yamlPath, "utf-8");
  const result: { targetPath?: string; gpValue?: number } = {};

  const targetMatch = content.match(/target_path:\s*(\S+)/);
  if (targetMatch) result.targetPath = targetMatch[1];

  const gpMatch = content.match(/gp_value:\s*(0x[0-9A-Fa-f]+)/);
  if (gpMatch) result.gpValue = parseInt(gpMatch[1], 16);

  return result;
}

/**
 * Scan near the entry point for `lui $gp, X` / `addiu $gp, $gp, Y` to discover GP.
 * Returns the GP value or null if not found.
 */
function discoverGp(binary: Buffer, entryFileOffset: number): number | null {
  // Scan the first 64 instructions from entry point
  const scanWords = 64;
  for (let i = 0; i < scanWords; i++) {
    const offset = entryFileOffset + i * 4;
    if (offset + 4 > binary.length) break;

    const word = binary.readUInt32LE(offset);
    // lui $gp, imm  =>  0x3C1C????  (op=0x0F, rt=$gp=28, rs=0)
    if ((word >>> 16) === 0x3c1c) {
      const hiImm = word & 0xffff;
      // Look for addiu $gp, $gp, imm in next few instructions
      for (let j = i + 1; j < Math.min(i + 8, scanWords); j++) {
        const off2 = entryFileOffset + j * 4;
        if (off2 + 4 > binary.length) break;
        const word2 = binary.readUInt32LE(off2);
        // addiu $gp, $gp, imm  =>  0x279C????
        if ((word2 >>> 16) === 0x279c) {
          const loImm = word2 & 0xffff;
          const loSigned = loImm >= 0x8000 ? loImm - 0x10000 : loImm;
          return ((hiImm << 16) + loSigned) >>> 0;
        }
      }
    }
  }
  return null;
}

/**
 * Load PSX-EXE info from the binary and splat.yaml header.
 * Throws if binary not found or invalid.
 */
export function loadPsxExeInfo(): PsxExeInfo {
  const yaml = parseSplatYamlHeader();
  const binaryPath = join(ROOT, yaml.targetPath ?? "extracted/iso/slus_011.15");

  if (!existsSync(binaryPath)) {
    throw new Error(`PSX-EXE binary not found: ${binaryPath}`);
  }

  const buf = readFileSync(binaryPath);

  if (buf.length < 0x800) {
    throw new Error(`File too small to be a PSX-EXE: ${buf.length} bytes`);
  }

  const magic = buf.subarray(0, 8).toString("ascii").replace(/\0/g, "");
  if (magic !== "PS-X EXE") {
    throw new Error(`Not a PSX-EXE (magic = ${JSON.stringify(magic)})`);
  }

  const entryPoint = buf.readUInt32LE(0x10);
  const loadAddr = buf.readUInt32LE(0x18);
  const payloadSize = buf.readUInt32LE(0x1c);
  const payloadOffset = 0x800;
  const fileEnd = payloadOffset + payloadSize;

  // GP discovery: try binary scan first, fall back to splat.yaml
  const entryFileOffset = entryPoint - loadAddr + payloadOffset;
  let gpValue = discoverGp(buf, entryFileOffset);
  if (gpValue === null) {
    gpValue = yaml.gpValue ?? 0;
  }

  return {
    binaryPath,
    loadAddr,
    entryPoint,
    payloadOffset,
    payloadSize,
    gpValue,
    fileEnd,
  };
}

/**
 * Load section layout from build/sectionLayout.json.
 * Returns null if the file doesn't exist.
 */
export function loadSectionLayout(): SectionLayout | null {
  const layoutPath = join(ROOT, "build/sectionLayout.json");
  if (!existsSync(layoutPath)) return null;
  return JSON.parse(readFileSync(layoutPath, "utf-8"));
}

/**
 * Require section layout — throws if not available.
 */
export function requireSectionLayout(): SectionLayout {
  const layout = loadSectionLayout();
  if (!layout) {
    throw new Error(
      "build/sectionLayout.json not found. Run bootstrap first: npx tsx tools/bootstrap.ts --write"
    );
  }
  return layout;
}

// Convenience helpers
export function vramToRom(vram: number, info: PsxExeInfo): number {
  return vram - info.loadAddr + info.payloadOffset;
}

export function romToVram(rom: number, info: PsxExeInfo): number {
  return rom - info.payloadOffset + info.loadAddr;
}
