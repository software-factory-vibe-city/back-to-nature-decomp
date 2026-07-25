/**
 * matchSignatures.ts — Match PSY-Q library signatures against the binary
 *
 * Scans the .text section of the binary for byte patterns from the
 * psx_psyq_signatures repo (JSON format). Reports per-version match
 * counts to identify the SDK version, and outputs matched function
 * names with their addresses.
 *
 * Usage:
 *   npx tsx tools/diagnostics/matchSignatures.ts [--version <ver>] [--symbols]
 *
 * Options:
 *   --version <ver>  Only scan a specific version (e.g., 400, 440)
 *   --symbols        Output matched symbols in symbol_addrs.txt format
 */

import * as fs from "fs";
import * as path from "path";
import { loadPsxExeInfo, requireSectionLayout } from "../lib/psxExeInfo.ts";

const _info = loadPsxExeInfo();
const _layout = requireSectionLayout();
const BINARY_PATH = _info.binaryPath;
const SIGS_DIR = "tools/vendor/psx_psyq_signatures";
const PAYLOAD_OFFSET = _info.payloadOffset;
const LOAD_ADDR = _info.loadAddr;
const TEXT_START = _layout.textStart - PAYLOAD_OFFSET + LOAD_ADDR;
const TEXT_END = _layout.dataStart - PAYLOAD_OFFSET + LOAD_ADDR;

interface SigLabel {
  name: string;
  offset: number;
}

interface SigEntry {
  name: string; // e.g. "C57.OBJ"
  sig: string; // hex bytes with ?? wildcards
  labels: SigLabel[];
}

interface Match {
  vramAddr: number;
  objName: string;
  libName: string;
  version: string;
  labels: SigLabel[];
  sigLength: number;
}

function parseSig(sigStr: string): { bytes: number[]; mask: boolean[] } {
  const tokens = sigStr.trim().split(/\s+/);
  const bytes: number[] = [];
  const mask: boolean[] = []; // true = must match, false = wildcard

  for (const token of tokens) {
    if (token === "??" || token === "??") {
      bytes.push(0);
      mask.push(false);
    } else {
      bytes.push(parseInt(token, 16));
      mask.push(true);
    }
  }

  return { bytes, mask };
}

