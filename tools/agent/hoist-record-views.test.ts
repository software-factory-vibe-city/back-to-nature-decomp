import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { discoverRecordViews, measureViewExpressions, normalizeRecordViews } from "./hoist-record-views.js";
import { enumerateHoistSites, invariantGlobals, invariantAddressLocals, hoistMasks, hoistVariant } from "./hoist-knob-sites.js";
import { ROOT, configuredToolchainIdentity } from "./decompToolchain.js";

const available = (() => { try { return configuredToolchainIdentity().compiler.sha256.length > 0; } catch { return false; } })();
const hostAvailable = (() => { try { execFileSync("cc", ["--version"], { stdio: "ignore" }); return true; } catch { return false; } })();
function fixture(loop: "do" | "for" = "do", offset = "12") {
  const declarations = `typedef unsigned short Word;
typedef struct { Word value; Word unused[2]; } Cell;
typedef struct { char prefix[6]; Cell rows[6]; } FrameView;
typedef struct { char prefix[6]; Word first; char gap[4]; Word second; } FlatView;
static Word G[32] = { 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32 };
`;
  return declarations + `int f(void) {
    FlatView *base;
    Word *table;
    Word output[6];
    int i, total;
    base = (FlatView *) G;
    i = 0;
    table = (Word *) ((unsigned char *) G + ${offset});
    ${loop === "do" ? "do" : "for (i = 0; i < 6; i++)"} {
        if (i < 2) output[i] = table[i * 3 + 3];
        else if (i == 2) output[2] = base->first;
        else if (i < 5) output[i] = table[i * 3];
        else if (i == 5) output[5] = base->second;
        ${loop === "do" ? "i += 1;" : ""}
    }${loop === "do" ? " while (i < 6);" : ""}
    total = 0;
    for (i = 0; i < 6; i++) total += output[i];
    return total;
}
`;
}
function sites(source: string, cpp = source) {
  const arrays = invariantGlobals(cpp), objects = invariantGlobals(cpp, true);
  return enumerateHoistSites(source, "f", [{ block: 0, loop: "1..99", before: 99, startLine: 17, endLine: 18 }], arrays, objects,
    invariantAddressLocals(cpp, "f", arrays, objects));
}
function measured(source: string, directory: string) {
  const discovery = discoverRecordViews(source, source, "f");
  const values = measureViewExpressions("func_hoist_record_test", source, discovery.expressions, directory);
  return { discovery, values };
}

