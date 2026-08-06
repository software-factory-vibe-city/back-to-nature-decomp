import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TOOL_SPECS } from "./diagnostics.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../../../..");

/**
 * The project ran for months with two tiers: tools registered as `psx_*`, and
 * tools reachable only as `npx tsx` lines buried in a skill. The second tier is
 * invisible to anything that reads the tool list, which is how a diagnostic
 * gets built and then never used. This test is the invariant that keeps the
 * split from coming back: every CLI under tools/agent is registered somewhere.
 */
function commandLineTools(): string[] {
  return readdirSync(join(ROOT, "tools/agent"))
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
    .filter((file) => readFileSync(join(ROOT, "tools/agent", file), "utf8").includes("process.argv"))
    .map((file) => file.replace(/\.ts$/, ""))
    .sort();
}

/** Scripts referenced by the hand-written one-tool-per-file wrappers. */
function individuallyRegistered(): Set<string> {
  const scripts = new Set<string>();
  for (const file of readdirSync(HERE)) {
    if (!file.endsWith(".ts") || file.endsWith(".test.ts") || file === "diagnostics.ts") continue;
    const text = readFileSync(join(HERE, file), "utf8");
    for (const match of text.matchAll(/tools\/agent\/([A-Za-z0-9_-]+)\.ts/g)) scripts.add(match[1]!);
  }
  return scripts;
}

test("every tools/agent CLI is registered as a Pi tool", () => {
  const registered = individuallyRegistered();
  for (const spec of TOOL_SPECS) registered.add(spec.script.replace(/\.ts$/, ""));

  const missing = commandLineTools().filter((name) => !registered.has(name));
  assert.deepEqual(missing, [],
    `unregistered CLI(s): ${missing.join(", ")}. Add an entry to TOOL_SPECS in ` +
    "diagnostics.ts, or a dedicated tool file — a CLI that is not a tool is invisible.");
});

test("tool names and backing scripts are unique", () => {
  const names = TOOL_SPECS.map((spec) => spec.name);
  const scripts = TOOL_SPECS.map((spec) => spec.script);
  assert.equal(new Set(names).size, names.length, `duplicate tool name: ${names.join(", ")}`);
  assert.equal(new Set(scripts).size, scripts.length, `duplicate script: ${scripts.join(", ")}`);
  for (const name of names) assert.match(name, /^psx_[a-z0-9_]+$/, `${name} is not a psx_ tool name`);
});

test("a tool's subcommands stay parameters of that tool", () => {
  /* One CLI, one tool. compilerSource has eight commands and is one tool; if
   * that ever becomes eight tools this fails, which is the intent. */
  const compilerSource = TOOL_SPECS.filter((spec) => spec.script === "compilerSource.ts");
  assert.equal(compilerSource.length, 1);
  assert.ok(JSON.stringify(compilerSource[0]!.parameters).includes("command"),
    "compilerSource exposes its subcommand as a parameter");
});
