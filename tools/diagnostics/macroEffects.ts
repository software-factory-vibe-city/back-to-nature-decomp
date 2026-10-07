/** Tier-B effect spine: drop allocator/address-feed noise, but preserve call
 * targets and known store values. Calls execute AFTER their delay slots, so a
 * terminator store in a jal delay slot belongs before the call effect. This
 * is a shared-source-shape hypothesis, not a semantic decompilation. */
import { createHash } from "node:crypto";
import { decodeMacroBytes, type MacroInstruction } from "./macroInstructions.js";
import type { MacroCandidate, MacroOccurrence } from "./macroMiner.js";
import type { MacroFunction } from "./macroTiler.js";
interface Effect { key: string; at: number; end: number; insn: MacroInstruction; arguments: Record<string, number> }

function effects(fn: MacroFunction): Effect[] {
  const insns = decodeMacroBytes(fn.bytes, fn.vram), result: Effect[] = [];
  const targets = new Set(insns.filter(i => i.target !== null && i.op !== "jal").map(i => i.target!));
  const values = new Map<number, number>();
  let pending: MacroInstruction | null = null, clearAt = -1;
  for (let index = 0; index < insns.length; index++) {
    const insn = insns[index]!;
    if (targets.has(insn.vram) || index === clearAt) values.clear();
    values.set(0, 0);
    const args = insn.args.map(a => a.value);
    let value: number | undefined;
    if (insn.op === "lui") value = (args[1]! << 16) >>> 0;
    if (insn.op === "addiu" || insn.op === "addi" || insn.op === "ori") {
      const source = values.get(args[1]!);
      if (source !== undefined) value = (insn.op === "ori" ? source | args[2]! : source + args[2]!) >>> 0;
    }
    if (insn.op === "addu" || insn.op === "or") {
      const a = values.get(args[1]!), b = values.get(args[2]!);
      if (a !== undefined && b !== undefined) value = (insn.op === "or" ? a | b : a + b) >>> 0;
    }
    if (/^(?:sb|sh|sw)$/.test(insn.op)) {
      const source = values.get(args[0]!);
      if (source !== undefined) {
        const masked = insn.op === "sb" ? source & 255 : insn.op === "sh" ? source & 65535 : source;
        result.push({ key: `store.${insn.op} constant:${masked}`, at: insn.vram, end: insn.vram + 4, insn, arguments: {} });
      } else result.push({ key: "opaque-store", at: insn.vram, end: insn.vram + 4, insn, arguments: {} });
    }
    for (const reg of insn.writes) values.delete(reg);
    if (value !== undefined && insn.writes[0] !== undefined) values.set(insn.writes[0], value);
    if (pending && index > 0 && insns[index - 1] === pending) {
      const arguments_: Record<string, number> = {};
      for (let reg = 4; reg <= 7; reg++) if (values.has(reg)) arguments_[`arg${reg - 4}`] = values.get(reg)!;
      result.push({ key: `call address:${pending.target}`, at: pending.vram, end: insn.vram + 4, insn: pending, arguments: arguments_ });
      // Preserve only callee-saved registers, never propagate return values.
      for (const reg of [...values.keys()]) if (reg > 0 && (reg < 16 || reg > 23)) values.delete(reg);
      pending = null;
    }
    if (insn.op === "jal") pending = insn;
    else if (insn.control || insn.op === "unknown") {
      result.push({ key: "control-barrier", at: insn.vram, end: insn.vram + 4, insn, arguments: {} });
      clearAt = index + (insn.control ? 2 : 1);
    }
  }
  return result;
}

export function mineCompiledEffects(functions: readonly MacroFunction[], minSupport: number, maxLength: number, maxPatterns: number): { candidates: MacroCandidate[]; complete: boolean; patternCount: number } {
  const groups = new Map<string, { keys: string[]; sites: Array<{ site: MacroOccurrence; effects: Effect[] }> }>();
  let complete = true;
  for (const fn of functions) {
    const spine = effects(fn);
    for (let start = 0; start < spine.length; start++) for (let length = 3; length <= maxLength && start + length <= spine.length; length++) {
      const window = spine.slice(start, start + length), keys = window.map(e => e.key);
      if (keys.some(k => k === "control-barrier" || k === "opaque-store")) break;
      const stores = keys.filter(k => k.startsWith("store."));
      const calls = keys.filter(k => k.startsWith("call "));
      if (!stores.some(k => /store\.(?:sb constant:255|sh constant:65535|sw constant:4294967295)$/.test(k)) || !(calls.length >= 2 || stores.length >= 3)) continue;
      const key = keys.join(";");
      let group = groups.get(key);
      if (!group) {
        if (groups.size >= maxPatterns) { complete = false; continue; }
        group = { keys, sites: [] }; groups.set(key, group);
      }
      const at = Math.min(...window.map(e => e.at)), end = Math.max(...window.map(e => e.end));
      if (group.sites.some(s => s.site.container === fn.container && s.site.function === fn.name && s.site.end > at)) continue;
      group.sites.push({ site: { function: fn.name, container: fn.container, start: at, end, parameters: {}, feeds: {} }, effects: window });
    }
  }
  const candidates: MacroCandidate[] = [];
  for (const [key, group] of groups) {
    if (group.sites.length < minSupport) continue;
    const template = group.keys.map((key, index) => {
      if (!key.startsWith("call ")) return key;
      const common = [0, 1, 2, 3].filter(arg => group.sites[0]!.effects[index]!.arguments[`arg${arg}`] !== undefined && group.sites.every(s => s.effects[index]!.arguments[`arg${arg}`] === group.sites[0]!.effects[index]!.arguments[`arg${arg}`]));
      return `${key}${common.map(arg => ` arg${arg}:${group.sites[0]!.effects[index]!.arguments[`arg${arg}`]}`).join("")}`;
    });
    candidates.push({ id: createHash("sha256").update(`effects:${key}`).digest("hex").slice(0, 20), tier: "compiled-idiom", representation: "effect-window", template, parameters: ["unresolved call arguments and store destinations"], occurrences: group.sites.map(s => s.site), signals: { cop2: false, registerRigidity: false, rigidRegisters: [], independentPairs: 0, orderRigidity: "not-tested", variantFeed: false, unusualInstructions: [] }, verdict: "undetermined", claim: "shared-source-shape" });
  }
  return { candidates, complete, patternCount: groups.size };
}
