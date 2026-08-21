/**
 * toolchainProfile.ts — which SDK and linker built this game?
 *
 * Overlay discovery has to make assumptions somewhere: where sections sit in a
 * headerless blob, what a function entry looks like, how the loader places a
 * member. Those assumptions are toolchain facts, not universal ones, so they
 * belong behind a detected profile rather than baked into the tools. A strategy
 * that only holds for PSY-Q should run only when PSY-Q is what is there.
 *
 * Detection is layered cheapest-first, and every layer records what it saw:
 *
 *   1. Vendor strings the SDK leaves in the image — RCS `$Id:` lines naming the
 *      library sources and their authors, and the Sony library banner.
 *   2. The project's own splat configuration, which names a compiler.
 *   3. Library byte-pattern signatures, which additionally pin a version. This
 *      is the expensive layer and runs only when asked or when the cheap
 *      layers are inconclusive.
 *
 * `undetermined` is a real verdict. A tool that needs a profile it did not get
 * must fall back to a toolchain-independent strategy and say so, never assume
 * the profile this project happens to have.
 */

import { existsSync, readFileSync, mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { ROOT, exeSplatYamlPath, loadPsxExeInfo } from "./psxExeInfo.js";

export interface ToolchainEvidence {
  source: "vendor-string" | "project-config" | "library-signatures";
  /** The toolchain this observation points at, when it points at one. */
  toolchain?: string;
  detail: string;
}

export interface ToolchainProfile {
  /** Stable id strategies match against, e.g. `psyq`. `unknown` when undetected. */
  id: string;
  /** SDK version when a layer pins one, e.g. `4.7`. */
  version: string | null;
  verdict: "detected" | "undetermined";
  evidence: ToolchainEvidence[];
}

export const UNKNOWN_TOOLCHAIN: ToolchainProfile = {
  id: "unknown",
  version: null,
  verdict: "undetermined",
  evidence: [],
};

const CACHE_PATH = "build/toolchainProfile.json";

/**
 * Vendor fingerprints. Each is a string an SDK leaves in a linked image that no
 * other SDK would; matching one is evidence for that SDK and nothing else.
 */
const VENDOR_STRINGS: Array<{ id: string; needle: string; note: string }> = [
  {
    id: "psyq",
    needle: "Library Programs (c) 1993-1997 Sony Computer Entertainment Inc.",
    note: "Sony library banner",
  },
  { id: "psyq", needle: "$Id: intr.c,v", note: "RCS id from libapi's intr.c" },
  { id: "psyq", needle: "$Id: bios.c,v", note: "RCS id from libcd's bios.c" },
  { id: "psyq", needle: "$Id: sys.c,v", note: "RCS id from libgpu's sys.c" },
];

/** Compiler tokens a project config can name, mapped to a toolchain id. */
const CONFIG_COMPILERS: Record<string, string> = {
  PSYQ: "psyq",
  SN64: "sn64",
  GCC: "psyq",
};

function scanVendorStrings(image: Buffer): ToolchainEvidence[] {
  const found: ToolchainEvidence[] = [];
  for (const { id, needle, note } of VENDOR_STRINGS) {
    if (image.includes(Buffer.from(needle, "latin1"))) {
      found.push({ source: "vendor-string", toolchain: id, detail: `${note} — ${JSON.stringify(needle)}` });
    }
  }
  return found;
}

/** Toolchains the evidence actually names. Observations that name none are context. */
function namedToolchains(evidence: readonly ToolchainEvidence[]): string[] {
  return [...new Set(evidence.map((e) => e.toolchain).filter((id): id is string => id !== undefined))];
}

function scanProjectConfig(): ToolchainEvidence | null {
  const path = exeSplatYamlPath();
  if (!existsSync(path)) return null;
  const compiler = readFileSync(path, "utf-8").match(/^\s*compiler:\s*(\S+)/m)?.[1];
  if (!compiler) return null;
  const id = CONFIG_COMPILERS[compiler.toUpperCase()];
  if (!id) return null;
  return {
    source: "project-config",
    toolchain: id,
    detail: `splat config names compiler ${compiler}`,
  };
}

/**
 * Version from the SDK's own source-control strings.
 *
 * The library RCS dates bound the release: an image carrying a 1998 `sys.c`
 * cannot be built against a 1997 SDK. This gives a date, not a version number,
 * so it is reported as what it is and the signature layer is what pins a
 * version.
 */
function versionHintFromStrings(image: Buffer): ToolchainEvidence | null {
  const text = image.toString("latin1");
  const dates = [...text.matchAll(/\$Id: (\S+),v [\d.]+ (\d{4})\/(\d{2})\/(\d{2})/g)].map((m) => ({
    file: m[1]!,
    date: `${m[2]}-${m[3]}-${m[4]}`,
  }));
  if (dates.length === 0) return null;
  const latest = dates.reduce((a, b) => (a.date >= b.date ? a : b));
  return {
    source: "vendor-string",
    detail: `latest library source date is ${latest.date} (${latest.file}), so the SDK is no older than that`,
  };
}

export interface DetectOptions {
  /** Run the library-signature scan, which pins a version but costs a full scan. */
  deep?: boolean;
  /** Ignore any cached verdict. */
  refresh?: boolean;
}

export function detectToolchain(options: DetectOptions = {}): ToolchainProfile {
  const cachePath = join(ROOT, CACHE_PATH);
  if (!options.refresh && existsSync(cachePath)) {
    const cached = JSON.parse(readFileSync(cachePath, "utf-8")) as ToolchainProfile;
    if (!options.deep || cached.version !== null) return cached;
  }

  const evidence: ToolchainEvidence[] = [];
  let image: Buffer | null = null;
  try {
    const exe = loadPsxExeInfo();
    image = readFileSync(exe.binaryPath);
  } catch {
    /* No binary is a reason to report undetermined, not to throw. */
  }

  if (image) {
    evidence.push(...scanVendorStrings(image));
    const hint = versionHintFromStrings(image);
    if (hint) evidence.push(hint);
  }
  const config = scanProjectConfig();
  if (config) evidence.push(config);

  const candidates = namedToolchains(evidence);

  let profile: ToolchainProfile;
  if (candidates.length === 1) {
    profile = { id: candidates[0]!, version: null, verdict: "detected", evidence };
  } else {
    if (candidates.length > 1) {
      evidence.push({
        source: "vendor-string",
        detail: `evidence names more than one toolchain (${candidates.join(", ")}); no single profile follows`,
      });
    } else {
      evidence.push({
        source: "vendor-string",
        detail: "no vendor string or project setting names a toolchain",
      });
    }
    profile = { ...UNKNOWN_TOOLCHAIN, evidence };
  }

  if (options.deep && profile.verdict === "detected") {
    const version = detectSdkVersion();
    if (version) {
      profile.version = version.version;
      profile.evidence.push(version.evidence);
    }
  }

  mkdirSync(dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, `${JSON.stringify(profile, null, 2)}\n`);
  return profile;
}

/**
 * Version from library byte-pattern signatures.
 *
 * Reads the report `tools/diagnostics/matchSignatures.ts` writes rather than
 * re-implementing the scan, so there is one signature matcher in the project.
 */
function detectSdkVersion(): { version: string; evidence: ToolchainEvidence } | null {
  const reportPath = join(ROOT, "build/sdkVersion.json");
  if (!existsSync(reportPath)) return null;
  const report = JSON.parse(readFileSync(reportPath, "utf-8")) as {
    best?: { version: string; matches: number; runnerUp?: string; runnerUpMatches?: number };
  };
  if (!report.best) return null;
  const { version, matches, runnerUp, runnerUpMatches } = report.best;
  return {
    version,
    evidence: {
      source: "library-signatures",
      detail:
        `${matches} library signatures match version ${version}` +
        (runnerUp ? `, against ${runnerUpMatches} for ${runnerUp}` : ""),
    },
  };
}

/** Does a strategy declared for these toolchain ids apply to this profile? */
export function profileMatches(profile: ToolchainProfile, appliesTo: readonly string[]): boolean {
  return appliesTo.includes("*") || appliesTo.includes(profile.id);
}
