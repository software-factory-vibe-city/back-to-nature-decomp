import { existsSync, readFileSync } from "node:fs";
import { endianness } from "node:os";
import { relative } from "node:path";
import { analyzeOriginal, evaluateByteTransform, transformAt } from "./analysis.ts";
import { engineFingerprints, parserFingerprints } from "./fingerprints.ts";
import { PARSERS, ParserRegistry, type DecodedOutput } from "./registry.ts";
import { presentAssets, presentationPlan, verifyPresentation } from "./presentation.ts";
import { schemaExtents, validateSchema } from "./schema.ts";
import { canonical, hash, id, integer, inventory, safePath, Store } from "./storage.ts";
import { DEFAULT_LIMITS, type Artifact, type Evidence, type Limits, type Manifest, type Match, type Node, type Operation, type ParserFingerprint, type Request } from "./types.ts";

export interface Statistics { scans: number; parses: number; decodes: number; replays: number; cacheHits: number }
interface StoredOutput { kind: string; extension: string; stage: "decoding" | "export"; path: string; hash: string; size: number; metadata: Record<string, unknown> }
interface Variant { parameters: Record<string, unknown>; outputs: StoredOutput[] }
interface Scan { matches: Array<Match & { bounded: Record<string, unknown> }>; rejected: number; complete: boolean }
/** Injection is for isolated fixtures; the CLI always derives real implementation
 * fingerprints. A fixture must explicitly supply its dependency identities. */
export interface ExtractionOptions {
  registry?: ParserRegistry; fingerprints?: ParserFingerprint[];
  beforePublish?: () => void | Promise<void>; publicationStep?: (step: string) => void;
}
const execution = () => ({ node: process.versions.node, v8: process.versions.v8, endian: endianness() });
const stats = (): Statistics => ({ scans: 0, parses: 0, decodes: 0, replays: 0, cacheHits: 0 });
export function limitsFrom(input: Partial<Limits> = {}): Limits {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Limits must be an object");
  for (const key of Object.keys(input)) if (!(key in DEFAULT_LIMITS)) throw new Error(`Unknown budget: ${key}`);
  const limits = { ...DEFAULT_LIMITS, ...input };
  for (const [key, value] of Object.entries(limits)) integer(value, key, 1);
  return limits;
}
function evidence(m: Manifest, subject: string, outcome: Evidence["outcome"], producer: string, detail: string): string {
  const entry: Evidence = { id: id("evidence", [subject, outcome, producer, detail]), subject, outcome, producer, detail };
  if (!m.evidence.some(e => e.id === entry.id)) m.evidence.push(entry);
  return entry.id;
}
function unresolved(m: Manifest, subject: string, outcome: Evidence["outcome"], reason: string, reopen: string): void {
  if (!m.unresolved.some(e => e.subject === subject && e.reason === reason)) m.unresolved.push({ subject, outcome, reason, reopen });
}
function nodeOf(m: Manifest, name: string): Node {
  const node = m.nodes.find(n => n.id === name);
  if (!node) throw new Error(`Unknown resource node: ${name}`);
  return node;
}
function usedOutput(m: Manifest): number {
  const blobs = new Map(m.nodes.filter(n => n.kind !== "input").map(n => [n.blob, n.size]));
  for (const a of m.artifacts) blobs.set(a.path, a.size);
  return [...blobs.values()].reduce((sum, size) => sum + size, 0);
}
function checkBudget(m: Manifest): void {
  if (m.nodes.filter(n => n.kind !== "input").length > m.limits.maxAssets || usedOutput(m) > m.limits.maxOutputBytes) throw new Error("budget-exhausted: resource nodes/output bytes; narrow scope or raise limits");
}
function addSlice(store: Store, m: Manifest, parent: Node, offset: number, length: number, kind: "member" | "resource", format: string | undefined, metadata: Record<string, unknown>, witness: string): Node {
  integer(offset, "slice offset"); integer(length, "slice length", 1);
  if (offset + length > parent.size) throw new Error("Slice outside parent");
  const name = id("node", [parent.id, offset, length, format ?? null, kind, metadata.parserId ?? metadata.record ?? null, metadata.schema ?? null]);
  const found = m.nodes.find(n => n.id === name);
  if (found) return found;
  const blob = store.blob(store.bytes(parent.blob).subarray(offset, offset + length));
  const node: Node = { id: name, kind, size: length, blob, source: { node: parent.id, offset, length, coordinate: parent.kind === "input" ? "file-byte" : "member-byte" }, metadata,
    ...(format ? { format } : {}), stages: { discovery: kind === "member" ? "candidate" : "validated", extraction: "validated" }, evidence: [witness] };
  const alias = m.nodes.find(n => n.blob === blob);
  m.nodes.push(node); m.edges.push({ from: parent.id, to: name, kind: "containment" });
  if (alias) m.edges.push({ from: alias.id, to: name, kind: "alias" });
  checkBudget(m);
  return node;
}
/** Complete immutable derivations only. A checked cache hit avoids parser work;
 * missing/corrupt backing objects invalidate just that entry and are regenerated. */
