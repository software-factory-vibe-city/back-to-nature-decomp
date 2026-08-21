/**
 * overlayManifest.ts — the archive member manifest every later tool reads.
 *
 * Deliverable 1 of plans/overlay-decompilation-enablement.md publishes
 * `configs/overlays.json` so that nothing downstream re-parses the container.
 * Member identity is the index position in the archive's own table: it is
 * derived, so it is never wrong, and a semantic name is only ever an alias
 * added on top of it.
 */

import { closeSync, existsSync, openSync, readFileSync, readSync, writeFileSync } from "fs";
import { join } from "path";
import { ROOT } from "./psxExeInfo.js";

export const MANIFEST_PATH = "configs/overlays.json";

/** How a member's bytes were classified — filled in by classifyArchiveMembers.ts. */
export interface MemberClassification {
  /** `code` and `data` are verdicts; `undetermined` is a real, reportable outcome. */
  verdict: "code" | "data" | "undetermined";
  /** Recognised container/asset format, when one was identified. */
  format: string | null;
  evidence: string[];
}

/** The solved load address for a code member — filled in by solveOverlayBase.ts. */
export interface MemberBase {
  verdict: "resolved" | "undetermined";
  /** Load address of the member's first loaded byte, when resolved. */
  base: number | null;
  /** Bytes of the member skipped before the loaded image begins (the leading tag word, or 0). */
  loadOffset: number;
  /** Score margin over the runner-up candidate base. */
  margin: number;
  evidence: string[];
}

export interface ManifestMember {
  index: number;
  /** Stable container id, e.g. `ovl_11`. */
  id: string;
  offset: number;
  end: number;
  size: number;
  sector: number;
  sectorCount: number;
  /** The member's leading little-endian u32, as hex — a format magic or an overlay id. */
  tag: string;
  sha256: string;
  classification?: MemberClassification;
  base?: MemberBase;
  /** Semantic name, adopted only on the Deliverable 10 evidence bar. */
  alias?: string;
}

export interface OverlayManifest {
  generatedBy: string;
  archive: {
    indexPath: string;
    dataPath: string;
    dataSize: number;
    indexSha256: string;
    dataSha256: string;
    sectorSize: number;
    format: string;
    formatDescription: string;
    formatScore: number;
    formatMargin: number;
    formatRunnerUp: string | null;
    formatEvidence: string[];
  };
  members: ManifestMember[];
}

/** `ovl_NN` from an archive member index — the durable identifier. */
export function memberId(index: number): string {
  return `ovl_${String(index).padStart(2, "0")}`;
}

export function manifestPath(): string {
  return join(ROOT, MANIFEST_PATH);
}

export function loadManifest(): OverlayManifest | null {
  const path = manifestPath();
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8")) as OverlayManifest;
}

export function requireManifest(): OverlayManifest {
  const manifest = loadManifest();
  if (!manifest) {
    throw new Error(
      `${MANIFEST_PATH} not found. Run: npx tsx tools/build/extractArchive.ts --write`
    );
  }
  return manifest;
}

export function saveManifest(manifest: OverlayManifest): void {
  writeFileSync(manifestPath(), `${JSON.stringify(manifest, null, 2)}\n`);
}

/** Members classified as code — the decompilation targets. */
export function codeMembers(manifest: OverlayManifest): ManifestMember[] {
  return manifest.members.filter((m) => m.classification?.verdict === "code");
}

/** Where extractArchive.ts writes a member's bytes. */
export function memberBinPath(member: ManifestMember): string {
  return join(ROOT, "extracted/overlays", `${member.id}.bin`);
}

/**
 * A member's bytes, from its extracted file when one exists and from the
 * archive otherwise. Large data members are not worth a second copy on disk,
 * so no tool may assume extraction has happened.
 */
export function readMemberBytes(manifest: OverlayManifest, member: ManifestMember): Buffer {
  const extracted = memberBinPath(member);
  if (existsSync(extracted)) return readFileSync(extracted);

  const archive = join(ROOT, manifest.archive.dataPath);
  const fd = openSync(archive, "r");
  try {
    const buffer = Buffer.allocUnsafe(member.size);
    let filled = 0;
    while (filled < buffer.length) {
      const read = readSync(fd, buffer, filled, buffer.length - filled, member.offset + filled);
      if (read <= 0) break;
      filled += read;
    }
    return buffer.subarray(0, filled);
  } finally {
    closeSync(fd);
  }
}
