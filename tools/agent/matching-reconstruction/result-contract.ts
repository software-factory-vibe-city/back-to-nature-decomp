/**
 * The reconstruction result contract — what a consumer is allowed to read, and
 * on whose authority.
 *
 * Before this module, a consumer looked for `winner.c` or `best-effort.c` in a
 * function's result directory and used whatever it found. Two things go wrong
 * with that. A file left by an earlier run outlives the result that produced
 * it, so a run that ends `unsupported-target` can hand a consumer last week's
 * winner. And a file rewritten by hand, or truncated by an interrupted write,
 * reads as authoritative because nothing checks it.
 *
 * The rule here: **the current `result.json` manifest is the only authority on
 * what may be consumed.** An artifact is readable when the manifest names it
 * and its bytes still hash to the recorded value; otherwise the reader gets an
 * explicit refusal naming which of the two failed. A stale-by-provenance
 * result is readable but flagged, because "this is the answer for a tree that
 * has since changed" is a different statement from "this is the answer".
 *
 * `ArtifactRecorder` is the writing half: every file a run produces goes
 * through it, so the manifest cannot drift from the directory.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { ROOT } from "../decompToolchain.js";
import { sha256, computeProvenance, describeStaleReason, staleReason, type Provenance, type ProvenanceInputs } from "../provenance.js";
import {
  MATCHING_RECONSTRUCTION_SCHEMA_VERSION,
  type ResultArtifacts,
  type ResultBundle,
} from "./types.js";

/** Where a function's reconstruction result lives. */
export function resultDirectory(functionName: string): string {
  return join(ROOT, "build/matchingReconstruction", functionName);
}

/** The result document inside that directory. */
export function resultPath(functionName: string): string {
  return join(resultDirectory(functionName), "result.json");
}

/* ---- writing -------------------------------------------------------------- */

/**
 * Records every file a run writes, so the bundle's manifest is produced by the
 * same act that produces the files.
 *
 * Paths are stored relative to the result directory: a bundle copied or a tree
 * moved must stay readable, and an absolute path in a checked artifact is a
 * portability defect as well as a privacy one.
 */
export class ArtifactRecorder {
  private readonly files: Record<string, string> = {};

  constructor(private readonly directory: string) {}

  /** Write `content` to `name` inside the result directory and record its hash. */
  write(name: string, content: string): string {
    const path = join(this.directory, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
    this.files[this.key(path)] = sha256(content);
    return path;
  }

  /** Record a file written by someone else (a compile artifact, say). */
  record(path: string): void {
    if (!existsSync(path)) return;
    this.files[this.key(path)] = sha256(readFileSync(path));
  }

  /** Forget a previously recorded artifact — used when a draft is superseded. */
  forget(name: string): void {
    delete this.files[name];
  }

  manifest(): ResultArtifacts {
    return { files: { ...this.files } };
  }

  private key(path: string): string {
    const rel = relative(this.directory, path);
    return rel.startsWith("..") ? path : rel;
  }
}

/* ---- reading -------------------------------------------------------------- */

export type ArtifactRefusal =
  | { refused: "no-result"; detail: string }
  | { refused: "not-in-manifest"; detail: string }
  | { refused: "missing"; detail: string }
  | { refused: "hash-mismatch"; detail: string };

export interface LoadedResult {
  bundle: ResultBundle & { provenance?: Provenance };
  /** Non-null when the tree has changed since the result was produced. */
  stale: string | null;
  directory: string;
}

/**
 * Load one function's result, or say why there is none.
 *
 * A schema the reader does not understand is a refusal, not a best-effort
 * parse: the whole point of the contract is that a consumer never guesses what
 * a field meant in an older layout.
 */
export function loadResult(
  functionName: string,
  options: { freshnessInputs?: ProvenanceInputs } = {},
): LoadedResult | ArtifactRefusal {
  const directory = resultDirectory(functionName);
  const path = resultPath(functionName);
  if (!existsSync(path)) {
    return { refused: "no-result", detail: `no reconstruction result at ${relative(ROOT, path)}` };
  }
  let bundle: ResultBundle & { provenance?: Provenance };
  try {
    bundle = JSON.parse(readFileSync(path, "utf-8")) as ResultBundle & { provenance?: Provenance };
  } catch (error) {
    return { refused: "no-result", detail: `result.json is unreadable: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (bundle.schemaVersion !== MATCHING_RECONSTRUCTION_SCHEMA_VERSION) {
    return {
      refused: "no-result",
      detail: `result.json uses schema ${bundle.schemaVersion}; this reader understands ${MATCHING_RECONSTRUCTION_SCHEMA_VERSION}`,
    };
  }

  let stale: string | null = null;
  if (options.freshnessInputs) {
    const fresh = computeProvenance(functionName, options.freshnessInputs);
    const reason = staleReason(bundle.provenance, fresh);
    if (reason) stale = describeStaleReason(reason);
  }
  return { bundle, stale, directory };
}

/**
 * Read one artifact the result claims to have written.
 *
 * Both checks matter and they fail differently: `not-in-manifest` means this
 * result did not produce the file (so whatever is on disk belongs to another
 * run), while `hash-mismatch` means it did and the bytes have since changed.
 */
export function readResultArtifact(
  loaded: LoadedResult,
  name: string,
): { content: string; path: string } | ArtifactRefusal {
  const recorded = loaded.bundle.artifacts?.files?.[name];
  if (!recorded) {
    return {
      refused: "not-in-manifest",
      detail: `${name} is not in the current result's artifact manifest — any file of that name belongs to an earlier run`,
    };
  }
  const path = join(loaded.directory, name);
  if (!existsSync(path)) {
    return { refused: "missing", detail: `${name} is in the manifest but absent from ${relative(ROOT, loaded.directory)}` };
  }
  const content = readFileSync(path, "utf-8");
  if (sha256(content) !== recorded) {
    return { refused: "hash-mismatch", detail: `${name} no longer hashes to the value the result recorded` };
  }
  return { content, path };
}

/**
 * The best source this result offers, with its provenance made explicit.
 *
 * `winner` is an exact candidate; `best-effort` is the closest non-matching
 * one, whatever the terminal state was. A consumer that wants only exact
 * output should check `kind`, not the absence of the other.
 */
export function resultDraft(
  loaded: LoadedResult,
): { kind: "winner" | "best-effort"; source: string; outcome: NonNullable<ResultBundle["winner"] | ResultBundle["bestEffort"]> } | ArtifactRefusal {
  const bundle = loaded.bundle;
  if (bundle.winner) {
    const read = readResultArtifact(loaded, "winner.c");
    if ("refused" in read) return read;
    return { kind: "winner", source: read.content, outcome: bundle.winner };
  }
  if (bundle.bestEffort) {
    const read = readResultArtifact(loaded, "best-effort.c");
    if ("refused" in read) return read;
    return { kind: "best-effort", source: read.content, outcome: bundle.bestEffort };
  }
  return { refused: "not-in-manifest", detail: `${bundle.functionName}: the result carries neither a winner nor a best-effort draft` };
}

/** True for the refusal shape, so callers can narrow without a type import. */
export function isRefusal(value: unknown): value is ArtifactRefusal {
  return typeof value === "object" && value !== null && "refused" in value;
}