async function cached<T>(store: Store, key: unknown, force: boolean, counts: Statistics, memory: Map<string, unknown>, validate: (value: T) => void, producer: () => Promise<T>): Promise<T> {
  const path = `cache/v2/${hash(canonical(key))}.json`;
  // Force invalidates prior invocations, not equivalent source occurrences in
  // this one. Each distinct derivation is still computed/replayed only once.
  if (memory.has(path)) { const value = memory.get(path) as T; validate(value); counts.cacheHits++; return value; }
  if (!force && existsSync(store.path(path))) {
    try {
      const entry = store.read<{ version: number; key: unknown; digest: string; value: T }>(path);
      if (entry.version !== 2 || canonical(entry.key) !== canonical(key) || entry.digest !== hash(canonical(entry.value))) throw new Error("Invalid derivation cache");
      validate(entry.value); memory.set(path, entry.value); counts.cacheHits++; return entry.value;
    } catch { /* An incomplete/corrupt cache is never acceptance evidence. */ }
  }
  const value = await producer(); validate(value);
  store.json(path, { version: 2, key, digest: hash(canonical(value)), value }); memory.set(path, value);
  return value;
}
function artifact(m: Manifest, node: Node, stage: Artifact["stage"], path: string, size: number, processor: string, parameters: Record<string, unknown>, extension: string, parents = [node.blob]): void {
  const digest = path.slice(6), name = id("artifact", [node.id, stage, processor, parameters, digest]);
  if (m.artifacts.some(a => a.id === name)) return;
  m.artifacts.push({ id: name, node: node.id, stage, hash: digest, size, path, extension, processor, parameters, parents, evidence: [...node.evidence] });
  checkBudget(m);
}
function validateOutputs(store: Store, variants: Variant[], maximum: number): void {
  if (!Array.isArray(variants) || variants.length > 65536 || new Set(variants.map(v => canonical(v.parameters))).size !== variants.length) throw new Error("Invalid cached variants");
  for (const variant of variants) {
    if (!variant.parameters || !Array.isArray(variant.outputs)) throw new Error("Invalid cached output list");
    const kinds = new Set<string>(); let total = 0;
    for (const output of variant.outputs) {
      if (!/^[a-zA-Z0-9_-]{1,80}$/.test(output.kind) || !/^[a-zA-Z0-9_-]{1,80}$/.test(output.extension) || kinds.has(output.kind) || !["decoding", "export"].includes(output.stage) || output.path !== `blobs/${output.hash}`) throw new Error("Invalid cached output descriptor");
      kinds.add(output.kind); const bytes = store.bytes(output.path);
      if (bytes.length !== output.size) throw new Error("Invalid cached output size");
      total += output.size;
    }
    if (total > maximum) throw new Error("budget-exhausted: cached variant output");
  }
}
function descriptors(outputs: DecodedOutput[]): unknown {
  return outputs.map(o => ({ ...o, bytes: hash(o.bytes), size: o.bytes.length }));
}
function validateInputs(store: Store, m: Manifest): void {
  for (const input of m.inputs) {
    const bytes = readFileSync(safePath(store.project, input.path));
    if (hash(bytes) !== input.hash || bytes.length !== input.size) throw new Error(`input-drift: ${input.path}`);
  }
}
function sortManifest(m: Manifest): void {
  for (const entries of [m.inputs, m.nodes, m.artifacts, m.evidence, m.assets]) entries.sort((a, b) => a.id.localeCompare(b.id, "en"));
  m.edges.sort((a, b) => canonical(a).localeCompare(canonical(b), "en"));
  m.unresolved.sort((a, b) => canonical(a).localeCompare(canonical(b), "en"));
}
/** Read-only verification. Full replay groups artifacts by resource/variant and
 * decodes once for all outputs, never once per output file. */
