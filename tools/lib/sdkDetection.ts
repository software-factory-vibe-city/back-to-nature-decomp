/** Signature/object cross-checks, independent of placement heuristics. */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { isReturnPadding, memberKey, parseSig, readTextObject, resolveSignatureObject, signatureId, signatureFits, type MemberMap, type SigEntry } from "./psyqMembers.js";

export interface CandidateMatch {
  offsets: number[];
  entry: SigEntry;
  oPath: string;
  libDir: string;
  textSize: number;
  sigLength: number;
}
export interface UnverifiableMatch {
  category: "matched-but-unverifiable";
  sigFile: string;
  member: string;
  identity: string;
  labels: string[];
  offsets: number[];
  oPath: string | null;
  reason: "unresolved-member" | "missing-file" | "invalid-object" | "size-mismatch" | "content-mismatch";
  detail: string;
  acknowledgement?: string;
}
export interface RejectedPlacement {
  category: "rejected-placement";
  oPath: string;
  offsets: number[];
  reason: "return-padding-without-independent-evidence";
}
export function findAllPatterns(binary: Buffer, searchStart: number, searchEnd: number, sigBytes: number[], sigMask: boolean[]): number[] {
  if (!sigBytes.length) return [];
  const offsets: number[] = [];
  const end = Math.min(searchEnd - 1, binary.length - sigBytes.length);
  for (let i = searchStart; i <= end; i += 4) {
    if (sigBytes.every((byte, j) => !sigMask[j] || binary[i + j] === byte)) offsets.push(i);
  }
  return offsets;
}
export function scanSdkSignatures(options: { root: string; sigDir: string; map: MemberMap | null; binary: Buffer; searchStart: number; searchEnd: number }): { candidates: CandidateMatch[]; matchedButUnverifiable: UnverifiableMatch[]; rejectedPlacements: RejectedPlacement[] } {
  const { root, sigDir, map, binary, searchStart, searchEnd } = options;
  const candidates: CandidateMatch[] = [], matchedButUnverifiable: UnverifiableMatch[] = [], rejectedPlacements: RejectedPlacement[] = [];
  for (const sigFile of readdirSync(sigDir).filter(f => f.endsWith(".json")).sort()) {
    const entries: SigEntry[] = JSON.parse(readFileSync(join(sigDir, sigFile), "utf8"));
    const groups = new Map<string, Set<string>>();
    for (const entry of entries) {
      const key = memberKey(entry.name);
      if (!groups.has(key)) groups.set(key, new Set());
      groups.get(key)!.add(signatureId(entry));
    }
    for (const entry of entries) {
      const { bytes, mask } = parseSig(entry.sig ?? "");
      if (bytes.length < 8) continue;
      const offsets = findAllPatterns(binary, searchStart, searchEnd, bytes, mask);
      if (!offsets.length) continue;
      const mapping = resolveSignatureObject(map, sigFile, entry, groups.get(memberKey(entry.name))!.size > 1);
      const fail = (reason: UnverifiableMatch["reason"], detail: string): void => {
        matchedButUnverifiable.push({ category: "matched-but-unverifiable", sigFile, member: entry.name, identity: signatureId(entry), labels: (entry.labels ?? []).map(l => l.name), offsets, oPath: mapping?.oPath ?? null, reason, detail });
      };
      if (!mapping) { fail("unresolved-member", "No unique signature identity in the SDK member map; run splitSdkLibs.ts"); continue; }
      const file = join(root, mapping.oPath);
      if (!existsSync(file)) { fail("missing-file", `Object not found: ${mapping.oPath}`); continue; }
      let object;
      try { object = readTextObject(readFileSync(file)); } catch (error) { fail("invalid-object", (error as Error).message); continue; }
      if (bytes.length > object.text.length) { fail("size-mismatch", `Signature ${bytes.length}B > .text ${object.text.length}B`); continue; }
      if (!signatureFits(entry, object)) { fail("content-mismatch", "Signature fixed bytes or exported label offsets disagree with its object"); continue; }
      if (isReturnPadding(object)) {
        // exe.txt is an OUTPUT of detection, not independent placement evidence.
        // Return-only members cannot claim a preceding unmatched function's tail.
        rejectedPlacements.push({ category: "rejected-placement", oPath: mapping.oPath, offsets, reason: "return-padding-without-independent-evidence" });
        continue;
      }
      const verifiedOffsets = offsets.filter(offset => offset + object.text.length <= binary.length && object.text.every((byte, i) => (byte & object.relocationMask[i]!) === (binary[offset + i]! & object.relocationMask[i]!)));
      if (!verifiedOffsets.length) { fail("content-mismatch", "No signature hit verifies the complete object .text modulo ELF relocations"); continue; }
      candidates.push({ offsets: verifiedOffsets, entry, ...mapping, textSize: object.text.length, sigLength: bytes.length });
    }
  }
  return { candidates, matchedButUnverifiable, rejectedPlacements };
}

export interface DetectionAcknowledgement {
  version: string;
  targetHash: string;
  sigFile: string;
  identity: string;
  reason: UnverifiableMatch["reason"];
  offsets: number[];
  evidence: string;
}
export function acknowledgeFindings(findings: UnverifiableMatch[], acknowledgements: DetectionAcknowledgement[], version: string, targetHash: string): number {
  for (const finding of findings) {
    delete finding.acknowledgement;
    const row = acknowledgements.find(a => a.version === version && a.targetHash === targetHash && a.sigFile === finding.sigFile && a.identity === finding.identity && a.reason === finding.reason && JSON.stringify(a.offsets) === JSON.stringify(finding.offsets) && a.evidence.trim());
    if (row) finding.acknowledgement = row.evidence;
  }
  return findings.filter(f => !f.acknowledgement).length;
}

export interface DetectionReport<T> {
  schemaVersion: 1;
  matches: T[];
  matchedButUnverifiable: UnverifiableMatch[];
  rejectedPlacements: RejectedPlacement[];
  unacknowledged: number;
}
/** Downstream generators cannot turn incomplete detection into a layout. */
export function verifiedMatches<T>(output: string): T[] {
  const report: DetectionReport<T> = JSON.parse(output);
  if (report.schemaVersion !== 1 || !Array.isArray(report.matches) || !Array.isArray(report.matchedButUnverifiable) || report.unacknowledged !== 0 || report.matchedButUnverifiable.some(f => !f.acknowledgement)) throw new Error("SDK detection is incomplete: inspect matched-but-unverifiable findings");
  return report.matches;
}
