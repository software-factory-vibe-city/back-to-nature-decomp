#!/usr/bin/env npx tsx
/**
 * checkDocReferences.ts — find references to repository files that do not exist.
 *
 * A comment or note that names a tool, config or document which has since been
 * deleted keeps reading as live guidance. Anything following it tries to use
 * machinery that is not there, fails to reconcile the instruction with the
 * build, and goes back to the prose to re-read the same dead reference. The
 * cost is not a wrong edit, it is an agent that never converges.
 *
 * Two reference kinds are recognised, and they are reported separately because
 * the evidence behind them differs:
 *
 *  - path: a repository-rooted path (`tools/build/foo.ts`, `configs/bar.txt`). doc-ref-ignore
 *    Its top-level component is a real directory in this repository, so the
 *    reference is unambiguously meant to resolve here. A missing one is proven
 *    stale.
 *  - basename: a bare filename with a source-like extension (`foo.ts`). It is
 *    reported only when NO file anywhere in the repository has that basename,
 *    which is the case where it cannot be a shorthand for a real file.
 *
 * Nothing here is specific to a game or a binary; the directory vocabulary is
 * read from the repository root at run time.
 *
 * Usage:
 *   npx tsx tools/diagnostics/checkDocReferences.ts [--json] [--all]
 *   npx tsx tools/diagnostics/checkDocReferences.ts --paths src/a.c,notes/b.md   (doc-ref-ignore)
 *
 * Exits non-zero when a stale reference is found, so it can gate a build. The
 * repository carries a backlog of stale references in historical notes, so gate
 * on `--paths` over what a change touched rather than on the whole tree.
 */

import { execFileSync } from "child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { dirname, join, relative, resolve } from "path";

const ROOT = new URL("../..", import.meta.url).pathname;

/** Extensions whose comments and prose are worth scanning. */
const SCANNED = new Set([".md", ".c", ".h", ".ts", ".mk"]);

/**
 * Directories excluded from both the scan and the file index.
 *
 * `build` and `extracted` are generated: a reference into them is a statement
 * about a build artifact, not about a checked-in file, and whether they exist
 * depends on which make targets have run. `vendor` is third-party. Treating
 * any of them as ground truth would make the check report the state of the
 * working tree rather than the state of the repository.
 */
const EXCLUDED = new Set(["node_modules", ".git", "build", "extracted", "vendor", "dist"]);

/** A source-like extension, for the bare-basename form. */
const BASENAME_EXTENSIONS = "ts|tsx|js|mjs|cjs|py|sh|mk|c|h|json|ya?ml";

/** Marker that exempts one line, for illustrative paths and deletion records. */
const SUPPRESSION = "doc-ref-ignore";

interface Reference {
  file: string;
  line: number;
  kind: "path" | "basename";
  reference: string;
  text: string;
}

function walk(directory: string, onFile: (absolute: string) => void): void {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && entry.name !== ".pi") continue;
    if (EXCLUDED.has(entry.name)) continue;
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute, onFile);
    else if (entry.isFile()) onFile(absolute);
  }
}

/**
 * Top-level directories that hold tracked files.
 *
 * A reference into a directory with nothing tracked under it — `build`,
 * `extracted`, a run-log directory — names generated state, so whether it
 * exists reports which make targets have run rather than whether the reference
 * is stale. Deciding this from tracked content rather than from ignore rules
 * matters: `.gitignore` here carries a `tools/build/*` rule whose files are
 * tracked anyway, and trusting the rule would have silently excused every
 * stale reference to a deleted build tool — the exact case this check exists
 * to catch.
 */
function trackedTopLevels(): Set<string> {
  const output = execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return new Set(output.split("\n").filter(Boolean).map((path) => path.split("/")[0]!));
}

/** Every checked-in file, by repository-relative path and by basename. */
function indexRepository(): { paths: Set<string>; basenames: Set<string> } {
  const paths = new Set<string>();
  const basenames = new Set<string>();
  walk(ROOT, (absolute) => {
    const path = relative(ROOT, absolute);
    paths.add(path);
    basenames.add(path.slice(path.lastIndexOf("/") + 1));
  });
  return { paths, basenames };
}

/** Top-level directories, which is the vocabulary a repository path can start with. */
function topLevelDirectories(): string[] {
  return readdirSync(ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !EXCLUDED.has(entry.name))
    .filter((entry) => !entry.name.startsWith(".") || entry.name === ".pi")
    .map((entry) => entry.name)
    .sort();
}

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * A stand-in rather than a real path, e.g. `src/FUNC.c` or `src/<name>.c`.
 *
 * Documentation writes these to describe a shape. An all-caps or bracketed
 * component is never a checked-in filename in this repository, so reporting it
 * would be reporting the prose's own notation back as a defect.
 */
