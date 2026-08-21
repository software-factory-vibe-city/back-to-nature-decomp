/**
 * solveOverlayBase.ts — solve every code member's load address, with a certificate.
 *
 * Deliverable 3 of plans/overlay-decompilation-enablement.md. Runs in two
 * passes: each member is first solved on its own evidence, then re-scored with
 * every other member's solved extent available, so a call from one overlay into
 * another is resolved rather than counted as a violation against the base that
 * is in fact correct.
 *
 * Usage:
 *   npx tsx tools/build/solveOverlayBase.ts                 # solve + report
 *   npx tsx tools/build/solveOverlayBase.ts --write         # + record in configs/overlays.json
 *   npx tsx tools/build/solveOverlayBase.ts --verbose       # + full certificates
 *   npx tsx tools/build/solveOverlayBase.ts --probe 0xADDR  # score one base against every member
 */

import {
  codeMembers,
  readMemberBytes,
  requireManifest,
  saveManifest,
  type ManifestMember,
} from "../lib/overlayManifest.js";
import {
  collectSelfReferences,
  scoreBase,
  solveMemberBase,
  weighted,
  type BaseCertificate,
  type BaseSolverInput,
  type ElsewhereResolution,
} from "../lib/overlayBase.js";
import { isDecodableInstruction, isJrRa, isStackPrologue } from "../lib/mips.js";
import { loadPsxExeInfo } from "../lib/psxExeInfo.js";
import { loadFunctionSpans, loadSymbolAddresses } from "../lib/symbolIndex.js";
import { isValidRamAddress, jalTarget } from "../lib/mips.js";

const args = process.argv.slice(2);
const write = args.includes("--write");
const verbose = args.includes("--verbose");
const probeIdx = args.indexOf("--probe");
const probe = probeIdx >= 0 && args[probeIdx + 1] ? Number(args[probeIdx + 1]) : null;

const manifest = requireManifest();
const exe = loadPsxExeInfo();
const exeImage = { start: exe.loadAddr, end: exe.loadAddr + exe.payloadSize };

const members = codeMembers(manifest);
const inputs = new Map<string, BaseSolverInput>(
  members.map((m) => [m.id, { id: m.id, bytes: readMemberBytes(manifest, m), exeImage }])
);

const hex = (value: number) => `0x${value.toString(16).toUpperCase().padStart(8, "0")}`;

/* An independent corroboration of every solved base: a member's calls *out* of
   itself do not depend on its base at all, so if the disassembly is being read
   correctly they must land on PS-X EXE function entries the project already
   knows. A member whose external calls miss is being decoded wrong, whatever
   its base solves to. */
const knownExeFunctions = new Set<number>(loadFunctionSpans().map((span) => span.vram));
for (const address of loadSymbolAddresses().values()) knownExeFunctions.add(address);

function externalCallAgreement(bytes: Buffer): { known: number; total: number } {
  const targets = new Set<number>();
  for (let offset = 0; offset + 4 <= bytes.length; offset += 4) {
    const target = jalTarget(bytes.readUInt32LE(offset), 0x80000000);
    if (target === null || !isValidRamAddress(target)) continue;
    if (target >= exeImage.start && target < exeImage.end) targets.add(target);
  }
  const known = [...targets].filter((t) => knownExeFunctions.has(t)).length;
  return { known, total: targets.size };
}

if (probe !== null) {
  console.log(`Scoring base ${hex(probe)} against every code member:`);
  for (const member of members) {
    const input = inputs.get(member.id)!;
    const refs = collectSelfReferences(input);
    const criteria = scoreBase(input, refs, probe);
    const score = weighted(criteria);
    console.log(`  ${member.id}  score ${score.toFixed(3)}`);
    for (const c of criteria) console.log(`      ${c.name}: ${c.detail}`);
  }
  process.exit(0);
}

// --- Pass 1: each member on its own evidence ---

const firstPass = new Map<string, BaseCertificate>();
for (const member of members) {
  firstPass.set(member.id, solveMemberBase(inputs.get(member.id)!));
}

// --- Pass 2: re-solve with every solved extent available ---

interface SolvedExtent {
  id: string;
  base: number;
  end: number;
}

function extentsFrom(certificates: Map<string, BaseCertificate>): SolvedExtent[] {
  const extents: SolvedExtent[] = [];
  for (const member of members) {
    const certificate = certificates.get(member.id);
    if (certificate?.verdict === "resolved" && certificate.base !== null) {
      extents.push({ id: member.id, base: certificate.base, end: certificate.base + member.size });
    }
  }
  return extents;
}

const NOWHERE: ElsewhereResolution = { contained: false, atEntry: false, decodable: false };

/**
 * Where an address lands in another member's solved extent.
 *
 * Reporting whether it lands on a function entry there — not merely inside the
 * extent — is what keeps a wrong base from laundering its misses through a
 * large neighbour: at a wrong base the misses land at arbitrary offsets, and
 * arbitrary offsets are almost never function entries.
 */
function makeResolver(extents: readonly SolvedExtent[], self: string) {
  return (address: number, candidateBase: number): ElsewhereResolution => {
    for (const extent of extents) {
      if (extent.id === self) continue;
      /* Same base means same slot, and slot mates are never resident together. */
      if (extent.base === candidateBase) continue;
      const offset = address - extent.base;
      if (offset < 0 || offset % 4 !== 0) continue;
      const bytes = inputs.get(extent.id)!.bytes;
      if (offset >= bytes.length) continue;
      const word = bytes.readUInt32LE(offset);
      const decodable = isDecodableInstruction(word);
      const atEntry =
        isStackPrologue(word) || (offset >= 8 && isJrRa(bytes.readUInt32LE(offset - 8)) && decodable);
      return { contained: true, atEntry, decodable };
    }
    return NOWHERE;
  };
}

