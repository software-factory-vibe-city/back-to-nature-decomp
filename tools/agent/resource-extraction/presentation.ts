import { existsSync, readFileSync } from "node:fs";
import { ASSET_CATEGORIES, PARSERS, type AssetCategory, type ParserRegistry } from "./registry.ts";
import { canonical, hash, runPath, Store } from "./storage.ts";
import type { Manifest } from "./types.ts";

export interface PresentedFile {
  path: string; backing: string; hash: string; size: number; stage: string; artifact?: string;
}
export interface PresentedAsset {
  node: string; format: string; category: AssetCategory; directory: string;
  manifest: string; manifestHash: string; files: PresentedFile[];
}
interface Index { version: 1; assets: PresentedAsset[] }
const safeName = (name: string): boolean => /^[a-zA-Z0-9_-]{1,80}$/.test(name);

/** A browsable derivative of verified artifacts, never a new format guess.
 * Paths do not contain resource names or arbitrary plugin/user path fragments.
 * Regular copies protect the authoritative blobs from edits in an image viewer.
 * These are copies of already-budgeted bytes, not additional decoder output. */
export function presentationPlan(m: Manifest, manifestHash: string, registry: ParserRegistry = PARSERS): PresentedAsset[] {
  const assets: PresentedAsset[] = [];
  for (const node of m.nodes) {
    if (node.kind !== "resource" || node.stages.discovery !== "validated" || node.stages.extraction !== "validated" || typeof node.metadata.parserId !== "string") continue;
    if (!/^node-[a-f0-9]{24}$/.test(node.id)) throw new Error("Invalid presentation node ID");
    const parser = registry.get(node.metadata.parserId), category = parser.category ?? "data", extension = parser.rawExtension ?? "bin";
    const directory = `${category}/${node.id}`;
    const files: PresentedFile[] = [{ path: `${directory}/original.${extension}`, backing: node.blob, hash: node.blob.slice(6), size: node.size, stage: "extraction" }];
    for (const artifact of m.artifacts.filter(a => a.node === node.id && a.processor === parser.id)) {
      const kind = artifact.parameters.kind as string;
      const ext = artifact.extension ?? artifact.path.match(/\.([a-zA-Z0-9_-]+)$/)?.[1];
      if (!safeName(kind) || !ext || !safeName(ext)) throw new Error("Parser artifact lacks a valid presentation kind/extension");
      const variant = artifact.parameters.variant as Record<string, unknown>;
      const bank = variant?.bank;
      const label = Number.isSafeInteger(bank) && (bank as number) >= 0 && Object.keys(variant).length === 1 ? `bank-${bank}` : `variant-${hash(canonical(variant)).slice(0, 16)}`;
      const name = kind === ext ? `${label}.${ext}` : `${label}-${kind}.${ext}`;
      files.push({ path: `${directory}/${name}`, backing: artifact.path, hash: artifact.hash, size: artifact.size, stage: artifact.stage, artifact: artifact.id });
    }
    if (new Set(files.map(file => file.path)).size !== files.length) throw new Error("Colliding presentation filenames");
    assets.push({ node: node.id, format: parser.format, category, directory, manifest: `${runPath(m.runId)}/manifest.json`, manifestHash, files });
  }
  return assets;
}

function validateFile(store: Store, file: PresentedFile, source = false): void {
  const bytes = readFileSync(store.path(source ? file.backing : file.path));
  if (bytes.length !== file.size || hash(bytes) !== file.hash) throw new Error(`Presented asset hash/size mismatch: ${source ? file.backing : file.path}`);
}

/** Caller first verifies original extents and decoder replay. Serialize the
 * shared catalog, merge other scopes, and preserve every authoritative run. */
