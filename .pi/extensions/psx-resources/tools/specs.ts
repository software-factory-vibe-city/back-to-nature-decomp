import { StringEnum } from "@earendil-works/pi-ai";
import { Type, type TObject } from "typebox";
import { TOOL_SCRIPTS, type Operation, type Request } from "../../../../tools/agent/resource-extraction/types.ts";
import { canonical } from "../../../../tools/agent/resource-extraction/storage.ts";

const field = Type.Object({ offset: Type.Integer({ minimum: 0 }), width: Type.Integer({ minimum: 1, maximum: 4 }), endian: StringEnum(["le", "be"] as const), scale: Type.Integer({ minimum: 1 }), signed: Type.Boolean() });
const schema = Type.Object({ index: Type.String(), data: Type.String(), tableOffset: Type.Integer({ minimum: 0 }), count: Type.Integer({ minimum: 0, maximum: 1000000 }), stride: Type.Integer({ minimum: 1, maximum: 65536 }), base: Type.Integer({ minimum: 0 }), position: field, length: field, basis: StringEnum(["supplied-hypothesis"] as const) });
export const PARAMETERS: TObject = Type.Object({
  input: Type.Optional(Type.String({ description: "Selected file/directory under extracted/; new runs only" })),
  run: Type.Optional(Type.String({ pattern: "^[a-f0-9]{16}-[a-f0-9]{16}$" })),
  resume: Type.Optional(Type.String({ pattern: "^[a-f0-9]{16}-[a-f0-9]{16}$" })),
  node: Type.Optional(Type.String({ description: "Resource graph node ID to focus; not a filesystem path" })),
  maxSteps: Type.Optional(Type.Integer({ minimum: 0, maximum: 1000000 })),
  limits: Type.Optional(Type.Object(Object.fromEntries(["maxFiles", "maxInputBytes", "maxFileBytes", "maxAssets", "maxOutputBytes", "maxFunctions", "maxInstructions"].map(key => [key, Type.Optional(Type.Integer({ minimum: 1 }))])))),
  schemas: Type.Optional(Type.Array(schema, { maxItems: 128 })),
  transformNode: Type.Optional(Type.String()),
  transformAddress: Type.Optional(Type.Integer({ minimum: 0, maximum: 4294967295 })),
  action: Type.Optional(StringEnum(["bundle", "check", "propose", "next", "asset", "prepare", "test", "accept", "discard"] as const)),
  baseline: Type.Optional(Type.String({ pattern: "^[a-f0-9]{24}$" })),
  commit: Type.Optional(Type.Boolean({ description: "Explicitly allow the gated iteration commit; never commit generated assets" })),
  claims: Type.Optional(Type.Array(Type.Object({ text: Type.String({ maxLength: 8192 }), evidence: Type.Array(Type.String(), { minItems: 1, maxItems: 128 }) }), { maxItems: 128 })),
}, { additionalProperties: false });
const descriptions: Record<Operation, string> = {
  campaign: "Start/resume the deterministic resource pipeline, or check status. Static discovery only; explicit unsupported outcomes.",
  inventory: "Fingerprint and snapshot selected unpacked files from extracted/, or show a run's frozen inputs.",
  probe: "Run structural TIM validation over byte views. Magic hits without valid lengths/rectangles are rejected.",
  analyze: "Recover bounded original-word entry/direct-call CFG/SSA slices and field observations; unknown operation semantics remain unresolved.",
  extract: "Preserve supplied-schema/parser extents, decode TIM palettes and export PPM/RGBA/STP; optionally evaluate a checked byte-xor constructor.",
  verify: "Replay raw extents, supported transformations, hashes and provenance; refuse input/analyzer drift.",
  document: "Prepare a verified immutable documentation handoff, or save an evidence-referenced CANDIDATE prose proposal.",
  iteration: "Select the next asset/parser work item, or verify, document and commit one asset to notes/asset-identification.md. Generated assets remain ignored.",
  parser: "Prepare a scoped parser-builder baseline; validate source policy, typecheck/test registered parsers and commit only a tested capability. Fixed test argv, no shell or child agent.",
};
export const TOOL_SPECS = TOOL_SCRIPTS.map(([operation, script]) => ({ operation, script, name: `psx_resource_${operation}`, description: descriptions[operation], parameters: PARAMETERS }));
export interface RoleBinding {
  phase: "extraction" | "documentation" | "parser"; run?: string; request: Request;
  baseline?: string; target?: string;
  controller: AbortController; calls: number;
  seen?: Record<string, number>;
  finish?: { phase: "extraction" | "documentation" | "parser"; state: string; manifestHash?: string; commit?: string };
}
export function bindRequest(binding: RoleBinding | undefined, operation: Operation, request: Request): Request {
  if (!binding) return request;
  binding.controller.signal.throwIfAborted();
  if (++binding.calls > 24) { binding.controller.abort(new Error("TUI role tool-call budget reached")); throw new Error("TUI role tool-call budget reached"); }
  const key = canonical([operation, request]);
  const seen = binding.seen ?? (binding.seen = {});
  seen[key] = (seen[key] ?? 0) + 1;
  if (seen[key] > 2) { binding.controller.abort(new Error("stalled: unchanged bounded request repeated")); throw new Error("stalled: unchanged bounded request repeated; no new experiment"); }
  if (binding.phase === "parser") {
    if (operation !== "parser" && operation !== "analyze" && operation !== "inventory") throw new Error("Parser role uses source tools and the parser test/accept gate");
    if (operation === "parser") {
      if (request.baseline && request.baseline !== binding.baseline) throw new Error("Wrong parser iteration baseline");
      if (request.action === "prepare" || request.action === "discard") throw new Error("The controller owns baseline preparation/restoration");
      return { ...request, baseline: binding.baseline, commit: request.action === "accept" } as Request;
    }
  }
  if (binding.phase === "documentation" && operation !== "document" && operation !== "verify" && operation !== "iteration" && operation !== "extract") throw new Error("Documentation role is restricted to the selected asset's evidence/extraction/commit gate");
  if (binding.phase === "documentation" && operation === "iteration") {
    if (request.action !== "asset" || (request.node && request.node !== binding.target)) throw new Error("Documentation can commit only its selected asset");
    return { ...request, run: binding.run!, node: binding.target!, commit: true };
  }
  const selected = request.resume ?? request.run;
  if (binding.run) {
    if (selected && selected !== binding.run) throw new Error("This TUI role is bound to another run");
    if (request.input || request.schemas || request.limits) throw new Error("Scope/schema/budgets are frozen for this run");
    return { ...request, run: binding.run };
  }
  if (operation !== "campaign" && operation !== "inventory") throw new Error("Start with the deterministic campaign/inventory tool");
  // The user's command, not a model-generated path or budget, defines the run.
  return { ...binding.request };
}
