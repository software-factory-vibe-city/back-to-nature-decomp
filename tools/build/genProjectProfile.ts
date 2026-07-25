/**
 * genProjectProfile.ts — Generate configs/project-profile.md from machine-readable sources
 *
 * The agent prompts in prompts/ are toolchain-agnostic; the profile supplies
 * the concrete toolchain facts. Nearly all of them are already canonical
 * elsewhere, so this tool DERIVES the profile instead of trusting prose:
 *
 *   - Load address, entry point, $gp   → PS-X EXE header + splat.yaml (via psxExeInfo)
 *   - Compiler version, cc1 flags      → Makefile (GCC_VERSION, CC1FLAGS)
 *   - Small-data (-G) threshold        → parsed from CC1FLAGS
 *   - ASPSX version                    → Makefile (--aspsx-version)
 *   - Game serial (e.g. SLUS-01115)    → EXE filename pattern
 *   - SDK version                      → auto-detected via matchSignatures.ts (~6s)
 *   - Byte-identity claim              → VERIFIED at generation time by hashing
 *                                        build/<basename>.bin against the payload
 *                                        (same slice the Makefile check target uses)
 *
 * The only fact that cannot be derived lives in configs/project-info.json:
 *   { "game": "Harvest Moon: Back to Nature",
 *     "evidence": "notes/toolchain-version-detection.md" }
 *
 * Usage:
 *   npx tsx tools/build/genProjectProfile.ts           # dry run: print to stdout
 *   npx tsx tools/build/genProjectProfile.ts --write   # write configs/project-profile.md
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { loadPsxExeInfo, ROOT } from "../lib/psxExeInfo.ts";

const INFO_PATH = join(ROOT, "configs/project-info.json");
const OUT_PATH = join(ROOT, "configs/project-profile.md");
const MAKEFILE_PATH = join(ROOT, "Makefile");

/* --- helpers --- */

function hex32(n: number): string {
  return `0x${n.toString(16).toUpperCase().padStart(8, "0")}`;
}

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

/** slus_011.15 → SLUS-01115 (also handles sles/sces/slps etc.) */
function serialFromPath(binaryPath: string): string | null {
  const m = basename(binaryPath).match(/^([a-z]{4})_(\d{3})\.(\d{2})$/i);
  if (!m) return null;
  return `${m[1].toUpperCase()}-${m[2]}${m[3]}`;
}

interface ProjectInfo {
  game?: string;
  evidence?: string;
}

function loadProjectInfo(): ProjectInfo {
  if (!existsSync(INFO_PATH)) return {};
  return JSON.parse(readFileSync(INFO_PATH, "utf-8"));
}

interface MakefileFacts {
  gccVersion: string;
  cc1Flags: string;
  gThreshold: number | null;
  aspsxVersion: string | null;
  builtBin: string | null;
}

function parseMakefile(): MakefileFacts {
  const mk = readFileSync(MAKEFILE_PATH, "utf-8");

  const gccVersion = mk.match(/^GCC_VERSION\s*:=\s*(\S+)/m)?.[1] ?? "unknown";

  /* The CC1FLAGS assignment inside the FlagsSwitch define; strip the
     per-file override variable $(CC1FLAGS_...) and everything after it. */
  const rawFlags = mk.match(/^CC1FLAGS\s*:=\s*(.+)$/m)?.[1] ?? "";
  const cc1Flags = rawFlags.split("$(")[0].trim();

  const gMatch = cc1Flags.match(/-G(\d+)/);
  const gThreshold = gMatch ? parseInt(gMatch[1], 10) : null;

  const aspsxVersion = mk.match(/--aspsx-version\s+(\S+)/)?.[1] ?? null;

  const base = mk.match(/^BASENAME\s*:=\s*(\S+)/m)?.[1];
  const builtBin = base ? join(ROOT, "build", `${base}.bin`) : null;

  return { gccVersion, cc1Flags, gThreshold, aspsxVersion, builtBin };
}

/** Hash the built binary against the original payload — the byte-identity
 *  claim is only emitted when it is actually true at generation time.
 *  Mirrors the Makefile check target: both sides skip the EXE header. */
function verifyByteIdentity(
  binaryPath: string,
  payloadOffset: number,
  payloadSize: number,
  builtBin: string | null
): { verified: boolean; detail: string } {
  if (!builtBin || !existsSync(builtBin)) {
    return { verified: false, detail: "built binary not found — run `make` first" };
  }
  const orig = readFileSync(binaryPath).subarray(payloadOffset, payloadOffset + payloadSize);
  const built = readFileSync(builtBin).subarray(payloadOffset, payloadOffset + payloadSize);
  if (sha256(orig) === sha256(built)) {
    return { verified: true, detail: "SHA-256 match confirmed at generation time" };
  }
  return { verified: false, detail: "built binary DOES NOT match the original payload" };
}

/** Auto-detect the PSY-Q SDK version via signature matching.
 *  Formats raw dir names: 470 → "4.7", 3610 → "3.6.10". */
