import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { executeResource, loadRun } from "./pipeline.ts";
import { analyzerVersion, canonical, integer, safePath, Store } from "./storage.ts";
import { changedFiles, commitScoped, git } from "./git.ts";
import type { Manifest, Node, Request } from "./types.ts";

export const ASSET_NOTES = "notes/asset-identification.md";
function identified(root: string): Set<string> {
  // Only a committed note counts as an accepted iteration. A rejected commit
  // can leave a useful working-tree draft, but must not hide the next asset.
  const tracked = git(root, ["ls-tree", "--name-only", "HEAD", "--", ASSET_NOTES]);
  const text = tracked ? git(root, ["show", `HEAD:${ASSET_NOTES}`]) : "";
  return new Set([...text.matchAll(/<!-- resource-asset:([a-z0-9-]+) -->/g)].map(m => m[1]!));
}
function nextAsset(m: Manifest, known: Set<string>): Node | undefined {
  return m.nodes.find(n => n.kind === "resource" && typeof n.metadata.parserId === "string" && n.stages.discovery === "validated" && !known.has(n.id));
}
function origin(m: Manifest, node: Node): Array<Record<string, unknown>> {
  const result: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();
  let current = node;
  while (!seen.has(current.id)) {
    seen.add(current.id);
    const transform = m.artifacts.find(a => a.node === current.id && a.processor === "byte-xor-v1");
    result.push({ node: current.id, blob: current.blob, size: current.size, ...(current.source ? { source: current.source } : {}),
      ...(transform ? { transformation: { processor: transform.processor, parameters: transform.parameters, codeOrigin: origin(m, m.nodes.find(n => n.id === transform.parameters.codeNode)!) } } : {}),
      ...(current.kind === "input" ? { input: m.inputs.find(i => i.id === current.id) } : {}) });
    const parent = current.source?.node ?? transform?.parameters.inputNode;
    if (!parent) break;
    current = m.nodes.find(n => n.id === parent)!;
  }
  return result;
}
export async function iterationOperation(root: string, request: Request, signal?: AbortSignal): Promise<Record<string, unknown>> {
  const store = new Store(root);
  if (request.action === "asset") {
    if (!request.run || !request.node) throw new Error("Asset iteration requires run and node");
    return store.lock("asset-identification", async () => {
      if (identified(root).has(request.node!)) return { outcome: "already-identified", node: request.node };
      if (changedFiles(root).includes(ASSET_NOTES)) throw new Error("Asset-identification notes already dirty; preserve the pre-existing change before committing an iteration");
      await executeResource("extract", root, { run: request.run!, node: request.node! }, signal);
      const checked = await executeResource("verify", root, { run: request.run! }, signal);
      const run = loadRun(store, request.run!), m = run.manifest;
      const node = nextAsset({ ...m, nodes: m.nodes.filter(n => n.id === request.node) }, new Set());
      if (!node) throw new Error("Only a validated, unambiguous parser resource can finish an asset iteration");
      const knownEvidence = new Set(m.evidence.map(e => e.id));
      for (const claim of request.claims ?? []) if (!claim.evidence.length || claim.evidence.some(e => !knownEvidence.has(e))) throw new Error("Asset prose must reference known evidence");
      const path = safePath(root, ASSET_NOTES);
      const previous = existsSync(path) ? readFileSync(path, "utf8") : null;
      const schemaPath = `loop/reproduction/${node.id}-schemas.json`;
      if (m.schemas.length) store.json(schemaPath, m.schemas);
      const quote = (text: string): string => `'${text.replaceAll("'", "'\"'\"'")}'`;
      const transforms = origin(m, node).filter(entry => entry.transformation).map(entry => {
        const operation = entry.transformation as { parameters: { inputNode: string; codeNode: string; address: number } };
        return `npx tsx tools/agent/resourceExtract.ts --run RUN --node ${operation.parameters.inputNode} --transform-node ${operation.parameters.codeNode} --transform-address ${operation.parameters.address}`;
      }).reverse();
      const section = `\n<!-- resource-asset:${node.id} -->\n## ${node.id} — ${node.format}\n\n- Parser: ${node.metadata.parserId} v${node.metadata.parserVersion}.\n- Raw SHA-256: ${node.blob.slice(6)}; ${node.size} bytes.\n- Verified manifest: ${checked.manifestHash}.\n- Stages: ${canonical(node.stages)}.\n- Evidence: ${node.evidence.join(", ")}. Structural compatibility is not historical naming evidence.\n\n### Source and extraction\n\n\`\`\`json\n${JSON.stringify(origin(m, node), null, 2)}\n\`\`\`\n\nRecreate a run from the original scope, using the registered parser:\n\n\`\`\`sh\nnpx tsx tools/agent/resourceCampaign.ts --input ${quote(m.selection)} --limits ${quote(canonical(m.limits))}${m.schemas.length ? ` --schemas build/assets/${schemaPath}` : ""}\n${transforms.length ? transforms.join("\n") + "\nnpx tsx tools/agent/resourceCampaign.ts --resume RUN\n" : ""}\n\`\`\`\n\nThe documented resource ID and source hashes identify the result independently\nof a generated run directory. Replace RUN with the new campaign's run ID.\nRequired schemas (if nonempty, save this JSON to the --schemas path above):\n\n\`\`\`json\n${JSON.stringify(m.schemas, null, 2)}\n\`\`\`\n\nFor transformed views, the commands and code-origin hashes above reproduce the\nrecorded parameters. Input association is conditional, not an inferred game call.\n\nGenerated artifacts (not committed):\n${m.artifacts.filter(a => a.node === node.id).map(a => `- \`build/assets/${a.path}\`: ${a.processor}, ${canonical(a.parameters)}, SHA-256 ${a.hash}`).join("\n")}\n\n### Qualified observations\n\n${(request.claims ?? []).map(c => `- Candidate interpretation: ${c.text.replaceAll("<", "&lt;").replaceAll(">", "&gt;")} [${c.evidence.join(", ")}]`).join("\n") || "Semantic name and consumer association remain unknown."}\n`;
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, (previous ?? "# Asset identification\n\nEntries are committed only after extraction/replay verification. Generated assets\nremain under `build/assets/`. Total game asset count is unknown.\n") + section);
      if (!request.commit) return { outcome: "documented-uncommitted", node: node.id, notes: ASSET_NOTES, manifestHash: checked.manifestHash };
      signal?.throwIfAborted();
      try {
        const commit = commitScoped(root, [ASSET_NOTES], `Identify ${node.format} asset ${node.id}`);
        store.json(`loop/asset-commits/${node.id}.json`, { node: node.id, run: request.run, manifestHash: checked.manifestHash, commit });
        return { outcome: "asset-committed", node: node.id, notes: ASSET_NOTES, commit };
      } catch (error) {
        // Keep the verified note for inspection if Git rejects the commit. Never
        // erase unrelated dirt, stage generated assets, or pretend it succeeded.
        throw error;
      }
    });
  }
  if (request.action !== "next") throw new Error("Iteration action must be next or asset");
  let runId = request.run ?? request.resume;
  if (runId) {
    const old = loadRun(store, runId, false);
    if (old.manifest.analyzer !== analyzerVersion()) {
      const restarted = await executeResource("inventory", root, { input: old.manifest.selection, limits: old.manifest.limits, schemas: old.manifest.schemas }, signal);
      runId = restarted.run as string;
    }
  } else {
    const seeded = await executeResource("inventory", root, request, signal);
    runId = seeded.run as string;
  }
  const known = identified(root);
  const steps = integer(request.maxSteps ?? 16, "iteration scan steps", 1, 1000000);
  for (let i = 0; i <= steps; i++) {
    signal?.throwIfAborted();
    const run = loadRun(store, runId), asset = nextAsset(run.manifest, known);
    if (asset) return { outcome: "asset-work", run: runId, node: asset.id, format: asset.format, evidence: asset.evidence, metadata: asset.metadata };
    if (i === steps && run.state.pending.length) return { outcome: "scan-work", run: runId, pending: run.state.pending.length };
    if (!run.state.pending.length) {
      const candidate = run.manifest.unresolved.find(u => u.subject !== "scope" && u.outcome !== "budget-exhausted");
      return { outcome: candidate ? "parser-work" : "budget-stop", run: runId, candidate: candidate ?? null,
        instruction: "Existing parser closure is not the loop's stopping point: inspect original bytes/loader evidence and build a tested parser capability. Never fabricate one to earn a commit.",
        unresolved: run.manifest.unresolved,
        ...(candidate && run.manifest.nodes.find(n => n.id === candidate.subject) ? { sample: (() => { const node = run.manifest.nodes.find(n => n.id === candidate.subject)!; const bytes = store.bytes(node.blob); return { node: node.id, input: node.metadata.inputPath ?? null, size: bytes.length, blob: node.blob, first256Bytes: bytes.subarray(0, 256).toString("hex") }; })() } : {}) };
    }
    const progress = await executeResource("campaign", root, { resume: runId, maxSteps: 1 }, signal);
    if (progress.steps === 0) return { outcome: "budget-stop", run: runId, reason: "Pending deterministic work cannot progress under the recorded budget" };
  }
  throw new Error("Unreachable iteration state");
}
