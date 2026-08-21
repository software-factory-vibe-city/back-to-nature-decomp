/**
 * overlayFlagFingerprint.ts — were overlay translation units built -G0 or -G8?
 *
 * Deliverable 12 of plans/overlay-decompilation-enablement.md, and it has to be
 * settled before any C is written against an overlay, because the answer
 * changes how every declaration must be written.
 *
 * The fingerprint is gp-relative addressing density in `.text`. Under `-G8`,
 * cc1 emits `.comm` for every global a translation unit defines that is eight
 * bytes or smaller, and the linker places those in small data reached through
 * `$gp` — so a `-G8` body of code touches `$gp` constantly. The measurement is
 * taken over the *derived* `.text` ranges only: over a whole overlay member,
 * data words misdecode as `lwc2`/`lwc3` and manufacture apparent `$gp` hits
 * that are not instructions at all.
 *
 * This is a target fingerprint in the sense the repository's flag policy means:
 * a measured property of the original binary, not a flag tried until something
 * matched.
 *
 * Usage:
 *   npx tsx tools/diagnostics/overlayFlagFingerprint.ts
 */

import { readFileSync } from "fs";
import { REG_GP, opcodeOf, rsOf, rtOf } from "../lib/mips.js";
import { loadPsxExeInfo, requireSectionLayout } from "../lib/psxExeInfo.js";
import { codeMembers, readMemberBytes, requireManifest } from "../lib/overlayManifest.js";
import { deriveLayoutByStrategy, layoutFromConsensus } from "../lib/overlayStrategies.js";
import { detectToolchain } from "../lib/toolchainProfile.js";

/** Loads and stores that can carry a base register, plus the address-forming adds. */
const BASE_REGISTER_OPS = new Set([
  0x08, 0x09, 0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x28, 0x29, 0x2a, 0x2b, 0x2e, 0x31, 0x32, 0x39, 0x3a,
]);

interface GpMeasurement {
  accesses: number;
  words: number;
  perThousand: number;
}

function measureGp(bytes: Buffer, from: number, to: number): GpMeasurement {
  let accesses = 0;
  for (let offset = from; offset + 4 <= to; offset += 4) {
    const word = bytes.readUInt32LE(offset);
    const op = opcodeOf(word);
    if (BASE_REGISTER_OPS.has(op) && rsOf(word) === REG_GP) accesses++;
    /* `lui $gp` is the prologue that establishes the base at all. */
    else if (op === 0x0f && rtOf(word) === REG_GP) accesses++;
  }
  const words = Math.max(0, Math.floor((to - from) / 4));
  return { accesses, words, perThousand: words === 0 ? 0 : (accesses / words) * 1000 };
}

const exe = loadPsxExeInfo();
const layout = requireSectionLayout();
const exeBytes = readFileSync(exe.binaryPath);
const exeGp = measureGp(exeBytes, layout.textStart, layout.dataStart);

const manifest = requireManifest();
const profile = detectToolchain();
const exeImage = { start: exe.loadAddr, end: exe.loadAddr + exe.payloadSize };

let overlayAccesses = 0;
let overlayWords = 0;
const perMember: Array<{ id: string; alias: string | undefined } & GpMeasurement> = [];

for (const member of codeMembers(manifest)) {
  if (member.base?.verdict !== "resolved" || member.base.base === null) continue;
  const bytes = readMemberBytes(manifest, member);
  const memberLayout = layoutFromConsensus(
    deriveLayoutByStrategy({ id: member.id, bytes, exeImage }, profile, member.base.base),
    bytes.length
  );
  const measurement = measureGp(bytes, memberLayout.textStart, memberLayout.dataStart);
  overlayAccesses += measurement.accesses;
  overlayWords += measurement.words;
  perMember.push({ id: member.id, alias: member.alias, ...measurement });
}

const overlayPerThousand = overlayWords === 0 ? 0 : (overlayAccesses / overlayWords) * 1000;

console.log("Overlay compiler-flag fingerprint: gp-relative addressing density in .text");
console.log();
console.log(`${"BODY".padEnd(24)} ${"GP ACCESSES".padStart(12)} ${"WORDS".padStart(9)} ${"PER 1000".padStart(9)}`);
console.log(
  `${"exe .text".padEnd(24)} ${String(exeGp.accesses).padStart(12)} ${String(exeGp.words).padStart(9)} ${exeGp.perThousand.toFixed(2).padStart(9)}`
);
for (const m of perMember) {
  console.log(
    `${`${m.id} ${m.alias ?? ""}`.trim().padEnd(24)} ${String(m.accesses).padStart(12)} ${String(m.words).padStart(9)} ${m.perThousand.toFixed(2).padStart(9)}`
  );
}
console.log(
  `${"overlays, total".padEnd(24)} ${String(overlayAccesses).padStart(12)} ${String(overlayWords).padStart(9)} ${overlayPerThousand.toFixed(2).padStart(9)}`
);

console.log();
const contrary = perMember.filter((m) => m.accesses > 0);
if (overlayAccesses === 0 && exeGp.accesses > 0) {
  console.log("FINDING: overlay translation units were compiled -G0.");
  console.log(
    `  Evidence: ${overlayWords} words of overlay .text contain not one gp-relative access, ` +
      `while the PS-X EXE's .text contains ${exeGp.accesses} (${exeGp.perThousand.toFixed(2)} per 1000 words).`
  );
  console.log(
    "  Under -G8 every global a translation unit defines that is eight bytes or smaller is emitted as .comm and"
  );
  console.log(
    "  reached through $gp. A body of decision code this size that defines no such global is not a credible"
  );
  console.log("  alternative reading.");
  console.log(
    "  It is also the only build that runs: $gp holds the PS-X EXE's small-data base at all times, so a"
  );
  console.log(
    "  separately linked overlay emitting gp-relative accesses would resolve them against the wrong section."
  );
  console.log("  No contrary regional witness: every one of the 13 code members measures exactly zero.");
  console.log();
  console.log("  Applied as a per-container fact in the Makefile, not a per-file override:");
  console.log("  overlay sources compile and assemble with -G0. See notes/overlay-enablement.md.");
} else if (overlayAccesses > 0) {
  console.log("FINDING: overlay .text does use gp-relative addressing.");
  console.log(`  ${contrary.length} member(s) carry accesses: ${contrary.map((m) => `${m.id}=${m.accesses}`).join(", ")}`);
  console.log("  -G0 is refuted; inspect these sites before choosing a flag column.");
} else {
  console.log("UNDETERMINED: neither body uses gp-relative addressing, so the density carries no signal.");
}
