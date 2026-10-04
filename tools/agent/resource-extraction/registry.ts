import { decodeTim, parseTim } from "./formats.ts";
import { EXTRA_PARSERS } from "./parser-plugins.ts";
import { canonical, integer } from "./storage.ts";
import type { Match } from "./types.ts";

export interface ParsedAsset { length: number; metadata: Record<string, unknown> }
export interface DecodedOutput {
  kind: string; extension: string; stage: "decoding" | "export";
  bytes: Buffer; metadata: Record<string, unknown>;
}
/** Plugins are trusted, versioned implementations, not executable agent drafts.
 * All methods are pure byte-view operations: no filesystem, game execution,
 * project symbols, or container-wide guesses. Parameterized/headerless formats
 * can be added as validated views without pretending they have universal magic. */
export interface AssetParser {
  id: string; format: string; version: number;
  probe(bytes: Buffer, offset: number): boolean;
  parse(bytes: Buffer, offset: number): ParsedAsset;
  variants(bytes: Buffer): Array<Record<string, unknown>>;
  decode(bytes: Buffer, variant: Record<string, unknown>, maxBytes: number): DecodedOutput[];
}
export class ParserRegistry {
  readonly parsers: readonly AssetParser[];
  constructor(parsers: AssetParser[]) {
    const names = new Set<string>();
    for (const parser of parsers) {
      if (!/^[a-z][a-z0-9-]+$/.test(parser.id) || names.has(parser.id) || ["slice-v1", "byte-xor-v1"].includes(parser.id)) throw new Error(`Invalid/duplicate parser ID: ${parser.id}`);
      integer(parser.version, "parser version", 1);
      names.add(parser.id);
    }
    this.parsers = Object.freeze([...parsers]);
  }
  get(name: string): AssetParser {
    const parser = this.parsers.find(p => p.id === name);
    if (!parser) throw new Error(`Unsupported parser processor: ${name}`);
    return parser;
  }
  parse(name: string, bytes: Buffer, offset: number): ParsedAsset {
    integer(offset, "parser offset", 0, bytes.length);
    const parsed = this.get(name).parse(bytes, offset);
    integer(parsed.length, "parsed extent", 1, bytes.length - offset);
    if (!parsed.metadata || typeof parsed.metadata !== "object" || Array.isArray(parsed.metadata)) throw new Error("Parser metadata must be a structured object");
    return parsed;
  }
  variants(name: string, bytes: Buffer): Array<Record<string, unknown>> {
    const variants = this.get(name).variants(bytes);
    if (variants.length > 65536 || new Set(variants.map(canonical)).size !== variants.length) throw new Error("Parser variant domain is too large or duplicated");
    return variants;
  }
  decode(name: string, bytes: Buffer, variant: Record<string, unknown>, maximum: number): DecodedOutput[] {
    integer(maximum, "decode budget");
    // Caller parameters cannot invent an unrecognized variant of a format.
    if (!this.variants(name, bytes).some(v => canonical(v) === canonical(variant))) throw new Error("Unknown parser decode variant");
    const outputs = this.get(name).decode(bytes, variant, maximum);
    const kinds = new Set<string>();
    for (const output of outputs) {
      if (!/^[a-zA-Z0-9_-]+$/.test(output.kind) || !/^[a-zA-Z0-9_-]+$/.test(output.extension) || kinds.has(output.kind) || !["decoding", "export"].includes(output.stage)) throw new Error("Invalid parser output descriptor");
      kinds.add(output.kind);
    }
    if (outputs.reduce((sum, o) => sum + o.bytes.length, 0) > maximum) throw new Error("budget-exhausted: parser outputs");
    return outputs;
  }
  replay(name: string, bytes: Buffer, variant: Record<string, unknown>, kind: string, maximum: number): DecodedOutput {
    const output = this.decode(name, bytes, variant, maximum).find(o => o.kind === kind);
    if (!output) throw new Error("Unrecognized parser artifact kind");
    return output;
  }
  async scan(bytes: Buffer, limit: number, signal?: AbortSignal): Promise<{ matches: Match[]; rejected: number; complete: boolean }> {
    integer(limit, "match limit");
    const matches: Match[] = [];
    let rejected = 0;
    for (let offset = 0; offset < bytes.length; offset++) {
      if ((offset & 0x1ffff) === 0) { signal?.throwIfAborted(); await new Promise<void>(r => setImmediate(r)); }
      for (const parser of this.parsers) {
        if (!parser.probe(bytes, offset)) continue;
        let parsed: ParsedAsset;
        try { parsed = this.parse(parser.id, bytes, offset); } catch { rejected++; continue; }
        if (matches.length >= limit) return { matches, rejected, complete: false };
        matches.push({ format: parser.format, parser: parser.id, offset, length: parsed.length, metadata: parsed.metadata });
      }
    }
    return { matches, rejected, complete: true };
  }
}

export const TIM_PARSER: AssetParser = {
  id: "tim-v1", format: "TIM", version: 1,
  probe: (bytes, offset) => offset + 8 <= bytes.length && bytes[offset] === 0x10 && bytes.readUInt32LE(offset) === 0x10,
  parse: (bytes, offset) => {
    const tim = parseTim(bytes, offset);
    return { length: tim.length, metadata: { ...tim, pixels: tim.pixels - offset, ...(tim.palette ? { palette: { ...tim.palette, offset: tim.palette.offset - offset } } : {}) } };
  },
  variants: bytes => Array.from({ length: parseTim(bytes).palette?.banks ?? 1 }, (_, bank) => ({ bank })),
  decode: (bytes, variant, maximum) => {
    const output = decodeTim(bytes, integer(variant.bank as number, "palette bank"), maximum);
    return (["rgba", "stp", "ppm"] as const).map(kind => ({ kind, extension: kind, stage: kind === "ppm" ? "export" : "decoding", bytes: output[kind], metadata: output.metadata }));
  },
};
/** Adding a format means a plugin, this registry entry, and its tests. The
 * inventory, graph, checkpoint, publication and verification loops stay put. */
export const PARSERS = new ParserRegistry([TIM_PARSER, ...EXTRA_PARSERS]);
export const scanFormats = (bytes: Buffer, limit: number, signal?: AbortSignal) => PARSERS.scan(bytes, limit, signal);
