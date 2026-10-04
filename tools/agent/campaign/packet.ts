import type { CommandRecord } from "../../lib/recordedCommand.js";
import type { DeclarationIndex, Declaration } from "../declarationContext.js";

/** Common handoff core. A draft's existence is independent of its compilability. */
export interface PacketSource {
  origin: "existing-attempt" | "m2c" | "reconstruction";
  path: string;
  sha256: string;
  text: string;
  declarationsRequired: Declaration[];
}
export interface UnknownFact {
  subject: string;
  span?: { path: string; start: number; end: number };
  strength: "witnessed" | "conditional" | "conflict" | "unsupported" | "unknown";
  constraints: string[];
  evidence: string[];
  missing: string;
  attempted: string;
  bound: string;
  stoppedBecause: string;
  inspectNext: string[];
}
export interface PreparationPacket {
  schemaVersion: 1;
  preparationState?: "running" | "complete";
  identity: {
    functionName: string; container: string; destination: string; assembly: string; data: string[];
    inputs: Record<string, string>; fingerprint: string; tools: unknown; flags: string[];
  };
  primary: PacketSource | null;
  context: { index: DeclarationIndex; projection: string; excluded: string[]; unknown: string[]; headers: string[] };
  generation: { status: "not-attempted" | "generated" | "failed" | "unsupported"; raw?: string; rawHash?: string; command?: CommandRecord };
  compilation: { status: "not-attempted" | "failed" | "succeeded"; commands: CommandRecord[];
    preprocessed?: { path: string; sha256: string }; object?: { path: string; sha256: string }; diagnostics: string };
  comparison: { status: "not-available" | "mismatching" | "exact" | "undetermined"; report?: string; residual?: unknown; reason?: string };
  integration: { state: "staged" | "live"; changes: string[]; blockers: string[]; destinationHash: string; stagedHash?: string };
  discovery: { unknowns: UnknownFact[]; report: unknown; priorExperiments: string[]; preflight: CommandRecord[] };
  finalization: { status: "not-attempted" | "failed" | "passed"; gate?: string; verifiedIdentity?: string; changedFiles?: string[] };
}

export function packetOpening(packet: PreparationPacket, packetPath: string): string {
  const source = packet.primary;
  const limit = 12_000;
  const preview = source?.text.slice(0, limit);
  return [
    `Prepared ${packet.identity.functionName} (${packet.identity.container}). Packet: ${packetPath}`,
    `Measured source: ${source?.path ?? "none — generation failed"}. Live destination: ${packet.identity.destination} (${packet.integration.state}).`,
    `Generation: ${packet.generation.status}; compilation: ${packet.compilation.status}; comparison: ${packet.comparison.status}; finalization: ${packet.finalization.status}.`,
    ...(packet.integration.blockers.length ? [`Blockers: ${packet.integration.blockers.join("; ")}`] : []),
    ...(packet.compilation.diagnostics ? [`Diagnostics (bounded preview; complete streams in packet):\n${packet.compilation.diagnostics.slice(0, 3000)}`] : []),
    ...(packet.comparison.residual ? [`Staged residual (complete artifact in packet): ${JSON.stringify(packet.comparison.residual).slice(0, 3000)}`] : []),
    `Unresolved: ${packet.discovery.unknowns.slice(0, 8).map((u) => `${u.subject}: ${u.missing}`).join("; ") || "none reported"}.`,
    "Use fresh packet evidence for equivalent startup checks. Preserve an existing attempt; reconstruction/family transfer are available when useful.",
    packet.integration.state === "staged" ? "Edit the measured draft under build/ first; integrate into the identified destination only after it compiles and passes source/scope checks. The live stub has not been overwritten." : "Continue from the measured live source.",
    ...(preview ? [`\n\`\`\`c\n${preview}\n\`\`\``, ...(source!.text.length > limit ? [`Explicit preview: ${limit} of ${source!.text.length} characters. Read ${source!.path} for the complete draft.`] : [])] : []),
  ].join("\n\n");
}