export function verifyManifest(store: Store, m: Manifest, full = true, registry: ParserRegistry = PARSERS, counts: Statistics = stats()): void {
  store.clearBytes(); validateInputs(store, m);
  if (m.version !== 2 || canonical(m.execution) !== canonical(execution())) throw new Error("Incompatible asset manifest/execution profile");
  const names = new Set(m.nodes.map(n => n.id)), witnesses = new Set(m.evidence.map(e => e.id));
  if (names.size !== m.nodes.length || witnesses.size !== m.evidence.length) throw new Error("Duplicate graph IDs");
  for (const node of m.nodes) {
    const bytes = store.bytes(node.blob);
    if (bytes.length !== node.size || node.evidence.some(e => !witnesses.has(e))) throw new Error("Invalid node size/evidence");
    if (node.source) {
      const s = node.source, parent = store.bytes(nodeOf(m, s.node).blob);
      integer(s.offset, "source offset"); integer(s.length, "source length", 1);
      if (s.length !== node.size || s.offset + s.length > parent.length || !bytes.equals(parent.subarray(s.offset, s.offset + s.length))) throw new Error("Raw extraction differs from source extent");
    }
    if (full && typeof node.metadata.parserId === "string") {
      const parser = registry.get(node.metadata.parserId), parsed = registry.parse(parser.id, bytes, 0); counts.parses++;
      if (parsed.length !== bytes.length || node.format !== parser.format || canonical(node.metadata) !== canonical({ ...parsed.metadata, parserId: parser.id, parserVersion: parser.version }) || (node.stages.discovery !== "ambiguous" && node.stages.discovery !== (parsed.discovery ?? "validated"))) throw new Error("Parser node extent/metadata/discovery failed replay");
    }
  }
  for (const input of m.inputs) {
    const node = nodeOf(m, input.id);
    if (node.blob !== input.blob || node.size !== input.size || input.blob !== `blobs/${input.hash}`) throw new Error("Input graph provenance mismatch");
  }
  for (const edge of m.edges) if (!names.has(edge.from) || !names.has(edge.to)) throw new Error("Dangling graph edge");
  const variants = new Map<string, DecodedOutput[]>();
  for (const a of m.artifacts) {
    const node = nodeOf(m, a.node), actual = store.bytes(a.path);
    if (a.path !== `blobs/${a.hash}` || actual.length !== a.size || a.evidence.some(e => !witnesses.has(e))) throw new Error("Artifact hash/size/evidence mismatch");
    for (const parent of a.parents) store.bytes(parent);
    if (a.processor === "slice-v1") {
      const s = node.source;
      const expectedParents = s ? [nodeOf(m, s.node).blob, ...(typeof node.metadata.indexBlob === "string" ? [node.metadata.indexBlob] : [])] : [];
      if (!s || a.stage !== "extraction" || canonical(a.parents) !== canonical(expectedParents) || canonical(a.parameters) !== canonical({ source: s, basis: node.metadata.basis ?? "validated-parser" }) || !actual.equals(store.bytes(node.blob))) throw new Error("Slice artifact provenance mismatch");
    } else if (registry.parsers.some(p => p.id === a.processor)) {
      if (node.stages.discovery !== "validated" || a.processor !== node.metadata.parserId || canonical(a.parents) !== canonical([node.blob])) throw new Error("Parser artifact provenance mismatch");
      if (!full) continue;
      const key = canonical([a.processor, node.blob, a.parameters.variant]);
      if (!variants.has(key)) { variants.set(key, registry.decode(a.processor, store.bytes(node.blob), a.parameters.variant as Record<string, unknown>, m.limits.maxOutputBytes)); counts.replays++; }
      const output = variants.get(key)!.find(o => o.kind === a.parameters.kind);
      if (!output || a.extension !== output.extension || a.stage !== output.stage || canonical(a.parameters) !== canonical({ ...output.metadata, ...(a.parameters.variant as object), variant: a.parameters.variant, kind: output.kind }) || !actual.equals(output.bytes)) throw new Error("Parser artifact stage/metadata/transformation failed replay");
    } else if (a.processor === "byte-xor-v1") {
      const code = nodeOf(m, a.parameters.codeNode as string), original = nodeOf(m, a.parameters.inputNode as string);
      const transform = transformAt(store.bytes(code.blob), a.parameters.address as number);
      if (!transform || transform.key !== a.parameters.key || a.parameters.count !== original.size || canonical(a.parents) !== canonical([original.blob, code.blob]) || !actual.equals(evaluateByteTransform(store.bytes(original.blob), transform.key, m.limits.maxOutputBytes))) throw new Error("Transform has no validated original-word constructor/provenance");
    } else throw new Error("Unsupported artifact processor");
  }
  if (full) for (const node of m.nodes.filter(n => n.kind === "resource" && n.stages.discovery === "validated")) {
    const parser = registry.get(node.metadata.parserId as string), raw = store.bytes(node.blob);
    for (const variant of registry.variants(parser.id, raw)) {
      const key = canonical([parser.id, node.blob, variant]);
      if (!variants.has(key)) { variants.set(key, registry.decode(parser.id, raw, variant, m.limits.maxOutputBytes)); counts.replays++; }
      const expected = variants.get(key)!.map(o => o.kind).sort();
      const actual = m.artifacts.filter(a => a.node === node.id && a.processor === parser.id && canonical(a.parameters.variant) === canonical(variant)).map(a => a.parameters.kind).sort();
      if (canonical(actual) !== canonical(expected)) throw new Error("Incomplete parser variant artifacts");
    }
  }
  if (canonical(m.assets) !== canonical(presentationPlan(m, registry))) throw new Error("Published asset/source-occurrence provenance mismatch");
  // Replay conditional member layouts as a whole, including index dependencies.
  for (const schema of m.schemas) {
    const index = m.inputs.find(i => i.path === schema.index), data = m.inputs.find(i => i.path === schema.data);
    if (!index || !data) throw new Error("Missing schema inputs");
    const extents = schemaExtents(schema, store.bytes(index.blob), data.size);
    const members = m.nodes.filter(n => n.kind === "member" && n.metadata.schema === hash(canonical(schema)));
    if (members.length !== extents.length || extents.some(e => !members.some(n => n.metadata.record === e.index && n.source?.node === data.id && n.source.offset === e.offset && n.size === e.length && n.metadata.indexBlob === index.blob))) throw new Error("Schema member provenance mismatch");
  }
  checkBudget(m);
}

