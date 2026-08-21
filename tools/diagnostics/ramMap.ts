/**
 * ramMap.ts — where every address overlay code touches actually lives.
 *
 * Deliverable 11 of plans/overlay-decompilation-enablement.md. The output is
 * the substrate overlay type recovery will live on: the code-character
 * measurement says overlay work is type-bound rather than allocator-bound, and
 * the region that holds the types is the one no container declares.
 *
 * Every address is assigned to a named region with its evidence, or reported
 * unclassified. Nothing is defaulted into the nearest region.
 *
 * Usage:
 *   npx tsx tools/diagnostics/ramMap.ts                 # regions + reference census
 *   npx tsx tools/diagnostics/ramMap.ts --container ovl_11
 *   npx tsx tools/diagnostics/ramMap.ts --unclassified  # only what no region explains
 *   npx tsx tools/diagnostics/ramMap.ts --json          # write build/ramMap.json
 */

import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { ROOT, loadPsxExeInfo } from "../lib/psxExeInfo.js";
import { buildRamMap, regionOf, type RamRegion } from "../lib/ramRegions.js";
import { scanOverlayReferences } from "../lib/overlayReferences.js";
import { findLuiPairs, isValidRamAddress } from "../lib/mips.js";

const args = process.argv.slice(2);
const containerIdx = args.indexOf("--container");
const only = containerIdx >= 0 ? args[containerIdx + 1] : undefined;
const unclassifiedOnly = args.includes("--unclassified");
const json = args.includes("--json");

const hex = (value: number) => `0x${value.toString(16).toUpperCase().padStart(8, "0")}`;

const regions = buildRamMap();
const scan = scanOverlayReferences();

console.log("RAM map");
console.log(`${"REGION".padEnd(22)} ${"START".padEnd(11)} ${"END".padEnd(11)} ${"SIZE".padStart(9)}  OWNER`);
for (const region of regions) {
  console.log(
    `${region.name.padEnd(22)} ${hex(region.start).padEnd(11)} ${hex(region.end).padEnd(11)} ${String(region.end - region.start).padStart(9)}  ${region.owner ?? "-"}`
  );
}
console.log();
for (const region of regions) console.log(`  ${region.name}: ${region.evidence}`);

/* Overlapping regions are a real physical fact worth seeing, not a bug to
   round away: two slots can be a few bytes apart because the larger member's
   tail is sector padding rather than content. An address in an overlap is
   attributed to the first region, so the overlap has to be stated. */
const overlaps = regions
  .slice(1)
  .map((region, index) => ({ previous: regions[index]!, region }))
  .filter(({ previous, region }) => region.start < previous.end);
if (overlaps.length > 0) {
  console.log();
  console.log("Overlapping regions (an address inside one is attributed to the first):");
  for (const { previous, region } of overlaps) {
    console.log(
      `  ${previous.name} ends ${hex(previous.end)} but ${region.name} starts ${hex(region.start)} ` +
        `— ${previous.end - region.start} byte(s) of overlap`
    );
  }
}

if (!scan) {
  console.log();
  console.log("No overlay manifest, so no overlay reference census.");
  process.exit(0);
}

/** Every address an overlay reaches, with how it reached it. */
interface Census {
  address: number;
  sites: number;
  members: string[];
  kinds: Set<string>;
}

const census = new Map<number, Census>();
function record(address: number, sites: number, members: readonly string[], kind: string): void {
  const entry = census.get(address) ?? { address, sites: 0, members: [], kinds: new Set<string>() };
  entry.sites += sites;
  for (const member of members) if (!entry.members.includes(member)) entry.members.push(member);
  entry.kinds.add(kind);
  census.set(address, entry);
}

for (const [address, count] of scan.resolvedAddresses) record(address, count.sites, count.members, "lui-pair");
for (const [address, count] of scan.literalReferences) record(address, count.sites, count.members, "word");
for (const [address, count] of scan.slotCallTargets) record(address, count.sites, count.members, "call");
for (const [address, count] of scan.exeCallTargets) record(address, count.sites, count.members, "call");

const filtered = [...census.values()].filter((entry) => !only || entry.members.includes(only));

const byRegion = new Map<string, { addresses: number; sites: number; members: Set<string> }>();
const unclassified: Census[] = [];
for (const entry of filtered) {
  const region = regionOf(regions, entry.address);
  if (!region) {
    unclassified.push(entry);
    continue;
  }
  const bucket = byRegion.get(region.name) ?? { addresses: 0, sites: 0, members: new Set<string>() };
  bucket.addresses++;
  bucket.sites += entry.sites;
  for (const member of entry.members) bucket.members.add(member);
  byRegion.set(region.name, bucket);
}

/* The PS-X EXE's own references, for the comparison that makes the shared
   region legible: it is busier than either body's references to its own image. */
const exe = loadPsxExeInfo();
const exeImage = readFileSync(exe.binaryPath).subarray(exe.payloadOffset, exe.payloadOffset + exe.payloadSize);
const exeByRegion = new Map<string, number>();
for (const pair of findLuiPairs(exeImage, 8)) {
  if (!isValidRamAddress(pair.address)) continue;
  const region = regionOf(regions, pair.address);
  const key = region?.name ?? "unclassified";
  exeByRegion.set(key, (exeByRegion.get(key) ?? 0) + 1);
}

console.log();
console.log(`Overlay reference census${only ? ` for ${only}` : ""}`);
console.log(`${"REGION".padEnd(22)} ${"ADDRS".padStart(7)} ${"OVL SITES".padStart(10)} ${"EXE SITES".padStart(10)}  MEMBERS`);
for (const region of regions) {
  const bucket = byRegion.get(region.name);
  const exeSites = exeByRegion.get(region.name) ?? 0;
  if (!bucket && exeSites === 0) continue;
  console.log(
    `${region.name.padEnd(22)} ${String(bucket?.addresses ?? 0).padStart(7)} ${String(bucket?.sites ?? 0).padStart(10)} ${String(exeSites).padStart(10)}  ${bucket ? bucket.members.size : 0}`
  );
}

console.log();
console.log(`Unclassified: ${unclassified.length} address(es)`);
if (unclassified.length > 0 && (unclassifiedOnly || unclassified.length <= 20)) {
  for (const entry of unclassified.sort((a, b) => b.sites - a.sites).slice(0, 40)) {
    console.log(`  ${hex(entry.address)}  ${entry.sites} site(s)  ${[...entry.kinds].join("/")}  ${entry.members.join(" ")}`);
  }
}

if (json) {
  const out = join(ROOT, "build/ramMap.json");
  mkdirSync(join(ROOT, "build"), { recursive: true });
  writeFileSync(
    out,
    `${JSON.stringify(
      {
        generatedBy: "tools/diagnostics/ramMap.ts",
        regions: regions.map((r: RamRegion) => ({ ...r, start: hex(r.start), end: hex(r.end) })),
        overlayCensus: [...byRegion.entries()].map(([name, b]) => ({
          region: name,
          addresses: b.addresses,
          sites: b.sites,
          members: [...b.members].sort(),
        })),
        exeCensus: [...exeByRegion.entries()].map(([region, sites]) => ({ region, sites })),
        unclassified: unclassified.map((entry) => ({
          address: hex(entry.address),
          sites: entry.sites,
          kinds: [...entry.kinds],
          members: entry.members,
        })),
      },
      null,
      2
    )}\n`
  );
  console.log(`Wrote ${out}`);
}
