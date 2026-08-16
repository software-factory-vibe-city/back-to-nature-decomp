/**
 * provenance.ts — every artifact carries the identity of what produced it.
 *
 * The rule this module exists to enforce: a tool call reports the state of the
 * tree *now*. Never the state at some earlier call, and never a state that
 * depends on the caller having run another tool first.
 *
 * Two failures motivated it, both measured:
 *
 *   - A cached artifact read without a freshness check. The pipeline reversal
 *     defaulted to `build/src/<fn>.c.o`, an object only `make` writes, and
 *     labelled the reading `baseline`. Sources edited after the last build
 *     scored as their previous selves, so a real improvement read as
 *     `identical` and was recorded as a dead axis.
 *   - A prerequisite the caller had to know about. Three tools threw
 *     `Missing build/...` and left the reader to work out which other tool
 *     writes that path. The deepest chain was three tools long and undocumented,
 *     so the axis it served was never exercised.
 *
 * The fix for both is the same: an artifact stamps the fingerprint of every
 * input it was derived from, a consumer recomputes that fingerprint before
 * reading, and a miss *produces* the artifact rather than reporting its absence.
 * Reuse is then an optimisation that cannot change an answer, and the caller
 * never sequences anything.
 *
 * A fingerprint covers three things, because all three change results:
 * the input files' bytes, the toolchain identity, and the producing code
 * itself — a tool whose logic changed must not reuse yesterday's output.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative } from "node:path";
import { ROOT, configuredToolchainIdentity } from "./decompToolchain.js";

/* ---- primitives ---------------------------------------------------------
 * These lived in variant-lab/artifacts.ts, which re-exports them so existing
 * call sites keep working. They are here because provenance is cross-cutting
 * and must not import from one tool's subdirectory. */

export function sha256(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

export function sha256File(path: string): string {
  return sha256(readFileSync(path));
}

export function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableValue(child)]),
    );
  }
  return value;
}

export function stableJson(value: unknown): string {
  return `${JSON.stringify(stableValue(value), null, 2)}\n`;
}

export function writeStableJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, stableJson(value));
}

export function projectPath(path: string): string {
  if (!isAbsolute(path)) return path.replace(/\\/g, "/");
  const related = relative(ROOT, path).replace(/\\/g, "/");
  return related.startsWith("../") ? path : related;
}

/* ---- fingerprints ------------------------------------------------------- */

export const PROVENANCE_SCHEMA_VERSION = 1;

/** What an artifact was derived from. Anything omitted here is a staleness hole. */
export interface ProvenanceInputs {
  /**
   * Files whose bytes decide the result. Missing files are recorded as absent
   * rather than throwing: "the source did not exist" is itself an input state,
   * and a later run that creates the file must count as a change.
   */
  files?: string[];
  /** Non-file inputs — CLI options, flags, derived identities. */
  values?: Record<string, unknown>;
  /**
   * Source files of the producing tool. A logic change must invalidate the
   * cache; see `implementationHash`.
   */
  implementation?: string[];
}

export interface Provenance {
  schemaVersion: number;
  function: string;
  /** Project-relative path → SHA-256, or `"absent"` when the file is missing. */
  files: Record<string, string>;
  /** Input name → SHA-256 of its stable JSON. */
  values: Record<string, string>;
  toolchainHash: string;
  implementationHash: string;
  /** SHA-256 over every field above. The single value a consumer compares. */
  fingerprint: string;
  producedAt: string;
}

let cachedToolchainHash: string | undefined;

/** The toolchain identity hash. Computed once — it shells out to four binaries. */
export function toolchainHash(): string {
  cachedToolchainHash ??= sha256(stableJson(configuredToolchainIdentity()));
  return cachedToolchainHash;
}

/**
 * Hash the producing tool's own code, so a logic change invalidates its cache.
 *
 * Accepts files and directories; directories contribute every non-test `.ts`
 * beneath them, sorted, so adding a module to a tool's directory changes the
 * hash without anyone maintaining a list.
 */