export async function extractAssets(project: string, request: Request = {}, signal?: AbortSignal, progress?: (info: Record<string, unknown>) => void, options: ExtractionOptions = {}): Promise<Record<string, unknown>> {
  const store = new Store(project), registry = options.registry ?? PARSERS, fingerprints = options.fingerprints ?? parserFingerprints(registry), engine = engineFingerprints(), counts = stats();
  const contract = engine.find(file => file.path.endsWith("/pipeline.ts"))!.hash, memory = new Map<string, unknown>();
  if (fingerprints.length !== registry.parsers.length || registry.parsers.some(p => !fingerprints.some(f => f.id === p.id && f.format === p.format && f.version === p.version && /^[a-f0-9]{64}$/.test(f.hash)))) throw new Error("Invalid parser dependency identities");
  return store.lock("extraction", async () => {
    signal?.throwIfAborted();
    const limits = limitsFrom(request.limits), selection = relative(store.project, safePath(store.project, request.input ?? "extracted")).replaceAll("\\", "/");
    const inputs = await inventory(project, selection, store, limits, signal);
    const schemas = [...(request.schemas ?? [])].sort((a, b) => canonical(a).localeCompare(canonical(b), "en"));
    if (schemas.length > 128 || new Set(schemas.map(canonical)).size !== schemas.length) throw new Error("Invalid/duplicate schema domain");
    for (const schema of schemas) validateSchema(schema);
    const transforms = [...(request.transforms ?? [])].sort((a, b) => canonical(a).localeCompare(canonical(b), "en"));
    if (transforms.length > 128 || new Set(transforms.map(canonical)).size !== transforms.length) throw new Error("Invalid/duplicate transform domain");
    const m: Manifest = { version: 2, selection, limits, schemas, transforms, execution: execution(), engine, parsers: fingerprints, inputs, nodes: [], artifacts: [], evidence: [], edges: [], unresolved: [], assets: [] };
    for (const input of inputs) {
      const witness = evidence(m, input.id, "validated", "inventory-v2", `SHA-256 ${input.hash}; ${input.size} file bytes at ${input.path}; physical disc coordinates and derivative lineage unavailable`);
      const prior = m.nodes.find(n => n.blob === input.blob);
      m.nodes.push({ id: input.id, kind: "input", blob: input.blob, size: input.size, metadata: { inputPath: input.path, physicalDiscCoordinates: "unavailable", lineage: "unverified" }, stages: { discovery: "validated" }, evidence: [witness] });
      if (prior) m.edges.push({ from: prior.id, to: input.id, kind: "alias" });
    }
    unresolved(m, "scope", "context-unresolved", "Supported-format scans do not establish total game asset count, semantic names, disc LBAs or missing XA subheaders", "Add evidence-backed capabilities or supply independently witnessed original disc metadata");
    for (const schema of schemas) {
      const index = inputs.find(i => i.path === schema.index), data = inputs.find(i => i.path === schema.data);
      if (!index || !data) throw new Error("Schema paths must identify inventoried inputs exactly");
      const witness = evidence(m, index.id, "candidate", "schema-v1", `Supplied schema ${hash(canonical(schema))}: extents checked, historical boundary/field interpretation NOT established`);
      for (const extent of schemaExtents(schema, store.bytes(index.blob), data.size)) addSlice(store, m, nodeOf(m, data.id), extent.offset, extent.length, "member", undefined, { record: extent.index, schema: hash(canonical(schema)), indexBlob: index.blob, basis: schema.basis }, witness);
      unresolved(m, index.id, "candidate", "Supplied archive schema has only extent validation", "Witness record origin, count and field semantics in the original loader");
    }
    for (const transform of transforms) {
      if (transform.kind !== "byte-xor") throw new Error("Unsupported transform constructor");
      integer(transform.address, "transform address", 0, 0xffffffff);
      const input = inputs.find(i => i.path === transform.input), code = inputs.find(i => i.path === transform.code);
      if (!input || !code) throw new Error("Transform paths must identify inventoried inputs exactly");
      const relation = transformAt(store.bytes(code.blob), transform.address);
      if (!relation) throw new Error("unsupported: no checked byte-xor constructor at the original code address");
      const output = evaluateByteTransform(store.bytes(input.blob), relation.key, limits.maxOutputBytes);
      const name = id("decoded", [input.id, code.id, transform.address, relation.key]);
      const witness = evidence(m, name, "validated", "byte-xor-v1", `Original-word constructor at ${code.id}:0x${transform.address.toString(16)}; key ${relation.key}; count ${input.size}; input association/count supplied, NOT an inferred game call`);
      const node: Node = { id: name, kind: "decoded", blob: store.blob(output), size: output.length, metadata: { codeNode: code.id, inputNode: input.id }, stages: { decoding: "validated", discovery: "candidate" }, evidence: [witness] };
      m.nodes.push(node); m.edges.push({ from: input.id, to: name, kind: "transformation" });
      artifact(m, node, "decoding", node.blob, node.size, "byte-xor-v1", { key: relation.key, address: transform.address, codeNode: code.id, inputNode: input.id, count: input.size }, "bin", [input.blob, code.blob]);
    }
    // Original/member/explicit-transform byte views only. General plugin-produced
    // view discovery is deliberately not claimed by this orchestration refactor.
    for (const view of [...m.nodes]) {
      signal?.throwIfAborted(); let found = 0;
      const bytes = store.bytes(view.blob);
      for (const parser of registry.parsers) {
        progress?.({ stage: "scan", input: view.id, parser: parser.id });
        const fingerprint = fingerprints.find(p => p.id === parser.id)!;
        const scanned = await cached<Scan>(store, ["scan-v2", contract, execution(), fingerprint.hash, view.blob, limits.maxAssets], Boolean(request.force), counts, memory, value => {
          if (!value.complete || !Array.isArray(value.matches)) throw new Error("Incomplete discovery cache");
          for (const match of value.matches) {
            integer(match.offset, "cached offset", 0, bytes.length); integer(match.length, "cached length", 1, bytes.length - match.offset);
            if (match.parser !== parser.id || match.format !== parser.format || !["validated", "candidate"].includes(match.discovery) || !match.bounded || typeof match.bounded !== "object") throw new Error("Invalid cached parser extent");
          }
        }, async () => {
          counts.scans++;
          const result = await new ParserRegistry([parser]).scan(bytes, limits.maxAssets, signal);
          counts.parses += result.matches.length + result.rejected;
          if (!result.complete) throw new Error("budget-exhausted: incomplete format scan");
          return { ...result, matches: result.matches.map(match => {
            const parsed = registry.parse(parser.id, bytes.subarray(match.offset, match.offset + match.length), 0); counts.parses++;
            if (parsed.length !== match.length || (parsed.discovery ?? "validated") !== match.discovery) throw new Error("Bounded parser extent/discovery failed replay");
            return { ...match, bounded: parsed.metadata };
          }) };
        });
        for (const match of scanned.matches) {
          const witness = evidence(m, view.id, match.discovery, parser.id, `${parser.format} at byte ${match.offset}, ${match.length} bytes; structurally compatible with ${parser.id} version ${parser.version}; ${match.discovery === "candidate" ? "weak discovery signature, independent sector/format alignment NOT established; no public export" : "historical naming is unknown"}`);
          const resource = addSlice(store, m, view, match.offset, match.length, "resource", parser.format, { ...match.bounded, parserId: parser.id, parserVersion: parser.version }, witness);
          resource.stages.discovery = match.discovery;
          if (match.discovery === "candidate") unresolved(m, resource.id, "candidate", "Weak format signature alone does not establish this extent as an asset; no decode or public export selected", "Witness the format boundary/alignment independently before promoting this candidate");
          const alternative = m.nodes.find(n => n.id !== resource.id && n.kind === "resource" && n.source?.node === view.id && n.source.offset === match.offset && n.size === match.length && n.metadata.parserId !== parser.id);
          if (alternative) {
            alternative.stages.discovery = "ambiguous"; resource.stages.discovery = "ambiguous";
            unresolved(m, resource.id, "ambiguous", "Multiple parsers validate the same extent; no public export selected", "Establish the correct format using independent context");
          }
          found++;
        }
      }
      if (!found) unresolved(m, view.id, "unsupported", `No validated ${registry.parsers.map(p => p.format).join("/")} in the complete supported-format scan`, "Add a tested parser or establish a container/transform; this does not mean the bytes are not assets");
    }
    for (const node of m.nodes.filter(n => n.source)) {
      artifact(m, node, "extraction", node.blob, node.size, "slice-v1", { source: node.source, basis: node.metadata.basis ?? "validated-parser" }, "bin", [nodeOf(m, node.source!.node).blob, ...(typeof node.metadata.indexBlob === "string" ? [node.metadata.indexBlob] : [])]);
      if (node.stages.discovery !== "validated" || typeof node.metadata.parserId !== "string") continue;
      const parser = registry.get(node.metadata.parserId), fingerprint = fingerprints.find(p => p.id === parser.id)!;
      const decoded = await cached<Variant[]>(store, ["decode-v2", contract, execution(), fingerprint.hash, node.blob, limits.maxOutputBytes], Boolean(request.force), counts, memory, value => validateOutputs(store, value, limits.maxOutputBytes), async () => {
        const variants: Variant[] = [];
        for (const parameters of registry.variants(parser.id, store.bytes(node.blob))) {
          signal?.throwIfAborted(); progress?.({ stage: "decode", input: node.id, parser: parser.id, variant: parameters });
          const outputs = registry.decode(parser.id, store.bytes(node.blob), parameters, limits.maxOutputBytes); counts.decodes++;
          const replay = registry.decode(parser.id, store.bytes(node.blob), parameters, limits.maxOutputBytes); counts.replays++;
          if (canonical(descriptors(outputs)) !== canonical(descriptors(replay))) throw new Error("Nondeterministic parser decode/replay");
          variants.push({ parameters, outputs: outputs.map(o => ({ kind: o.kind, extension: o.extension, stage: o.stage, metadata: o.metadata, path: store.blob(o.bytes), hash: hash(o.bytes), size: o.bytes.length })) });
          await new Promise<void>(r => setImmediate(r));
        }
        return variants;
      });
      for (const variant of decoded) for (const output of variant.outputs) {
        artifact(m, node, output.stage, output.path, output.size, parser.id, { ...output.metadata, ...variant.parameters, variant: variant.parameters, kind: output.kind }, output.extension);
        node.stages[output.stage] = "validated";
      }
    }
    m.assets = presentationPlan(m, registry); sortManifest(m);
    verifyManifest(store, m, Boolean(request.fullVerify), registry, counts);
    await options.beforePublish?.(); signal?.throwIfAborted(); validateInputs(store, m);
    if (canonical(engineFingerprints()) !== canonical(engine) || (!options.fingerprints && canonical(parserFingerprints(registry)) !== canonical(fingerprints))) throw new Error("Extractor/parser implementation changed during extraction");
    await presentAssets(store, m, signal, options.publicationStep);
    let migration: Record<string, unknown> | undefined;
    if (request.migrateLegacy) { const { migrateLegacy } = await import("./migration.ts"); migration = await migrateLegacy(store, signal); }
    return { ...(migration ? { migration } : {}), outcome: "validated", manifest: "build/assets/manifest.json", manifestHash: hash(canonical(m) + "\n"), documentation: "notes/asset-provenance.md", inputs: m.inputs.length, resourceNodes: m.nodes.filter(n => n.kind === "resource" && n.stages.discovery === "validated").length, candidateNodes: m.nodes.filter(n => n.kind === "resource" && n.stages.discovery !== "validated").length, assets: m.assets.length, exports: m.assets.reduce((sum, a) => sum + a.files.length, 0), unresolved: m.unresolved.length, statistics: counts };
  });
}

