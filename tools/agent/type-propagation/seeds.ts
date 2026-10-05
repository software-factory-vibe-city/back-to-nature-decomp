/** Independent seed admission: SDK, or clean C verified by the relocated oracle.
 * Generated function headers are never read as witnesses. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, compileSource, sourcePathFor, preprocessOnly } from "../decompToolchain.js";
import { compareFunction } from "../../lib/functionOracle.js";
import { requireFunctionLocation } from "../../lib/symbolIndex.js";
import { definitionPrototype, sdkPrototypes, scopeFromPreprocessed, type Prototype } from "../calleeTruth.js";
import { analyzeCSource } from "../cSourceGuard.js";
import { parseC } from "../residual-source-search/tree-sitter-c.js";
import { slotsWithTypedefs, parameterReads, typeScopes } from "./c-types.js";

export interface SeedRecord { name: string; status: "sdk" | "verified" | "withheld" | "rejected" | "absent"; prototype?: Prototype; reason?: string; evidence: string[] }
export function seedOracle(directory: string, withheld: string[] = [], permitted?: string[]): { get: (name: string) => Prototype | undefined; records: SeedRecord[] } {
  const sdk = sdkPrototypes(), records: SeedRecord[] = [], memo = new Map<string, Prototype | undefined>();
  const get = (name: string): Prototype | undefined => {
    if (memo.has(name)) return memo.get(name);
    const record: SeedRecord = { name, status: "absent", evidence: [] }; records.push(record); memo.set(name, undefined);
    if (withheld.includes(name) || (permitted && !permitted.includes(name))) { record.status = "withheld"; record.reason = "isolated inference input view"; return; }
    const prototype = sdk.get(name) ?? definitionPrototype(name);
    if (!prototype) return;
    record.evidence.push(`${prototype.where}:${prototype.line}`);
    if (sdk.has(name)) { record.status = "sdk"; record.prototype = prototype; memo.set(name, prototype); return prototype; }
    try {
      const source = sourcePathFor(name), text = readFileSync(source, "utf8");
      const guard = analyzeCSource(text);
      const syntax = parseC(text);
      const assembly = syntax.rootNode.descendantsOfType("gnu_asm_expression").length;
      syntax.delete();
      if (!guard.parses || guard.includeAsm.length || assembly) throw new Error("not a clean-C seed: AST has a stub, broken syntax or embedded assembly");
      const container = requireFunctionLocation(name).container;
      const artifact = compileSource(source, join(directory, name), name, { assemble: true, containerKind: container.kind });
      record.evidence.push(artifact.object!);
      const verdict = compareFunction(name, { objectPath: artifact.object!, container });
      if (verdict.verdict !== "match") throw new Error(`defining C relocated bytes: ${verdict.verdict}`);
      const processed = preprocessOnly(source, join(directory, name), `${name}-types`);
      const scope = scopeFromPreprocessed(readFileSync(processed, "utf8"));
      prototype.slots = slotsWithTypedefs(prototype.paramTypes ?? [], scope.source);
      prototype.usedParameters = parameterReads(scope.source, name);
      const identities = typeScopes([...(prototype.paramTypes ?? []), prototype.returnType ?? ""], scope.source, scope.lineOf, prototype.where);
      prototype.typeScopes = { parameters: identities.slice(0, -1), result: identities.at(-1)! };
      record.status = "verified"; record.prototype = prototype; memo.set(name, prototype); return prototype;
    } catch (error) { record.status = "rejected"; record.reason = String(error); return; }
  };
  return { get, records };
}
