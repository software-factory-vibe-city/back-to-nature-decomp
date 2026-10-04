import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { canonical, hash, Store } from "./storage.ts";
import type { Manifest } from "./types.ts";

/** Save the legacy ownership catalog before index.json becomes a v2 projection.
 * This is migration input, not active extraction/acceptance state. */
export function rememberLegacyPresentation(store: Store): void {
  if (!existsSync(store.path("index.json"))) return;
  try {
    const index = store.read<{ version: number; assets: unknown[] }>("index.json");
    if (index.version === 1 && Array.isArray(index.assets)) store.json("cache/legacy-presentation.json", index);
  } catch { /* A malformed index is not evidence permitting deletion. */ }
}
interface LegacyFile { path: string; backing: string; hash: string; size: number }
interface LegacyAsset { node: string; category: string; directory: string; files: LegacyFile[]; manifest: string }
function matches(store: Store, file: LegacyFile): boolean {
  try {
    const bytes = readFileSync(store.path(file.path)), backing = readFileSync(store.path(file.backing));
    return bytes.length === file.size && hash(bytes) === file.hash && bytes.equals(backing);
  } catch { return false; }
}
/** Explicit migration only. Verified legacy presentation copies can be removed;
 * recognized old run/control directories are archived, not destroyed. Unknown,
 * edited and symlinked files are retained. No Git operation or original input is
 * touched; a live legacy lock refuses migration rather than racing another agent. */