export async function presentAssets(store: Store, m: Manifest, manifestHash: string, signal?: AbortSignal, registry: ParserRegistry = PARSERS): Promise<Record<string, unknown>> {
  const assets = presentationPlan(m, manifestHash, registry);
  return store.lock("asset-presentation", async () => {
    // Validate the complete prefix before publishing any browsable file.
    for (const asset of assets) for (const file of asset.files) { signal?.throwIfAborted(); validateFile(store, file, true); }
    const indexPath = "index.json";
    const previous: Index = existsSync(store.path(indexPath)) ? store.read<Index>(indexPath) : { version: 1, assets: [] };
    if (previous.version !== 1 || !Array.isArray(previous.assets) || previous.assets.some(a => !ASSET_CATEGORIES.includes(a.category) || !/^node-[a-f0-9]{24}$/.test(a.node) || a.directory !== `${a.category}/${a.node}`)) throw new Error("Invalid asset presentation index");
    const merged = new Map(previous.assets.map(asset => [asset.node, asset]));
    for (const asset of assets) {
      signal?.throwIfAborted();
      for (const file of asset.files) {
        const bytes = readFileSync(store.path(file.backing));
        // Idempotent publication. A deliberately edited derivative is repaired
        // only by extraction/campaign, never silently by verification.
        if (!existsSync(store.path(file.path)) || hash(readFileSync(store.path(file.path))) !== file.hash) store.atomic(file.path, bytes);
      }
      store.json(`${asset.directory}/asset.json`, { ...asset, resource: m.nodes.find(n => n.id === asset.node), note: "Browsable copies; backing blobs and the referenced run manifest remain authoritative. Historical semantic names are unknown." });
      merged.set(asset.node, asset);
    }
    store.json(`${runPath(m.runId)}/presented-assets.json`, { version: 1, assets } satisfies Index);
    store.json(indexPath, { version: 1, assets: [...merged.values()].sort((a, b) => a.node.localeCompare(b.node)) } satisfies Index);
    return { outcome: "validated", index: indexPath, assets: assets.length, files: assets.reduce((sum, asset) => sum + asset.files.length, 0), directories: [...new Set(assets.map(a => a.category))].sort() };
  });
}

/** Optional view check: old runs need not have been presented. A missing or
 * edited copy in an existing view is reported without touching the backing data. */
export function verifyPresentation(store: Store, m: Manifest, registry: ParserRegistry = PARSERS): Record<string, unknown> {
  const path = `${runPath(m.runId)}/presented-assets.json`;
  if (!existsSync(store.path(path))) return { outcome: "not-presented" };
  const index = store.read<Index>(path);
  if (index.version !== 1 || !Array.isArray(index.assets)) throw new Error("Invalid run presentation index");
  const expected = presentationPlan(m, "", registry);
  // A previous budgeted prefix can be smaller than the current manifest.
  for (const asset of index.assets) {
    const found = expected.find(a => a.node === asset.node);
    if (!found || asset.category !== found.category || asset.directory !== found.directory || asset.manifest !== found.manifest) throw new Error("Presented asset provenance mismatch");
    const sidecar = store.read<PresentedAsset & { resource: Record<string, unknown> }>(`${asset.directory}/asset.json`);
    const node = m.nodes.find(n => n.id === asset.node)!;
    if (sidecar.node !== asset.node || sidecar.manifest !== asset.manifest || sidecar.manifestHash !== asset.manifestHash || canonical(sidecar.files) !== canonical(asset.files) ||
        ["id", "blob", "size", "source", "format", "metadata", "evidence"].some(field => canonical(sidecar.resource[field]) !== canonical((node as unknown as Record<string, unknown>)[field]))) throw new Error("Presented asset metadata/provenance mismatch");
    for (const file of asset.files) {
      if (!found.files.some(f => canonical(f) === canonical(file))) throw new Error("Presented file provenance mismatch");
      validateFile(store, file);
    }
  }
  return { outcome: "validated", index: "index.json", assets: index.assets.length, files: index.assets.reduce((sum, a) => sum + a.files.length, 0) };
}
