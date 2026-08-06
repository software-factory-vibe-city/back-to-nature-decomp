#!/usr/bin/env npx tsx
/**
 * compilerSource.ts — search the source of the compiler that builds this project.
 *
 * The vendored tree (tools/vendor/gcc/<version>) is the exact source cc1 is
 * built from, so it answers pass-level questions directly instead of by
 * experiment. The version comes from the Makefile's GCC_VERSION unless
 * --version names another vendored one. The two lemmas that closed func_80016C08 came from reading
 * gcse.c, local-alloc.c and reload1.c; this makes that reading cheap and
 * citable.
 *
 * Usage:
 *   npx tsx tools/agent/compilerSource.ts verify            [--version 2.8.1]
 *   npx tsx tools/agent/compilerSource.ts def   <name>
 *   npx tsx tools/agent/compilerSource.ts body  <name> [--kind function|macro|…]
 *   npx tsx tools/agent/compilerSource.ts refs  <name> [--limit N] [--file glob]
 *   npx tsx tools/agent/compilerSource.ts pass  <.gcse|gcse|lreg|greg|sched2|…>
 *   npx tsx tools/agent/compilerSource.ts pattern <movsi_internal2>
 *   npx tsx tools/agent/compilerSource.ts grep  <regex> [--file glob] [--limit N]
 *   npx tsx tools/agent/compilerSource.ts health
 *
 * Add --json to any query for the machine-readable form.
 */

import { loadIndex, loadPin, verifyTree, vendoredVersions, resolveVersion, type Definition } from "./compiler-source/index.js";
import {
  definitionText, findDefinitions, findDumpPass, findPatterns, grep,
  patternText, references, enclosingDefinition,
} from "./compiler-source/query.js";

const argv = process.argv.slice(2);
const json = argv.includes("--json");
const positional = argv.filter((argument) => !argument.startsWith("--"));
const command = positional[0];
const subject = positional[1];

function option(name: string): string | undefined {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1] : undefined;
}
const limit = Number(option("limit") ?? 40);
const fileGlob = option("file");
const version = option("version");

