import { strict as assert } from "node:assert";
import { test } from "node:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { enumerateHoistSites, hoistMasks, hoistVariant, invariantGlobals, invariantAddressLocals } from "./hoist-knob-sites.js";
import { analyzeCSource } from "./cSourceGuard.js";

const window = [{ block: 0, loop: "1..9", before: 8, startLine: 1, endLine: 1 }];
const globals = new Set(["G"]);
const make = (setup = "p = (T *) G;", reads = "x += p[i].f; x += ((T *) G)[i].f;") =>
  `typedef struct { int f; } T; extern T G[]; int f(void) { T *p; int i, x; ${setup} for(i=0;i<3;i++) { ${reads} } return x; }`;

test("the AST finds both address routes, not comment/string lookalikes, and rewrites complete C", () => {
  const source = make() + '\n/* p[i].f */ char *s = "p[i].f";';
  const sites = enumerateHoistSites(source, "f", window, globals);
  assert.equal(sites.length, 2);
  assert.deepEqual(sites.map((site) => site.current), ["local", "global"]);
  assert.ok(analyzeCSource(hoistVariant(source, sites, 3n)).parses);
  assert.match(hoistVariant(source, sites, 0n), /x \+= p\[i\]\.f; x \+= p\[i\]\.f/);
  assert.match(hoistVariant(source, sites, 3n), /char \*s = "p\[i\]\.f"/);
});

test("pure array addresses qualify, loaded global pointers do not; preprocessed macro effects are refused", () => {
  const arrays = invariantGlobals("extern T G[]; extern T *P; extern volatile T V[];");
  assert.deepEqual([...arrays], ["G"]);
  assert.equal(enumerateHoistSites(make("p = P;"), "f", window, arrays).length, 0);
  const raw = make();
  const cpp = make("p = (T *) next();");
  assert.equal(enumerateHoistSites(raw, "f", window, arrays, arrays, invariantAddressLocals(cpp, "f", arrays, arrays)).length, 0);
});

test("constant-offset address copies expose local and direct sites without changing the offset's units", () => {
  for (const rhs of ["(T *) ((char *) G + 8)", "G + (2 * 3)", "2 + G", "(G + 8) - 2", "(T *) ((char *) &G + 8UL)"]) {
    const source = make(`p = ${rhs};`, `x += p[i].f; x += (${rhs})[i].f;`);
    const proven = invariantAddressLocals(source, "f", globals, globals);
    assert.ok(proven.has("p"), rhs);
    const sites = enumerateHoistSites(source, "f", window, globals, globals, proven);
    assert.equal(sites.length, 2, rhs);
    assert.deepEqual(sites.map((site) => site.current), ["local", "global"]);
    assert.ok(sites.every((site) => site.global.includes(rhs)), "copy the expression, never fold byte/element offsets");
    assert.ok(analyzeCSource(hoistVariant(source, sites, 3n)).parses);
  }
});

test("variable/side-effecting offsets, pointer loads, VLA casts and expanded writes stay outside the address grammar", () => {
  for (const rhs of ["(T *) ((char *) G + i)", "G + next()", "P + 8", "(T *) 0x80010000", "(T *) ((char *) G + 1.5)", "(T *) ((int (*)[i]) G + 1)"]) {
    const source = make(`p = ${rhs};`);
    assert.equal(invariantAddressLocals(source, "f", globals, globals).has("p"), false, rhs);
    assert.equal(enumerateHoistSites(source, "f", window, globals).length, 0, rhs);
  }
  const raw = make("p = (T *) ((char *) G + 8);", "ADVANCE(p); x += p[i].f;");
  for (const expanded of [
    raw.replace("ADVANCE(p)", "(p)++"), raw.replace("ADVANCE(p)", "escape(&(p))"),
    raw.replace("ADVANCE(p)", "(p) = (T *) G"), raw.replace("T *p;", "T *p; T G[3];"),
  ]) {
    const proven = invariantAddressLocals(expanded, "f", globals, globals);
    assert.equal(proven.has("p"), false);
    assert.equal(enumerateHoistSites(raw, "f", window, globals, globals, proven).length, 0);
  }
});

