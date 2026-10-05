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
  const directory = packetPath.replace(/\/packet\.json$/, "");
  const links = `Context (selected declarations and dependencies): ${packet.context.projection}.\nEvidence and unresolved contracts: ${directory}/evidence.md.\nFull diagnostics: ${directory}/diagnostics.txt.\nOriginal assembly: ${packet.identity.assembly}.`;
  /* Whole small sections only: large drafts/reports are linked, never a clipped
     source fragment or a catalogue dump. The machine manifest stays internal. */
  const sections = [
    `Prepared ${packet.identity.functionName} (${packet.identity.container}). Handoff: ${directory}/handoff.md.\nRead the measured source and selected context first; packet.json is an internal freshness record, not a startup reading task.`,
    `Measured source: ${source?.path ?? "none — generation failed"}. Live destination: ${packet.identity.destination} (${packet.integration.state}).`,
    `Generation: ${packet.generation.status}; compilation: ${packet.compilation.status}; comparison: ${packet.comparison.status}; finalization: ${packet.finalization.status}.`,
    links,
    ...(packet.comparison.report ? [`Relocated-byte report: ${packet.comparison.report}. Compilation, exactness and finalization are separate claims.`] : []),
    `Blockers: ${packet.integration.blockers.length}; unresolved facts: ${packet.discovery.unknowns.filter((u) => u.strength !== "witnessed").length}. See evidence.md for constraints, examined inputs and next evidence paths.`,
    ...packet.discovery.unknowns.filter((u) => u.strength !== "witnessed" && /contract|signature|conflict/.test(u.missing)).slice(0, 4)
      .map((u) => `${u.subject}: ${Buffer.byteLength(u.missing) <= 350 ? u.missing : "see evidence.md"}.`),
    ...(packet.compilation.status === "failed" ? [`Compile errors:\n${packet.compilation.diagnostics.split("\n").filter((line) => /error|undeclared|parse|no member|incomplete|conflict/i.test(line)).slice(0, 6).join("\n") || "See diagnostics.txt."}`] : []),
    "Use fresh handoff evidence for equivalent startup checks. Preserve an existing attempt; reconstruction/family transfer are available when useful.",
    packet.integration.state === "staged" ? "Edit the measured draft under build/ first; integrate into the identified destination only after it compiles and passes source/scope checks. The live stub has not been overwritten." : "Continue from the measured live source.",
    ...(source && Buffer.byteLength(source.text) <= 2000 ? [`\n\`\`\`c\n${source.text.trimEnd()}\n\`\`\``] : []),
  ];
  const kept: string[] = [];
  for (const section of sections) {
    if (Buffer.byteLength([...kept, section].join("\n\n")) < 7500) kept.push(section);
  }
  return kept.join("\n\n");
}

export function packetEvidence(packet: PreparationPacket): string {
  return [
    `# Evidence for ${packet.identity.functionName}`,
    `Selected context: ${packet.context.projection}\nOriginal assembly: ${packet.identity.assembly}\nOriginal data: ${packet.identity.data.join(", ") || "none"}`,
    ...packet.integration.blockers.map((b) => `- Blocker: ${b}`),
    ...packet.discovery.unknowns.map((u) => [
      `## ${u.subject} (${u.strength})`, u.missing,
      `Constraints: ${u.constraints.join("; ") || "none established"}`,
      `Examined: ${u.evidence.join("; ") || "no evidence available"}`,
      `Attempt: ${u.attempted}; bound: ${u.bound}; stopped: ${u.stoppedBecause}`,
      `Inspect next: ${u.inspectNext.join("; ") || "no additional input identified"}`,
    ].join("\n")),
    ...packet.primary?.declarationsRequired.map((d) => `## Required declaration (${d.origin})\n\`\`\`c\n${d.text}\n\`\`\``) ?? [],
    `Preflight streams: ${packet.discovery.preflight.map((c) => `${c.stdout}, ${c.stderr}`).join("; ")}`,
    `Prior experiments: ${packet.discovery.priorExperiments.join("; ") || "none recorded"}`,
  ].join("\n\n");
}
