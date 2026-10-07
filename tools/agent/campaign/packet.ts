import type { CommandRecord } from "../../lib/recordedCommand.js";
import type { DeclarationIndex, Declaration } from "../declarationContext.js";
import type { detectFunctionMacroIdentity } from "../../diagnostics/macroIdentity.js";

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
  performance?: { phases: import("../../lib/contentCache.js").PhaseTiming[]; totalMs: number; cache: "hit" | "miss"; reason: string };
  diagnosticsIdentity?: string;
  identity: {
    functionName: string; container: string; destination: string; assembly: string; data: string[];
    inputs: Record<string, string>; fingerprint: string; tools: unknown; flags: string[];
    memberships?: Record<string, string[]>;
  };
  primary: PacketSource | null;
  context: { index: DeclarationIndex; projection: string; excluded: string[]; unknown: string[]; headers: string[] };
  generation: { status: "not-attempted" | "generated" | "failed" | "unsupported"; raw?: string; rawHash?: string; draftHash?: string; command?: CommandRecord };
  compilation: { status: "not-attempted" | "failed" | "succeeded"; commands: CommandRecord[];
    preprocessed?: { path: string; sha256: string }; assembly?: { path: string; sha256: string }; object?: { path: string; sha256: string }; diagnostics: string };
  comparison: { status: "not-available" | "mismatching" | "exact" | "undetermined"; report?: string; residual?: unknown; reason?: string };
  integration: { state: "staged" | "live"; changes: string[]; blockers: string[]; destinationHash: string; stagedHash?: string };
  discovery: { unknowns: UnknownFact[]; report: unknown; priorExperiments: string[]; preflight: CommandRecord[];
    macroIdentity?: ReturnType<typeof detectFunctionMacroIdentity>;
    readBeforeDefinition?: { findings: Array<{ guidance?: string; register: string; vram: string }>; staticChain: import("../../diagnostics/nestedFunctionScan.js").ChainRow | null; censusComplete: boolean | null };
    staticChain?: import("../staticChainInjection.js").ChainInjection;
    propagation?: { graph: string; report: string; input: string; graphComplete: boolean; convergence: string; visited: number; facts: number; steps: number } };
  finalization: { status: "not-attempted" | "failed" | "passed"; gate?: string; verifiedIdentity?: string; changedFiles?: string[] };
}

const MACRO_CALL_POLICY = "Policy exception for this function: you may call the detected header macros (including reported compatible alternatives), even when they expand to assembly. This permits macro calls only, not handwritten assembly, register pinning, new stubs or allowlist changes. Candidate calls remain oracle-unverified; resolve operands and header vintage, then verify the complete function.";

function macroOpening(packet: PreparationPacket): string {
  const report = packet.discovery.macroIdentity?.function;
  if (!report) return "Header asm-macro detection unavailable; no macro policy exception.";
  if (!report.tiling.length) return `Header asm-macro detection: no template matches (${report.cop2.count} COP2 instructions); no macro policy exception.`;
  const names = [...new Set(report.tiling.flatMap(t => [t.macro, ...t.alternatives.map(a => a.macro)]))];
  return `Detected header asm macros: ${names.slice(0, 8).join(", ")}${names.length > 8 ? `; ${names.length - 8} more in evidence.md` : ""}.\n${MACRO_CALL_POLICY}\nSee evidence.md for matched sites, headers, operands, alternatives and production encodings; unmatched regions are not exempt.`;
}

function chainOpening(packet: PreparationPacket): string {
  const row = packet.discovery.readBeforeDefinition?.staticChain;
  if (!row) return "Static-chain census: no applicable paired caller/entry-$2 row (other register findings retained in evidence.md).";
  return `Static-chain census ${row.id}: ${row.verdict}; ${row.callee?.form ?? "caller"}. ${row.callee?.guidance ?? 'Use block-local auto prototype + asm symbol label for census-paired calls only.'}\n` +
    (packet.discovery.staticChain ? `Prep injection: ${packet.discovery.staticChain.status}; ${packet.discovery.staticChain.changed ? "build/ candidate edited; claims need the relocated-byte gate" : "no edit"}.` : "Existing live attempt preserved; no injection.") +
    " See evidence.md for addresses, provenance and unresolved scaffold requirements.";
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
    macroOpening(packet),
    chainOpening(packet),
    ...(packet.discovery.propagation ? [`Type propagation: ${packet.discovery.propagation.convergence}, ${packet.discovery.propagation.visited} original functions; graph ${packet.discovery.propagation.graphComplete ? "closed" : "coverage incomplete"}. Constraints/provenance: ${packet.discovery.propagation.report}; actual m2c input: ${packet.discovery.propagation.input}.`] : []),
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
    ...(packet.discovery.propagation ? [`Graph: ${packet.discovery.propagation.graph}\nPropagation: ${packet.discovery.propagation.report}\nPartial m2c inputs: ${packet.discovery.propagation.input}\nConvergence and graph completeness are separate: ${packet.discovery.propagation.convergence}, complete=${packet.discovery.propagation.graphComplete}.`] : []),
    `## Static-chain detection/injection\n${chainOpening(packet)}`,
    ...(packet.discovery.readBeforeDefinition?.findings.map(f => `- Hard $${f.register} @ ${f.vram}: ${f.guidance ?? "see scanner streams"}`) ?? []),
    ...(packet.discovery.staticChain?.claims.map(c => `- Oracle claim: ${c.kind} @ 0x${c.address.toString(16)}; ${JSON.stringify(c)}`) ?? []),
    ...(packet.discovery.staticChain?.findings.map(f => `- ${f}`) ?? []),
    `## Detected header macros\n${macroOpening(packet)}`,
    ...(packet.discovery.macroIdentity?.function.tiling.flatMap(t => [
      `### 0x${t.start.toString(16)}–0x${t.end.toString(16)}: ${t.macro}\nHeader: ${t.header}:${t.line} (${t.vintage}; sha256 ${t.headerSha256})\nOracle-unverified call: \`${t.candidateC}\``,
      ...t.operands.map(o => `- Operand ${o.parameter}: ${o.machine} → ${o.expression ?? "unresolved"} (${o.resolution})`),
      ...t.alternatives.map(a => `- Also compatible: \`${a.candidateC}\` from ${a.header}:${a.line} (${a.vintage}; sha256 ${a.headerSha256})`),
      ...t.encodingEvidence.map(e => `- Required production encoding: ${e.assemblerStatement} from ${e.header}:${e.line}; probe ${e.probeObject}. Do not use the raw SDK .word placeholder.`),
    ]) ?? []),
    ...(packet.discovery.macroIdentity?.encodingToolchains.map(e => `Production encoding probe (${e.containerKind}): ${e.probeObject}\nVintage substitution headers: ${e.reconstructionHeaders.map(h => `${h.vintage}: ${h.path}`).join("; ") || "none"}`) ?? []),
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