function findPattern(
  binary: Buffer,
  searchStart: number,
  searchEnd: number,
  sigBytes: number[],
  sigMask: boolean[]
): number | null {
  const sigLen = sigBytes.length;
  if (sigLen === 0) return null;

  // Only match on 4-byte aligned addresses (MIPS)
  for (let i = searchStart; i <= searchEnd - sigLen; i += 4) {
    let match = true;
    for (let j = 0; j < sigLen; j++) {
      if (sigMask[j] && binary[i + j] !== sigBytes[j]) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }
  return null;
}

function fileOffsetToVram(offset: number): number {
  return offset - PAYLOAD_OFFSET + LOAD_ADDR;
}

function scanVersion(
  binary: Buffer,
  version: string,
  searchStart: number,
  searchEnd: number
): Match[] {
  const versionDir = path.join(SIGS_DIR, version);
  const files = fs
    .readdirSync(versionDir)
    .filter((f) => f.endsWith(".json"));

  const matches: Match[] = [];

  for (const file of files) {
    const libName = file.replace(".json", "");
    const data: SigEntry[] = JSON.parse(
      fs.readFileSync(path.join(versionDir, file), "utf-8")
    );

    for (const entry of data) {
      if (!entry.sig) continue;
      const { bytes, mask } = parseSig(entry.sig);
      if (bytes.length < 8) continue; // skip tiny sigs (too many false positives)

      const offset = findPattern(binary, searchStart, searchEnd, bytes, mask);
      if (offset !== null) {
        matches.push({
          vramAddr: fileOffsetToVram(offset),
          objName: entry.name,
          libName,
          version,
          labels: entry.labels,
          sigLength: bytes.length,
        });
      }
    }
  }

  return matches;
}

function main() {
  const args = process.argv.slice(2);
  const versionFilter = args.includes("--version")
    ? args[args.indexOf("--version") + 1]
    : null;
  const outputSymbols = args.includes("--symbols");

  if (!fs.existsSync(BINARY_PATH)) {
    console.error(`Binary not found: ${BINARY_PATH}`);
    process.exit(1);
  }

  const binary = fs.readFileSync(BINARY_PATH);

  // Convert VRAM addresses to file offsets for search bounds
  const searchStart = TEXT_START - LOAD_ADDR + PAYLOAD_OFFSET;
  const searchEnd = TEXT_END - LOAD_ADDR + PAYLOAD_OFFSET;

  // Get versions to scan
  const allVersions = fs
    .readdirSync(SIGS_DIR)
    .filter((d) => /^\d+$/.test(d) && fs.statSync(path.join(SIGS_DIR, d)).isDirectory())
    .sort((a, b) => parseInt(a) - parseInt(b));

  const versions = versionFilter
    ? allVersions.filter((v) => v === versionFilter)
    : allVersions;

  if (versions.length === 0) {
    console.error(`No matching version found: ${versionFilter}`);
    process.exit(1);
  }

  // Collect all matches per version
  const allMatches = new Map<string, Match[]>();

  for (const version of versions) {
    process.stderr.write(`Scanning version ${version}...`);
    const matches = scanVersion(binary, version, searchStart, searchEnd);
    allMatches.set(version, matches);
    process.stderr.write(` ${matches.length} matches\n`);
  }

  // Summary: per-version match counts
  console.log("\n=== Match counts by PSY-Q version ===\n");
  for (const [version, matches] of allMatches) {
    // Count unique addresses matched
    const uniqueAddrs = new Set(matches.map((m) => m.vramAddr));
    // Count unique function names (non-loc_ labels)
    const funcNames = new Set(
      matches.flatMap((m) =>
        m.labels
          .filter((l) => !l.name.startsWith("loc_") && !l.name.startsWith("text_"))
          .map((l) => l.name)
      )
    );
    console.log(
      `  ${version}: ${matches.length} sigs matched, ${uniqueAddrs.size} unique addresses, ${funcNames.size} named functions`
    );
  }

  // Find the best version (most matches)
  let bestVersion = "";
  let bestCount = 0;
  for (const [version, matches] of allMatches) {
    if (matches.length > bestCount) {
      bestCount = matches.length;
      bestVersion = version;
    }
  }

  if (bestVersion) {
    console.log(`\nBest match: PSY-Q ${bestVersion} (${bestCount} signatures)\n`);
  }

  // Show diffs between adjacent versions
  const sortedVersions = [...allMatches.keys()].sort(
    (a, b) => parseInt(a) - parseInt(b)
  );

  // Helper: build a set of "libName/objName" keys for a version's matches
  function matchKey(m: Match): string {
    return `${m.libName}/${m.objName}`;
  }

  console.log("=== Diffs between adjacent versions ===\n");
  for (let i = 1; i < sortedVersions.length; i++) {
    const prev = sortedVersions[i - 1];
    const curr = sortedVersions[i];
    const prevMatches = allMatches.get(prev)!;
    const currMatches = allMatches.get(curr)!;

    const prevKeys = new Set(prevMatches.map(matchKey));
    const currKeys = new Set(currMatches.map(matchKey));

    // Gained: in curr but not prev
    const gained = currMatches.filter((m) => !prevKeys.has(matchKey(m)));
    // Lost: in prev but not curr
    const lost = prevMatches.filter((m) => !currKeys.has(matchKey(m)));

    if (gained.length === 0 && lost.length === 0) continue;

    console.log(`--- ${prev} → ${curr} (+${gained.length} / -${lost.length}) ---`);

    for (const m of gained) {
      const funcLabels = m.labels.filter(
        (l) => !l.name.startsWith("loc_") && !l.name.startsWith("text_")
      );
      const names = funcLabels.map((l) => l.name).join(", ") || m.objName;
      const addr = `0x${m.vramAddr.toString(16).toUpperCase().padStart(8, "0")}`;
      console.log(`  + ${addr}  ${names.padEnd(35)} [${m.libName}]`);
    }
    for (const m of lost) {
      const funcLabels = m.labels.filter(
        (l) => !l.name.startsWith("loc_") && !l.name.startsWith("text_")
      );
      const names = funcLabels.map((l) => l.name).join(", ") || m.objName;
      const addr = `0x${m.vramAddr.toString(16).toUpperCase().padStart(8, "0")}`;
      console.log(`  - ${addr}  ${names.padEnd(35)} [${m.libName}]`);
    }
    console.log();
  }

  // Output symbol_addrs.txt format if requested
  if (outputSymbols && bestVersion) {
    const matches = allMatches.get(bestVersion)!;
    matches.sort((a, b) => a.vramAddr - b.vramAddr);
    console.log("\n=== symbol_addrs.txt entries ===\n");
    const seen = new Set<number>();
    for (const match of matches) {
      const funcLabels = match.labels.filter(
        (l) => !l.name.startsWith("loc_") && !l.name.startsWith("text_")
      );
      for (const label of funcLabels) {
        const addr = match.vramAddr + label.offset;
        if (seen.has(addr)) continue;
        seen.add(addr);
        console.log(
          `${label.name} = 0x${addr.toString(16).toUpperCase().padStart(8, "0")}; // type:func`
        );
      }
    }
  }
}

main();
