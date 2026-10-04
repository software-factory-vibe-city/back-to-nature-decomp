import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import type { Operation, Request } from "../../../../tools/agent/resource-extraction/types.ts";

const limits = Type.Object(Object.fromEntries(["maxFiles", "maxInputBytes", "maxFileBytes", "maxAssets", "maxOutputBytes", "maxFunctions", "maxInstructions"].map(key => [key, Type.Optional(Type.Integer({ minimum: 1 }))])), { additionalProperties: false });
const field = Type.Object({ offset: Type.Integer({ minimum: 0 }), width: Type.Integer({ minimum: 1, maximum: 4 }), endian: StringEnum(["le", "be"] as const), scale: Type.Integer({ minimum: 1 }), signed: Type.Boolean() }, { additionalProperties: false });
const schema = Type.Object({ index: Type.String(), data: Type.String(), tableOffset: Type.Integer({ minimum: 0 }), count: Type.Integer({ minimum: 0, maximum: 1000000 }), stride: Type.Integer({ minimum: 1, maximum: 65536 }), base: Type.Integer({ minimum: 0 }), position: field, length: field, basis: StringEnum(["supplied-hypothesis"] as const) }, { additionalProperties: false });
export const TOOL_SPECS = [
  { operation: "extract", script: "resourceExtract.ts", name: "psx_resource_extract", description: "Run the deterministic extractor: flat content-deduplicated exports, checked caches and generated provenance. No model, iteration, run ID or commit.", parameters: Type.Object({ input: Type.Optional(Type.String()), limits: Type.Optional(limits), schemas: Type.Optional(Type.Array(schema, { maxItems: 128 })), transforms: Type.Optional(Type.Array(Type.Object({ input: Type.String(), code: Type.String(), address: Type.Integer({ minimum: 0, maximum: 4294967295 }), kind: StringEnum(["byte-xor"] as const) }, { additionalProperties: false }), { maxItems: 128 })), force: Type.Optional(Type.Boolean()), fullVerify: Type.Optional(Type.Boolean()) }, { additionalProperties: false }) },
  { operation: "verify", script: "resourceVerify.ts", name: "psx_resource_verify", description: "Read-only full replay of the current manifest, exports and generated document. Decode once per variant; report drift/corruption without repair.", parameters: Type.Object({}, { additionalProperties: false }) },
  { operation: "analyze", script: "resourceAnalyze.ts", name: "psx_resource_analyze", description: "Inspect one original file under extracted/: bounded hex view and original-word CFG/SSA evidence. No compiler, matched source or guessed format meaning.", parameters: Type.Object({ input: Type.String(), offset: Type.Optional(Type.Integer({ minimum: 0 })), length: Type.Optional(Type.Integer({ minimum: 0, maximum: 4096 })), limits: Type.Optional(limits) }, { additionalProperties: false }) },
  { operation: "parser", script: "resourceParser.ts", name: "psx_resource_parser", description: "Prepare a parser-only baseline or policy/typecheck/test a capability. Fixed argv, source-drift checks, no Git operations or automatic restoration/commits.", parameters: Type.Object({ action: StringEnum(["prepare", "test", "accept"] as const), baseline: Type.Optional(Type.String({ pattern: "^[a-f0-9]{24}$" })) }, { additionalProperties: false }) },
] as const;
export interface RoleBinding { baseline: string; controller: AbortController; calls: number; finish?: boolean }
export function bindRequest(binding: RoleBinding | undefined, operation: Operation, request: Request): Request {
  if (!binding) return request;
  binding.controller.signal.throwIfAborted();
  if (++binding.calls > 64) { binding.controller.abort(new Error("Parser work-item tool budget reached")); throw new Error("Parser work-item tool budget reached"); }
  if (!["parser", "analyze", "extract"].includes(operation)) throw new Error("Parser work item uses only original-byte analysis, parser tests and deterministic integration extraction");
  if (operation === "parser") {
    if (request.action === "prepare") throw new Error("Controller owns parser baseline preparation");
    if (request.baseline && request.baseline !== binding.baseline) throw new Error("Wrong parser baseline");
    return { ...request, baseline: binding.baseline };
  }
  return request;
}
