import { existsSync, readFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import type { AutodecompConfig, PolicyFinding, SourcePolicyResult } from "./types.ts";

interface PolicyOptions {
  projectRoot: string;
  config: AutodecompConfig;
  functionName?: string;
  functionVram?: string;
  functionContainer?: string;
  scanFunctions?: string[];
  functionVrams?: Record<string, string>;
  /** name -> container id, from the call graph. */
  functionContainers?: Record<string, string>;
  /**
   * name -> project-relative C file, from the call graph.
   *
   * Supplied rather than reconstructed: `src/<name>.c` is the executable's
   * layout, and reconstructing it for an overlay scans a file that does not
   * exist, which reads as a clean function instead of an unscanned one.
   */
  functionSources?: Record<string, string>;
  changedFiles?: string[];
  patch?: string;
}

/** The container an unqualified identity belongs to. */
const EXE_CONTAINER = "exe";

function normalizedPath(path: string): string {
  return path.split(sep).join("/").replace(/^\.\//, "");
}

export function withinAllowedRoots(config: AutodecompConfig, file: string): boolean {
  const normalized = normalizedPath(file);
  return config.integration.allowedRoots.some((root) => normalized === root || normalized.startsWith(`${root}/`));
}

/**
 * The allowlist keys one function answers to.
 *
 * A name is one of them because an overlay's symbols carry their container as a
 * prefix, which makes the name globally unique. A bare address is honoured only
 * for the executable: two overlays share a RAM slot, so a bare address there
 * would hand one function's policy exception to a different function at the
 * same address. Overlays are keyed `<container>:<address>` instead.
 */
export function allowlistKeys(name?: string, vram?: string, container?: string): string[] {
  const keys: string[] = [];
  if (name) keys.push(name.toLowerCase());
  if (vram) {
    const owner = container ?? EXE_CONTAINER;
    keys.push(`${owner}:${vram}`.toLowerCase());
    if (owner === EXE_CONTAINER) keys.push(vram.toLowerCase());
  }
  return keys;
}

function allowlisted(
  config: AutodecompConfig,
  name: string | undefined,
  vram: string | undefined,
  container: string | undefined,
  kind: string,
): boolean {
  return allowlistKeys(name, vram, container).some((key) => config.sourcePolicy.allowlist[key]?.includes(kind));
}

/**
 * A GCC *asm label* — `extern T sym[1] __asm__("NAME");` — renames the symbol
 * a declarator refers to. It emits no instructions, and it is how an
 * absolutely-addressed generated symbol is given a real aggregate type in the
 * override header. It is not embedded assembly and must not be policed as
 * such.
 *
 * Recognised narrowly, so instructions cannot enter through it: one plain
 * string operand that is a bare identifier (no colon operand lists, no
 * instruction text), preceded on the same line by a declarator, and closing a
 * declaration. Anything statement-initial, or following a `;`/`{`/`}`, is an
 * asm statement and stays forbidden. A register pin is a different construct
 * and is matched before this, on the `register` keyword.
 */
function asmLabel(line: string): boolean {
  const match = line.match(/\b(?:__asm__|__asm|asm)\s*\(\s*"([^"\\]*)"\s*\)\s*;\s*$/);
  if (!match || !/^[A-Za-z_][A-Za-z0-9_.]*$/.test(match[1])) return false;
  const declarator = line.slice(0, match.index).trim();
  return declarator.length > 0 && !/[;{}]$/.test(declarator);
}

/**
 * Assembly that does nothing but move the stack pointer.
 *
 * The PS1's data cache is not a cache: it is 1 KB of single-cycle memory
 * mapped at 0x1F800000, the "scratchpad", and main RAM has no data cache at
 * all. So a hot call tree pays bus cycles for every local it touches, and the
 * standard answer is to point `$sp` at the scratchpad for the duration and
 * restore it afterwards. This target does exactly that at three sites, with a
 * byte-identical six-instruction idiom, and 0x1F8003FC is the only scratchpad
 * address anywhere in the image.
 *
 * No C construct moves `$sp`. There is no compiler flag, no SDK call and no
 * intrinsic for it in PSY-Q — the original source can only have contained
 * inline assembly, so demanding clean C here demands a program the developers
 * did not write. That makes this a *classification*, like the empty memory
 * barrier, rather than a per-function exception a human has to grant: an
 * allowlist entry asserts "assembly was the right answer for this function",
 * and here it is the right answer for the construct.
 *
 * Recognised narrowly enough that nothing else can travel with it. The
 * statement must have no output operands, so it cannot deliver a value to C;
 * every destination must be `$sp` or a caller-saved temp; and the only memory
 * operations permitted are storing `$sp` and loading `$sp`, so it cannot read
 * or write anything else. What is left is precisely: compute an address into a
 * temp, park `$sp` in memory, install a new `$sp`, and undo it.
 */
const STACK_POINTER = /^\$(?:sp|29)$/;
const SCRATCH_REGISTER = /^(?:\$(?:t[0-7]|at|[1]|8|9|1[0-5])|%\d)$/;

function stackSwitchInstruction(text: string): boolean {
  const instruction = text.trim();
  if (instruction === "" || instruction === "nop") return true;

  const destinationIsWritable = (operand: string) =>
    STACK_POINTER.test(operand) || /^\$(?:t[0-7]|at|[1]|8|9|1[0-5])$/.test(operand);
  const readable = (operand: string) =>
    STACK_POINTER.test(operand) || SCRATCH_REGISTER.test(operand) || /^\$(?:0|zero)$/.test(operand);

  /* A copy: `move d,s`, `addu d,s,$0`, `or d,s,$0`. */
  const copy = instruction.match(/^(?:move|addu|add|or)\s+(\S+?),\s*(\S+?)(?:,\s*(\S+))?$/);
  if (copy) {
    const [, destination, first, second] = copy;
    if (!destinationIsWritable(destination!) || !readable(first!)) return false;
    return second === undefined ? true : /^\$(?:0|zero)$/.test(second) || readable(second);
  }

  /* An offset: `addiu d,s,imm`. */
  const offset = instruction.match(/^(?:addiu|addi)\s+(\S+?),\s*(\S+?),\s*(-?(?:0x)?[0-9A-Fa-f]+)$/);
  if (offset) return destinationIsWritable(offset[1]!) && readable(offset[2]!);

  /* The only memory this may touch is the saved stack pointer itself. */
  const store = instruction.match(/^sw\s+(\S+?),\s*(-?(?:0x)?[0-9A-Fa-f]+)?\((\S+?)\)$/);
  if (store) return STACK_POINTER.test(store[1]!) && readable(store[3]!);
  const load = instruction.match(/^lw\s+(\S+?),\s*(-?(?:0x)?[0-9A-Fa-f]+)?\((\S+?)\)$/);
  if (load) return STACK_POINTER.test(load[1]!) && readable(load[3]!);

  return false;
}

export function stackPointerSwitch(line: string): boolean {
  const open = line.search(/\b(?:__asm__|__asm|asm)\s*(?:(?:__)?volatile(?:__)?\s*)?\(/);
  if (open < 0) return false;
  const body = line.slice(line.indexOf("(", open) + 1);

  /* Everything before the first colon is the instruction template; the colon
     groups are the operand lists. An output operand would let a value reach C,
     so the first group must be empty. */
  const colon = body.search(/:(?!:)/);
  const template = colon < 0 ? body.replace(/\)\s*;?\s*$/, "") : body.slice(0, colon);
  if (colon >= 0) {
    const groups = body.slice(colon + 1).replace(/\)\s*;?\s*$/, "").split(":");
    if ((groups[0] ?? "").trim() !== "") return false;
  }

  const pieces = [...template.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((match) => match[1]!);
  if (pieces.length === 0) return false;
  const instructions = pieces
    .join(" ")
    .replace(/\\n\\t|\\n|\\t/g, ";")
    .split(";")
    .map((piece) => piece.trim())
    .filter((piece) => piece.length > 0);
  if (instructions.length === 0) return false;
  if (!instructions.every(stackSwitchInstruction)) return false;

  /* A statement that does nothing is not a stack switch, whatever else it
     satisfies. A bare `__asm__("nop")` breaks no rule above precisely because
     it has no effect, and "has no effect" is a different claim from "moves the
     stack pointer" — without this the classification would exempt every no-op
     asm statement in the project. So at least one instruction has to do one of
     the three things the idiom is made of: touch `$sp`, take the slot address
     from a compiler-chosen register (`%N`), or step the temp by a constant. */
  return instructions.some((instruction) =>
    /\$(?:sp|29)\b/.test(instruction)
    || /%\d/.test(instruction)
    || /^(?:addiu|addi)\s/.test(instruction));
}

function forbiddenLine(
  line: string,
  config: AutodecompConfig,
  functionName?: string,
  functionVram?: string,
  functionContainer?: string,
): { kind: string; message: string } | undefined {
  if (/\bINCLUDE_ASM\s*\(/.test(line) && !allowlisted(config, functionName, functionVram, functionContainer, "include-asm")) {
    return { kind: "include-asm", message: "Assembly stub is forbidden for an ordinary compiled function" };
  }
  if (/\bregister\b[^;\n]*\b(?:__asm__|__asm|asm)\s*\(/.test(line) && !allowlisted(config, functionName, functionVram, functionContainer, "register-asm")) {
    return { kind: "register-asm", message: "Hard-register pinning is forbidden" };
  }
  /* `__volatile__` is the reserved spelling this project's C89 sources use;
   * matching only `volatile` let embedded asm through the gate unseen. */
  if (/\b(?:__asm__|__asm|asm)\s*(?:(?:__)?volatile(?:__)?\s*)?\(/.test(line)) {
    if (asmLabel(line)) return undefined;
    const compact = line.replace(/\s+/g, "").replace(/__volatile__/g, "volatile");
    const emptyMemoryBarrier = compact.includes('__asm__volatile("":::"memory")') || compact.includes('__asm__("":::"memory")');
    if (emptyMemoryBarrier && config.sourcePolicy.allowEmptyMemoryBarrier) return undefined;
    if (config.sourcePolicy.allowStackPointerSwitch && stackPointerSwitch(line)) return undefined;
    if (!allowlisted(config, functionName, functionVram, functionContainer, "embedded-asm")) {
      return { kind: "embedded-asm", message: "Embedded assembly is forbidden for an ordinary compiled function" };
    }
  }
  return undefined;
}

function stripComments(line: string, inBlock: boolean): { code: string; inBlock: boolean } {
  let code = "";
  let index = 0;
  while (index < line.length) {
    if (inBlock) {
      const end = line.indexOf("*/", index);
      if (end < 0) return { code, inBlock: true };
      inBlock = false;
      index = end + 2;
      continue;
    }
    const block = line.indexOf("/*", index);
    const slash = line.indexOf("//", index);
    if (slash >= 0 && (block < 0 || slash < block)) {
      code += line.slice(index, slash);
      break;
    }
    if (block < 0) {
      code += line.slice(index);
      break;
    }
    code += line.slice(index, block);
    inBlock = true;
    index = block + 2;
  }
  return { code, inBlock };
}

/**
 * A source file whose only code is the canonical `INCLUDE_ASM` placeholder is
 * a backlog stub: the function has not been decompiled yet. That is the normal
 * state of unfinished work, not a policy violation. A file that mixes
 * `INCLUDE_ASM` with any other code is *not* a stub — it is a partial fold,
 * and the scan must still see it.
 *
 * The per-function match gate and the controller's completion audit
 * deliberately do not use this: there, a remaining stub is a real failure.
 */
export function isPendingStub(source: string): boolean {
  let inBlock = false;
  const code: string[] = [];
  for (const line of source.split("\n")) {
    const stripped = stripComments(line, inBlock);
    inBlock = stripped.inBlock;
    const trimmed = stripped.code.trim();
    if (trimmed && !trimmed.startsWith("#")) code.push(trimmed);
  }
  return code.length === 1 && /^INCLUDE_ASM\s*\(.*\)\s*;?$/.test(code[0]);
}

/**
 * Physical lines joined into the logical lines C actually sees.
 *
 * A backslash continuation is not a line break, and every classification this
 * module makes needs the whole statement: whether an asm statement is an empty
 * memory barrier, a stack-pointer switch, or a symbol-renaming asm label is
 * decided by its template and its operand lists, and those are exactly what a
 * macro definition spreads across lines. Read physically, the opening
 * `__asm__ volatile(  \\` of any multi-line macro carries no template at all,
 * so every classifier says no and the construct is reported as ordinary
 * embedded assembly — a false positive that tells the author to allowlist
 * something the policy already permits.
 *
 * The reported line number stays the first physical line, which is where a
 * reader looks.
 */
function logicalLines(lines: string[]): Array<{ line: number; text: string }> {
  const out: Array<{ line: number; text: string }> = [];
  for (let index = 0; index < lines.length; index++) {
    const first = index;
    let text = lines[index]!;
    while (/\\\s*$/.test(text) && index + 1 < lines.length) {
      text = `${text.replace(/\\\s*$/, " ")}${lines[++index]!}`;
    }
    out.push({ line: first + 1, text });
  }
  return out;
}

function scanSourceFile(options: PolicyOptions, file: string, findings: PolicyFinding[]): void {
  const path = resolve(options.projectRoot, file);
  if (!existsSync(path)) return;
  let inBlock = false;
  for (const { line, text } of logicalLines(readFileSync(path, "utf8").split("\n"))) {
    const stripped = stripComments(text, inBlock);
    inBlock = stripped.inBlock;
    const violation = forbiddenLine(stripped.code, options.config, options.functionName, options.functionVram, options.functionContainer);
    if (violation) {
      findings.push({
        kind: violation.kind,
        file: normalizedPath(relative(options.projectRoot, path)),
        line,
        message: violation.message,
        text: text.trim(),
      });
    }
  }
}

/**
 * Attribute an added line to the function whose file it is in. Using the single
 * top-level `functionName` attributes every file to one function, and in a
 * repo-wide sweep that name is `undefined` — so no allowlist entry could ever
 * apply to a patch-added line, and an allowlisted construct failed the gate the
 * first time its own file was touched.
 */
/**
 * Only compiled translation units carry the construct ban: `src/**.c` and the
 * headers they include (where the narrow asm-label exception lives). A note or
 * a retro quoting `__asm__` is documentation — policing it would make the
 * repository unable to write down the very thing the policy is about.
 */
function policesConstructs(file: string): boolean {
  const path = normalizedPath(file);
  return /^src\/.*\.c$/.test(path) || /^include\/.*\.h$/.test(path);
}

/**
 * The function a source path names.
 *
 * The basename, not the path tail: `src/<name>.c` is the executable's layout
 * and `src/overlays/<id>/<name>.c` an overlay's, and reading the tail as a name
 * produced `overlays/ovl_11/ovl_11_func_800BD160`, which matched no allowlist
 * key and no call-graph entry. A directory below `src/` is the container's, so
 * it is the fallback when the caller supplied no container map.
 */
function sourceIdentity(file: string): { name: string; container?: string } | undefined {
  const match = normalizedPath(file).match(/^src\/(?:(.*)\/)?([^/]+)\.c$/);
  if (!match) return undefined;
  const directory = match[1];
  const container = directory ? directory.split("/").at(-1) : undefined;
  return container ? { name: match[2]!, container } : { name: match[2]! };
}

function patchScope(options: PolicyOptions, file: string): { name?: string; vram?: string; container?: string } {
  const identity = sourceIdentity(file);
  const name = identity?.name ?? options.functionName;
  if (!name) return {};
  const vram = options.functionVrams?.[name]
    ?? (name === options.functionName ? options.functionVram : undefined);
  const container = options.functionContainers?.[name]
    ?? (name === options.functionName ? options.functionContainer : undefined)
    ?? identity?.container;
  return container ? { name, vram, container } : { name, vram };
}

function scanAddedPatch(options: PolicyOptions): PolicyFinding[] {
  if (!options.patch) return [];
  const findings: PolicyFinding[] = [];
  let file = "";
  let scope: ReturnType<typeof patchScope> = {};
  let newLine = 0;
  for (const line of options.patch.split("\n")) {
    const fileMatch = line.match(/^\+\+\+ b\/(.+)$/);
    if (fileMatch) {
      file = fileMatch[1];
      scope = patchScope(options, file);
      continue;
    }
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)/);
    if (hunk) {
      newLine = Number.parseInt(hunk[1], 10);
      continue;
    }
    if (line.startsWith("+") && !line.startsWith("+++")) {
      const text = line.slice(1);
      const trimmed = text.trim();
      const commentOnly = trimmed.startsWith("/*") || trimmed.startsWith("*") || trimmed.startsWith("//");
      const violation = commentOnly || !policesConstructs(file)
        ? undefined
        : forbiddenLine(text, options.config, scope.name, scope.vram, scope.container);
      if (violation) findings.push({ kind: violation.kind, file, line: newLine, message: violation.message, text: text.trim() });
      /* A CC1FLAGS_ line names the stem it overrides, so the allowlist lookup
       * keys on that stem rather than on the patch scope. The scope is empty
       * whenever the caller audits the repo rather than one function, and
       * keying on it there reported an allowlisted override as a violation. */
      const overrideStem = file === "configs/flag_overrides.mk"
        ? text.match(/^CC1FLAGS_(\S+?)\s*:?=/)?.[1]
        : undefined;
      if (overrideStem) {
        const overrideVram = options.functionVrams?.[overrideStem]
          ?? (overrideStem === options.functionName ? options.functionVram : undefined);
        const overrideContainer = options.functionContainers?.[overrideStem]
          ?? (overrideStem === options.functionName ? options.functionContainer : undefined);
        if (!allowlisted(options.config, overrideStem, overrideVram, overrideContainer, "flag-override")) {
          findings.push({
            kind: "flag-override",
            file,
            line: newLine,
            message: "New per-function compiler flag overrides are forbidden",
            text: text.trim(),
          });
        }
      }
      newLine++;
    } else if (!line.startsWith("-") && !line.startsWith("\\")) {
      newLine++;
    }
  }
  return findings;
}

/**
 * Where a function's translation unit lives.
 *
 * The call graph is the authority and supplies the path outright. `src/<name>.c`
 * is the fallback for a caller that has no graph — the executable's layout, and
 * the only one that can be assumed without one.
 */
function sourceFileOf(options: PolicyOptions, name: string): string {
  return options.functionSources?.[name] ?? `src/${name}.c`;
}

/**
 * One construct, one finding.
 *
 * The file scan and the patch scan both report a construct in a newly written
 * file, because a new file is entirely new lines. Reporting it twice makes a
 * park note read as two violations and a review message ask about a construct
 * that appears once — and where a reviewer counts findings to judge severity,
 * it doubles the count.
 */
function dedupeFindings(findings: PolicyFinding[]): PolicyFinding[] {
  const seen = new Set<string>();
  const out: PolicyFinding[] = [];
  for (const finding of findings) {
    const key = `${finding.kind}\u0000${finding.file}\u0000${finding.line ?? ""}\u0000${finding.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(finding);
  }
  return out;
}

export function checkSourcePolicy(options: PolicyOptions): SourcePolicyResult {
  const changedFiles = [...new Set((options.changedFiles ?? []).map(normalizedPath))].sort();
  const outOfScopeFiles = changedFiles.filter((file) => !withinAllowedRoots(options.config, file));
  const hardFailures: PolicyFinding[] = outOfScopeFiles.map((file) => ({
    kind: "out-of-scope",
    file,
    message: "Worker modified a path outside the configured integration roots",
  }));

  const scanNames = options.scanFunctions ?? (options.functionName ? [options.functionName] : []);
  for (const name of scanNames) {
    scanSourceFile(
      {
        ...options,
        functionName: name,
        functionVram: options.functionVrams?.[name] ?? (name === options.functionName ? options.functionVram : undefined),
        functionContainer: options.functionContainers?.[name] ?? (name === options.functionName ? options.functionContainer : undefined),
      },
      sourceFileOf(options, name),
      hardFailures,
    );
  }

  const overrides = resolve(options.projectRoot, "configs", "flag_overrides.mk");
  if (existsSync(overrides)) {
    const lines = readFileSync(overrides, "utf8").split("\n");
    const names = options.functionName ? [options.functionName] : scanNames;
    for (const name of names) {
      const vram = options.functionVrams?.[name] ?? (name === options.functionName ? options.functionVram : undefined);
      const container = options.functionContainers?.[name] ?? (name === options.functionName ? options.functionContainer : undefined);
      if (allowlisted(options.config, name, vram, container, "flag-override")) continue;
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const index = lines.findIndex((line) => new RegExp(`^CC1FLAGS_${escaped}\\s*:?=`).test(line));
      if (index >= 0) {
        hardFailures.push({
          kind: "flag-override",
          file: "configs/flag_overrides.mk",
          line: index + 1,
          message: "Per-function compiler flag override is not allowlisted",
          text: lines[index].trim(),
        });
      }
    }
  }

  const newlyAddedForbiddenConstructs = scanAddedPatch(options);
  hardFailures.push(...newlyAddedForbiddenConstructs);

  return {
    pass: hardFailures.length === 0,
    hardFailures: dedupeFindings(hardFailures),
    warnings: [],
    changedFiles,
    outOfScopeFiles,
    newlyAddedForbiddenConstructs,
  };
}