function isPlaceholder(reference: string): boolean {
  return reference.split("/").some((part) => /[<>{}*]/.test(part) || /^[A-Z][A-Z0-9_]*(\.[A-Za-z]+)?$/.test(part));
}

export function findReferences(source: string, file: string, directories: string[]): Reference[] {
  const found: Reference[] = [];
  /* The extension must start with a letter: `build-gcc-2.95.2-psx` ends in a
   * version component, not a file type, and treating `.2` as an extension
   * invents a path that was never written. */
  const pathPattern = new RegExp(
    String.raw`\b(?:${directories.map(escape).join("|")})\/[A-Za-z0-9_./-]*[A-Za-z0-9_-]\.[A-Za-z][A-Za-z0-9]*`,
    "g",
  );
  const basenamePattern = new RegExp(String.raw`\b([A-Za-z_][A-Za-z0-9_-]*\.(?:${BASENAME_EXTENSIONS}))\b`, "g");
  const lines = source.split("\n");
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    /* Illustrative paths and records of a deletion are prose about references
     * rather than references. There is no way to tell them apart by shape, so
     * the line says so itself and stays greppable. */
    if (line.includes(SUPPRESSION)) continue;
    const seen = new Set<string>();
    for (const match of line.matchAll(pathPattern)) {
      seen.add(match[0]);
      if (isPlaceholder(match[0])) continue;
      found.push({ file, line: index + 1, kind: "path", reference: match[0], text: line.trim() });
    }
    for (const match of line.matchAll(basenamePattern)) {
      /* A basename already covered by a path reference on this line is the
       * same reference, not a second one. */
      if ([...seen].some((path) => path.endsWith(`/${match[1]}`))) continue;
      found.push({ file, line: index + 1, kind: "basename", reference: match[1]!, text: line.trim() });
    }
  }
  return found;
}

function main(): void {
  const json = process.argv.includes("--json");
  const all = process.argv.includes("--all");
  const pathsFlag = process.argv.indexOf("--paths");
  const only = pathsFlag === -1
    ? null
    : new Set((process.argv[pathsFlag + 1] ?? "").split(",").map((entry) => entry.trim()).filter(Boolean));
  const { paths, basenames } = indexRepository();
  const directories = topLevelDirectories();

  const candidates: Reference[] = [];
  let scanned = 0;
  let checked = 0;
  walk(ROOT, (absolute) => {
    const path = relative(ROOT, absolute);
    if (only && !only.has(path)) return;
    if (!SCANNED.has(path.slice(path.lastIndexOf(".")))) return;
    /* Test files name deliberately fictional paths as fixtures. */
    if (path.endsWith(".test.ts")) return;
    if (statSync(absolute).size > 4_000_000) return;
    scanned++;
    for (const reference of findReferences(readFileSync(absolute, "utf8"), path, directories)) {
      checked++;
      if (reference.kind === "basename") {
        if (!basenames.has(reference.reference)) candidates.push(reference);
        continue;
      }
      /* A path may be repository-rooted or relative to the file that names it —
       * `./tools/x.ts` inside an extension resolves against that extension (doc-ref-ignore). Only
       * a reference that resolves neither way is a candidate. */
      const fromRoot = join(ROOT, reference.reference);
      const fromFile = resolve(ROOT, dirname(path), reference.reference);
      if (paths.has(reference.reference) || existsSync(fromRoot) || existsSync(fromFile)) continue;
      candidates.push(reference);
    }
  });

  const tracked = trackedTopLevels();
  const stale = candidates.filter((reference) =>
    reference.kind === "basename" || tracked.has(reference.reference.split("/")[0]!));
  const shown = all ? stale : stale.filter((reference) => reference.kind === "path");
  if (json) {
    console.log(JSON.stringify({ scanned, checked, stale: shown }, null, 2));
  } else {
    console.log(`checkDocReferences: ${scanned} file(s), ${checked} reference(s), ${shown.length} stale`);
    for (const reference of shown) {
      console.log(`  ${reference.file}:${reference.line}: ${reference.reference} [${reference.kind}]`);
      console.log(`      ${reference.text.slice(0, 120)}`);
    }
    if (!all && stale.length > shown.length) {
      console.log(`\n${stale.length - shown.length} bare-basename reference(s) hidden; pass --all to include them.`);
    }
  }
  process.exit(shown.length > 0 ? 1 : 0);
}

if (process.argv[1]?.endsWith("checkDocReferences.ts")) main();
