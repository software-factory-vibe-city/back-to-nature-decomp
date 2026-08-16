import { strict as assert } from "node:assert";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { UNEXPOSED_CLIS } from "../../.pi/extensions/psx-decomp/tools/diagnostics.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");

/**
 * A tool call must report the state of the tree now.
 *
 * Three patterns break that, and all three shipped. A tool read an artifact
 * only `make` writes and reported it as the current state; a tool picked the
 * newest run by mtime and analysed whichever one happened to be last on disk;
 * a tool refused to work until the caller had run a different tool, naming a
 * path rather than the producer. The first cost a day of iteration against a
 * stale object, the third left an entire forensic axis unexercised.
 *
 * These tests are the guard. Each failure message says what to do instead,
 * because the fix is always the same shape: produce the input, or fingerprint
 * it — never assume a caller sequenced anything.
 */

interface SourceFile {
  path: string;
  relative: string;
  text: string;
}

function agentSources(): SourceFile[] {
  const files: SourceFile[] = [];
  const visit = (directory: string): void => {
    for (const name of readdirSync(directory).sort()) {
      const path = join(directory, name);
      if (statSync(path).isDirectory()) {
        visit(path);
        continue;
      }
      if (!name.endsWith(".ts") || name.endsWith(".test.ts")) continue;
      files.push({ path, relative: path.slice(ROOT.length + 1), text: readFileSync(path, "utf8") });
    }
  };
  visit(join(ROOT, "tools/agent"));
  return files;
}

const SOURCES = agentSources();

/** Lines outside block comments — a pattern named in prose is documentation. */
function codeLines(text: string): Array<{ line: string; number: number }> {
  const result: Array<{ line: string; number: number }> = [];
  let inBlockComment = false;
  text.split("\n").forEach((line, index) => {
    const trimmed = line.trim();
    if (inBlockComment) {
      if (trimmed.includes("*/")) inBlockComment = false;
      return;
    }
    if (trimmed.startsWith("/*")) {
      if (!trimmed.includes("*/")) inBlockComment = true;
      return;
    }
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;
    result.push({ line, number: index + 1 });
  });
  return result;
}

function findings(predicate: (line: string) => boolean): string[] {
  const hits: string[] = [];
  for (const file of SOURCES) {
    for (const { line, number } of codeLines(file.text)) {
      if (predicate(line)) hits.push(`${file.relative}:${number}: ${line.trim()}`);
    }
  }
  return hits;
}

test("no tool reads the object only `make` writes", () => {
  /* `build/src/<fn>.c.o` is written by the build, not by any tool. Reading it
   * reports the last `make`, which is a different question from the one every
   * caller is asking. Compile the source instead — it costs under a second. */
  const hits = findings((line) => /build\/src["'`/]/.test(line) && !/writeFile|mkdir/.test(line));
  assert.deepEqual(hits, [],
    "read the source and compile it (see pipeline-reversal/reverse.ts ensureCandidateObject) " +
    "rather than reading build/src, which only `make` writes:\n" + hits.join("\n"));
});

test("no tool picks an input by modification time", () => {
  /* mtime ordering answers "which ran last", never "which describes this
   * source". Select by fingerprint; `ensureArtifact` does it for you. */
  const hits = findings((line) => /mtimeMs|\.mtime\b|birthtime/.test(line));
  assert.deepEqual(hits, [],
    "select an artifact by provenance fingerprint, not by mtime — see tools/agent/provenance.ts:\n" +
    hits.join("\n"));
});

test("no tool tells its caller to run another tool first", () => {
  /* A prerequisite the caller has to satisfy is state the tool is carrying in
   * the caller's head. Produce the input instead; see compiler-oracle/ensure.ts.
   *
   * CLIs in UNEXPOSED_CLIS are exempt: no agent can reach them, and each one
   * already carries a written reason for staying out of the tool list. The
   * exemption is deliberately tied to that list rather than to a second one
   * here, so retiring a CLI and excusing it stay the same decision. */
  const exempt = new Set(Object.keys(UNEXPOSED_CLIS).map((name) => `tools/agent/${name}.ts`));
  const hits = findings((line) =>
    /(run|call)\s+\S*(\.ts|_[a-z]+)\s+first/i.test(line)
    || /\bMissing build\//.test(line))
    .filter((hit) => !exempt.has(hit.split(":")[0]!));
  assert.deepEqual(hits, [],
    "produce the missing input rather than asking the caller for it — see " +
    "tools/agent/compiler-oracle/ensure.ts:\n" + hits.join("\n"));
});

test("the tools that read a cached artifact check its provenance", () => {
  /* Every directory under build/ that a tool both writes and later reads is a
   * cache. A cache without a freshness check is a stale reading waiting to
   * happen, so each of these must reach the provenance layer. */
  const cacheReaders = [
    "tools/agent/pipeline-reversal/reverse.ts",
    "tools/agent/compiler-oracle/ensure.ts",
    "tools/agent/residualObjective.ts",
  ];
  for (const relative of cacheReaders) {
    const file = SOURCES.find((entry) => entry.relative === relative);
    assert.ok(file, `${relative} is missing — update this list if it moved`);
    assert.match(file!.text, /provenance\.js/,
      `${relative} reads a cached artifact and must import the provenance layer`);
  }
});

test("the residual objective names the source it measured", () => {
  /* The stale reading went unnoticed for a day because its row was labelled
   * `baseline`, which names no file and so always looks current. */
  const objective = SOURCES.find((entry) => entry.relative === "tools/agent/residualObjective.ts")!;
  assert.match(objective.text, /renderProvenance/,
    "residualObjective must print what each row was derived from");
  assert.doesNotMatch(objective.text, /score\(options\.functionName, "baseline"\)/,
    'the baseline row must be labelled with its source path, not the word "baseline"');
});
