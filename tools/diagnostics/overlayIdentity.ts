/**
 * overlayIdentity.ts — which archive member is which, and on what evidence.
 *
 * Deliverable 10 of plans/overlay-decompilation-enablement.md. The member index
 * is the durable identifier and always will be; a semantic name is an alias
 * adopted only when independent sources agree, because a wrong name propagates
 * into hundreds of filenames and notes and a right one saves every reader a
 * lookup.
 *
 * Three sources, none of them derived from the others:
 *
 *   1. The developer's own asset-path table in the PS-X EXE — fixed-stride
 *      records of NUL-terminated Windows paths, discovered by its shape rather
 *      than by a hardcoded address.
 *   2. A naming convention *derived* from those paths — not assumed. Each path
 *      is reduced to candidate features (leading directory, extension), and the
 *      feature whose values partition the members exactly as the classifier's
 *      independent code-vs-data verdict does is the convention this developer
 *      used. The classifier reached its verdict from code measurements and
 *      knows nothing about filenames, so a clean partition is a coincidence
 *      that has to be explained.
 *   3. The loader: the function that references both archive filenames and the
 *      table, which is what makes the table an index into *this* archive rather
 *      than a list that happens to be the right length.
 *
 * Usage:
 *   npx tsx tools/diagnostics/overlayIdentity.ts           # report
 *   npx tsx tools/diagnostics/overlayIdentity.ts --write   # + record aliases
 */

import { readFileSync } from "fs";
import { loadPsxExeInfo } from "../lib/psxExeInfo.js";
import { findLuiPairs } from "../lib/mips.js";
import { loadFunctionSpans } from "../lib/symbolIndex.js";
import { requireManifest, saveManifest } from "../lib/overlayManifest.js";

const write = process.argv.includes("--write");

const exe = loadPsxExeInfo();
const image = readFileSync(exe.binaryPath);
const payload = image.subarray(exe.payloadOffset, exe.payloadOffset + exe.payloadSize);
const manifest = requireManifest();
const memberCount = manifest.members.length;

const hex = (value: number) => `0x${value.toString(16).toUpperCase().padStart(8, "0")}`;

/** A NUL-terminated run of printable bytes at this offset, or null. */
function stringAt(offset: number, maxLength: number): string | null {
  let end = offset;
  while (end < offset + maxLength && end < payload.length && payload[end] !== 0) {
    const byte = payload[end]!;
    if (byte < 0x20 || byte > 0x7e) return null;
    end++;
  }
  if (end === offset || end >= offset + maxLength) return null;
  return payload.subarray(offset, end).toString("latin1");
}

interface AssetTable {
  vram: number;
  stride: number;
  nameOffset: number;
  names: string[];
}

/**
 * Find the asset-path table by its shape: `memberCount` consecutive records of
 * one stride, each holding a Windows-style path at a fixed offset.
 *
 * Nothing here knows the address. A table found this way is a table the binary
 * actually contains, and a run of exactly the archive's member count is the
 * property that makes it *this* archive's index.
 */
function findAssetTable(): AssetTable | null {
  /* Path-shaped: printable, no whitespace, and carrying a separator or an
     extension. Deliberately not tied to one platform's separator. */
  const PATH = /^[!-~]{3,}$/;
  const PATH_LIKE = (value: string) => PATH.test(value) && /[\\/.]/.test(value);
  const strides = [0x20, 0x24, 0x28, 0x2c, 0x30, 0x38, 0x40];
  let best: AssetTable | null = null;

  for (const stride of strides) {
    for (let start = 0; start + stride * memberCount <= payload.length; start += 4) {
      const first = stringAt(start, stride);
      if (!first || !PATH_LIKE(first)) continue;

      const names: string[] = [];
      for (let i = 0; i < memberCount; i++) {
        const name = stringAt(start + i * stride, stride);
        if (!name || !PATH_LIKE(name)) break;
        names.push(name);
      }
      if (names.length < memberCount) continue;
      if (!best || names.length > best.names.length) {
        best = { vram: exe.loadAddr + start, stride, nameOffset: 0, names };
      }
      /* A longer run cannot start inside the one just accepted. */
      start += stride * (names.length - 1);
    }
    if (best) break;
  }
  return best;
}

