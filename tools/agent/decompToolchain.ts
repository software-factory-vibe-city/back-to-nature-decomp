import { execFileSync, spawn } from "child_process";
import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { basename, dirname, isAbsolute, join, resolve } from "path";
import { fileURLToPath } from "url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const CC = join(ROOT, "tools/vendor/old-gcc/build-gcc-2.95.2-psx/cc1");
const MASPSX = join(ROOT, "tools/vendor/maspsx/maspsx.py");
const CPP = "mips-linux-gnu-cpp";
const AS = "mips-linux-gnu-as";
const OBJDUMP = "mips-linux-gnu-objdump";

export const CPP_FLAGS = [
  `-I${join(ROOT, "include")}`,
  `-I${join(ROOT, "include/psyq")}`,
  "-undef",
  "-D__GNUC__=2",
  "-DINCLUDE_ASM_USE_MACRO_INC=1",
  "-lang-c",
];

export const CC1_FLAGS = [
  "-O2", "-G8", "-mips1", "-mcpu=r3000", "-funsigned-char",
  "-fpeephole", "-ffunction-cse", "-fpcc-struct-return", "-fcommon",
  "-fverbose-asm", "-msoft-float", "-mgas", "-fgnu-linker", "-quiet",
];

export const AS_FLAGS = [
  "-march=r3000", "-mtune=r3000", "-EL", "-G8", "-no-pad-sections",
  `-I${join(ROOT, "include")}`, `-I${join(ROOT, "include/psyq")}`,
];

export interface CompileArtifacts {
  source: string;
  preprocessed: string;
  assembly: string;
  object?: string;
  outputDir: string;
  stem: string;
  cc1Flags: string[];
}

function commandError(tool: string, error: any): Error {
  const stderr = Buffer.isBuffer(error?.stderr) ? error.stderr.toString() : error?.stderr;
  const stdout = Buffer.isBuffer(error?.stdout) ? error.stdout.toString() : error?.stdout;
  const detail = String(stderr || stdout || error?.message || error).trim();
  return new Error(`${tool} failed${detail ? `: ${detail}` : ""}`);
}

export function runTool(command: string, args: string[], cwd: string = ROOT): string {
  try {
    return execFileSync(command, args, {
      cwd,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error: any) {
    throw commandError(command, error);
  }
}

export function runToolAsync(
  command: string,
  args: string[],
  cwd: string = ROOT,
  signal?: AbortSignal,
): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"], signal });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    child.on("error", (error) => reject(commandError(command, { message: error.message, stderr: Buffer.concat(stderr) })));
    child.on("close", (code) => {
      if (code === 0) resolvePromise(Buffer.concat(stdout).toString("utf8"));
      else reject(commandError(command, { message: `exit ${code}`, stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr) }));
    });
  });
}

function firstVersionLine(command: string, args: string[]): string {
  try {
    return runTool(command, args).split("\n").find((line) => line.trim())?.trim() || "unknown";
  } catch {
    return "unknown";
  }
}

function fileSha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function configuredToolchainIdentity(): {
  node: string;
  compiler: { path: string; sha256: string; version: string };
  assemblerShim: { path: string; sha256: string };
  cpp: string;
  assembler: string;
  objdump: string;
} {
  return {
    node: process.version,
    compiler: {
      path: relativePath(CC),
      sha256: fileSha256(CC),
      version: firstVersionLine(CC, ["--version"]),
    },
    assemblerShim: { path: relativePath(MASPSX), sha256: fileSha256(MASPSX) },
    cpp: firstVersionLine(CPP, ["--version"]),
    assembler: firstVersionLine(AS, ["--version"]),
    objdump: firstVersionLine(OBJDUMP, ["--version"]),
  };
}

function relativePath(path: string): string {
  return path.startsWith(`${ROOT}/`) ? path.slice(ROOT.length + 1) : path;
}