function detectSdkVersion(): { version: string; detail: string } | null {
  try {
    const out = execSync("npx tsx tools/diagnostics/matchSignatures.ts", {
      cwd: ROOT,
      encoding: "utf-8",
      timeout: 120_000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    const m = out.match(/Best match: PSY-Q (\S+) \((\d+) signatures\)/);
    if (!m) return null;
    const digits = m[1];
    let version = `${digits[0]}.${digits[1]}`;
    if (digits.length > 2 && digits.slice(2) !== "0") version += `.${digits.slice(2)}`;
    return { version, detail: `${m[2]} signatures matched` };
  } catch {
    return null;
  }
}

/* --- main --- */

function main() {
  const write = process.argv.includes("--write");

  const exe = loadPsxExeInfo();
  const info = loadProjectInfo();
  const mk = parseMakefile();

  const serial = serialFromPath(exe.binaryPath);
  const gameLine = info.game
    ? `${info.game}${serial ? ` (${serial})` : ""}`
    : serial ?? "(unknown — set \"game\" in configs/project-info.json)";

  const check = verifyByteIdentity(exe.binaryPath, exe.payloadOffset, exe.payloadSize, mk.builtBin);
  const sdk = detectSdkVersion();

  const sdkLine = sdk
    ? `PSY-Q ${sdk.version} (auto-detected by signature matching — ${sdk.detail}, \`tools/diagnostics/matchSignatures.ts\`)`
    : "(detection failed — run tools/diagnostics/matchSignatures.ts manually)";

  const evidenceRef = info.evidence ? ` (evidence: \`${info.evidence}\`)` : "";

  const verifiedSentence = check.verified
    ? `- **Compiler:** GCC ${mk.gccVersion}-psx (\`cc1\`) — verified byte-identical output against the original binary${evidenceRef}; ${check.detail}`
    : `- **Compiler:** GCC ${mk.gccVersion}-psx (\`cc1\`) — CONFIGURED but byte-identity NOT confirmed at generation time (${check.detail})`;

  const consequenceClaim = check.verified
    ? "Because the compiler is verified byte-identical, the original C under its original compiler invocation is reproducible. Compiler identity does not by itself prove a reconstructed source shape or per-file flag assumption."
    : "If the compiler is verified byte-identical, the original C under its original compiler invocation is reproducible; reconstructed source shape and per-file flags still require evidence.";

  const gSentence = mk.gThreshold !== null
    ? `\`-G${mk.gThreshold}\` — externs declared **${mk.gThreshold} bytes or smaller** get GP-relative addressing (single \`lw/sw %gp_rel(sym)($gp)\`); larger declarations get absolute addressing (\`lui\` + \`lw/sw %lo(sym)\`)`
    : "unknown — no `-G` flag found in CC1FLAGS";

  const aspsxSentence = mk.aspsxVersion
    ? `ASPSX ${mk.aspsxVersion} via maspsx (\`tools/vendor/maspsx\`) — emulates macro expansion and relocation behavior; unlike cc1, byte identity with real ASPSX is not established for every input`
    : "maspsx (\`tools/vendor/maspsx\`)";

  const out = `<!-- Auto-generated by tools/build/genProjectProfile.ts — do not edit manually.
     Human-supplied facts live in configs/project-info.json; toolchain facts
     are derived from the Makefile, splat.yaml, and the EXE header. -->

# Project Profile — ${gameLine}

Concrete environment facts for agents working on this project. The prompt
templates in \`prompts/\` are deliberately toolchain-agnostic; this file
supplies the specifics. It is injected into every agent prompt by
\`tools/agent/getPrompt.ts\`. **For a new decompilation project, update
\`configs/project-info.json\` and the Makefile, then regenerate this file.**

## Target

- Game: ${gameLine}
- Platform: PlayStation 1 — MIPS R3000 (\`mips1\`), little-endian, GTE coprocessor
- PS-X EXE: load address \`${hex32(exe.loadAddr)}\`, entry \`${hex32(exe.entryPoint)}\`, \`$gp = ${hex32(exe.gpValue)}\`

## Toolchain

${verifiedSentence}
- **Flags:** \`${mk.cc1Flags}\`
- **Small-data threshold:** ${gSentence}
- **Assembler semantics:** ${aspsxSentence}
- **SDK:** ${sdkLine}

## Diagnostic and verification commands

- Structural classification: \`npx tsx tools/agent/explainDiff.ts <func>\`
- GCC pass/allocation trace: \`npx tsx tools/agent/compilerTrace.ts <func>\`
- Exact per-function oracle: \`npx tsx tools/agent/diffFunc.ts <func>\` (100% = match)
- Full binary oracle: \`make check\` (SHA-256 against the original payload)

## Consequences for matching work

- ${consequenceClaim} Never "solve" functions with inline asm, \`register __asm__\` pinning, or flag overrides — find the clean C, or stop and report the diff signature.
- Switch statements compile correctly, including jump-table dispatch; case bodies are emitted in source order.
- The compiler's scheduler reorders independent instructions; the original toolchain often did not. Order-only diffs are a known, well-understood diff class (see the style guide).
`;

  if (!write) {
    process.stdout.write(out);
    console.error("\n(dry run — pass --write to update configs/project-profile.md)");
    return;
  }

  writeFileSync(OUT_PATH, out);
  console.log(`Wrote ${OUT_PATH}`);
  console.log(`  compiler: GCC ${mk.gccVersion}-psx, -G threshold: ${mk.gThreshold ?? "?"}, aspsx: ${mk.aspsxVersion ?? "?"}`);
  console.log(`  byte-identity: ${check.verified ? "VERIFIED" : "NOT VERIFIED"} (${check.detail})`);
}

main();