test("automatic record preparation uses measured offsets and guarded bounds, not type/field names", { skip: !available }, () => {
  const dir = mkdtempSync(join(ROOT, "build/hoist-view-test-"));
  try {
    for (const [i, source] of [fixture("do"), fixture("for"), fixture("do", "014")].entries()) {
      const { discovery, values } = measured(source, join(dir, String(i)));
      const prepared = normalizeRecordViews(source, source, "f", sites(source), discovery, values);
      assert.equal(prepared.length, 1);
      assert.equal(prepared[0]!.view.type, "FrameView");
      assert.equal(prepared[0]!.equalStores, 2);
      const { layout, reads } = prepared[0]!;
      assert.deepEqual(layout, { stride: 6, arrayOffset: 6, memberOffset: 0, count: 6 });
      for (const read of reads) {
        assert.equal(source.slice(read.start, read.end), read.before);
        assert.equal(read.byteAffine.a, layout.stride * read.recordIndex.a);
        assert.equal(read.byteAffine.b, layout.arrayOffset + layout.memberOffset + layout.stride * read.recordIndex.b);
      }
      assert.deepEqual(prepared[0]!.reads.map(read => [read.minIndex, read.maxIndex]), [[2, 3], [0, 0], [3, 5], [1, 1]]);
      assert.ok(prepared[0]!.source.includes("rows[i + 2].value"));
      assert.ok(prepared[0]!.source.includes("output[i]"));
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("ambiguous compatible record views are enumerated, not silently chosen", { skip: !available }, () => {
  const dir = mkdtempSync(join(ROOT, "build/hoist-view-ambiguity-"));
  try {
    const source = fixture().replace("static Word G", "typedef struct { char prefix[6]; Cell alternate[6]; } OtherView;\nstatic Word G");
    const { discovery, values } = measured(source, dir);
    const prepared = normalizeRecordViews(source, source, "f", sites(source), discovery, values);
    assert.deepEqual(prepared.map(value => value.view.type), ["FrameView", "OtherView"]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("wrong layout, insufficient bounds, counter escapes/shadowing and expanded mutations cannot license a view", { skip: !available }, () => {
  const dir = mkdtempSync(join(ROOT, "build/hoist-view-negative-"));
  try {
    const source = fixture(), { discovery, values } = measured(source, dir);
    for (const [expression, value] of [
      ["sizeof(Cell)", 4], ["(unsigned int) &(((FrameView *) 0)->rows)", 8],
      ["sizeof(((FrameView *) 0)->rows) / sizeof(Cell)", 5],
    ] as const) {
      const wrong = new Map(values); wrong.set(expression, value);
      assert.deepEqual(normalizeRecordViews(source, source, "f", sites(source), discovery, wrong), []);
    }
    for (const changed of [
      source.replace("i += 1;", "i += 2;"),
      source.replace("i += 1;", "i++; i++;"),
      source.replace("i = 0;", "i = 1;"),
      source.replace("i += 1;", "escape(&i); i += 1;"),
      source.replace("if (i < 2)", "{ int i; } if (i < 2)"),
      source.replace("i += 1;", "(i) += 2; i += 1;"),
      source.replace("i += 1;", "++(i); i += 1;"),
      source.replace("i = 0;", "i = 0; if (G[0]) i = 9;"),
      source.replace("i = 0;", "goto skip; i = 0; skip: ;"),
      source.replace("int i, total;", "typedef volatile int Counter; Counter i; int total;"),
    ]) assert.deepEqual(normalizeRecordViews(changed, changed, "f", sites(changed), discovery, values), []);
    for (const cpp of [source.replace("i += 1;", "i += 2;"), source.replace("base->first", "base->second"),
      source.replace("if (i < 2)", "if (i < 3)"), source.replace("i * 3 + 3", "i * 3 + 6")]) {
      assert.deepEqual(normalizeRecordViews(source, cpp, "f", sites(source, cpp), discovery, values), [],
        "preprocessed counter, guards and read addresses must agree");
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("prepared record views preserve executable results across every access-route choice", { skip: !available || !hostAvailable }, () => {
  const dir = mkdtempSync(join(ROOT, "build/hoist-view-execute-"));
  try {
    for (const [fixtureIndex, original] of [fixture("do"), fixture("for"), fixture("do", "014")].entries()) {
      const { discovery, values } = measured(original, join(dir, `measure-${fixtureIndex}`));
      const normalization = normalizeRecordViews(original, original, "f", sites(original), discovery, values)[0]!;
      const normalized = normalization.source;
      const cppSites = enumerateHoistSites(normalized, "f", [{ block: 0, loop: "1..99", before: 99, startLine: 19, endLine: 20 }],
        invariantGlobals(normalized), invariantGlobals(normalized, true), invariantAddressLocals(normalized, "f", invariantGlobals(normalized), invariantGlobals(normalized, true)));
      assert.equal(cppSites.length, 4);
      const execute = (source: string, name: string): string => {
        const path = join(dir, name);
        writeFileSync(`${path}.c`, source + "\n#include <stdio.h>\nint main(void) { printf(\"%d\\n\", f()); return 0; }\n");
        /* Kept original administrative aliases may be unused after normalization. */
        execFileSync("cc", ["-std=c89", "-O2", `${path}.c`, "-o", path]);
        return execFileSync(path, { encoding: "utf8" });
      };
      const expected = execute(original, `original-${fixtureIndex}`);
      for (const mask of hoistMasks(cppSites.length, 64).masks) assert.equal(execute(hoistVariant(normalized, cppSites, mask), `view-${fixtureIndex}-${mask}`), expected);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
