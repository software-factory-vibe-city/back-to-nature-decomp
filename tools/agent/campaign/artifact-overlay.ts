/**
 * The recovered-artifact overlay — where a verified recovery goes so the next
 * attempt can use it.
 *
 * A campaign that learns nothing from its own successes is not a fixed point.
 * The mechanics of that failure are mundane: the donor index and the signature
 * resolver both ask `src/`, a campaign is forbidden to write `src/`, and so a
 * function it recovered byte-exactly five seconds ago is, to every consumer,
 * still a stub with no C and no declared interface. Its family gains no donor.
 * Its callers still see an ABI bound instead of a signature. Another round of
 * the same loop asks the same questions and gets the same answers.
 *
 * The overlay is the missing tier: a store of recovered C that is *not* `src/`,
 * that consumers consult where they consult `src/`, and that carries a
 * **revision** so every cache keyed on project context invalidates the moment
 * something is published. Promoting an entry into `src/` remains a separate,
 * separately authorized step — the overlay makes a recovery usable without
 * making it permanent.
 *
 * **Nothing enters unverified.** Publication compiles the source under the
 * production flag column, requires the relocated-byte oracle to return `match`,
 * requires the front end to raise no constraint violation, and rejects any
 * source containing assembly or a pinned register. An overlay of plausible
 * drafts would be worse than no overlay: it would feed guesses to the very
 * consumers that exist to tell evidence from guesses.
 *
 * **Context is carried, not lost.** Each entry records the mode it was
 * recovered under. A cold run reads only cold entries, because a warm recovery
 * used the project's headers and donors and re-admitting it through the overlay
 * would quietly turn a cold measurement into a warm one.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { ROOT, compileSource, rejectionFromDiagnostics } from "../decompToolchain.js";
import { requireFunctionLocation } from "../../lib/symbolIndex.js";
import { compareFunction } from "../../lib/functionOracle.js";
import { excludedReason } from "../idiom-corpus/corpus.js";
import { contextMode, type ContextMode } from "../matching-reconstruction/context-mode.js";

export interface OverlayEntry {
  functionName: string;
  containerId: string;
  /** Path to the published C, relative to the repository root. */
  sourcePath: string;
  /** sha256 of the published source, so a hand-edit is visible. */
  sha256: string;
  /** How the recovery was produced, for a reader deciding whether to trust it. */
  route: "family-transfer" | "reconstruction" | "external";
  /** The context this was recovered under; a cold run reads only cold entries. */
  contextMode: ContextMode;
  /** Words the oracle compared, all of which matched. */
  words: number;
}

export interface Overlay {
  /**
   * Content hash over the entries.
   *
   * Consumers put this in their cache keys. A revision that changed only when
   * someone remembered to bump it would let a stale donor index outlive the
   * publication that should have invalidated it — the exact failure this whole
   * mechanism exists to prevent.
   */
  revision: string;
  entries: OverlayEntry[];
}

/**
 * Where the overlay lives.
 *
 * Read per call, and overridable through `PSX_OVERLAY_ROOT`, because the
 * overlay is shared mutable state: two test files running concurrently, or a
 * campaign running beside an evaluation, would otherwise publish into each
 * other's measurements. An experiment that needs a private overlay sets the
 * variable; everything else gets the project's one.
 */
export function overlayRoot(): string {
  const configured = process.env["PSX_OVERLAY_ROOT"];
  return configured ? (isAbsolute(configured) ? configured : join(ROOT, configured)) : join(ROOT, "build/recoveredOverlay");
}

const manifestPath = (): string => join(overlayRoot(), "overlay.json");

const EMPTY: Overlay = { revision: "empty", entries: [] };

/**
 * One parsed manifest per process, invalidated by the file's own bytes.
 *
 * Consumers ask for the revision on every cache lookup, so re-reading and
 * re-parsing the manifest each time would cost more than the caches save.
 */
let cached: { raw: string; overlay: Overlay } | undefined;

export function loadOverlay(): Overlay {
  if (!existsSync(manifestPath())) {
    cached = undefined;
    return EMPTY;
  }
  const raw = readFileSync(manifestPath(), "utf-8");
  if (cached && cached.raw === raw) return cached.overlay;
  let overlay: Overlay;
  try {
    overlay = JSON.parse(raw) as Overlay;
  } catch {
    return EMPTY;
  }
  cached = { raw, overlay };
  return overlay;
}

/**
 * The revision visible to the current context mode.
 *
 * Not simply `loadOverlay().revision`: a cold run ignores warm entries, so two
 * runs that see different entry sets must see different revisions, or one will
 * serve the other's cached index.
 */
export function overlayRevision(): string {
  const visible = visibleEntries();
  if (visible.length === 0) return "empty";
  return digestOf(visible);
}

/** Entries the current context mode is allowed to read. */
export function visibleEntries(): OverlayEntry[] {
  const mode = contextMode();
  return loadOverlay().entries.filter((entry) => mode === "warm" || entry.contextMode === "cold");
}