export function normalizeFunctionName(value: string): string {
  return basename(value).replace(/\.c$/, "");
}

export function resolveSource(funcName: string, requested?: string): string {
  const source = requested || join("src", `${funcName}.c`);
  const absolute = isAbsolute(source) ? source : join(ROOT, source);
  if (!existsSync(absolute)) throw new Error(`Source file not found: ${source}`);
  return absolute;
}

export function loadFlagOverrides(): Map<string, string[]> {
  const result = new Map<string, string[]>();
  const path = join(ROOT, "configs/flag_overrides.mk");
  if (!existsSync(path)) return result;

  for (const line of readFileSync(path, "utf-8").split("\n")) {
    const match = line.match(/^CC1FLAGS_(\S+)\s*:=\s*(.+)$/);
    if (!match) continue;
    result.set(match[1], match[2].trim().split(/\s+/));
  }
  return result;
}

export function assembleCompilerOutput(assembly: string, object: string): string {
  runTool("python3", [
    MASPSX,
    "--aspsx-version", "2.77",
    "--dont-force-G0",
    "--run-assembler",
    "--gnu-as-path", AS,
    "-o", object,
    ...AS_FLAGS,
    assembly,
  ]);
  return object;
}

export function compileSource(
  source: string,
  outputDir: string,
  stem: string,
  options: { dumps?: boolean; assemble?: boolean; useOverrides?: boolean; extraCc1Flags?: string[] } = {},
): CompileArtifacts {
  const absoluteSource = isAbsolute(source) ? source : join(ROOT, source);
  const absoluteOutput = isAbsolute(outputDir) ? outputDir : join(ROOT, outputDir);
  mkdirSync(absoluteOutput, { recursive: true });

  const preprocessed = join(absoluteOutput, `${stem}.i`);
  const assembly = join(absoluteOutput, `${stem}.s`);
  const object = join(absoluteOutput, `${stem}.c.o`);

  runTool(CPP, [...CPP_FLAGS, absoluteSource, "-o", preprocessed]);

  const overrides = options.useOverrides === false
    ? []
    : (loadFlagOverrides().get(stem) || []);
  const cc1Flags = [...CC1_FLAGS, ...overrides, ...(options.extraCc1Flags || [])];
  if (options.dumps) cc1Flags.push("-da");

  /* Running cc1 in the artifact directory keeps all -da files together. */
  runTool(CC, [...cc1Flags, basename(preprocessed), "-o", basename(assembly)], absoluteOutput);

  if (options.assemble) assembleCompilerOutput(assembly, object);

  const result: CompileArtifacts = {
    source: absoluteSource,
    preprocessed,
    assembly,
    outputDir: absoluteOutput,
    stem,
    cc1Flags,
  };
  if (options.assemble) result.object = object;
  return result;
}

export async function compileSourceAsync(
  source: string,
  outputDir: string,
  stem: string,
  options: { dumps?: boolean; assemble?: boolean; useOverrides?: boolean; signal?: AbortSignal } = {},
): Promise<CompileArtifacts> {
  const absoluteSource = isAbsolute(source) ? source : join(ROOT, source);
  const absoluteOutput = isAbsolute(outputDir) ? outputDir : join(ROOT, outputDir);
  mkdirSync(absoluteOutput, { recursive: true });
  const preprocessed = join(absoluteOutput, `${stem}.i`);
  const assembly = join(absoluteOutput, `${stem}.s`);
  const object = join(absoluteOutput, `${stem}.c.o`);
  await runToolAsync(CPP, [...CPP_FLAGS, absoluteSource, "-o", preprocessed], ROOT, options.signal);
  const overrides = options.useOverrides === false ? [] : (loadFlagOverrides().get(stem) || []);
  const cc1Flags = [...CC1_FLAGS, ...overrides];
  if (options.dumps) cc1Flags.push("-da");
  await runToolAsync(CC, [...cc1Flags, basename(preprocessed), "-o", basename(assembly)], absoluteOutput, options.signal);
  if (options.assemble) {
    await runToolAsync("python3", [
      MASPSX, "--aspsx-version", "2.77", "--dont-force-G0", "--run-assembler",
      "--gnu-as-path", AS, "-o", object, ...AS_FLAGS, assembly,
    ], ROOT, options.signal);
  }
  const result: CompileArtifacts = { source: absoluteSource, preprocessed, assembly, outputDir: absoluteOutput, stem, cc1Flags };
  if (options.assemble) result.object = object;
  return result;
}

