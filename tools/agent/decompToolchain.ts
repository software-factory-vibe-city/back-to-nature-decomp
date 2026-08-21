import { execFileSync, spawn, spawnSync } from "child_process";
import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { basename, dirname, isAbsolute, join, resolve } from "path";
import { fileURLToPath } from "url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * The compiler version is project configuration, not a constant: the Makefile
 * names it in one place and says to change it to experiment with 2.7.2 or
 * 2.8.1. Anything that resolves a compiler path or its vendored source reads
 * it from there, so switching versions does not mean editing tools.
 */
export function configuredGccVersion(): string {
  const makefile = readFileSync(join(ROOT, "Makefile"), "utf-8");
  const version = makefile.match(/^GCC_VERSION\s*:=\s*(\S+)/m)?.[1];
  if (!version) throw new Error("Makefile does not define GCC_VERSION; cannot resolve the configured compiler.");
  return version;
}

export function configuredCompilerPath(): string {
  return join(ROOT, `tools/vendor/old-gcc/build-gcc-${configuredGccVersion()}-psx/cc1`);
}

const CC = configuredCompilerPath();
const MASPSX = join(ROOT, "tools/vendor/maspsx/maspsx.py");
const CPP = "mips-linux-gnu-cpp";
const AS = "mips-linux-gnu-as";
const OBJDUMP = "mips-linux-gnu-objdump";

/**
 * Preprocessor flags, read from the Makefile rather than restated here.
 *
 * They were duplicated in four places -- this file, diffFunc, flagProbe and the
 * Makefile -- so adding `-D_LANGUAGE_C` to the build left every diagnostic tool
 * preprocessing differently from the thing it was diagnosing, and `make check`
 * could not detect the discrepancy because it only reads the Makefile.
 *
 * Include paths are re-anchored to ROOT so a tool can run from any directory;
 * every other token is taken verbatim.
 */
export function configuredCppFlags(): string[] {
  const makefile = readFileSync(join(ROOT, "Makefile"), "utf-8");
  const line = makefile.match(/^CPPFLAGS\s*:?=\s*(.*)$/m)?.[1];
  if (!line) throw new Error("Makefile does not define CPPFLAGS; cannot resolve the configured preprocessor flags.");
  return line.trim().split(/\s+/).map((flag) =>
    flag.startsWith("-I") ? `-I${join(ROOT, flag.slice(2))}` : flag);
}

export const CPP_FLAGS = configuredCppFlags();

/** One Makefile variable, tokenised, with `$(...)` expansions dropped. */
function makefileFlags(name: string): string[] {
  const makefile = readFileSync(join(ROOT, "Makefile"), "utf-8");
  const line = makefile.match(new RegExp(`^${name}\\s*:?=\\s*(.*)$`, "m"))?.[1];
  if (line === undefined) throw new Error(`Makefile does not define ${name}; cannot resolve the configured flags.`);
  /* CC1FLAGS ends in $(CC1FLAGS_$(basename ...)) for per-file overrides, which
   * is applied separately by loadFlagOverrides. Strip innermost-first so
   * nested calls disappear cleanly. */
  let text = line;
  while (/\$\([^()]*\)/.test(text)) text = text.replace(/\$\([^()]*\)/g, "");
  return text.trim().split(/\s+/).filter(Boolean);
}

const anchorIncludes = (flags: string[]): string[] =>
  flags.map((flag) => (flag.startsWith("-I") ? `-I${join(ROOT, flag.slice(2))}` : flag));

/** Baseline cc1 flags; per-file overrides come from configs/flag_overrides.mk. */
export function configuredCc1Flags(): string[] {
  return makefileFlags("CC1FLAGS");
}

/**
 * cc1 flags for one container kind.
 *
 * Overlay translation units were built `-G0`: 145,741 words of overlay `.text`
 * contain not one gp-relative access against 17.99 per 1000 words in the PS-X
 * EXE's. The threshold is the only difference, and it is swapped rather than
 * restated so the rest of the set stays sourced from the Makefile.
 * Reproduce the fingerprint: tools/diagnostics/overlayFlagFingerprint.ts
 */
