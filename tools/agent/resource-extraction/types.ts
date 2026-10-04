/** Extraction stages and analysis outcomes are deliberately independent. */
export type Outcome = "validated" | "candidate" | "ambiguous" | "unsupported" | "context-unresolved" | "domain-exhausted" | "budget-exhausted" | "input-drift";
export type Stage = "discovery" | "extraction" | "decoding" | "interpretation" | "export";
export interface Limits {
  maxFiles: number; maxInputBytes: number; maxFileBytes: number;
  maxAssets: number; maxOutputBytes: number; maxFunctions: number; maxInstructions: number;
}
export const DEFAULT_LIMITS: Limits = {
  maxFiles: 4096, maxInputBytes: 512 * 1024 * 1024, maxFileBytes: 256 * 1024 * 1024,
  maxAssets: 2000, maxOutputBytes: 256 * 1024 * 1024, maxFunctions: 128, maxInstructions: 4096,
};
export interface Input { id: string; path: string; hash: string; size: number; blob: string }
export interface Evidence {
  id: string; subject: string; outcome: Outcome; producer: string; detail: string;
  addresses?: number[];
}
export interface Node {
  id: string; kind: "input" | "member" | "resource" | "decoded"; blob: string; size: number;
  source?: { node: string; offset: number; length: number; coordinate: "file-byte" | "member-byte" };
  format?: string; metadata: Record<string, unknown>;
  stages: Partial<Record<Stage, Outcome>>; evidence: string[];
}
export interface Artifact {
  id: string; node: string; stage: Stage; hash: string; size: number; path: string;
  processor: string; parameters: Record<string, unknown>; parents: string[]; evidence: string[];
}
export interface Job { node: string; stage: "probe" | "analyze" | "extract" | "schema"; schema?: number }
export interface Manifest {
  version: 1; runId: string; identity: string; analyzer: string; selection: string;
  limits: Limits; inputs: Input[]; nodes: Node[]; artifacts: Artifact[]; evidence: Evidence[];
  edges: Array<{ from: string; to: string; kind: "containment" | "transformation" | "alias" }>;
  unresolved: Array<{ subject: string; outcome: Outcome; reason: string; reopen: string }>;
  /** Imported schemas are assumptions, not automatically recovered facts. */
  schemas: ArchiveSchema[];
}
export interface State {
  version: 1; manifestHash: string; pending: Job[]; completed: string[];
  outcome: "running" | "supported-fixed-point" | "budget-exhausted";
}
export interface Field { offset: number; width: 1 | 2 | 4; endian: "le" | "be"; scale: number; signed: boolean }
export interface ArchiveSchema {
  index: string; data: string; tableOffset: number; count: number; stride: number;
  base: number; position: Field; length: Field;
  basis: "supplied-hypothesis";
}
export interface Match { format: string; parser: string; offset: number; length: number; metadata: Record<string, unknown> }
export interface Request {
  input?: string; run?: string; resume?: string; maxSteps?: number; limits?: Partial<Limits>;
  schemas?: ArchiveSchema[]; node?: string; transformNode?: string; transformAddress?: number;
  action?: "bundle" | "check" | "propose" | "next" | "asset" | "prepare" | "test" | "accept" | "discard";
  baseline?: string; commit?: boolean;
  claims?: Array<{ text: string; evidence: string[] }>;
}
export const TOOL_SCRIPTS = [
  ["campaign", "resourceCampaign.ts"], ["inventory", "resourceInventory.ts"],
  ["probe", "resourceProbe.ts"], ["analyze", "resourceAnalyze.ts"],
  ["extract", "resourceExtract.ts"], ["verify", "resourceVerify.ts"],
  ["document", "resourceDocument.ts"], ["iteration", "resourceIteration.ts"], ["parser", "resourceParser.ts"],
] as const;
export type Operation = typeof TOOL_SCRIPTS[number][0];
