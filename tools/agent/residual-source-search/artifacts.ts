import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { ROOT } from "../decompToolchain.js";
import { sha256, sha256File, stableJson, writeStableJson } from "../variant-lab/artifacts.js";
import { C_FRONTEND_IDENTITY } from "./tree-sitter-c.js";
import type { CausalClosure, ResidualDomain, ResidualGrammar, SemanticGraph, BaselineBundle } from "./types.js";

/**
 * Identity of the implementation and of the C front end. The grammar version
 * and its wasm hash belong here for the same reason the compiler build does: a
 * change to either changes what a run means, so it must change the run id.
 */
export function residualImplementationHash(): string {
  const directory = join(ROOT, "tools/agent/residual-source-search");
  const files = [
    join(ROOT, "tools/agent/searchResidualSourceSpace.ts"),
    ...readdirSync(directory)
      .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
      .sort()
      .map((name) => join(directory, name)),
  ];
  const sources = files.map((path) => {
    try {
      return `${relative(ROOT, path)}:${sha256File(path)}`;
    } catch {
      return `${relative(ROOT, path)}:absent`;
    }
  });
  return sha256([...sources, `frontend:${stableJson(C_FRONTEND_IDENTITY)}`].join("\n"));
}

/** Deterministic run id from pre-derivation inputs only, so resume finds the same directory. */
export function computeRunId(options: {
  functionName: string;
  sourceHash: string;
  toolchainHash: string;
  implementationHash: string;
}): string {
  return sha256(stableJson({ schemaVersion: 1, ...options })).slice(0, 16);
}

/** Post-derivation identity guarding checkpoints against grammar/domain drift. */
export function computeIdentityHash(options: {
  runId: string;
  bundleHash: string;
  grammarHash: string;
  domainTotal: string;
}): string {
  return sha256(stableJson({ schemaVersion: 1, ...options }));
}

export function writeDerivationArtifacts(runRoot: string, artifacts: {
  bundle: BaselineBundle;
  graph: SemanticGraph;
  closure: CausalClosure;
  grammar: ResidualGrammar;
  /** Absent when the grammar was already too large to serialize a domain for. */
  domain?: ResidualDomain;
}): { bundleHash: string; grammarHash: string } {
  writeStableJson(join(runRoot, "frontend.json"), C_FRONTEND_IDENTITY);
  writeStableJson(join(runRoot, "baseline.json"), artifacts.bundle);
  writeStableJson(join(runRoot, "semantic-graph.json"), artifacts.graph);
  writeStableJson(join(runRoot, "causal-closure.json"), artifacts.closure);
  writeStableJson(join(runRoot, "grammar.json"), artifacts.grammar);
  if (artifacts.domain) writeStableJson(join(runRoot, "domain.json"), artifacts.domain);
  return {
    bundleHash: sha256(stableJson(artifacts.bundle)),
    grammarHash: sha256(stableJson(artifacts.grammar)),
  };
}