export async function migrateLegacy(store: Store, signal?: AbortSignal): Promise<Record<string, unknown>> {
  const current = store.read<Manifest>("manifest.json");
  if (current.version !== 2) throw new Error("Legacy cleanup requires a successful v2 publication");
  if (existsSync(store.path("locks"))) for (const name of readdirSync(store.path("locks"))) {
    if (name === "extraction.lock") continue;
    const pid = Number(readFileSync(store.path(`locks/${name}`), "utf8").trim());
    if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error("Unknown legacy lock owner; refusing migration");
    try { process.kill(pid, 0); throw new Error(`Live legacy resource lock: ${name}`); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error; }
  }
  const catalogs: string[] = [];
  if (existsSync(store.path("cache/legacy-presentation.json"))) catalogs.push("cache/legacy-presentation.json");
  const runs = existsSync(store.path("runs")) ? readdirSync(store.path("runs")).filter(n => /^[a-f0-9]{16}-[a-f0-9]{16}$/.test(n)) : [];
  for (const run of runs) if (existsSync(store.path(`runs/${run}/presented-assets.json`))) catalogs.push(`runs/${run}/presented-assets.json`);
  let removed = 0, preserved = 0;
  const directories = new Map<string, Set<string>>(), files = new Map<string, LegacyFile>();
  for (const catalog of catalogs) {
    signal?.throwIfAborted();
    try {
      const index = store.read<{ version: number; assets: LegacyAsset[] }>(catalog);
      if (index.version !== 1 || !Array.isArray(index.assets)) continue;
      for (const asset of index.assets) {
        if (!/^(images|sound|models|video|data)\/node-[a-f0-9]{24}$/.test(asset.directory) || asset.directory !== `${asset.category}/${asset.node}` || !Array.isArray(asset.files)) continue;
        const sidecars = directories.get(asset.directory) ?? new Set<string>();
        directories.set(asset.directory, sidecars);
        // The old renderer's exact projection, independently reconstructed from
        // its catalog and referenced resource node. A marker prefix alone must
        // never authorize deleting a user-edited provenance sidecar.
        if (/^runs\/[a-f0-9]{16}-[a-f0-9]{16}\/manifest\.json$/.test(asset.manifest)) {
          try {
            const path = existsSync(store.path(asset.manifest)) ? asset.manifest : `cache/legacy/${asset.manifest}`;
            const legacy = store.read<{ nodes: Array<{ id: string }> }>(path), resource = legacy.nodes.find(n => n.id === asset.node);
            if (resource) sidecars.add(canonical({ ...asset, resource, note: "Browsable copies; backing blobs and the referenced run manifest remain authoritative. Historical semantic names are unknown." }));
          } catch { /* Missing resource context cannot authorize deletion. */ }
        }
        for (const file of asset.files) if (file.path.startsWith(`${asset.directory}/`) && !file.path.slice(asset.directory.length + 1).includes("/") && /^[a-f0-9]{64}$/.test(file.hash) && Number.isSafeInteger(file.size)) files.set(file.path, file);
      }
    } catch { /* Unknown legacy catalogs remain untouched. */ }
  }
  for (const file of files.values()) {
    signal?.throwIfAborted();
    if (!existsSync(store.path(file.path))) continue;
    if (matches(store, file)) { rmSync(store.path(file.path)); removed++; } else preserved++;
  }
  for (const [dir, sidecars] of directories) {
    const sidecar = `${dir}/asset.json`;
    try {
      if (existsSync(store.path(sidecar))) {
        const value = store.read<unknown>(sidecar);
        if (sidecars.has(canonical(value))) { rmSync(store.path(sidecar)); removed++; } else preserved++;
      }
      if (existsSync(store.path(dir)) && !readdirSync(store.path(dir)).length) rmSync(store.path(dir), { recursive: true });
    } catch { preserved++; }
  }
  for (const category of ["images", "sound", "models", "video", "data"]) if (existsSync(store.path(category)) && !readdirSync(store.path(category)).length) rmSync(store.path(category), { recursive: true });
  const archived: string[] = [];
  const recognized: Record<string, RegExp> = {
    requests: /^[a-f0-9]{24}\.json$/,
    logs: /^commands\/[a-f0-9]{24}\.json$/,
    loop: /^(state\.json|asset-commits\/node-[a-f0-9]{24}\.json|parser-baselines\/[a-f0-9]{24}\.json|parser-tests\/[a-f0-9]{24}\.json|failed\/[a-f0-9]{24}\/[a-zA-Z0-9_.-]+)$/,
  };
  function onlyFiles(path: string, accepted: RegExp): boolean {
    function walk(at: string, prefix: string): boolean {
      return readdirSync(store.path(at)).every(name => {
        const file = `${at}/${name}`, suffix = prefix ? `${prefix}/${name}` : name, st = lstatSync(store.path(file));
        return st.isDirectory() ? walk(file, suffix) : st.isFile() && accepted.test(suffix);
      });
    }
    try { return walk(path, ""); } catch { return false; }
  }
  function archive(path: string): void {
    const target = `cache/legacy/${path}`;
    if (existsSync(store.path(target))) { preserved++; return; }
    mkdirSync(dirname(store.path(target)), { recursive: true }); renameSync(store.path(path), store.path(target)); archived.push(path);
  }
  for (const run of runs) {
    signal?.throwIfAborted();
    const path = `runs/${run}`;
    try {
      const pointer = store.read<{ snapshot: string }>(`${path}/current.json`);
      const snapshot = readFileSync(store.path(`${path}/snapshots/${pointer.snapshot}.json`));
      const value = JSON.parse(snapshot.toString());
      if (!/^[a-f0-9]{64}$/.test(pointer.snapshot) || hash(snapshot) !== pointer.snapshot || value.manifest?.version !== 1 || value.manifest.runId !== run || value.state?.manifestHash !== hash(canonical(value.manifest) + "\n")) throw new Error("Unowned legacy run");
      if (!onlyFiles(path, /^(current\.json|manifest\.json|state\.json|inputs\.json|report\.md|presented-assets\.json|snapshots\/[a-f0-9]{64}\.json|exports\/artifact-[a-f0-9]{24}\.[a-zA-Z0-9_-]+|analysis\/[a-zA-Z0-9_-]+\.json|schemas\/[a-f0-9]{64}\.json|docs\/(catalog\.md|(handoff|proposal)-[a-f0-9]{64}\.json)|logs\/[a-z]+-[a-f0-9]{16}\.json|logs\/tui-[a-z]+-\d+\.json)$/)) throw new Error("Unknown files in legacy run");
      archive(path);
    } catch { preserved++; }
  }
  for (const [path, pattern] of Object.entries(recognized)) if (existsSync(store.path(path))) { if (onlyFiles(path, pattern)) archive(path); else preserved++; }
  if (existsSync(store.path("runs")) && !readdirSync(store.path("runs")).length) rmSync(store.path("runs"), { recursive: true });
  return { removedLegacyCopies: removed, archived, preservedUnknownOrEdited: preserved };
}
