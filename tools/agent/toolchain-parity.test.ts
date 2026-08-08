import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  ROOT,
  CC1_FLAGS,
  AS_FLAGS,
  CPP_FLAGS,
  configuredMaspsxFlags,
} from "./decompToolchain.js";

/**
 * The diagnostic tools must preprocess, compile and assemble exactly as the
 * build does. When the flags were hand-copied into each tool they drifted:
 * `-D_LANGUAGE_C` went into the Makefile and three tools kept the old set, so
 * every masked score came from a different translation unit than `make check`
 * produced -- and `make check`, reading only the Makefile, could not see it.
 *
 * Comparing the tools' flags against the Makefile is no longer a real test:
 * both sides derive from the same line, so it passes by construction. What can
 * still break is the parsing, and the discipline that keeps a single source.
 */
const ALL = { CC1_FLAGS, AS_FLAGS, CPP_FLAGS, MASPSX_FLAGS: configuredMaspsxFlags() };

test("toolchain parity: no Makefile expansion residue survives parsing", () => {
  for (const [name, flags] of Object.entries(ALL)) {
    for (const flag of flags) {
      assert.ok(!/[$()]/.test(flag), `${name} token ${JSON.stringify(flag)} carries $() residue`);
      assert.ok(flag.trim() === flag && flag !== "", `${name} has a blank or padded token`);
    }
  }
});

test("toolchain parity: flag sets are non-empty and well formed", () => {
  assert.ok(CC1_FLAGS.includes("-O2") && CC1_FLAGS.includes("-G8"), "cc1 flags look like the real set");
  assert.ok(CPP_FLAGS.includes("-lang-c"), "cpp flags look like the real set");
  assert.ok(AS_FLAGS.includes("-march=r3000"), "as flags look like the real set");
  assert.ok(configuredMaspsxFlags().includes("--run-assembler"), "maspsx flags look like the real set");
});

test("toolchain parity: include paths are absolute so tools can run anywhere", () => {
  for (const flags of [CPP_FLAGS, AS_FLAGS]) {
    for (const flag of flags.filter((f) => f.startsWith("-I"))) {
      assert.ok(flag.startsWith(`-I${ROOT}/`), `${flag} is not anchored to ROOT`);
    }
  }
});

/**
 * The values agreeing is not the property worth testing -- they agreed before
 * `-D_LANGUAGE_C` too. A tool that restates a flag set has already lost parity
 * even while the strings happen to match, so fail on the restatement itself.
 */
test("toolchain parity: no tool restates a flag set literally", () => {
  const offenders: string[] = [];
  const dir = join(ROOT, "tools/agent");
  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith(".ts") || entry === "decompToolchain.ts") continue;
    const text = readFileSync(join(dir, entry), "utf-8");
    for (const line of text.split("\n")) {
      if (/^\s*(export\s+)?const\s+\w*(CPP|CC1|AS|MASPSX)_?FLAGS\s*[:=]/.test(line) && /["'`]-/.test(line)) {
        offenders.push(`${entry}: ${line.trim().slice(0, 70)}`);
      }
    }
  }
  assert.deepEqual(offenders, [], "flag sets must come from decompToolchain, not be restated");
});

/**
 * The assembler flags drifted the same way the compiler flags did, and cost
 * more: every tool spelled out `--aspsx-version ... --dont-force-G0 ...`, so
 * when the build stopped passing `--dont-force-G0` the diagnostics would have
 * kept assembling under the old small-data rule and reported scores for a
 * translation unit the build no longer produces. Name the tokens, not just the
 * variable, because a literal maspsx invocation needs no named constant.
 */
test("toolchain parity: no tool spells out a maspsx flag", () => {
  const offenders: string[] = [];
  for (const dir of ["tools/agent", "tools/build"]) {
    const base = join(ROOT, dir);
    for (const entry of readdirSync(base)) {
      if (!entry.endsWith(".ts") || entry.endsWith(".test.ts")) continue;
      for (const line of readFileSync(join(base, entry), "utf-8").split("\n")) {
        if (/^\s*\*/.test(line.trim())) continue; /* prose, not an invocation */
        if (/["'`][^"'`]*--(aspsx-version|dont-force-G0|use-comm-section|run-assembler)/.test(line)) {
          offenders.push(`${dir}/${entry}: ${line.trim().slice(0, 70)}`);
        }
      }
    }
  }
  assert.deepEqual(offenders, [], "maspsx flags must come from the Makefile via configuredMaspsxFlags");
});
