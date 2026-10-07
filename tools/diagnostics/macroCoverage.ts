/** Coverage and presence are separate from macro identity. Raw opcode hits in
 * unenabled overlays may be data; they never become functions or template tiles. */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { ROOT } from "../lib/psxExeInfo.js";
import { containerPath, containerTargetPath, type Container } from "../lib/container.js";
import { loadManifest } from "../lib/overlayManifest.js";
import { loadSubsegments } from "../lib/symbolIndex.js";
import type { MacroFunction } from "./macroTiler.js";

export interface MacroTextRange { startOffset: number; endOffset: number; startVram: number; endVram: number }
export interface MacroScanCoverage {
  scope: "project" | "selected-containers" | "selected-functions" | "injected-functions";
  functionByteSource: "original-target-bytes" | "caller-supplied-bytes";
  sourceEligibility: "all-function-extents-including-INCLUDE_ASM" | "selected-function-extents-including-INCLUDE_ASM" | "caller-supplied-functions";
  containersScanned: Array<{ container: string; targetPath: string | null; functionCount: number; textRanges: MacroTextRange[] }>;
  containersSkipped: Array<{ container: string; targetPath: string; reason: string }>;
  complete: boolean;
  caveats: string[];
}
export interface MacroPresence {
  container: string;
  targetPath: string;
  targetSha256: string;
  tier: "presence-only";
  containerEnabled: boolean;
  bounds: "splat-text" | "unbounded";
  reason: string;
  ranges: Array<{ startOffset: number; endOffset: number }>;
  scannedWords: number;
  trailingBytesIgnored: number;
  counts: { COP2: number; LWC2: number; SWC2: number; total: number };
  clustering: { windowWords: 32; minimumOps: 3 };
  clusters: Array<{ startOffset: number; endOffset: number; startVram: number | null; endVram: number | null; opCount: number }>;
  caveat: string;
}

/** Includes c and asm extents regardless of source status, and SDK .text
 * objects. Explicit data/BSS objects are never treated as code. */
export function loadMacroTextRanges(container: Container, mergeAdjacent = true): MacroTextRange[] {
  const path = containerPath(container, "splat");
  if (!existsSync(path)) return [];
  const yaml = readFileSync(path, "utf8");
  const objects = new Set([...yaml.matchAll(/^\s*-\s*\[(0x[\da-f]+|\d+)\s*,\s*o\s*,[^,\]\n]+(?:,\s*\.text)?\s*\]/gim)].map(m => Number(m[1])));
  const ranges = loadSubsegments(container).filter(s => s.type === "c" || s.type === "asm" || s.type === ".text" || s.type === "text" || s.type === "o" && objects.has(s.rom))
    .filter(s => s.size > 0).map(s => ({ startOffset: s.rom, endOffset: s.rom + s.size, startVram: s.vram, endVram: s.vram + s.size })).sort((a, b) => a.startOffset - b.startOffset);
  // Function-table extents must fit an individual splat entry/object, not
  // merely a concatenation of unrelated adjacent objects.
  if (!mergeAdjacent) return ranges;
  const merged: MacroTextRange[] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && last.endOffset === range.startOffset && last.endVram === range.startVram) { last.endOffset = range.endOffset; last.endVram = range.endVram; }
    else merged.push({ ...range });
  }
  return merged;
}

/** Sliding 32-word windows, merging overlapping qualifying windows. Counts
 * and addresses are observations, not proof that the scanned bytes are code. */
export function scanMacroPresence(bytes: Buffer, input: {
  container: string; targetPath: string; enabled: boolean; reason: string;
  ranges?: Array<{ startOffset: number; endOffset: number }>; base?: number | null;
}): MacroPresence {
  const ranges = input.ranges ?? [{ startOffset: 0, endOffset: bytes.length - bytes.length % 4 }];
  const counts = { COP2: 0, LWC2: 0, SWC2: 0, total: 0 };
  const clusters: MacroPresence["clusters"] = [];
  let scannedWords = 0;
  for (const range of ranges) {
    if (range.startOffset % 4 || range.endOffset % 4 || range.startOffset < 0 || range.endOffset > bytes.length || range.endOffset < range.startOffset) throw new Error(`Invalid presence range for ${input.container}`);
    const offsets: number[] = [];
    for (let at = range.startOffset; at < range.endOffset; at += 4) {
      const op = bytes.readUInt32LE(at) >>> 26;
      scannedWords++;
      if (op === 0x12) counts.COP2++;
      else if (op === 0x32) counts.LWC2++;
      else if (op === 0x3a) counts.SWC2++;
      else continue;
      offsets.push(at); counts.total++;
    }
    const windows: Array<{ startOffset: number; endOffset: number }> = [];
    let left = 0, right = 0;
    for (let start = range.startOffset; start < range.endOffset; start += 4) {
      const end = Math.min(start + 32 * 4, range.endOffset);
      while (left < offsets.length && offsets[left]! < start) left++;
      while (right < offsets.length && offsets[right]! < end) right++;
      if (right - left < 3) continue;
      const last = windows[windows.length - 1];
      if (last && start < last.endOffset) last.endOffset = end;
      else windows.push({ startOffset: start, endOffset: end });
    }
    let cursor = 0;
    for (const window of windows) {
      while (cursor < offsets.length && offsets[cursor]! < window.startOffset) cursor++;
      const first = cursor;
      while (cursor < offsets.length && offsets[cursor]! < window.endOffset) cursor++;
      clusters.push({ ...window, startVram: input.base == null ? null : input.base + window.startOffset, endVram: input.base == null ? null : input.base + window.endOffset, opCount: cursor - first });
    }
  }
  return { container: input.container, targetPath: input.targetPath, targetSha256: createHash("sha256").update(bytes).digest("hex"), tier: "presence-only", containerEnabled: input.enabled, bounds: input.enabled ? "splat-text" : "unbounded", reason: input.reason, ranges, scannedWords, trailingBytesIgnored: input.ranges ? 0 : bytes.length % 4, counts, clustering: { windowWords: 32, minimumOps: 3 }, clusters,
    caveat: input.enabled ? "Opcode presence within configured splat text only; no macro identity is claimed." : "Container not enabled. Unbounded raw-word scan may interpret data as COP2/LWC2/SWC2; clusters are enablement-priority signals only, not functions or macro matches." };
}