const hostCompilerAvailable = (() => { try { execFileSync("cc", ["--version"], { stdio: "ignore" }); return true; } catch { return false; } })();
test("offset-route fixture backtests preserve executable results across every spelling", { skip: !hostCompilerAvailable }, () => {
  const dir = mkdtempSync(join(tmpdir(), "hoist-offset-backtest-"));
  try {
    for (const [fixture, rhs] of [
      ["byte-offset", "(unsigned short *) ((unsigned char *) G + 8)"],
      ["element-offset", "G + (2 * 3)"],
      ["nested-subtraction", "(unsigned short *) ((unsigned char *) (G + 8) - 4)"],
    ]) {
      const source = `static unsigned short G[64] = { 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16 };
int f(void) { unsigned short *p; int i, sum; p = ${rhs}; (void) p; sum = 0;
for (i = 0; i < 3; i++) { sum += p[i]; sum += (${rhs})[i + 1]; } return sum; }
#include <stdio.h>
int main(void) { printf("%d\\n", f()); return 0; }
`;
      const arrays = invariantGlobals(source), objects = invariantGlobals(source, true);
      const sites = enumerateHoistSites(source, "f", [{ ...window[0]!, startLine: 3, endLine: 3 }], arrays, objects,
        invariantAddressLocals(source, "f", arrays, objects));
      assert.equal(sites.length, 2, fixture);
      const baseline = join(dir, `${fixture}-original`);
      writeFileSync(`${baseline}.c`, source);
      execFileSync("cc", ["-std=c89", "-O2", "-Wall", "-Werror", `${baseline}.c`, "-o", baseline]);
      const expected = execFileSync(baseline, { encoding: "utf8" });
      for (const mask of hoistMasks(sites.length, 64).masks) {
        const path = join(dir, `${fixture}-${mask}.c`), binary = join(dir, `${fixture}-${mask}`);
        writeFileSync(path, hoistVariant(source, sites, mask));
        execFileSync("cc", ["-std=c89", "-O2", "-Wall", "-Werror", path, "-o", binary]);
        const result = execFileSync(binary, { encoding: "utf8" });
        assert.equal(result, expected, `${fixture}, mask ${mask}`);
      }
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("implicit assignment conversions stay explicit on the direct route", () => {
  const source = make("p = (char *) G;");
  const sites = enumerateHoistSites(source, "f", window, globals);
  assert.ok(sites[0]!.global.includes("(T *)"), "direct indexing keeps the local's pointee type");
});

test("reassignment, update, shadowing, address escape and conditional binding are not licensed", () => {
  for (const source of [
    make("p = (T *) G; p = (T *) G;"),
    make("p = (T *) G;", "p++; x += p[i].f;"),
    make("p = (T *) G;", "(p)++; x += p[i].f;"),
    make("p = (T *) G; (p) = (T *) G;"),
    make("p = (T *) G;", "escape(&p); x += p[i].f;"),
    make("p = (T *) G;", "escape(&(p)); x += p[i].f;"),
    make().replace("T *p;", "T *p; T G[3];"),
    make("p = (T *) G;", "{ T G[3]; x += ((T *) G)[i].f; } x += p[i].f;"),
    make("p = (T *) G;", "{ T *p; x += p[i].f; }"),
    make().replace("x += p[i].f;", "\n#if X\nx += p[i].f;\n#endif\n"),
    make().replace("p = (T *) G;", "\n#define G next()\np = (T *) G;"),
    make().replace("T *p;", "T *volatile p;"),
  ]) assert.equal(enumerateHoistSites(source, "f", [{ ...window[0]!, endLine: source.split("\n").length }], globals).length, 0);
  assert.throws(() => enumerateHoistSites("void f( {", "f", window, globals), /does not parse/);
});

test("the final condition's controlled read belongs to the window, later independent reads do not", () => {
  const source = `typedef struct { int f; } T; extern T G[];
int f(void) { T *p; int i,x; p = (T *) G;
for(i=0;i<3;i++) {
 if(i<8) x += p[i].f;
 else if(i==17) {
  x += p[0].f;
 }
 x += p[1].f;
} return x; }`;
  const sites = enumerateHoistSites(source, "f", [{ ...window[0]!, startLine: 4, endLine: 5 }], globals);
  assert.deepEqual(sites.map((site) => site.line), [4, 6]);
});

test("direct object fields through a single address copy have two spellings", () => {
  const source = "typedef struct { int f; } T; extern T G; int f(void) { T *p; int i,x; p=&G; for(i=0;i<3;i++) { x+=G.f; x+=p->f; } return x; }";
  const sites = enumerateHoistSites(source, "f", window, new Set(), new Set(["G"]));
  assert.equal(sites.length, 2);
  assert.match(hoistVariant(source, sites, 0n), /\(\*p\)\.f/);
  assert.ok(analyzeCSource(hoistVariant(source, sites, 3n)).parses);
});

test("small products are exhaustive, large products sampled with explicit fraction and bounded unique masks", () => {
  const full = hoistMasks(4, 64);
  assert.equal(full.total, 16n); assert.equal(full.exhaustive, true); assert.equal(full.masks.length, 16);
  const sampled = hoistMasks(80, 64);
  assert.equal(sampled.total, 1n << 80n); assert.equal(sampled.exhaustive, false);
  assert.equal(new Set(sampled.masks).size, 64); assert.equal(sampled.masks.at(-1), sampled.total - 1n);
  assert.throws(() => hoistMasks(4, 0), /positive/);
});