function emit(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

/** Scope note printed with every count, so empty never reads as "not in GCC". */
function scopeNote(): string {
  const resolved = resolveVersion(version);
  const pin = loadPin(resolved);
  return `scope: GCC ${resolved} (${pin.tree.files} files, complete for cc1). ` +
    `Excluded: ${pin.excluded.length} sets — see tools/vendor/gcc/${resolved}/pin.json.`;
}

function healthNote(): string {
  const index = loadIndex(version);
  const failed = index.health.filter((entry) => !entry.parsed);
  const broken = index.health.filter((entry) => entry.parsed && entry.errorNodes > 0);
  if (failed.length === 0 && broken.length === 0) return "";
  return `note: ${failed.length} file(s) did not parse and ${broken.length} parsed with error nodes; ` +
    "run `compilerSource.ts health` before concluding a name is absent.";
}

function matchesFile(file: string): boolean {
  return !fileGlob || file.includes(fileGlob);
}

function printDefinition(definition: Definition): void {
  console.log(`${definition.file}:${definition.line}-${definition.endLine}  [${definition.kind}] ${definition.name}`);
}

function usage(): never {
  console.error(
    "Usage: compilerSource.ts <verify|def|body|refs|pass|pattern|grep|health> [subject] [--version V] [--json]",
  );
  process.exit(1);
}

/* Resolution and drift failures are operator errors with actionable messages
 * (which versions are vendored, what the Makefile says). A stack trace buries
 * them, so report the message and exit. */
try {
  run();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function run(): void {
switch (command) {
  case "verify": {
    const result = verifyTree(version);
    if (json) { emit(result); break; }
    console.log(`GCC ${result.version}: ${result.files} files, tree sha256 ${result.actual}`);
    console.log(`vendored versions: ${vendoredVersions().join(", ") || "none"}`);
    console.log(result.ok
      ? "VERIFIED: matches pin.json; this is the source cc1 was built from."
      : `DRIFT: pin.json expects ${result.expected} over ${result.expectedFiles} files. Queries will refuse.`);
    if (!result.ok) process.exitCode = 1;
    break;
  }

  case "health": {
    const index = loadIndex(version);
    const failed = index.health.filter((entry) => !entry.parsed);
    const broken = index.health.filter((entry) => entry.parsed && entry.errorNodes > 0)
      .sort((left, right) => right.errorNodes - left.errorNodes);
    if (json) { emit({ files: index.fileCount, definitions: index.definitions.length, failed, broken }); break; }
    console.log(`GCC ${index.version}: ${index.fileCount} files indexed; ${index.definitions.length} definitions, ` +
      `${index.patterns.length} machine-description patterns, ${index.dumpPasses.length} dump sites.`);
    console.log(`${failed.length} file(s) failed to parse.`);
    for (const entry of failed) console.log(`  UNPARSED ${entry.file}`);
    console.log(`${broken.length} file(s) parsed with error nodes (definitions in those regions may be missing):`);
    for (const entry of broken.slice(0, limit)) console.log(`  ${entry.errorNodes.toString().padStart(5)}  ${entry.file}`);
    if (broken.length > limit) console.log(`  … ${broken.length - limit} more`);
    break;
  }

  case "def": {
    if (!subject) usage();
    const index = loadIndex(version);
    const found = findDefinitions(index, subject).filter((definition) => matchesFile(definition.file));
    if (json) { emit(found); break; }
    for (const definition of found) printDefinition(definition);
    console.log(`\n${found.length} definition(s). ${scopeNote()}`);
    const note = healthNote();
    if (note) console.log(note);
    break;
  }

  case "body": {
    if (!subject) usage();
    const index = loadIndex(version);
    const kind = option("kind");
    const found = findDefinitions(index, subject)
      .filter((definition) => matchesFile(definition.file) && (!kind || definition.kind === kind));
    if (json) { emit(found.map((definition) => ({ ...definition, text: definitionText(index, definition) }))); break; }
    if (found.length === 0) {
      console.log(`no definition of ${subject}. ${scopeNote()}`);
      const note = healthNote();
      if (note) console.log(note);
      break;
    }
    for (const definition of found) {
      console.log(`--- ${definition.file}:${definition.line} [${definition.kind}] ---`);
      console.log(definitionText(index, definition));
      console.log();
    }
    break;
  }

  case "refs": {
    if (!subject) usage();
    const index = loadIndex(version);
    const found = references(index, subject).filter((reference) => matchesFile(reference.file));
    if (json) { emit(found); break; }
    for (const reference of found.slice(0, limit)) {
      const tag = reference.context === "macro-body" ? " (macro body)" : "";
      console.log(`${reference.file}:${reference.line}${tag}  ${reference.text}`);
    }
    if (found.length > limit) console.log(`… ${found.length - limit} more (--limit)`);
    console.log(`\n${found.length} reference(s), comments and string literals excluded. ${scopeNote()}`);
    break;
  }

  case "pass": {
    if (!subject) usage();
    const index = loadIndex(version);
    const found = findDumpPass(index, subject);
    if (json) { emit(found); break; }
    if (found.length === 0) {
      console.log(`no open_dump_file(".${subject.replace(/^\./, "")}") site in toplev.c. ${scopeNote()}`);
      break;
    }
    /* RTL accessors (NEXT_INSN, GET_CODE, PATTERN) are macros, not passes.
     * The index already knows which names have a function definition, so the
     * distinction is read from the source rather than from a stop-list. */
    const definitionOf = (name: string): Definition | undefined =>
      findDefinitions(index, name).find((definition) => definition.kind === "function");
    for (const pass of found) {
      const enclosing = enclosingDefinition(index, pass.file, pass.line);
      console.log(`.${pass.suffix}  opened ${pass.file}:${pass.line}` +
        (pass.closeLine ? `, RTL written at close ${pass.file}:${pass.closeLine}` : "") +
        (enclosing ? `, in ${enclosing.name}()` : ""));
      if (pass.guards.length > 0) console.log(`  emitted when: ${pass.guards.join(" && ")}`);
      const show = (label: string, calls: Array<{ name: string; line: number }>): void => {
        const resolved = calls.map((call) => ({ call, definition: definitionOf(call.name) }));
        const passes = resolved.filter((entry) => entry.definition);
        if (passes.length === 0) return;
        console.log(`  ${label}`);
        for (const { call, definition } of passes) {
          console.log(`    ${call.name}  (${pass.file}:${call.line}) -> ${definition!.file}:${definition!.line}`);
        }
        const macros = resolved.length - passes.length;
        if (macros > 0) console.log(`    (${macros} RTL accessor macro(s) not shown)`);
      };
      show("dump shows state after:", pass.writtenAfter);
      show("last passes before the open:", pass.stateEntering);
      console.log();
    }
    console.log("Read from toplev.c's own open/close sites; there is no hardcoded pass table.");
    break;
  }

  case "pattern": {
    if (!subject) usage();
    const index = loadIndex(version);
    const found = findPatterns(index, subject);
    if (json) { emit(found.map((pattern) => ({ ...pattern, text: patternText(index, pattern) }))); break; }
    if (found.length === 0) {
      const near = index.patterns.filter((pattern) => pattern.name.includes(subject)).slice(0, 10);
      console.log(`no pattern named "${subject}".` + (near.length ? ` Similar: ${near.map((p) => p.name).join(", ")}` : ""));
      break;
    }
    for (const pattern of found) {
      console.log(`--- ${pattern.file}:${pattern.line} [${pattern.form}] ---`);
      console.log(patternText(index, pattern));
      console.log();
    }
    break;
  }

  case "grep": {
    if (!subject) usage();
    const index = loadIndex(version);
    const scope = fileGlob ? index.health.filter((entry) => matchesFile(entry.file)).map((entry) => entry.file) : undefined;
    const found = grep(index, new RegExp(subject), scope);
    if (json) { emit(found); break; }
    for (const hit of found.slice(0, limit)) console.log(`${hit.file}:${hit.line}  ${hit.text}`);
    if (found.length > limit) console.log(`… ${found.length - limit} more (--limit)`);
    console.log(`\n${found.length} line(s). ${scopeNote()}`);
    break;
  }

  default:
    usage();
}
}
