import { existsSync, readFileSync, readdirSync } from "node:fs";
import { relative } from "node:path";
import { analyzeOriginal, evaluateByteTransform, transformAt } from "./analysis.ts";
import { PARSERS, scanFormats } from "./registry.ts";
import { presentAssets, verifyPresentation } from "./presentation.ts";
import { schemaExtents, validateSchema } from "./schema.ts";
import { analyzerVersion, canonical, hash, id, integer, inventory, runPath, safePath, Store } from "./storage.ts";
import { DEFAULT_LIMITS, type Artifact, type Evidence, type Job, type Limits, type Manifest, type Node, type Operation, type Request, type State } from "./types.ts";
import { randomBytes } from "node:crypto";

interface Run { manifest: Manifest; state: State }
function limitsFrom(input: Partial<Limits> = {}): Limits {
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
function persist(store: Store, run: Run): void {
  const path = runPath(run.manifest.runId);
  run.state.manifestHash = hash(canonical(run.manifest) + "\n");
  const digest = hash(canonical(run) + "\n");
  // Immutable generations plus one atomic pointer: a crash never pairs a new
  // manifest with an old work queue. Convenience views are not authoritative.
  if (!existsSync(store.path(`${path}/snapshots/${digest}.json`))) store.json(`${path}/snapshots/${digest}.json`, run);
  store.json(`${path}/current.json`, { snapshot: digest });
  store.json(`${path}/manifest.json`, run.manifest);
  store.json(`${path}/state.json`, run.state);
}
export function loadRun(store: Store, name: string, checkAnalyzer = true): Run {
  const path = runPath(name);
  const current = store.read<{ snapshot: string }>(`${path}/current.json`);
  if (!/^[a-f0-9]{64}$/.test(current.snapshot)) throw new Error("Invalid checkpoint pointer");
  const bytes = readFileSync(store.path(`${path}/snapshots/${current.snapshot}.json`));
  if (hash(bytes) !== current.snapshot) throw new Error("Corrupt checkpoint");
  const run = JSON.parse(bytes.toString()) as Run;
  if (run.manifest.version !== 1 || run.state.version !== 1 || run.manifest.runId !== name || run.state.manifestHash !== hash(canonical(run.manifest) + "\n")) throw new Error("Invalid run checkpoint");
  if (checkAnalyzer && run.manifest.analyzer !== analyzerVersion()) throw new Error("input-drift: analyzer changed; start a new run (settled old snapshots are preserved)");
  return run;
}
function nodeOf(m: Manifest, name: string): Node {
  const node = m.nodes.find(n => n.id === name);
  if (!node) throw new Error(`Unknown resource node: ${name}`);
  return node;
}
function addSlice(store: Store, run: Run, parent: Node, offset: number, length: number, kind: Node["kind"], format: string | undefined, metadata: Record<string, unknown>, witness: string): Node {
  const m = run.manifest;
  const name = id("node", [parent.id, offset, length, format ?? null, metadata]);
  const found = m.nodes.find(n => n.id === name);
  if (found) return found;
  integer(offset, "slice offset"); integer(length, "slice length");
  if (offset + length > parent.size) throw new Error("Slice outside parent");
  if (m.nodes.filter(n => n.kind !== "input").length >= m.limits.maxAssets || usedOutput(m) + length > m.limits.maxOutputBytes) throw new Error("budget-exhausted: raw resource nodes/bytes");
  const blob = store.blob(store.bytes(parent.blob).subarray(offset, offset + length));
  const node: Node = { id: name, kind, size: length, blob, source: { node: parent.id, offset, length, coordinate: parent.kind === "input" ? "file-byte" : "member-byte" }, metadata,
    ...(format ? { format } : {}), stages: { discovery: kind === "member" ? "candidate" : "validated", extraction: "validated" }, evidence: [witness] };
  m.nodes.push(node);
  m.edges.push({ from: parent.id, to: name, kind: "containment" });
  const alias = m.nodes.find(n => n.id !== name && n.blob === blob);
  if (alias) m.edges.push({ from: alias.id, to: name, kind: "alias" });
  return node;
}
function usedOutput(m: Manifest): number {
  // Raw member/resource objects and decoded graph nodes already own their bytes.
  return m.nodes.filter(n => n.kind !== "input").reduce((sum, n) => sum + n.size, 0) +
    m.artifacts.filter(a => PARSERS.parsers.some(p => p.id === a.processor)).reduce((sum, a) => sum + a.size, 0);
}
async function cached<T>(store: Store, path: string, producer: () => Promise<T>): Promise<T> {
  if (existsSync(store.path(path))) {
    try {
      const entry = store.read<{ key: string; digest: string; value: T }>(path);
      if (entry.key === path && entry.digest === hash(canonical(entry.value))) return entry.value;
    } catch { /* An incomplete/corrupt cache is never acceptance evidence. */ }
  }
  const value = await producer();
  store.json(path, { key: path, digest: hash(canonical(value)), value });
  return value;
}
function enqueue(run: Run, job: Job): void {
  const key = id("job", job);
  if (!run.state.completed.includes(key) && !run.state.pending.some(j => id("job", j) === key)) run.state.pending.push(job);
}
function artifact(store: Store, m: Manifest, node: Node, stage: Artifact["stage"], bytes: Buffer, processor: string, parameters: Record<string, unknown>, suffix: string, parents = [node.blob]): void {
  const name = id("artifact", [node.id, stage, processor, parameters, hash(bytes)]);
  if (m.artifacts.some(a => a.id === name)) return;
  const blob = store.blob(bytes);
  const path = stage === "export" ? `${runPath(m.runId)}/exports/${name}.${suffix}` : blob;
  if (stage === "export") store.atomic(path, bytes);
  m.artifacts.push({ id: name, node: node.id, stage, hash: hash(bytes), size: bytes.length, path, extension: suffix, processor, parameters, parents, evidence: [...node.evidence] });
}

async function createRun(store: Store, request: Request, signal?: AbortSignal): Promise<Run> {
  const limits = limitsFrom(request.limits);
  const selection = relative(store.project, safePath(store.project, request.input ?? "extracted")).replaceAll("\\", "/");
  const inputs = await inventory(store.project, selection, store, limits, signal);
  const schemas = request.schemas ?? [];
  for (const schema of schemas) validateSchema(schema);
  const analyzer = analyzerVersion();
  const identity = hash(canonical({ analyzer, selection, inputs, limits, schemas }));
  const runId = `${identity.slice(0, 16)}-${randomBytes(8).toString("hex")}`;
  const m: Manifest = { version: 1, runId, identity, analyzer, selection, limits, inputs, schemas, nodes: [], artifacts: [], evidence: [], edges: [], unresolved: [] };
  const state: State = { version: 1, manifestHash: "", pending: [], completed: [], outcome: "running" };
  for (const input of inputs) {
    const witness = evidence(m, input.id, "validated", "inventory-v1", `SHA-256 ${input.hash}; ${input.size} consumed file bytes at ${input.path}; physical disc coordinates and derivative lineage unavailable`);
    m.nodes.push({ id: input.id, kind: "input", blob: input.blob, size: input.size, metadata: { inputPath: input.path, physicalDiscCoordinates: "unavailable", lineage: "unverified" }, stages: { discovery: "validated" }, evidence: [witness] });
    const prior = inputs.find(i => i.id !== input.id && i.hash === input.hash && inputs.indexOf(i) < inputs.indexOf(input));
    if (prior) m.edges.push({ from: prior.id, to: input.id, kind: "alias" });
    state.pending.push({ node: input.id, stage: "probe" }, { node: input.id, stage: "analyze" });
  }
  for (let i = 0; i < schemas.length; i++) {
    const index = inputs.find(input => input.path === schemas[i]!.index);
    const data = inputs.find(input => input.path === schemas[i]!.data);
    if (!index || !data) throw new Error("Schema input paths must identify inventoried files exactly");
    state.pending.unshift({ node: index.id, stage: "schema", schema: i });
  }
  unresolved(m, "scope", "context-unresolved", "Unpacked files do not establish disc LBAs, sector modes, XA subheaders or audio tracks", "Supply independently witnessed disc metadata if an operation needs physical coordinates");
  const run = { manifest: m, state };
  store.json(`${runPath(runId)}/inputs.json`, inputs);
  persist(store, run);
  return run;
}

async function perform(store: Store, run: Run, job: Job, signal?: AbortSignal): Promise<boolean> {
  const m = run.manifest, node = nodeOf(m, job.node), path = runPath(m.runId);
  const available = m.limits.maxAssets - m.nodes.filter(n => n.kind !== "input").length;
  const bytes = store.bytes(node.blob);
  if (job.stage === "schema") {
    const schema = m.schemas[job.schema!]!;
    if (schema.count > available) return false;
    const dataInput = m.inputs.find(i => i.path === schema.data)!;
    const parent = nodeOf(m, dataInput.id);
    try {
      const extents = schemaExtents(schema, bytes, parent.size);
      const witness = evidence(m, node.id, "candidate", "schema-v1", `Supplied schema ${hash(canonical(schema))}: extents checked, historical boundary/field interpretation NOT established`);
      store.json(`${path}/schemas/${hash(canonical(schema))}.json`, { schema, extents, evidence: witness });
      for (const extent of extents) {
        const member = addSlice(store, run, parent, extent.offset, extent.length, "member", undefined, { record: extent.index, schema: hash(canonical(schema)), indexBlob: node.blob, basis: schema.basis }, witness);
        for (const stage of ["probe", "analyze", "extract"] as const) enqueue(run, { node: member.id, stage });
      }
      unresolved(m, node.id, "candidate", "Supplied archive schema has only extent validation", "Witness its record origin, count and field semantics in the original loader");
    } catch (error) {
      unresolved(m, node.id, "domain-exhausted", `Supplied schema rejected: ${String(error)}`, "Revise the schema premise using loader evidence; this closes only the supplied reading");
    }
  } else if (job.stage === "probe") {
    const cache = `cache/${id("probe", [m.analyzer, node.blob, m.limits.maxAssets])}.json`;
    const result = await cached(store, cache, () => scanFormats(bytes, m.limits.maxAssets, signal));
    for (const match of result.matches) {
      // On cached results the parser is still the acceptance gate.
      const parser = PARSERS.get(match.parser);
      const parsed = PARSERS.parse(parser.id, bytes, match.offset);
      if (parsed.length !== match.length || parser.format !== match.format) throw new Error("Probe cache failed parser replay");
      // Resource metadata must replay on its isolated blob, not its container.
      // Keep container-context observations in the probe report/cache instead.
      const bounded = PARSERS.parse(parser.id, bytes.subarray(match.offset, match.offset + parsed.length), 0);
      if (bounded.length !== parsed.length) throw new Error("Bounded resource extent failed parser replay");
      const witness = evidence(m, node.id, "validated", parser.id, `${parser.format} at byte ${match.offset}, ${match.length} bytes; structural constraints validated by ${parser.id} version ${parser.version}; compatibility is not historical naming evidence`);
      const metadata = { ...bounded.metadata, parserId: parser.id, parserVersion: parser.version };
      const resource = addSlice(store, run, node, match.offset, match.length, "resource", parser.format, metadata, witness);
      const alternative = m.nodes.find(n => n.id !== resource.id && n.source?.node === node.id && n.source.offset === match.offset && n.size === match.length && n.metadata.parserId && n.metadata.parserId !== parser.id);
      if (alternative) { alternative.stages.discovery = "ambiguous"; resource.stages.discovery = "ambiguous"; }
      enqueue(run, { node: resource.id, stage: "extract" });
    }
    store.json(`${path}/analysis/${node.id}-probe.json`, result);
    if (!result.complete) {
      unresolved(m, node.id, "budget-exhausted", "Format scan stopped at maxAssets", "Start a new run with a larger asset budget or narrower input scope");
      // Accepted prefix is retained; do not keep re-scanning it on every resume.
    } else if (!result.matches.length) unresolved(m, node.id, "unsupported", `No validated ${PARSERS.parsers.map(p => p.format).join("/")} found in the complete byte-wise supported-format scan`, "Add a tested format parser, or establish a container/transform from loader evidence; this does not mean the bytes are not assets");
  } else if (job.stage === "analyze") {
    const cache = `cache/${id("analysis", [m.analyzer, node.blob, m.limits.maxFunctions, m.limits.maxInstructions])}.json`;
    const report = await cached(store, cache, () => analyzeOriginal(bytes, node.id, m.limits, signal));
    // A cache shared by identical byte objects carries the current container identity.
    report.container = node.id;
    store.json(`${path}/analysis/${node.id}-static.json`, report);
    const witness = evidence(m, node.id, report.outcome, "static-slices-v1", `${report.functions.length} entry/direct-call function observations; ${report.capability}; consult original-word addresses in the attached static report`);
    node.evidence.push(witness);
    if (report.functions.length) node.stages.interpretation = "candidate";
    unresolved(m, node.id, report.outcome === "budget-exhausted" ? "budget-exhausted" : "context-unresolved", report.blockers.join("; ") || "Resource operation signatures, archive table extent and consumer meaning remain unresolved", "Supply missing address/operation evidence or extend the bounded static analyzer; changing an unrelated C source does not reopen it");
  } else {
    if (!node.source) return true;
    if (!m.artifacts.some(a => a.node === node.id && a.processor === "slice-v1")) {
      const parents = [nodeOf(m, node.source.node).blob];
      if (typeof node.metadata.indexBlob === "string") parents.push(node.metadata.indexBlob);
      artifact(store, m, node, "extraction", bytes, "slice-v1", { source: node.source, basis: node.metadata.basis ?? "validated-parser" }, "bin", parents);
    }
    if (typeof node.metadata.parserId === "string") {
      const parser = PARSERS.get(node.metadata.parserId);
      for (const variant of PARSERS.variants(parser.id, bytes)) {
        const complete = m.artifacts.some(a => a.node === node.id && a.processor === parser.id && canonical(a.parameters.variant) === canonical(variant));
        if (complete) continue;
        const outputs = PARSERS.decode(parser.id, bytes, variant, m.limits.maxOutputBytes - usedOutput(m));
        for (const output of outputs) {
          artifact(store, m, node, output.stage, output.bytes, parser.id, { ...output.metadata, ...variant, variant, kind: output.kind }, output.extension);
          node.stages[output.stage] = "validated";
        }
        // Publish a whole variant at once; a budget stop preserves earlier variants.
        persist(store, run);
        signal?.throwIfAborted();
        await new Promise<void>(r => setImmediate(r));
      }
    }
  }
  return true;
}

function validateInputs(store: Store, run: Run): void {
  for (const input of run.manifest.inputs) {
    const path = safePath(store.project, input.path);
    const bytes = readFileSync(path);
    if (hash(bytes) !== input.hash) throw new Error(`input-drift: ${input.path}; the old input snapshot is preserved`);
  }
}
export function verifyRun(store: Store, run: Run): { outcome: "validated"; nodes: number; artifacts: number; manifestHash: string } {
  const m = run.manifest;
  store.clearBytes();
  validateInputs(store, run);
  const names = new Set(m.nodes.map(n => n.id)), witnesses = new Set(m.evidence.map(e => e.id));
  if (names.size !== m.nodes.length || witnesses.size !== m.evidence.length) throw new Error("Duplicate graph IDs");
  for (const node of m.nodes) {
    const bytes = store.bytes(node.blob);
    if (bytes.length !== node.size || node.evidence.some(e => !witnesses.has(e))) throw new Error("Invalid node size/evidence");
    if (node.source) {
      const source = node.source;
      integer(source.offset, "source offset"); integer(source.length, "source length");
      const parent = store.bytes(nodeOf(m, source.node).blob);
      if (source.length !== node.size || source.offset + source.length > parent.length || !bytes.equals(parent.subarray(source.offset, source.offset + source.length))) throw new Error("Raw extraction differs from source extent");
    }
    if (typeof node.metadata.parserId === "string") {
      const parser = PARSERS.get(node.metadata.parserId), parsed = PARSERS.parse(parser.id, bytes, 0);
      if (parsed.length !== bytes.length || node.format !== parser.format || node.metadata.parserVersion !== parser.version || canonical(node.metadata) !== canonical({ ...parsed.metadata, parserId: parser.id, parserVersion: parser.version })) throw new Error("Parser node extent/metadata failed replay");
    }
  }
  for (const input of m.inputs) {
    const node = nodeOf(m, input.id);
    if (node.blob !== input.blob || node.size !== input.size || input.blob !== `blobs/${input.hash}`) throw new Error("Input graph provenance mismatch");
  }
  for (const edge of m.edges) if (!names.has(edge.from) || !names.has(edge.to)) throw new Error("Dangling graph edge");
  for (const a of m.artifacts) {
    const node = nodeOf(m, a.node);
    if (a.evidence.some(e => !witnesses.has(e))) throw new Error("Missing artifact evidence");
    for (const parent of a.parents) store.bytes(parent);
    if (a.path !== `blobs/${a.hash}` && !a.path.startsWith(`${runPath(m.runId)}/exports/`)) throw new Error("Artifact outside output scope");
    const actual = readFileSync(store.path(a.path));
    if (hash(actual) !== a.hash || actual.length !== a.size) throw new Error("Artifact hash/size mismatch");
    let expected: Buffer;
    if (a.processor === "slice-v1") expected = store.bytes(node.blob);
    else if (PARSERS.parsers.some(p => p.id === a.processor)) {
      const output = PARSERS.replay(a.processor, store.bytes(node.blob), a.parameters.variant as Record<string, unknown>, a.parameters.kind as string, m.limits.maxOutputBytes);
      if ((a.extension !== undefined && a.extension !== output.extension) || a.stage !== output.stage || canonical(a.parameters) !== canonical({ ...output.metadata, ...(a.parameters.variant as Record<string, unknown>), variant: a.parameters.variant, kind: output.kind }) || canonical(a.parents) !== canonical([node.blob])) throw new Error("Parser artifact stage/metadata/provenance mismatch");
      expected = output.bytes;
    } else if (a.processor === "byte-xor-v1") {
      const code = nodeOf(m, a.parameters.codeNode as string);
      const original = nodeOf(m, a.parameters.inputNode as string);
      // Recheck ORIGINAL WORDS, never trust a mutable analysis JSON as proof.
      const transform = transformAt(store.bytes(code.blob), a.parameters.address as number);
      if (transform?.kind !== "byte-xor" || transform.key !== a.parameters.key || a.parameters.count !== original.size) throw new Error("Transform has no validated constructor evidence");
      expected = evaluateByteTransform(store.bytes(original.blob), transform.key, m.limits.maxOutputBytes);
    } else throw new Error("Unsupported artifact processor");
    if (!actual.equals(expected)) throw new Error("Transformation replay mismatch");
  }
  return { outcome: "validated", nodes: m.nodes.length, artifacts: m.artifacts.length, manifestHash: run.state.manifestHash };
}

function documentBundle(store: Store, run: Run): Record<string, unknown> {
  const verification = verifyRun(store, run), m = run.manifest;
  const bundle = { version: 1, runId: m.runId, manifestHash: verification.manifestHash, analyzer: m.analyzer, verification,
    inputs: m.inputs.map(({ id, path, hash, size }) => ({ id, path, hash, size })),
    nodes: m.nodes, artifacts: m.artifacts, evidence: m.evidence, unresolved: m.unresolved,
    coverage: { observedInputFiles: m.inputs.length, observedBytes: m.inputs.reduce((s, i) => s + i.size, 0), supportedFormats: PARSERS.parsers.map(p => ({ id: p.id, format: p.format, version: p.version })), totalGameAssets: "unknown" },
    reproduction: `npx tsx tools/agent/resourceCampaign.ts --resume ${m.runId}`,
    browsableAssets: "build/assets/index.json (category folders contain copies; run artifacts remain authoritative)",
    limitations: ["Schema validation is conditional on supplied layouts", "Static slices do not independently establish loader/consumer semantics", "Exports are derivative; raw/RGBA/STP blobs remain authoritative"] };
  const bundleHash = hash(canonical(bundle));
  store.json(`${runPath(m.runId)}/docs/handoff-${bundleHash}.json`, bundle);
  const table = m.nodes.filter(n => n.kind !== "input").map(n => `| ${n.id} | ${n.format ?? "opaque"} | ${n.size} | ${canonical(n.stages)} | ${n.evidence.join(", ")} |`).join("\n");
  const report = `# Resource extraction ${m.runId}\n\nVerified manifest: ${verification.manifestHash}\n\n${m.inputs.length} observed input files; total game assets unknown.\nSupported format parsers/exporters: ${PARSERS.parsers.map(p => `${p.format} v${p.version}`).join(", ")}.\n\n| Node | Format | Bytes | Stages | Evidence |\n|---|---|---|---|---|\n${table}\n\n## Limitations and reopening conditions\n\n${m.unresolved.map(u => `- ${u.subject}: **${u.outcome}** — ${u.reason}. Reopen: ${u.reopen}.`).join("\n")}\n\n## Reproduce\n\n\`${bundle.reproduction}\`\n\nRaw and decoded blobs are authoritative. PPM discards transparency/STP.\n`;
  store.atomic(`${runPath(m.runId)}/report.md`, report);
  store.atomic(`${runPath(m.runId)}/docs/catalog.md`, report);
  return { outcome: "validated", handoff: `${runPath(m.runId)}/docs/handoff-${bundleHash}.json`, bundleHash, manifestHash: verification.manifestHash };
}

async function transform(store: Store, run: Run, request: Request, signal?: AbortSignal): Promise<void> {
  const m = run.manifest;
  if (!request.node || !request.transformNode || request.transformAddress === undefined) throw new Error("Transform requires node, transformNode and transformAddress");
  const input = nodeOf(m, request.node), code = nodeOf(m, request.transformNode);
  const report = await analyzeOriginal(store.bytes(code.blob), code.id, m.limits, signal);
  const fn = report.functions.find(f => f.entry === request.transformAddress);
  const relation = fn?.transform as { kind: string; key: number; outcome: string } | undefined;
  if (relation?.kind !== "byte-xor" || relation.outcome !== "validated") throw new Error("unsupported: no checked byte-xor constructor at requested code address");
  const output = evaluateByteTransform(store.bytes(input.blob), relation.key, m.limits.maxOutputBytes - usedOutput(m));
  const name = id("decoded", [input.id, code.id, request.transformAddress, relation.key]);
  if (m.nodes.some(n => n.id === name)) return;
  if (m.nodes.filter(n => n.kind !== "input").length >= m.limits.maxAssets) throw new Error("budget-exhausted: transform node");
  store.json(`${runPath(m.runId)}/analysis/${code.id}-static.json`, report);
  const witness = evidence(m, input.id, "validated", "byte-xor-v1", `Complete original-word constructor at ${code.id}:0x${request.transformAddress.toString(16)}; key ${relation.key}; requested count ${input.size}, separate output buffer; association/count supplied by caller, NOT an inferred game call`);
  const node: Node = { id: name, kind: "decoded", blob: store.blob(output), size: output.length, metadata: { codeNode: code.id, inputNode: input.id }, stages: { decoding: "validated", discovery: "candidate" }, evidence: [witness] };
  m.nodes.push(node); m.edges.push({ from: input.id, to: name, kind: "transformation" });
  artifact(store, m, node, "decoding", output, "byte-xor-v1", { key: relation.key, address: request.transformAddress, codeNode: code.id, inputNode: input.id, count: input.size }, "bin", [input.blob, code.blob]);
  run.state.pending.push({ node: name, stage: "probe" });
  run.state.outcome = "running";
  persist(store, run);
}

export async function executeResource(operation: Operation, project: string, request: Request = {}, signal?: AbortSignal, progress?: (info: Record<string, unknown>) => void): Promise<Record<string, unknown>> {
  signal?.throwIfAborted();
  const store = new Store(project);
  if (operation === "campaign" && request.action === "check" && !request.run && !request.resume) {
    const path = store.path("runs");
    const runs = existsSync(path) ? readdirSync(path).filter(name => /^[a-f0-9]{16}-[a-f0-9]{16}$/.test(name)).sort().map(name => {
      const run = loadRun(store, name, false);
      return { run: name, state: run.state.outcome, pending: run.state.pending.length, artifacts: run.manifest.artifacts.length, analyzerCompatible: run.manifest.analyzer === analyzerVersion() };
    }) : [];
    return { runs };
  }
  let run: Run;
  const name = request.resume ?? request.run;
  if (name) run = loadRun(store, name);
  else {
    if (operation !== "campaign" && operation !== "inventory") throw new Error("This operation requires an existing --run <run-id>");
    run = await createRun(store, request, signal);
  }
  return store.lock(run.manifest.runId, async () => {
    // Re-read the committed checkpoint after acquiring the exclusive run lock.
    run = loadRun(store, run.manifest.runId);
    validateInputs(store, run);
    const m = run.manifest, path = runPath(m.runId);
    if (name && (request.input || request.schemas || request.limits)) throw new Error("Resume uses the recorded scope/schema/budgets; start a new run to change those premises");
    progress?.({ run: m.runId, stage: operation, completed: run.state.completed.length, pending: run.state.pending.length });
    let detail: Record<string, unknown> = {};
    if (operation === "campaign" && request.action === "check") detail = { pending: run.state.pending.length, completed: run.state.completed.length };
    else if (operation === "verify") detail = { ...verifyRun(store, run), presented: verifyPresentation(store, m) };
    else if (operation === "document") {
      detail = documentBundle(store, run);
      const selected = request.node ? [nodeOf(m, request.node)] : m.nodes.slice(0, 50);
      detail.facts = { nodes: selected, evidence: m.evidence.filter(e => selected.some(n => n.id === e.subject || n.evidence.includes(e.id))), unresolved: m.unresolved.filter(u => u.subject === "scope" || selected.some(n => n.id === u.subject)), truncated: !request.node && m.nodes.length > 50 };
      if (request.action === "propose") {
        const claims = request.claims ?? [];
        if (claims.length > 128 || canonical(claims).length > 65536) throw new Error("Documentation proposal budget exceeded");
        const known = new Set(m.evidence.map(e => e.id));
        for (const claim of claims) if (!claim.text?.trim() || !Array.isArray(claim.evidence) || !claim.evidence.length || claim.evidence.some(e => !known.has(e))) throw new Error("Every documentation claim must cite existing evidence IDs");
        const proposal = { outcome: "candidate", semanticReview: "required; reference checking is not a proof of prose truth", manifestHash: run.state.manifestHash, claims };
        const target = `${path}/docs/proposal-${hash(canonical(proposal))}.json`;
        store.json(target, proposal); detail.proposal = target;
      }
    } else if (operation === "inventory") detail = { inputs: m.inputs, limits: m.limits };
    else {
      if (operation === "extract" && request.transformNode) await transform(store, run, request, signal);
      const max = integer(request.maxSteps ?? 100000, "maxSteps", 0, 1000000);
      let steps = 0;
      while (steps < max) {
        signal?.throwIfAborted();
        const index = run.state.pending.findIndex(job => (operation === "campaign" || job.stage === operation || (operation === "extract" && job.stage === "schema")) && (!request.node || job.node === request.node));
        if (index < 0) break;
        const job = run.state.pending[index]!;
        progress?.({ run: m.runId, stage: job.stage, node: job.node, completed: run.state.completed.length, pending: run.state.pending.length });
        try {
          if (!(await perform(store, run, job, signal))) { run.state.outcome = "budget-exhausted"; persist(store, run); break; }
        } catch (error) {
          if (!String(error).includes("budget-exhausted:")) throw error;
          unresolved(m, job.node, "budget-exhausted", String(error), "Start a larger-budget run or narrow its selected scope; settled artifacts remain valid");
          run.state.outcome = "budget-exhausted"; persist(store, run); break;
        }
        run.state.pending.splice(index, 1);
        run.state.completed.push(id("job", job));
        steps++;
        persist(store, run);
      }
      const budgetFinding = m.unresolved.some(u => u.outcome === "budget-exhausted");
      run.state.outcome = run.state.pending.length || budgetFinding ? "budget-exhausted" : "supported-fixed-point";
      persist(store, run);
      detail = { steps, completed: run.state.completed.length, pending: run.state.pending.length };
      if (operation === "campaign") detail.documentation = documentBundle(store, run);
      if (request.node) {
        detail.node = nodeOf(m, request.node);
        for (const suffix of ["probe", "static"]) {
          const target = `${path}/analysis/${request.node}-${suffix}.json`;
          if (existsSync(store.path(target))) detail[suffix] = store.read(target);
        }
      }
    }
    if (operation === "extract" || (operation === "campaign" && request.action !== "check")) {
      const checked = verifyRun(store, run);
      detail.presented = await presentAssets(store, m, checked.manifestHash, signal);
    }
    signal?.throwIfAborted();
    const fullReport = `${path}/logs/${operation}-${randomBytes(8).toString("hex")}.json`;
    const result = { run: m.runId, state: run.state.outcome, manifest: `${path}/manifest.json`, fullReport, observedInputs: m.inputs.length, resourceNodes: m.nodes.filter(n => n.kind !== "input").length, artifacts: m.artifacts.length, unresolved: m.unresolved.length, ...detail };
    store.json(fullReport, { request, result });
    return result;
  });
}
