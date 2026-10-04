import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const hash = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]);
export function m2cPatchIdentity(root: string): { upstream: string; sha256: string; inputs: string[] } {
  const manifest = join(root, "tools/vendor/m2c-patches/manifest.json");
  const spec = JSON.parse(readFileSync(manifest, "utf8")) as { version: number; upstream: string; patches: string[] };
  if (spec.version !== 1 || !/^[a-f0-9]{40}$/.test(spec.upstream) || spec.patches.some((p) => !/^[\w.-]+\.patch$/.test(p))) throw new Error("Invalid m2c patch manifest");
  const inputs = [manifest, ...spec.patches.map((p) => join(dirname(manifest), p))];
  return { upstream: spec.upstream, sha256: hash(JSON.stringify(inputs.map((p) => [relative(root, p), hash(readFileSync(p))]))), inputs };
}
/** Materialize a pinned, patched vendor tree without mutating the submodule.
 * Only source patches are tracked; archives, generated code and caches stay in build/. */
export function prepareM2c(root: string): { script: string; identity: ReturnType<typeof m2cPatchIdentity>; sources: string[] } {
  const identity = m2cPatchIdentity(root);
  const vendor = join(root, "tools/vendor/m2c");
  const head = execFileSync("git", ["-C", vendor, "rev-parse", "HEAD"], { encoding: "utf8", timeout: 10000 }).trim();
  const dirty = execFileSync("git", ["-C", vendor, "status", "--porcelain", "--untracked-files=no"], { encoding: "utf8", timeout: 10000 }).trim();
  if (head !== identity.upstream || dirty) throw new Error("m2c upstream differs from the pinned clean vendor revision");
  const dir = join(root, "build/vendor/m2c", identity.sha256);
  const stamp = join(dir, "patched-source.json");
  const inspect = () => {
    const hashes = JSON.parse(readFileSync(stamp, "utf8")) as Record<string, string>;
    for (const [path, expected] of Object.entries(hashes)) if (!existsSync(join(dir, path)) || hash(readFileSync(join(dir, path))) !== expected) throw new Error(`Edited m2c build source: ${join(dir, path)}`);
    return { script: join(dir, "m2c.py"), identity, sources: Object.keys(hashes).map((p) => join(dir, p)) };
  };
  if (existsSync(stamp)) return inspect();
  if (existsSync(dir)) throw new Error(`Incomplete m2c build preserved: ${dir}`);
  const temp = `${dir}.tmp-${randomUUID()}`;
  mkdirSync(temp, { recursive: true });
  try {
    const archive = join(temp, "upstream.tar");
    execFileSync("git", ["-C", vendor, "archive", identity.upstream, "-o", archive], { timeout: 10000 });
    execFileSync("tar", ["-xf", archive, "-C", temp], { timeout: 10000 }); rmSync(archive);
    for (const patch of identity.inputs.slice(1)) execFileSync("patch", ["--batch", "--fuzz=0", "-p1", "-d", temp, "-i", patch], { timeout: 10000 });
    const hashes = Object.fromEntries(files(temp).filter((p) => p.endsWith(".py") || p.endsWith(".h")).map((p) => [relative(temp, p), hash(readFileSync(p))]));
    writeFileSync(join(temp, "patched-source.json"), JSON.stringify(hashes, null, 2) + "\n");
    mkdirSync(dirname(dir), { recursive: true });
    try { renameSync(temp, dir); } catch (error) { if (!existsSync(stamp)) throw error; rmSync(temp, { recursive: true, force: true }); }
    return inspect();
  } catch (error) { rmSync(temp, { recursive: true, force: true }); throw error; }
}
