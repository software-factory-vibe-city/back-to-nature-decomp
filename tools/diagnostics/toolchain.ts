/**
 * toolchain.ts — report the detected toolchain profile and its evidence.
 *
 * Usage:
 *   npx tsx tools/diagnostics/toolchain.ts            # cheap layers
 *   npx tsx tools/diagnostics/toolchain.ts --deep     # + library-signature version
 *   npx tsx tools/diagnostics/toolchain.ts --refresh  # ignore the cached verdict
 */

import { detectToolchain } from "../lib/toolchainProfile.js";

const args = process.argv.slice(2);
const profile = detectToolchain({ deep: args.includes("--deep"), refresh: args.includes("--refresh") });

console.log(`Toolchain: ${profile.id}${profile.version ? ` ${profile.version}` : ""} (${profile.verdict})`);
for (const item of profile.evidence) console.log(`  [${item.source}] ${item.detail}`);
if (profile.verdict === "undetermined") {
  console.log();
  console.log("  Toolchain-specific discovery strategies will be skipped; only strategies");
  console.log("  declared for any toolchain will run, and they are weaker.");
}