export function collectMacroCoverage(containers: readonly Container[], functions: readonly MacroFunction[], findings: readonly { container: string; reason: string }[], options: {
  scope: MacroScanCoverage["scope"]; overlayDirectory?: string; requestedIds?: readonly string[];
}): { coverage: MacroScanCoverage; presence: MacroPresence[] } {
  const coverage: MacroScanCoverage = { scope: options.scope, functionByteSource: options.scope === "injected-functions" ? "caller-supplied-bytes" : "original-target-bytes", sourceEligibility: options.scope === "injected-functions" ? "caller-supplied-functions" : options.scope === "selected-functions" ? "selected-function-extents-including-INCLUDE_ASM" : "all-function-extents-including-INCLUDE_ASM", containersScanned: [], containersSkipped: [], complete: findings.length === 0, caveats: ["Unscanned containers have unknown macro identity, not zero macros.", "Presence-only observations do not contribute to function counts, template coverage or mining."] };
  const presence: MacroPresence[] = [];
  if (options.scope === "injected-functions") {
    for (const id of new Set(functions.map(f => f.container))) coverage.containersScanned.push({ container: id, targetPath: null, functionCount: functions.filter(f => f.container === id).length, textRanges: [] });
    return { coverage, presence };
  }
  const directory = options.overlayDirectory ?? join(ROOT, "extracted/overlays");
  const files = existsSync(directory) ? readdirSync(directory).filter(f => f.endsWith(".bin")).sort().map(f => join(directory, f)) : [];
  const targets = new Map(containers.map(c => [c.id, containerTargetPath(c)]));
  for (const file of files) targets.set(basename(file, ".bin"), file);
  const members = loadManifest()?.members ?? [];
  for (const [id, target] of targets) {
    const container = containers.find(c => c.id === id);
    const requested = !options.requestedIds || options.requestedIds.includes(id);
    const enabled = !!container && existsSync(containerPath(container, "splat"));
    let reason: string | null = null;
    if (!requested || !container && options.scope === "selected-containers" && !options.requestedIds) reason = "Outside requested container scope";
    else if (!existsSync(target)) reason = "Original binary missing";
    else if (!enabled) {
      const member = members.find(m => m.id === id);
      reason = !member ? "No manifest/container mapping and no enabled splat configuration" : member.classification?.verdict !== "code" ? `No enabled splat/container mapping; manifest classification ${member.classification?.verdict ?? "missing"}; container not enabled` : member.base?.verdict !== "resolved" ? "Overlay base unresolved; container not enabled" : "No splat configuration; container not enabled";
    } else if (!functions.some(f => f.container === id)) reason = options.scope === "selected-functions" ? "No functions in requested function scope" : "No valid function extents scanned";
    if (reason) {
      coverage.containersSkipped.push({ container: id, targetPath: relative(ROOT, target), reason });
      if (!["Outside requested container scope", "No functions in requested function scope"].includes(reason)) coverage.complete = false;
    } else coverage.containersScanned.push({ container: id, targetPath: relative(ROOT, target), functionCount: functions.filter(f => f.container === id).length, textRanges: loadMacroTextRanges(container!) });
    if (!requested || reason === "Outside requested container scope" || !existsSync(target)) continue;
    const bytes = readFileSync(target);
    if (enabled) {
      const ranges = loadMacroTextRanges(container!);
      const valid = ranges.every(r => r.startOffset >= container!.payloadOffset && r.endOffset <= Math.min(bytes.length, container!.payloadOffset + container!.payloadSize) && r.startOffset % 4 === 0 && r.endOffset % 4 === 0);
      if (!valid) { coverage.complete = false; coverage.containersSkipped.push({ container: id, targetPath: relative(ROOT, target), reason: "Invalid/truncated splat text bounds; presence scan refused" }); continue; }
      presence.push(scanMacroPresence(bytes, { container: id, targetPath: relative(ROOT, target), enabled: true, ranges, base: container!.loadAddr - container!.payloadOffset, reason: "Configured text bounds" }));
    } else {
      const member = members.find(m => m.id === id);
      presence.push(scanMacroPresence(bytes, { container: id, targetPath: relative(ROOT, target), enabled: false, reason: reason!, base: member?.base?.verdict === "resolved" ? member.base.base : null }));
    }
  }
  return { coverage, presence };
}
