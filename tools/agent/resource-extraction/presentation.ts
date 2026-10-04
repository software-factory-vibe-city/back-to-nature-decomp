import { existsSync, readFileSync, readdirSync, rmdirSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { PARSERS, type ParserRegistry } from "./registry.ts";
import { canonical, hash, id, safePath, Store } from "./storage.ts";
import { renderProvenance } from "./provenance.ts";
import { PUBLIC_CATEGORIES, type Manifest, type PublishedAsset, type PublishedFile, type PublicCategory } from "./types.ts";

const publicCategory = (category: string): PublicCategory => category === "sound" ? "sounds" : category === "video" ? "videos" : category as PublicCategory;
function label(variant: Record<string, unknown>): string {
  if (Object.keys(variant).length === 1 && Number.isSafeInteger(variant.bank) && Number(variant.bank) >= 0) return `bank-${variant.bank}`;
  if (variant.kind === "audio" && [variant.file, variant.channel, variant.segment].every(n => Number.isSafeInteger(n) && Number(n) >= 0)) return `file-${variant.file}-channel-${variant.channel}-segment-${variant.segment}`;
  return `variant-${hash(canonical(variant)).slice(0, 16)}`;
}
export function presentationPlan(m: Manifest, registry: ParserRegistry = PARSERS): PublishedAsset[] {
  const assets = new Map<string, PublishedAsset>();
  for (const node of [...m.nodes].sort((a, b) => a.id.localeCompare(b.id, "en"))) {
    if (node.kind !== "resource" || node.stages.discovery !== "validated" || node.stages.extraction !== "validated" || typeof node.metadata.parserId !== "string") continue;
    const parser = registry.get(node.metadata.parserId), category = publicCategory(registry.category(parser.id, node.metadata));
    if (!PUBLIC_CATEGORIES.includes(category)) throw new Error("Invalid public asset category");
    const { parserVersion: _revision, ...context } = node.metadata;
    const name = id("asset", [node.format, node.blob, context]);
    let asset = assets.get(name);
    if (asset) { asset.occurrences.push(node.id); continue; }
    const files: PublishedFile[] = [];
    const exports = m.artifacts.filter(a => a.node === node.id && a.processor === parser.id && a.stage === "export");
    for (const a of exports) {
      const kind = a.parameters.kind;
      if (typeof kind !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(kind) || !/^[a-zA-Z0-9_-]{1,80}$/.test(a.extension)) throw new Error("Invalid public export descriptor");
      // Hash-qualified names never overwrite a different prior export before the
      // manifest commits. Source paths/run IDs never appear in public filenames.
      const suffix = kind === a.extension ? "" : `-${kind}`;
      files.push({ path: `extracted/${category}/${name}-${label(a.parameters.variant as Record<string, unknown>)}${suffix}-${a.hash.slice(0, 16)}.${a.extension}`, backing: a.path, hash: a.hash, size: a.size, artifact: a.id });
    }
    // Validated non-media resources can be preserved as native data containers.
    // Do not pretend raw XA payloads are decoded/playable video or audio.
    if (!files.length && category === "data") {
      const raw = m.artifacts.find(a => a.node === node.id && a.processor === "slice-v1");
      if (raw) files.push({ path: `extracted/data/${name}.${parser.rawExtension ?? "bin"}`, backing: node.blob, hash: raw.hash, size: node.size, artifact: raw.id });
    }
    if (!files.length) continue;
    if (new Set(files.map(f => f.path)).size !== files.length) throw new Error("Colliding public filenames");
    asset = { id: name, format: parser.format, category, raw: node.blob, occurrences: [node.id], files: files.sort((a, b) => a.path.localeCompare(b.path, "en")) };
    assets.set(name, asset);
  }
  const result = [...assets.values()].sort((a, b) => a.id.localeCompare(b.id, "en"));
  const paths = result.flatMap(a => a.files.map(f => f.path));
  if (new Set(paths).size !== paths.length) throw new Error("Colliding public asset identities");
  return result;
}
const safeExport = (path: string): boolean => /^extracted\/(images|sounds|models|videos|data)\/[a-zA-Z0-9_.-]+$/.test(path);
function validateFile(store: Store, file: PublishedFile, backing = false): void {
  if (!safeExport(file.path) || file.backing !== `blobs/${file.hash}`) throw new Error("Invalid public export path/provenance");
  const bytes = readFileSync(store.path(backing ? file.backing : file.path));
  if (bytes.length !== file.size || hash(bytes) !== file.hash) throw new Error(`Presented asset hash/size mismatch: ${file.path}`);
}
function index(m: Manifest): object { return { version: 2, manifestHash: hash(canonical(m) + "\n"), assets: m.assets }; }
/** All backing bytes and target containment are checked before any publication.
 * The manifest is the commit point; notes are a recoverable hash-linked projection.
 * Copies (not hard links) protect backing objects from edits in media viewers. */
export async function presentAssets(store: Store, m: Manifest, signal?: AbortSignal, step?: (stage: string) => void): Promise<void> {
  const previous = existsSync(store.path("manifest.json")) ? store.read<Manifest>("manifest.json") : undefined;
  if (previous && previous.version !== 2) throw new Error("Incompatible canonical asset manifest");
  for (const asset of m.assets) for (const file of asset.files) { signal?.throwIfAborted(); store.path(file.path); validateFile(store, file, true); }
  // Validate old ownership paths before committing, never accept arbitrary paths
  // from an edited manifest as permission to remove files elsewhere in build/.
  const intentPath = "cache/publication.json";
  const interrupted = existsSync(store.path(intentPath)) ? store.read<{ version: number; files: PublishedFile[] }>(intentPath) : undefined;
  if (interrupted && (interrupted.version !== 2 || !Array.isArray(interrupted.files))) throw new Error("Invalid publication recovery record");
  const previousFiles = [...(previous?.assets.flatMap(a => a.files) ?? []), ...(interrupted?.files ?? [])];
  for (const file of previousFiles) if (!safeExport(file.path)) throw new Error("Invalid previous publication ownership");
  const notes = safePath(store.project, "notes/asset-provenance.md");
  const document = renderProvenance(m);
  if (existsSync(notes) && !readFileSync(notes, "utf8").startsWith("<!-- Generated by extract-assets; do not edit. -->\n")) throw new Error("Refusing to overwrite handwritten provenance notes");
  const { rememberLegacyPresentation } = await import("./migration.ts");
  rememberLegacyPresentation(store);
  // One bounded ownership record covers interrupted copies; it is neither a run
  // ledger nor acceptance state. Remove it only after the projection is settled.
  store.json(intentPath, { version: 2, files: [...new Map([...previousFiles, ...m.assets.flatMap(a => a.files)].map(f => [f.path, f])).values()] });
  for (const asset of m.assets) for (const file of asset.files) {
    signal?.throwIfAborted(); store.atomic(file.path, store.bytes(file.backing));
  }
  step?.("exports"); signal?.throwIfAborted();
  store.json("manifest.json", m); step?.("manifest");
  store.json("index.json", index(m)); step?.("index");
  // Store supplies atomic write-if-changed and symlink checks. A second store at
  // the project root is unnecessary: write through the same primitive explicitly.
  const { mkdirSync, renameSync, writeFileSync } = await import("node:fs");
  const { randomBytes } = await import("node:crypto");
  if (!existsSync(notes) || readFileSync(notes, "utf8") !== document) {
    mkdirSync(dirname(notes), { recursive: true });
    const temp = `${notes}.${randomBytes(8).toString("hex")}.tmp`;
    try { writeFileSync(temp, document, { flag: "wx" }); renameSync(temp, notes); }
    finally { rmSync(temp, { force: true }); }
  }
  step?.("notes");
  const current = new Set(m.assets.flatMap(a => a.files.map(f => f.path)));
  const prunedCategories = new Set<string>();
  for (const file of previousFiles) if (!current.has(file.path)) {
    rmSync(store.path(file.path), { force: true }); prunedCategories.add(dirname(file.path));
  }
  for (const category of prunedCategories) {
    const path = store.path(category);
    if (existsSync(path) && readdirSync(path).length === 0) rmdirSync(path);
  }
  rmSync(store.path(intentPath), { force: true });
}
export function verifyPresentation(store: Store, m: Manifest): void {
  const expected = index(m);
  if (canonical(store.read("index.json")) !== canonical(expected)) throw new Error("Presented index/provenance mismatch");
  for (const asset of m.assets) for (const file of asset.files) validateFile(store, file);
  const notes = safePath(store.project, "notes/asset-provenance.md");
  if (!existsSync(notes) || readFileSync(notes, "utf8") !== renderProvenance(m)) throw new Error("Manifest/provenance document mismatch; rerun extract-assets to repair publication");
}
