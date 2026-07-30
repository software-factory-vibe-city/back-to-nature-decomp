import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { ROOT } from "../decompToolchain.js";

/**
 * Discovery and source-level binding of SAT scheduler-constraint witnesses.
 * Witness artifacts under build/schedulerConstraint/<function>/ are generated
 * evidence, never operator input: rule 4.7 activates only when a SAT witness
 * names a phantom copy requirement that binds to a concrete source identity
 * through a machine-derived channel. Unbindable phantoms are recorded with
 * exact refusal reasons and never guessed at.
 */

export const MAX_WITNESS_PHANTOMS = 3;

export interface WitnessPhantomBinding {
  templateId: string;
  producerUid: number;
  producerPseudo: number;
  readRegister?: string;
  /** Final machine instruction of the producer node in the witness model. */
  producerLabel?: string;
  /**
   * Bound channel: the producer is the ABI entry copy of argument register
   * a<index>, so the copy reads parameter <index> of the function.
   */
  abiParameterIndex?: number;
  /** Set instead of a binding when no supported channel applies. */
  refusal?: string;
  evidence: string[];
}

export interface DiscoveredWitness {
  runId: string;
  directory: string;
  phantoms: WitnessPhantomBinding[];
  sourceRequirements: number;
  caveats: string[];
}

interface WitnessModelNode {
  uid?: number;
  pseudo?: number;
  label?: string;
  machineClass?: string;
  evidence?: string[];
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

/**
 * Bind one phantom to a source identity. The only channel in grammar schema 4
 * is the ABI entry copy: the producer node's final machine instruction is
 * `move <reg>,a<n>` and its model evidence names the ABI entry copy, so the
 * phantom reads the incoming value of parameter n.
 */
function bindPhantom(phantom: Record<string, unknown>, nodes: WitnessModelNode[]): WitnessPhantomBinding {
  const binding: WitnessPhantomBinding = {
    templateId: String(phantom.templateId ?? "unnamed-phantom"),
    producerUid: Number(phantom.producerUid),
    producerPseudo: Number(phantom.producerPseudo),
    evidence: [],
  };
  if (phantom.readRegister !== undefined) binding.readRegister = String(phantom.readRegister);
  const producer = nodes.find((node) => node.uid === binding.producerUid);
  if (!producer) {
    binding.refusal = `witness model has no node for producer UID ${binding.producerUid}`;
    return binding;
  }
  if (producer.label !== undefined) binding.producerLabel = producer.label;
  if (producer.pseudo !== undefined && producer.pseudo !== binding.producerPseudo) {
    binding.refusal = `witness model node for UID ${binding.producerUid} sets pseudo ${producer.pseudo}, not the phantom's pseudo ${binding.producerPseudo}`;
    return binding;
  }
  const abiMove = (producer.label ?? "").match(/^move\s+\$?\w+,\s*\$?a([0-3])$/);
  const abiEvidence = (producer.evidence ?? []).some((line) => /ABI entry copy/.test(line));
  if (!abiMove || !abiEvidence) {
    binding.refusal = `no supported binding channel: producer "${producer.label ?? "?"}" is not a machine-evidenced ABI argument-register entry copy`;
    return binding;
  }
  binding.abiParameterIndex = Number(abiMove[1]);
  binding.evidence.push(
    `Producer UID ${binding.producerUid} is the ABI entry copy "${producer.label}" of argument register a${binding.abiParameterIndex}.`,
    `The witness model attributes pseudo ${binding.producerPseudo} to that entry copy.`,
  );
  return binding;
}

/**
 * Discover the SAT scheduler-constraint witness for a function, or undefined
 * when none exists. When several SAT runs with phantom requirements exist the
 * lexicographically last run id is used and the others are named in a caveat.
 */
export function discoverWitness(functionName: string, rootOverride?: string): DiscoveredWitness | undefined {
  const base = rootOverride ?? join(ROOT, "build/schedulerConstraint", functionName);
  if (!existsSync(base)) return undefined;
  const satRuns: string[] = [];
  for (const entry of readdirSync(base, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifestPath = join(base, entry.name, "manifest.json");
    const witnessPath = join(base, entry.name, "witness.json");
    if (!existsSync(manifestPath) || !existsSync(witnessPath)) continue;
    try {
      const manifest = readJson(manifestPath) as { status?: string; function?: string };
      if (manifest.status !== "sat") continue;
      if (manifest.function !== undefined && manifest.function !== functionName) continue;
      const witness = readJson(witnessPath) as { phantoms?: unknown[] };
      if (!Array.isArray(witness.phantoms) || witness.phantoms.length === 0) continue;
      satRuns.push(entry.name);
    } catch {
      continue;
    }
  }
  if (satRuns.length === 0) return undefined;
  satRuns.sort();
  const runId = satRuns[satRuns.length - 1]!;
  const directory = join(base, runId);
  const reportedDirectory = directory.startsWith(ROOT) ? relative(ROOT, directory) : directory;
  const caveats: string[] = [];
  if (satRuns.length > 1) {
    caveats.push(`Multiple SAT witnesses exist (${satRuns.join(", ")}); rule 4.7 uses ${runId}.`);
  }

  let phantomsRaw: Array<Record<string, unknown>>;
  let sourceRequirements = 0;
  let nodes: WitnessModelNode[] = [];
  try {
    const witness = readJson(join(directory, "witness.json")) as {
      phantoms?: Array<Record<string, unknown>>;
      sourceRequirements?: unknown[];
    };
    phantomsRaw = witness.phantoms ?? [];
    sourceRequirements = Array.isArray(witness.sourceRequirements) ? witness.sourceRequirements.length : 0;
    const input = readJson(join(directory, "input.json")) as { model?: { nodes?: WitnessModelNode[] } };
    nodes = input.model?.nodes ?? [];
  } catch (error) {
    caveats.push(`Witness ${runId} could not be parsed (${error instanceof Error ? error.message : error}); rule 4.7 stays suppressed.`);
    return { runId, directory: reportedDirectory, phantoms: [], sourceRequirements: 0, caveats };
  }

  if (phantomsRaw.length > MAX_WITNESS_PHANTOMS) {
    caveats.push(`Witness names ${phantomsRaw.length} phantoms; only the first ${MAX_WITNESS_PHANTOMS} are considered (grammar bound).`);
    phantomsRaw = phantomsRaw.slice(0, MAX_WITNESS_PHANTOMS);
  }
  const phantoms = phantomsRaw.map((phantom) => bindPhantom(phantom, nodes));
  return { runId, directory: reportedDirectory, phantoms, sourceRequirements, caveats };
}
