/**
 * extractArchive.ts — decode the overlay container and publish its manifest.
 *
 * Deliverable 1 of plans/overlay-decompilation-enablement.md. The index format
 * is detected, never assumed (tools/lib/archiveIndex.ts); this tool turns the
 * detected boundaries into `configs/overlays.json` and, on request, writes each
 * member's bytes under `extracted/overlays/`.
 *
 * Usage:
 *   npx tsx tools/build/extractArchive.ts                  # discover + detect, no writes
 *   npx tsx tools/build/extractArchive.ts --write          # + write configs/overlays.json
 *   npx tsx tools/build/extractArchive.ts --write --extract        # + write code members
 *   npx tsx tools/build/extractArchive.ts --write --extract-all    # + write all members
 *   npx tsx tools/build/extractArchive.ts --verify         # concatenation round trip
 *   npx tsx tools/build/extractArchive.ts --discover extracted/iso
 *   npx tsx tools/build/extractArchive.ts --index a.hdt --data a.bin
 */

import { createHash } from "crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  openSync,
  readSync,
  closeSync,
  statSync,
} from "fs";
import { join, relative } from "path";
import { ROOT } from "../lib/psxExeInfo.js";
import { detectArchiveIndex, SECTOR_SIZE, type ArchiveIndexVerdict } from "../lib/archiveIndex.js";
import {
  loadManifest,
  memberId,
  saveManifest,
  memberBinPath,
  type ManifestMember,
  type OverlayManifest,
} from "../lib/overlayManifest.js";

/** Where to look when no paths are given. The filenames are discovered, not assumed. */
const DEFAULT_SEARCH_ROOT = "extracted";

const args = process.argv.slice(2);
const write = args.includes("--write");
const extractAll = args.includes("--extract-all");
const extractCode = args.includes("--extract") || extractAll;
const verify = args.includes("--verify");
const quiet = args.includes("--quiet");

function flagValue(name: string): string | undefined {
  const idx = args.indexOf(name);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : undefined;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

/**
 * Find an index/data pair by testing the format detector against every
 * plausible combination under a directory.
 *
 * A paired-index archive is recognisable without knowing either filename: a
 * small file whose length is a multiple of four, next to a large one, whose
 * words decode as boundaries that tile the large one exactly. That is a
 * property of the format, and it is what makes this tool usable on a game whose
 * archive is not called `a_file`.
 */
function discoverArchive(root: string): { index: string; data: string; members: number } | null {
  const files: Array<{ rel: string; size: number }> = [];
  const stack = [join(ROOT, root)];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir).sort()) {
      const path = join(dir, entry);
      const stats = statSync(path);
      if (stats.isDirectory()) stack.push(path);
      else files.push({ rel: relative(ROOT, path), size: stats.size });
    }
  }

  /* An index is small and word-sized; a container is large. Both bounds are
     properties of the format, not of any game. */
  const indexes = files.filter((f) => f.size > 0 && f.size <= 1 << 16 && f.size % 4 === 0);
  const datas = files.filter((f) => f.size >= 1 << 20);

  const hits: Array<{ index: string; data: string; members: number }> = [];
  for (const index of indexes) {
    const bytes = readFileSync(join(ROOT, index.rel));
    for (const data of datas) {
      const verdict = detectArchiveIndex(bytes, data.size);
      if (verdict.kind === "resolved") {
        hits.push({ index: index.rel, data: data.rel, members: verdict.members.length });
      }
    }
  }

  if (hits.length === 0) return null;
  if (hits.length > 1) {
    console.error(`Several index/data pairs resolve under ${root}; name one explicitly with --index/--data:`);
    for (const hit of hits) console.error(`  --index ${hit.index} --data ${hit.data}  (${hit.members} members)`);
    process.exit(1);
  }
  return hits[0]!;
}

const searchRoot = flagValue("--discover") ?? DEFAULT_SEARCH_ROOT;
let indexRel = flagValue("--index");
let dataRel = flagValue("--data");

if (!indexRel || !dataRel) {
  const found = discoverArchive(searchRoot);
  if (!found) {
    fail(
      `No paired index/data archive found under ${searchRoot}. ` +
        "Name them explicitly with --index <path> --data <path>."
    );
  }
  indexRel ??= found.index;
  dataRel ??= found.data;
  if (!quiet) console.log(`Discovered archive: index ${indexRel}, data ${dataRel}`);
}

const indexPath = join(ROOT, indexRel);
const dataPath = join(ROOT, dataRel);
if (!existsSync(indexPath)) fail(`archive index not found: ${indexRel}`);
if (!existsSync(dataPath)) fail(`archive data not found: ${dataRel}`);

/** Hash a byte range of a file without holding it in memory. */
function hashRange(path: string, start: number, end: number): string {
  const fd = openSync(path, "r");
  try {
    const hash = createHash("sha256");
    const buffer = Buffer.allocUnsafe(1 << 20);
    let position = start;
    while (position < end) {
      const want = Math.min(buffer.length, end - position);
      const read = readSync(fd, buffer, 0, want, position);
      if (read <= 0) break;
      hash.update(buffer.subarray(0, read));
      position += read;
    }
    return hash.digest("hex");
  } finally {
    closeSync(fd);
  }
}

function readRange(path: string, start: number, end: number): Buffer {
  const fd = openSync(path, "r");
  try {
    const buffer = Buffer.allocUnsafe(end - start);
    let filled = 0;
    while (filled < buffer.length) {
      const read = readSync(fd, buffer, filled, buffer.length - filled, start + filled);
      if (read <= 0) break;
      filled += read;
    }
    return buffer.subarray(0, filled);
  } finally {
    closeSync(fd);
  }
}

