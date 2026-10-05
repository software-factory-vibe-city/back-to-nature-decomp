/** Finite, evidence-carrying constraints. Machine slots are not C parameters. */
import type { MachineIrReport } from "../machine-ir/index.js";
import type { Prototype } from "../calleeTruth.js";

export const DEFAULT_BOUNDS = { functions: 96, instructions: 65536, indirectTargets: 32,
  storageDependencies: 256, propagationSteps: 200000, indexInstructions: 1000000 };
export type Bounds = typeof DEFAULT_BOUNDS;
export interface Endpoint { function: string; value: number }
export const endpointKey = (e: Endpoint) => `${e.function}:v${e.value}`;
export interface Relation {
  id: string; from: Endpoint; to: Endpoint;
  rule: "argument" | "result" | "copy" | "memory" | "phi-input";
  witness: string; conditional?: string;
}
export interface CallSite {
  id: string; caller: string; at: number; effect: number; kind: "direct" | "indirect" | "tail";
  targets: string[]; closed: boolean; remainder: string[];
  args: Array<number | null>; results: number[]; through?: number; table?: string;
}
export interface Summary {
  id: string; name: string; container: string; report: MachineIrReport;
  slots: Array<{ slot: number; value: number; used: boolean; width?: number; signed?: boolean }>;
  returns: number[]; calls: CallSite[]; seed?: Prototype;
}
export interface EvidenceGraph {
  root: string; bounds: Bounds; nodes: Summary[]; relations: Relation[];
  frontier: Array<{ node: string; reason: string; at?: number }>;
  unsupported: Array<{ node: string; at: number; reason: string }>;
  inputs: string[]; indexComplete: boolean;
  consumed: { functions: number; instructions: number; indexInstructions: number; storageDependencies: number };
}
export type Constraint = { kind: "type-use"; type: string; scope: string; identity?: string } |
  { kind: "address-use"; offset: number; width: number; signed: boolean | null; access: "load" | "store" };
export interface Fact {
  id: string; endpoint: Endpoint; constraint: Constraint; seed: string;
  /** Links to facts, not recursively expanded witness strings (cycles stay finite). */
  via: null | { parent: string; relation: string; direction: "forward" | "reverse" };
  conditional?: string;
}
export interface Propagation {
  status: "fixed-point" | "budget-incomplete"; steps: number; components: string[][];
  facts: Fact[]; conflicts: Array<{ endpoint: string; facts: string[] }>;
  unresolved: Array<{ node: string; slot: number | "return"; outcome: "fixed-point-unresolved" | "unsupported" | "budget/input-incomplete" | "conflict"; reason: string }>;
}
export interface InferenceInput {
  version: 1;
  openTables?: Record<string, string[]>;
  functions: Record<string, { slots: Record<string, { type?: string; pointer?: boolean }>; result?: { type?: string; pointer?: boolean }; openTargetSlots?: number[] }>;
}
