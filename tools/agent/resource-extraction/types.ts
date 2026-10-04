/** Structural compatibility, preservation, decoding and interpretation are distinct. */
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
  extension: string;
}
export interface Field { offset: number; width: 1 | 2 | 4; endian: "le" | "be"; scale: number; signed: boolean }
export interface ArchiveSchema {
  index: string; data: string; tableOffset: number; count: number; stride: number;
  base: number; position: Field; length: Field; basis: "supplied-hypothesis";
}
export interface ByteTransform { input: string; code: string; address: number; kind: "byte-xor" }
export interface ParserFingerprint {
  id: string; format: string; version: number; hash: string;
  files: Array<{ path: string; hash: string }>; specifications: string[];
}
export const PUBLIC_CATEGORIES = ["images", "sounds", "models", "videos", "data"] as const;
export type PublicCategory = typeof PUBLIC_CATEGORIES[number];
export interface PublishedFile { path: string; backing: string; hash: string; size: number; artifact: string }
export interface PublishedAsset {
  id: string; format: string; category: PublicCategory; raw: string;
  occurrences: string[]; files: PublishedFile[];
}
/** No execution history, clocks, cache hits, random IDs or Git state. */
export interface Manifest {
  version: 2; selection: string; limits: Limits; schemas: ArchiveSchema[]; transforms: ByteTransform[];
  execution: { node: string; v8: string; endian: string }; engine: Array<{ path: string; hash: string }>; parsers: ParserFingerprint[];
  inputs: Input[]; nodes: Node[]; artifacts: Artifact[]; evidence: Evidence[]; assets: PublishedAsset[];
  edges: Array<{ from: string; to: string; kind: "containment" | "transformation" | "alias" }>;
  unresolved: Array<{ subject: string; outcome: Outcome; reason: string; reopen: string }>;
}
export interface Match { format: string; parser: string; offset: number; length: number; metadata: Record<string, unknown>; discovery: "validated" | "candidate" }
export interface Request {
  input?: string; limits?: Partial<Limits>; schemas?: ArchiveSchema[]; transforms?: ByteTransform[];
  force?: boolean; fullVerify?: boolean; migrateLegacy?: boolean;
  action?: "prepare" | "test" | "accept"; baseline?: string;
  offset?: number; length?: number;
}
export const TOOL_SCRIPTS = [
  ["extract", "resourceExtract.ts"], ["verify", "resourceVerify.ts"],
  ["analyze", "resourceAnalyze.ts"], ["parser", "resourceParser.ts"],
] as const;
export type Operation = typeof TOOL_SCRIPTS[number][0];
