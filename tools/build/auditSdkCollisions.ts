#!/usr/bin/env npx tsx
/** Audit EVERY vendored version separately. Versions without converted objects
 * are explicitly not-provisioned, never called verified. Default required: 470.
 * Usage: auditSdkCollisions.ts [--require-version N | --require-all] [--detection report.json]
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadMemberMap, memberKey, parseSig, readTextObject, resolveSignatureObject, signatureFits, signatureId, type SigEntry } from "../lib/psyqMembers.js";
import { ROOT } from "../lib/psxExeInfo.js";
import { verifiedMatches } from "../lib/sdkDetection.js";

export function auditSdkCollisions(root: string, requiredVersions: string[] = ["470"]): { versions: { version: string; status: "verified" | "not-provisioned" | "failed"; collisions: { sigFile: string; member: string; objects: string[]; variants: number }[] }[]; errors: string[] } {
  const sigRoot = join(root, "tools/vendor/psx_psyq_signatures");
  const versions = readdirSync(sigRoot, { withFileTypes: true }).filter(d => d.isDirectory() && /^\d+$/.test(d.name)).map(d => d.name).sort();
  const errors: string[] = [];
  for (const version of requiredVersions) if (!versions.includes(version)) errors.push(`Required signature version ${version} absent`);
  const rows = versions.map(version => {
    const map = loadMemberMap(root, version), collisions: { sigFile: string; member: string; objects: string[]; variants: number }[] = [];
    const before = errors.length;
    if (!map && requiredVersions.includes(version)) errors.push(`SDK ${version}: member map absent; run splitSdkLibs.ts`);
    for (const sigFile of readdirSync(join(sigRoot, version)).filter(f => f.endsWith(".json")).sort()) {
      const entries: SigEntry[] = JSON.parse(readFileSync(join(sigRoot, version, sigFile), "utf8"));
      const groups = new Map<string, SigEntry[]>();
      for (const entry of entries) {
        const key = memberKey(entry.name);
        if (!groups.has(key)) groups.set(key, []);
        if (!groups.get(key)!.some(e => signatureId(e) === signatureId(entry))) groups.get(key)!.push(entry);
      }
      for (const [member, variants] of groups) {
        if (variants.length < 2) continue;
        const objects: string[] = [];
        if (map) for (const entry of variants) {
          const mapping = resolveSignatureObject(map, sigFile, entry, true);
          const errorPrefix = `${version}/${sigFile}:${member} (${entry.labels?.[0]?.name})`;
          if (!mapping || !mapping.oPath.includes("__")) { errors.push(`${errorPrefix}: no disambiguated object`); continue; }
          objects.push(mapping.oPath);
          const file = join(root, mapping.oPath);
          if (!existsSync(file)) { errors.push(`${errorPrefix}: missing ${mapping.oPath}`); continue; }
          try {
            const object = readTextObject(readFileSync(file));
            if (!signatureFits(entry, object) || parseSig(entry.sig).bytes.length !== object.text.length) errors.push(`${errorPrefix}: object does not verify the signature length/content/labels`);
          } catch (error) { errors.push(`${errorPrefix}: ${(error as Error).message}`); }
        }
        collisions.push({ sigFile, member, objects: [...new Set(objects)], variants: variants.length });
      }
    }
    return { version, status: (errors.length > before ? "failed" : map ? "verified" : "not-provisioned") as "failed" | "verified" | "not-provisioned", collisions };
  });
  return { versions: rows, errors };
}
function main(): void {
  const args = process.argv.slice(2);
  const required = args.flatMap((a, i) => a === "--require-version" ? [args[i + 1]!] : []);
  const all = readdirSync(join(ROOT, "tools/vendor/psx_psyq_signatures")).filter(v => /^\d+$/.test(v));
  const report = auditSdkCollisions(ROOT, args.includes("--require-all") ? all : required.length ? required : ["470"]);
  const detectionIndex = args.indexOf("--detection");
  if (detectionIndex >= 0) {
    try { verifiedMatches(readFileSync(resolve(args[detectionIndex + 1]!), "utf8")); } catch (error) { report.errors.push((error as Error).message); }
  }
  console.log(JSON.stringify(report, null, 2));
  if (report.errors.length) process.exitCode = 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