export async function executeResource(operation: Operation, project: string, request: Request = {}, signal?: AbortSignal, progress?: (info: Record<string, unknown>) => void): Promise<Record<string, unknown>> {
  signal?.throwIfAborted();
  if (operation === "extract") return extractAssets(project, request, signal, progress);
  if (operation === "parser") { const { parserOperation } = await import("./parser-builder.ts"); return parserOperation(project, request, signal); }
  const store = new Store(project);
  if (operation === "verify") return store.lock("extraction", async () => {
    const m = store.read<Manifest>("manifest.json"), counts = stats();
    if (canonical(m.engine) !== canonical(engineFingerprints()) || canonical(m.parsers) !== canonical(parserFingerprints())) throw new Error("Extractor/parser implementation drift; rerun extract-assets");
    verifyManifest(store, m, true, PARSERS, counts); verifyPresentation(store, m);
    return { outcome: "validated", manifestHash: hash(canonical(m) + "\n"), statistics: counts };
  });
  // Focused investigation works on original bytes alone. It never creates an
  // extraction run or assumes a matched source/compiler/generated symbol map.
  if (!request.input) throw new Error("Analysis requires a selected original input file");
  const inputs = await inventory(project, request.input, store, limitsFrom(request.limits), signal);
  if (inputs.length !== 1) throw new Error("Analysis requires exactly one original input file");
  const input = inputs[0]!, bytes = store.bytes(input.blob), offset = integer(request.offset ?? 0, "offset", 0, bytes.length), length = integer(request.length ?? Math.min(256, bytes.length - offset), "length", 0, Math.min(4096, bytes.length - offset));
  const report = await analyzeOriginal(bytes, input.id, limitsFrom(request.limits), signal);
  const fullReport = `cache/analysis/${hash(canonical([input.hash, report]))}.json`;
  store.json(fullReport, { input, report });
  return { input, offset, length, hex: bytes.subarray(offset, offset + length).toString("hex"), outcome: report.outcome, capability: report.capability, blockers: report.blockers, functions: report.functions, fullReport: `build/assets/${fullReport}` };
}
