/** Original assembly inputs, including matched functions with no .s artifact.
 * This is assembly parsing, not C source analysis. */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { containerTargetPath, vramToRom } from "../../lib/container.js";
import { requireFunctionLocation, loadSymbolIndex } from "../../lib/symbolIndex.js";
import { resolveAsmSource, ROOT } from "../decompToolchain.js";

export function originalAssembly(name: string, directory: string): { path: string; inputs: string[] } {
  const location = requireFunctionLocation(name), { span, container } = location;
  const target = containerTargetPath(container), image = readFileSync(target), rom = vramToRom(container, span.vram);
  const bytes = image.subarray(rom, rom + span.size), existing = resolveAsmSource(name);
  if (existing) {
    const text = readFileSync(existing, "utf8");
    const words = [...text.matchAll(/\/\*\s*\w+\s+([\da-fA-F]{8})\s+([\da-fA-F]{8})\s*\*\//g)];
    if (words.length === bytes.length / 4 && words.every((w, i) => Number(`0x${w[1]}`) === span.vram + i * 4 &&
      /* Splat prints instruction bytes in memory order, not numeric order. */
      Buffer.from(w[2]!, "hex").equals(bytes.subarray(i * 4, i * 4 + 4)))) return { path: existing, inputs: [existing, target] };
  }
  const binary = join(directory, `${name}.original.bin`), assembly = join(directory, `${name}.original.s`);
  writeFileSync(binary, bytes);
  const disassembly = execFileSync("mips-linux-gnu-objdump", ["-D", "-b", "binary", "-m", "mips:3000", "-EL", "-M", "no-aliases", `--adjust-vma=${span.vram}`, binary], { cwd: ROOT, encoding: "utf8" });
  const index = loadSymbolIndex(container);
  const instructions = [...disassembly.matchAll(/^\s*([\da-f]+):\s+[\da-f]{8}\s+(\w+)\s*([^\n]*)/gm)];
  const labels = new Set<number>();
  const lines = instructions.map((m) => {
    const at = parseInt(m[1]!, 16), op = m[2]!;
    let operands = m[3]!.replace(/\s+<[^>]*>/g, "").trim();
    /* GNU objdump omits '$'; m2c's MIPS grammar requires it. */
    operands = operands.replace(/\b(zero|at|v[01]|a[0-3]|t[0-9]|s[0-7]|k[01]|gp|sp|s8|fp|ra)\b/g, (_, reg: string) => `$${reg === "s8" ? "fp" : reg}`);
    if (["j", "jal", "beq", "bne", "blez", "bgtz", "bltz", "bgez"].includes(op)) {
      operands = operands.replace(/(?:0x)?([\da-f]{8})$/, (raw, hex: string) => {
        const address = parseInt(hex, 16);
        if (address >= span.vram && address < span.vram + span.size) { labels.add(address); return `.L${address.toString(16)}`; }
        return index.byAddress.get(address) ?? raw;
      });
    }
    return { at, text: `${op} ${operands}` };
  });
  writeFileSync(assembly, `.text\nglabel ${name}\n` + lines.map((line) => `${labels.has(line.at) ? `.L${line.at.toString(16)}:\n` : ""}${line.text}\n`).join(""));
  return { path: assembly, inputs: [target, assembly, binary] };
}