export function configuredCc1FlagsForContainer(kind: "exe" | "overlay"): string[] {
  const base = configuredCc1Flags();
  if (kind === "exe") return base;
  const threshold = makefileFlags("OVERLAY_G")[0] ?? "-G0";
  return base.map((flag) => (flag === "-G8" ? threshold : flag));
}

/** Assembler flags for one container kind; same small-data reasoning. */
export function configuredAsFlagsForContainer(kind: "exe" | "overlay"): string[] {
  return kind === "exe" ? configuredAsFlags() : anchorIncludes(makefileFlags("OVERLAY_ASFLAGS"));
}

export function configuredAsFlags(): string[] {
  return anchorIncludes(makefileFlags("ASFLAGS"));
}

export function configuredMaspsxFlags(): string[] {
  return makefileFlags("MASPSX_FLAGS");
}

export const CC1_FLAGS = configuredCc1Flags();

export const AS_FLAGS = configuredAsFlags();

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
    ...configuredMaspsxFlags(),
    "--gnu-as-path", AS,
    "-o", object,
    ...AS_FLAGS,
    assembly,
  ]);
  return object;
}

export function parseImplicitDeclarationWarnings(stderr: string): string[] {
  const callees = new Set<string>();
  for (const line of stderr.split("\n")) {
    const warning = line.match(/warning: implicit declaration of function `(.+)'/);
    if (warning) callees.add(warning[1]);
  }
  return [...callees];
}

/**
 * A call to an undeclared function is C89 implicit int, so the call defines
 * `$v0` even though nothing reads it — a TU-context fact that reshapes
 * register allocation from outside the function body. The front end is the
 * authority on which calls lack a declaration, so ask it: re-run cc1 on the
 * already-preprocessed unit with -Wimplicit and read the warnings.
 */
export function detectImplicitDeclarations(preprocessed: string, stem: string): string[] {
  const flags = [...CC1_FLAGS, ...(loadFlagOverrides().get(stem) || []), "-Wimplicit"];
  const result = spawnSync(CC, [...flags, preprocessed, "-o", "/dev/null"], {
    cwd: ROOT,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  });
  return parseImplicitDeclarationWarnings(result.stderr ?? "");
}

/**
 * Run only the preprocessor, and return the path to the `.i`.
 *
 * The preprocessed text is the exact set of declarations the compiler saw, so
 * it is the only sound answer to "what prototype is in scope here" — a scan of
 * the headers on disk answers a different question, because it counts
 * declarations this translation unit never includes.
 *
 * This shares `CPP` and `CPP_FLAGS` with `compileSource` on purpose: a second
 * spelling of the preprocessor invocation is a second thing to keep in step
 * with the project configuration, and it would drift silently.
 */
export function preprocessOnly(source: string, outputDir: string, stem: string): string {
  const absoluteSource = isAbsolute(source) ? source : join(ROOT, source);
  const absoluteOutput = isAbsolute(outputDir) ? outputDir : join(ROOT, outputDir);
  mkdirSync(absoluteOutput, { recursive: true });
  const preprocessed = join(absoluteOutput, `${stem}.i`);
  runTool(CPP, [...CPP_FLAGS, absoluteSource, "-o", preprocessed]);
  return preprocessed;
}

/**
 * `-dp` annotates the first assembly line of each RTL instruction with its
 * UID, pattern name and declared length, which is the only sound way to learn
 * where one RTL instruction emitted several machine instructions. It is
 * opt-in: it appends text to instruction lines, and the production build in
 * the Makefile must stay byte-for-byte what it was.
 */
export function compileSource(
  source: string,
  outputDir: string,
  stem: string,
  options: {
    dumps?: boolean;
    assemble?: boolean;
    useOverrides?: boolean;
    extraCc1Flags?: string[];
    emissionAttribution?: boolean;
  } = {},
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
  if (options.emissionAttribution) cc1Flags.push("-dp");

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
      MASPSX, ...configuredMaspsxFlags(),
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