function reportVerdict(verdict: ArchiveIndexVerdict): void {
  if (verdict.kind === "undetermined") {
    console.log(`archive index: UNDETERMINED — ${verdict.reason}`);
    for (const candidate of verdict.candidates) {
      console.log(`  ${candidate.score.toFixed(3)}  ${candidate.id}`);
    }
    return;
  }
  console.log(`archive index: ${verdict.format} (score ${verdict.score.toFixed(3)}, margin ${verdict.margin.toFixed(3)} over ${verdict.runnerUp ?? "nothing"})`);
  console.log(`  ${verdict.description}`);
  for (const note of verdict.notes) console.log(`  - ${note}`);
  for (const criterion of verdict.criteria) {
    console.log(`  - ${criterion.name}: ${criterion.value.toFixed(3)} — ${criterion.detail}`);
  }
}

const indexBytes = readFileSync(indexPath);
const dataSize = statSync(dataPath).size;

const verdict = detectArchiveIndex(indexBytes, dataSize);
if (!quiet) reportVerdict(verdict);

if (verdict.kind === "undetermined") {
  console.error("Refusing to publish a manifest from an undetermined index format.");
  process.exit(1);
}

/* Classification and solved bases are produced by later tools in the chain.
   Re-running the extractor must not discard them, so they are carried over by
   member index from any existing manifest. */
const previous = loadManifest();
const carried = new Map(previous?.members.map((m) => [m.index, m]) ?? []);

const members: ManifestMember[] = verdict.members.map((m) => {
  const prior = carried.get(m.index);
  const size = m.end - m.start;
  const tagWord = size >= 4 ? readRange(dataPath, m.start, m.start + 4).readUInt32LE(0) : 0;
  const entry: ManifestMember = {
    index: m.index,
    id: memberId(m.index),
    offset: m.start,
    end: m.end,
    size,
    sector: m.start / SECTOR_SIZE,
    sectorCount: size / SECTOR_SIZE,
    tag: `0x${tagWord.toString(16).padStart(8, "0")}`,
    sha256: hashRange(dataPath, m.start, m.end),
  };
  if (prior?.classification) entry.classification = prior.classification;
  if (prior?.base) entry.base = prior.base;
  if (prior?.alias) entry.alias = prior.alias;
  return entry;
});

const manifest: OverlayManifest = {
  generatedBy: "tools/build/extractArchive.ts",
  archive: {
    indexPath: indexRel,
    dataPath: dataRel,
    dataSize,
    indexSha256: createHash("sha256").update(indexBytes).digest("hex"),
    dataSha256: hashRange(dataPath, 0, dataSize),
    sectorSize: SECTOR_SIZE,
    format: verdict.format,
    formatDescription: verdict.description,
    formatScore: verdict.score,
    formatMargin: verdict.margin,
    formatRunnerUp: verdict.runnerUp,
    formatEvidence: [...verdict.notes, ...verdict.criteria.map((c) => `${c.name}: ${c.detail}`)],
  },
  members,
};

if (!quiet) {
  console.log();
  console.log(`${members.length} members, ${dataSize} bytes total`);
  const shown = members.filter((m) => extractAll || m.size <= 1 << 20);
  for (const m of shown) {
    console.log(
      `  ${m.id}  sector ${String(m.sector).padStart(6)}  ${String(m.size).padStart(9)} B  tag ${m.tag}` +
        (m.classification ? `  ${m.classification.verdict}` : "")
    );
  }
  if (shown.length < members.length) {
    console.log(`  (${members.length - shown.length} members over 1 MB not listed; use --extract-all to list all)`);
  }
}

if (extractCode) {
  const outDir = join(ROOT, "extracted/overlays");
  mkdirSync(outDir, { recursive: true });
  const wanted = extractAll ? members : members.filter((m) => m.classification?.verdict === "code");
  if (wanted.length === 0) {
    console.warn(
      "--extract selected no members: nothing is classified as code yet. " +
        "Run classifyArchiveMembers.ts first, or use --extract-all."
    );
  }
  for (const m of wanted) {
    const path = memberBinPath(m);
    writeFileSync(path, readRange(dataPath, m.offset, m.end));
  }
  console.log(`Extracted ${wanted.length} members to extracted/overlays/`);
}

if (verify) {
  /* The manifest's ranges must reproduce the archive exactly. Where member
     files exist, hash those — that is the artifact later stages consume;
     otherwise hash the ranges, and say which was checked. */
  const hash = createHash("sha256");
  let source: "member files" | "manifest ranges" = "member files";
  for (const m of members) {
    const path = memberBinPath(m);
    if (existsSync(path)) hash.update(readFileSync(path));
    else {
      source = "manifest ranges";
      hash.update(readRange(dataPath, m.offset, m.end));
    }
  }
  const concatenated = hash.digest("hex");
  const ok = concatenated === manifest.archive.dataSha256;
  console.log();
  console.log(`round trip (${source}): ${ok ? "OK" : "MISMATCH"}`);
  console.log(`  archive:       ${manifest.archive.dataSha256}`);
  console.log(`  concatenation: ${concatenated}`);
  if (!ok) process.exit(1);
}

if (write) {
  saveManifest(manifest);
  console.log(`Wrote ${manifest.members.length} members to configs/overlays.json`);
}
