/**
 * classifyArchiveMembers.ts — code vs data, per archive member, with evidence.
 *
 * Part of Deliverable 5 of plans/overlay-decompilation-enablement.md. The
 * throwaway `jr ra` density scan that found the code members in the first place
 * is promoted here into a tool that states its measurements, applies stated
 * thresholds, and reports `undetermined` when the measurements fall between
 * them. Asset magics are recognised where a format declares itself; where none
 * does, the verdict says so rather than inventing a format name.
 *
 * Usage:
 *   npx tsx tools/build/classifyArchiveMembers.ts            # report only
 *   npx tsx tools/build/classifyArchiveMembers.ts --write    # + update configs/overlays.json
 */

import {
  requireManifest,
  readMemberBytes,
  saveManifest,
  type OverlayManifest,
} from "../lib/overlayManifest.js";
import { classifyMemberBytes, measureCodeReference } from "../lib/memberClassification.js";
import { detectToolchain } from "../lib/toolchainProfile.js";
import { loadPsxExeInfo, requireSectionLayout } from "../lib/psxExeInfo.js";
import { readFileSync } from "fs";

const write = process.argv.includes("--write");
const manifest: OverlayManifest = requireManifest();

/*
 * The reference body: the project's own main executable `.text`, which is code
 * by construction. Everything the classifier decides is decided relative to it,
 * so a different game supplies a different reference and the thresholds move
 * with it rather than being carried over.
 */
const exe = loadPsxExeInfo();
const layout = requireSectionLayout();
const reference = measureCodeReference(
  readFileSync(exe.binaryPath),
  layout.textStart,
  layout.dataStart,
  "PS-X EXE .text"
);

const profile = detectToolchain();

console.log(`Toolchain profile: ${profile.id} (${profile.verdict})`);
console.log(
  `Reference (${reference.source}): ${(reference.decodeRatio * 100).toFixed(1)}% decode, ` +
    `${reference.returnsPerKb.toFixed(2)} returns/KB`
);
console.log();

let changed = 0;
for (const member of manifest.members) {
  const bytes = readMemberBytes(manifest, member);
  const before = JSON.stringify(member.classification ?? null);
  member.classification = classifyMemberBytes(bytes, member.tag, { reference, profile });
  if (JSON.stringify(member.classification) !== before) changed++;
}

const width = Math.max(...manifest.members.map((m) => m.id.length));
console.log(`${"member".padEnd(width)}  ${"size".padStart(9)}  verdict       format`);
for (const member of manifest.members) {
  const c = member.classification!;
  console.log(
    `${member.id.padEnd(width)}  ${String(member.size).padStart(9)}  ${c.verdict.padEnd(13)} ${c.format ?? "-"}`
  );
}

const counts = manifest.members.reduce<Record<string, number>>((acc, m) => {
  const v = m.classification!.verdict;
  acc[v] = (acc[v] ?? 0) + 1;
  return acc;
}, {});
console.log();
console.log(
  `code: ${counts.code ?? 0}   data: ${counts.data ?? 0}   undetermined: ${counts.undetermined ?? 0}`
);

if (write) {
  saveManifest(manifest);
  console.log(`Updated configs/overlays.json (${changed} member classifications changed)`);
} else if (changed > 0) {
  console.log(`${changed} member classifications would change; re-run with --write`);
}