const table = findAssetTable();
if (!table) {
  console.log("Asset table: NOT FOUND");
  console.log(
    `  No run of ${memberCount} fixed-stride path records exists in the PS-X EXE, so the member index stands alone.`
  );
  process.exit(0);
}

console.log(`Asset table: ${table.names.length} records of ${table.stride} bytes at ${hex(table.vram)}`);
console.log(`  run length equals the archive's member count (${memberCount}), which is what binds it to this archive`);

// --- Source 2: a naming convention derived from the paths, not assumed ---

/**
 * Candidate features of a path, each a thing a developer might have used to
 * separate code from assets. Nothing here is specific to one project's habits;
 * the data decides which feature, if any, actually separates.
 */
function pathFeatures(path: string): Array<{ feature: string; value: string }> {
  const separated = path.split(/[\\/]/);
  const base = separated[separated.length - 1] ?? path;
  const features: Array<{ feature: string; value: string }> = [];
  if (separated.length > 1) features.push({ feature: "leading directory", value: separated[0]!.toLowerCase() });
  if (separated.length > 2) features.push({ feature: "directory path", value: separated.slice(0, -1).join("/").toLowerCase() });
  const dot = base.lastIndexOf(".");
  if (dot > 0) features.push({ feature: "extension", value: base.slice(dot + 1).toLowerCase() });
  return features;
}

interface Partition {
  feature: string;
  codeValues: string[];
  dataValues: string[];
  consistent: number;
  total: number;
  conflicts: string[];
}

/**
 * Find the feature whose values split the members exactly as the classifier did.
 *
 * A value that appears on both a code member and a data member cannot be part
 * of a convention, and the feature carrying it is rejected. The best feature is
 * the one with the fewest such conflicts.
 */
function derivePartition(
  entries: Array<{ id: string; path: string; verdict: "code" | "data" }>
): Partition | null {
  const features = [...new Set(entries.flatMap((e) => pathFeatures(e.path).map((f) => f.feature)))];
  let best: Partition | null = null;

  for (const feature of features) {
    const byValue = new Map<string, { code: number; data: number }>();
    let covered = 0;
    for (const entry of entries) {
      const value = pathFeatures(entry.path).find((f) => f.feature === feature)?.value;
      if (value === undefined) continue;
      covered++;
      const bucket = byValue.get(value) ?? { code: 0, data: 0 };
      bucket[entry.verdict]++;
      byValue.set(value, bucket);
    }
    if (covered !== entries.length) continue;

    const conflicts: string[] = [];
    const codeValues: string[] = [];
    const dataValues: string[] = [];
    let consistent = 0;
    for (const [value, counts] of byValue) {
      if (counts.code > 0 && counts.data > 0) {
        conflicts.push(`${JSON.stringify(value)} covers ${counts.code} code and ${counts.data} data member(s)`);
        consistent += Math.max(counts.code, counts.data);
      } else {
        (counts.code > 0 ? codeValues : dataValues).push(value);
        consistent += counts.code + counts.data;
      }
    }
    const candidate: Partition = {
      feature,
      codeValues: codeValues.sort(),
      dataValues: dataValues.sort(),
      consistent,
      total: entries.length,
      conflicts,
    };
    if (!best || candidate.consistent > best.consistent) best = candidate;
  }
  return best;
}

function combinations(n: number, k: number): number {
  let result = 1;
  for (let i = 0; i < k; i++) result = (result * (n - i)) / (i + 1);
  return result;
}

const labelled = manifest.members
  .map((member) => ({
    id: member.id,
    path: table.names[member.index],
    verdict: member.classification?.verdict,
  }))
  .filter(
    (e): e is { id: string; path: string; verdict: "code" | "data" } =>
      e.path !== undefined && (e.verdict === "code" || e.verdict === "data")
  );

const partition = derivePartition(labelled);
const codeCount = labelled.filter((e) => e.verdict === "code").length;