/** The published source for one function, or null when nothing is published. */
export function overlaySourceFor(functionName: string): { path: string; text: string } | null {
  const entry = visibleEntries().find((candidate) => candidate.functionName === functionName);
  if (!entry) return null;
  const path = isAbsolute(entry.sourcePath) ? entry.sourcePath : join(ROOT, entry.sourcePath);
  if (!existsSync(path)) return null;
  const text = readFileSync(path, "utf-8");
  /* A published entry whose file no longer hashes to its manifest entry is not
   * the artifact that was verified, and serving it would make the verification
   * a claim about a different file. */
  if (sha256(text) !== entry.sha256) return null;
  return { path, text };
}

export type PublishResult =
  | { published: OverlayEntry; revision: string }
  | { refused: string };

/**
 * Verify a recovered source and add it to the overlay.
 *
 * The verification is repeated here rather than trusted from the producer. A
 * campaign, a transfer and a hand-written experiment all reach this function,
 * and "the caller says it matched" is the kind of provenance that stops being
 * true one refactor later. Compiling once more costs a second and makes the
 * overlay's invariant checkable from the overlay alone.
 */
export function publishRecovered(
  functionName: string,
  source: string,
  route: OverlayEntry["route"],
): PublishResult {
  const assembly = excludedReason(source);
  if (assembly) {
    return { refused: `${functionName}: the source is excluded as ${assembly}; the overlay holds compiled C only` };
  }

  const location = requireFunctionLocation(functionName);
  const workspace = join(overlayRoot(), "verify", functionName);
  mkdirSync(workspace, { recursive: true });
  const staged = join(workspace, `${functionName}.c`);
  writeFileSync(staged, source);

  let compiled;
  try {
    compiled = compileSource(staged, workspace, functionName, {
      assemble: true,
      containerKind: location.container.kind,
    });
  } catch (error) {
    return { refused: `${functionName}: does not compile — ${(error instanceof Error ? error.message : String(error)).slice(0, 200)}` };
  }

  const rejection = rejectionFromDiagnostics(compiled.diagnostics);
  if (rejection) return { refused: `${functionName}: invalid C accepted by the front end — ${rejection}` };

  const oracle = compareFunction(functionName, { objectPath: compiled.object!, container: location.container });
  if (oracle.verdict !== "match") {
    return { refused: `${functionName}: the oracle says ${oracle.verdict} (${oracle.same}/${oracle.targetWords.length}); only a match is published` };
  }

  const sourcesDir = join(overlayRoot(), "sources");
  mkdirSync(sourcesDir, { recursive: true });
  const published = join(sourcesDir, `${functionName}.c`);
  writeFileSync(published, source);

  const entry: OverlayEntry = {
    functionName,
    containerId: location.container.id,
    /* Relative to the repository when the overlay lives inside it, so the
     * manifest is the same on every machine; absolute only when a private root
     * was configured outside the tree. */
    sourcePath: published.startsWith(`${ROOT}/`) ? published.slice(ROOT.length + 1) : published,
    sha256: sha256(source),
    route,
    contextMode: contextMode(),
    words: oracle.targetWords.length,
  };

  const entries = loadOverlay().entries.filter((existing) => existing.functionName !== functionName);
  entries.push(entry);
  entries.sort((left, right) => left.functionName.localeCompare(right.functionName));
  writeManifest(entries);
  return { published: entry, revision: overlayRevision() };
}

/** Remove one entry, or every entry when no name is given. */
export function retractRecovered(functionName?: string): string {
  const entries = functionName === undefined
    ? []
    : loadOverlay().entries.filter((entry) => entry.functionName !== functionName);
  if (functionName === undefined) {
    rmSync(overlayRoot(), { recursive: true, force: true });
    cached = undefined;
    return overlayRevision();
  }
  writeManifest(entries);
  return overlayRevision();
}

function writeManifest(entries: OverlayEntry[]): void {
  mkdirSync(overlayRoot(), { recursive: true });
  const overlay: Overlay = { revision: digestOf(entries), entries };
  writeFileSync(manifestPath(), `${JSON.stringify(overlay, null, 1)}\n`);
  cached = undefined;
}

/** A revision is a content hash, so publishing and retracting cannot drift. */
function digestOf(entries: OverlayEntry[]): string {
  const hash = createHash("sha256");
  for (const entry of [...entries].sort((left, right) => left.functionName.localeCompare(right.functionName))) {
    hash.update(`${entry.functionName}|${entry.sha256}|${entry.contextMode}\n`);
  }
  return hash.digest("hex").slice(0, 16);
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/** A readable summary, for a campaign report or a bundle heading. */
export function describeOverlay(): string[] {
  const visible = visibleEntries();
  if (visible.length === 0) return [`recovered-artifact overlay: empty (revision ${overlayRevision()})`];
  const byRoute = new Map<string, number>();
  for (const entry of visible) byRoute.set(entry.route, (byRoute.get(entry.route) ?? 0) + 1);
  return [
    `recovered-artifact overlay: ${visible.length} verified entr(ies) at revision ${overlayRevision()}`,
    ...[...byRoute].sort().map(([route, count]) => `  ${route}: ${count}`),
    `  every entry compiled under production flags and matched the relocated-byte oracle`,
  ];
}