export function implementationHash(paths: string[]): string {
  const files: string[] = [];
  const visit = (path: string): void => {
    const absolute = isAbsolute(path) ? path : join(ROOT, path);
    if (!existsSync(absolute)) return;
    if (!statSync(absolute).isDirectory()) {
      files.push(absolute);
      return;
    }
    for (const name of readdirSync(absolute).sort()) {
      const child = join(absolute, name);
      if (statSync(child).isDirectory()) visit(child);
      else if (name.endsWith(".ts") && !name.endsWith(".test.ts")) files.push(child);
    }
  };
  for (const path of paths) visit(path);
  files.sort();
  return sha256(files.map((path) => `${projectPath(path)}:${sha256File(path)}`).join("\n"));
}

/** Compute the provenance stamp for an artifact about to be produced. */
export function computeProvenance(functionName: string, inputs: ProvenanceInputs): Provenance {
  const files: Record<string, string> = {};
  for (const path of (inputs.files ?? []).slice().sort()) {
    const absolute = isAbsolute(path) ? path : join(ROOT, path);
    files[projectPath(absolute)] = existsSync(absolute) ? sha256File(absolute) : "absent";
  }

  const values: Record<string, string> = {};
  for (const [name, value] of Object.entries(inputs.values ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
    values[name] = sha256(stableJson(value));
  }

  const identity = {
    schemaVersion: PROVENANCE_SCHEMA_VERSION,
    function: functionName,
    files,
    values,
    toolchainHash: toolchainHash(),
    implementationHash: inputs.implementation ? implementationHash(inputs.implementation) : "unspecified",
  };

  return {
    ...identity,
    fingerprint: sha256(stableJson(identity)),
    producedAt: new Date().toISOString(),
  };
}

/**
 * Why a stored artifact could not be reused. Returned rather than thrown so a
 * caller can put the reason in its own output — "regenerated because the source
 * changed" is a useful line, "regenerated" is not.
 */
export type StaleReason =
  | { kind: "absent" }
  | { kind: "unstamped" }
  | { kind: "schema"; stored: number }
  | { kind: "files"; changed: string[] }
  | { kind: "values"; changed: string[] }
  | { kind: "toolchain" }
  | { kind: "implementation" };

export function describeStaleReason(reason: StaleReason): string {
  switch (reason.kind) {
    case "absent": return "no previous run";
    case "unstamped": return "the previous run predates provenance stamping";
    case "schema": return `the previous run used provenance schema ${reason.stored}`;
    case "files": return `${reason.changed.join(", ")} changed`;
    case "values": return `${reason.changed.join(", ")} changed`;
    case "toolchain": return "the toolchain changed";
    case "implementation": return "the tool's own code changed";
  }
}

/**
 * Compare a stored stamp against a freshly computed one.
 *
 * Reports the most specific reason rather than the fingerprint mismatch, so the
 * message names the thing the caller can act on.
 */
export function staleReason(stored: Provenance | undefined, fresh: Provenance): StaleReason | undefined {
  if (!stored) return { kind: "absent" };
  if (typeof stored.fingerprint !== "string") return { kind: "unstamped" };
  if (stored.schemaVersion !== fresh.schemaVersion) return { kind: "schema", stored: stored.schemaVersion };
  if (stored.fingerprint === fresh.fingerprint) return undefined;

  const changedFiles = Object.keys(fresh.files).filter((path) => stored.files?.[path] !== fresh.files[path]);
  const droppedFiles = Object.keys(stored.files ?? {}).filter((path) => !(path in fresh.files));
  if (changedFiles.length > 0 || droppedFiles.length > 0) {
    return { kind: "files", changed: [...changedFiles, ...droppedFiles].sort() };
  }

  const changedValues = Object.keys(fresh.values).filter((name) => stored.values?.[name] !== fresh.values[name]);
  const droppedValues = Object.keys(stored.values ?? {}).filter((name) => !(name in fresh.values));
  if (changedValues.length > 0 || droppedValues.length > 0) {
    return { kind: "values", changed: [...changedValues, ...droppedValues].sort() };
  }

  if (stored.toolchainHash !== fresh.toolchainHash) return { kind: "toolchain" };
  if (stored.implementationHash !== fresh.implementationHash) return { kind: "implementation" };
  return { kind: "files", changed: ["an unrecorded input"] };
}

/* ---- ensure ------------------------------------------------------------- */

export interface EnsureOptions<T> {
  /** JSON artifact carrying the stamp. `produce` must write it. */
  artifactPath: string;
  /** What this artifact is, for messages: "target schedule analysis". */
  label: string;
  functionName: string;
  inputs: ProvenanceInputs;
  /** Build the artifact from scratch and write `artifactPath`. */
  produce: (provenance: Provenance) => T;
  /** Read a stored artifact whose stamp already matched. */
  read: (stored: unknown) => T;
  /**
   * Cost hint printed before a regeneration that will take a while, so a long
   * tool call explains itself instead of appearing hung.
   */
  costHint?: string;
  /** Where regeneration notices go. Defaults to stderr, keeping stdout clean. */
  notify?: (message: string) => void;
}

export interface EnsuredArtifact<T> {
  value: T;
  provenance: Provenance;
  /** False when a stored artifact's stamp matched and was reused. */
  regenerated: boolean;
  /** Why it was regenerated; undefined when reused. */
  reason?: StaleReason;
}

function readStamp(artifactPath: string): { document: unknown; provenance: Provenance | undefined } | undefined {
  if (!existsSync(artifactPath)) return undefined;
  try {
    const document = JSON.parse(readFileSync(artifactPath, "utf8")) as { provenance?: Provenance };
    return { document, provenance: document?.provenance };
  } catch {
    /* A truncated or hand-edited artifact is not a cache hit. */
    return undefined;
  }
}

/**
 * Return the artifact, producing it when the stored one was derived from
 * anything other than the current inputs.
 *
 * This is the whole statelessness contract: a caller never checks for an
 * artifact, never sequences a producer, and never has to ask whether what it
 * read is current.
 */
export function ensureArtifact<T>(options: EnsureOptions<T>): EnsuredArtifact<T> {
  const fresh = computeProvenance(options.functionName, options.inputs);
  const stored = readStamp(options.artifactPath);
  const reason = staleReason(stored?.provenance, fresh);

  if (!reason && stored) {
    /* A matching stamp is not enough on its own: the artifact it describes may
     * name files that have since been removed. A `read` that throws means the
     * cache is unusable, which is a miss, not an error to propagate. */
    try {
      return { value: options.read(stored.document), provenance: stored.provenance!, regenerated: false };
    } catch {
      /* fall through to produce */
    }
  }

  const cause: StaleReason = reason ?? { kind: "absent" };
  const notify = options.notify ?? ((message: string) => console.error(message));
  const cost = options.costHint ? ` (${options.costHint})` : "";
  notify(`  deriving ${options.label}${cost} — ${describeStaleReason(cause)}`);

  const value = options.produce(fresh);
  return { value, provenance: fresh, regenerated: true, reason: cause };
}

/**
 * Attach a stamp to an artifact document. Producers call this on the object
 * they are about to write, so the stamp and the content cannot drift apart.
 */
export function stamped<T extends object>(document: T, provenance: Provenance): T & { provenance: Provenance } {
  return { ...document, provenance };
}

/* ---- reporting ---------------------------------------------------------- */

/**
 * The one line every tool prints about what it measured.
 *
 * A reading whose provenance is not visible is a reading a caller cannot
 * trust: the whole failure this module addresses was invisible because the
 * stale row was labelled `baseline` and named no source.
 */
export function renderProvenance(entries: Array<{ label: string; ensured: EnsuredArtifact<unknown> }>): string {
  const lines = entries.map(({ label, ensured }) => {
    const state = ensured.regenerated
      ? `derived now (${describeStaleReason(ensured.reason!)})`
      : "reused (inputs unchanged)";
    const files = Object.entries(ensured.provenance.files)
      .map(([path, hash]) => `${path}@${hash === "absent" ? "absent" : hash.slice(0, 8)}`)
      .join(" ");
    return `  ${label}: ${state}${files ? ` — ${files}` : ""}`;
  });
  return ["PROVENANCE (what this reading was derived from)", ...lines].join("\n");
}