console.log();
if (!partition) {
  console.log("Naming convention: none derivable — no path feature covers every member");
} else {
  console.log(
    `Naming convention (derived): ${partition.feature} partitions ${partition.consistent}/${partition.total} members as the classifier does`
  );
  console.log(`  code side: ${partition.codeValues.join(", ") || "(none)"}`);
  console.log(`  data side: ${partition.dataValues.join(", ") || "(none)"}`);
  for (const conflict of partition.conflicts) console.log(`  CONFLICT — ${conflict}`);
  if (partition.conflicts.length === 0) {
    console.log(
      `  The classifier reached its verdict from code measurements and knows nothing about filenames; ` +
        `a chance alignment of ${codeCount} code members onto the ${codeCount} paths carrying ` +
        `${partition.codeValues.map((v) => JSON.stringify(v)).join("/")} has odds of about 1 in ` +
        `${Math.round(combinations(partition.total, codeCount)).toLocaleString()}.`
    );
  }
}
const conventionAgrees = partition !== null && partition.conflicts.length === 0 && partition.consistent === partition.total;

// --- Source 3: the loader ---

const spans = loadFunctionSpans().sort((a, b) => a.vram - b.vram);
const owner = (vram: number) => spans.find((s) => vram >= s.vram && vram < s.vram + s.size)?.name ?? null;

function stringVram(needle: string): number | null {
  const at = image.indexOf(Buffer.from(needle, "latin1"));
  return at < 0 ? null : at - exe.payloadOffset + exe.loadAddr;
}

const archiveStrings = [manifest.archive.indexPath, manifest.archive.dataPath]
  .map((path) => `\\${path.split("/").pop()!.toUpperCase()};1`)
  .map((needle) => ({ needle, vram: stringVram(needle) }));

const pairs = findLuiPairs(payload, 12);
const referencesOf = (address: number) =>
  new Set(
    pairs
      .filter((pair) => pair.address === address)
      .map((pair) => owner(exe.loadAddr + pair.offset))
      .filter((name): name is string => name !== null)
  );

const tableReaders = new Set<string>();
for (const pair of pairs) {
  if (pair.address >= table.vram - 8 && pair.address < table.vram + table.stride * table.names.length) {
    const name = owner(exe.loadAddr + pair.offset);
    if (name) tableReaders.add(name);
  }
}

console.log();
console.log("Archive filename references:");
const filenameReaders = new Set<string>();
for (const { needle, vram } of archiveStrings) {
  if (vram === null) {
    console.log(`  ${needle}: not present in the PS-X EXE`);
    continue;
  }
  const readers = referencesOf(vram);
  for (const reader of readers) filenameReaders.add(reader);
  console.log(`  ${needle} at ${hex(vram)} referenced by ${[...readers].join(", ") || "nothing"}`);
}

const loaders = [...filenameReaders].filter((name) => tableReaders.has(name));
console.log();
console.log(
  loaders.length > 0
    ? `Loader: ${loaders.join(", ")} references both archive filenames and the asset table`
    : "Loader: no function references both the archive filenames and the asset table"
);
console.log(`  functions reading the table: ${[...tableReaders].sort().join(", ") || "none"}`);

// --- Verdict ---

const sourcesAgree = conventionAgrees && loaders.length > 0;
console.log();
console.log(
  sourcesAgree
    ? "All three sources agree. Adopting the table's path as each member's alias."
    : "Sources do not all agree. The member index stands alone; no alias is adopted."
);

console.log();
console.log(`${"MEMBER".padEnd(8)} ${"CLASS".padEnd(13)} ALIAS`);
for (const member of manifest.members) {
  const path = table.names[member.index] ?? "-";
  console.log(`${member.id.padEnd(8)} ${(member.classification?.verdict ?? "-").padEnd(13)} ${path}`);
}

if (write) {
  if (!sourcesAgree) {
    console.error("Refusing to write aliases: the evidence bar is three agreeing sources.");
    process.exit(1);
  }
  for (const member of manifest.members) {
    const path = table.names[member.index];
    if (path) member.alias = path;
  }
  saveManifest(manifest);
  console.log();
  console.log("Recorded aliases in configs/overlays.json");
}