const pass1Extents = extentsFrom(firstPass);

const certificates = new Map<string, BaseCertificate>();
for (const member of members) {
  /* A member's own pass-1 base is not evidence for itself; only what other
     members were solved to independently counts as slot agreement. */
  const externalBases = pass1Extents.filter((e) => e.id !== member.id).map((e) => e.base);
  certificates.set(
    member.id,
    solveMemberBase(inputs.get(member.id)!, {
      externalBases,
      resolveElsewhere: makeResolver(pass1Extents, member.id),
    })
  );
}

const finalExtents = extentsFrom(certificates);

/** Which solved member in another slot contains this address? */
function owner(address: number, self: string, ownBase: number): SolvedExtent | undefined {
  return finalExtents.find(
    (e) => e.id !== self && e.base !== ownBase && address >= e.base && address < e.end
  );
}

// --- Report ---

console.log(`Overlay base solver: ${members.length} code members`);
console.log();
console.log(
  `${"MEMBER".padEnd(8)} ${"VERDICT".padEnd(13)} ${"BASE".padEnd(11)} ${"END".padEnd(11)} ${"SCORE".padStart(6)} ${"MARGIN".padStart(7)}  RESIDUAL`
);
for (const member of members) {
  const c = certificates.get(member.id)!;
  const end = c.base === null ? null : c.base + member.size;
  console.log(
    `${member.id.padEnd(8)} ${c.verdict.padEnd(13)} ${(c.base === null ? "-" : hex(c.base)).padEnd(11)} ${(end === null ? "-" : hex(end)).padEnd(11)} ${c.score.toFixed(3).padStart(6)} ${c.margin.toFixed(3).padStart(7)}  ${c.residuals.length === 0 ? "none" : `${c.residuals.length} constraint(s) short`}`
  );
}

console.log();
console.log("External call agreement (independent of the base — a decode check):");
for (const member of members) {
  const agreement = externalCallAgreement(inputs.get(member.id)!.bytes);
  const pct = agreement.total === 0 ? 100 : (agreement.known / agreement.total) * 100;
  console.log(
    `  ${member.id.padEnd(8)} ${agreement.known}/${agreement.total} external jal targets are known PS-X EXE functions (${pct.toFixed(1)}%)`
  );
}

// --- Slot grouping: members sharing a base share a slot ---

const slots = new Map<number, string[]>();
for (const extent of finalExtents) {
  slots.set(extent.base, [...(slots.get(extent.base) ?? []), extent.id]);
}
console.log();
console.log("Slots (members sharing a base are mutually exclusive in RAM):");
for (const [base, ids] of [...slots.entries()].sort((a, b) => a[0] - b[0])) {
  const largest = Math.max(...ids.map((id) => members.find((m) => m.id === id)!.size));
  console.log(`  ${hex(base)} .. ${hex(base + largest)}  ${ids.length} members: ${ids.join(" ")}`);
}

// --- Cross-member references, which the plan's earlier measurement did not expect ---

const crossCalls: string[] = [];
for (const member of members) {
  const c = certificates.get(member.id)!;
  if (c.verdict !== "resolved") continue;
  const targets = c.unexplainedTargets;
  const resolved = collectSelfReferences(inputs.get(member.id)!);
  for (const target of [...resolved.calls, ...resolved.jumps]) {
    const offset = target - c.base!;
    if (offset >= 0 && offset < member.size) continue;
    const other = owner(target, member.id, c.base!);
    if (other) crossCalls.push(`${member.id} -> ${other.id} at ${hex(target)}`);
  }
  if (targets.length > 0) {
    console.log();
    console.log(`${member.id}: ${targets.length} self-reference target(s) no member's extent explains:`);
    for (const t of targets.slice(0, 8)) console.log(`  ${hex(t)}`);
  }
}

if (crossCalls.length > 0) {
  console.log();
  console.log(`Cross-member references: ${crossCalls.length}`);
  const byPair = new Map<string, number>();
  for (const call of crossCalls) {
    const pair = call.split(" at ")[0]!;
    byPair.set(pair, (byPair.get(pair) ?? 0) + 1);
  }
  for (const [pair, count] of [...byPair.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${pair}: ${count} target(s)`);
  }
}

if (verbose) {
  for (const member of members) {
    const c = certificates.get(member.id)!;
    console.log();
    console.log(`=== ${member.id} — ${c.verdict}${c.base === null ? "" : ` at ${hex(c.base)}`} ===`);
    for (const line of c.evidence) console.log(`  ${line}`);
    for (const criterion of c.criteria) {
      console.log(`  ${criterion.name} (w=${criterion.weight}): ${criterion.value.toFixed(3)} — ${criterion.detail}`);
    }
    for (const residual of c.residuals) console.log(`  residual: ${residual}`);
  }
}

const unresolved = members.filter((m) => certificates.get(m.id)!.verdict !== "resolved");
console.log();
console.log(`${members.length - unresolved.length} resolved, ${unresolved.length} undetermined`);

if (write) {
  for (const member of manifest.members) {
    const c = certificates.get(member.id);
    if (!c) continue;
    member.base = {
      verdict: c.verdict,
      base: c.base,
      /* Every member's byte 0 sits at the solved base: the members that share a
         slot agree on the address of their leading id word, not on the address
         of the first instruction, so the loader copies the member whole. */
      loadOffset: 0,
      margin: c.margin,
      evidence: [...c.evidence, ...c.residuals.map((r) => `residual: ${r}`)],
    };
  }
  saveManifest(manifest);
  console.log("Recorded solved bases in configs/overlays.json");
}

process.exit(unresolved.length > 0 && write ? 1 : 0);

/* keep the type import used */
export type { ManifestMember };