export function resolveAsmSource(funcName: string): string | null {
  const directory = join(ROOT, "build/asm/nonmatchings", funcName);
  const expected = join(directory, `${funcName}.s`);
  if (existsSync(expected)) return expected;
  if (existsSync(directory)) {
    const files = readdirSync(directory).filter((file) => file.endsWith(".s"));
    if (files.length === 1) return join(directory, files[0]);
  }

  /* disassemble.sh keeps originals here even after splat promotes a function to C. */
  const archived = join(ROOT, "build/functions", `${funcName}.s`);
  return existsSync(archived) ? archived : null;
}

export function assembleTarget(funcName: string, outputDir: string): string {
  const asmSource = resolveAsmSource(funcName);
  if (!asmSource) {
    throw new Error(`Original assembly not found for ${funcName}; run make disassemble to populate build/functions`);
  }

  const absoluteOutput = isAbsolute(outputDir) ? outputDir : join(ROOT, outputDir);
  mkdirSync(absoluteOutput, { recursive: true });
  const wrapper = join(absoluteOutput, `${funcName}.target.s`);
  const object = join(absoluteOutput, `${funcName}.target.o`);
  const relativeAsm = asmSource.slice(ROOT.length + 1);

  writeFileSync(wrapper,
    `.include "include/macro.inc"\n` +
    `.set noat\n` +
    `.set noreorder\n` +
    `.include "${relativeAsm}"\n`,
  );

  runTool(AS, [...AS_FLAGS, wrapper, "-o", object]);
  return object;
}

export interface DisassembledInstruction {
  address: number;
  mnemonic: string;
  operands: string[];
  operandText: string;
  relocation?: { type: string; symbol: string };
  raw: string;
}

/** Split operands without splitting the offset(base) syntax. */
export function splitOperands(text: string): string[] {
  const result: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === "(") depth++;
    else if (char === ")") depth--;
    else if (char === "," && depth === 0) {
      result.push(text.slice(start, index).trim());
      start = index + 1;
    }
  }
  const tail = text.slice(start).trim();
  if (tail) result.push(tail);
  return result;
}

export function disassembleObject(object: string): DisassembledInstruction[] {
  const dump = runTool(OBJDUMP, ["-dr", "--no-show-raw-insn", object]);
  const instructions: DisassembledInstruction[] = [];
  const byAddress = new Map<number, DisassembledInstruction>();

  for (const line of dump.split("\n")) {
    const relocation = line.match(/^\s*([0-9a-f]+):\s+(R_MIPS_\S+)\s+(.+?)\s*$/i);
    if (relocation) {
      const instruction = byAddress.get(parseInt(relocation[1], 16));
      if (instruction) {
        instruction.relocation = { type: relocation[2], symbol: relocation[3].trim() };
      }
      continue;
    }

    const match = line.match(/^\s*([0-9a-f]+):\s+([a-z][a-z0-9_.]*)\s*(.*?)\s*$/i);
    if (!match) continue;
    const address = parseInt(match[1], 16);
    const instruction: DisassembledInstruction = {
      address,
      mnemonic: match[2].toLowerCase(),
      operands: splitOperands(match[3]),
      operandText: match[3],
      raw: line.trim(),
    };
    instructions.push(instruction);
    byAddress.set(address, instruction);
  }
  return instructions;
}
