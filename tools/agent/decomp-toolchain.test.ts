import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  configuredAsFlagsForContainer,
  configuredCc1FlagsForContainer,
  containerForSymbol,
  containerKindForSymbol,
  parseImplicitDeclarationWarnings,
  resolveAsmSource,
  sourceDirFor,
  sourcePathFor,
} from "./decompToolchain.js";

test("extracts each undeclared callee once from cc1 -Wimplicit stderr", () => {
  const stderr = [
    "probe.c: In function `func_80022738':",
    "probe.c:4: warning: implicit declaration of function `SetVal8005E2BC'",
    "probe.c:5: warning: implicit declaration of function `SetVal8005E334'",
    "probe.c:7: warning: implicit declaration of function `SetVal8005E334'",
  ].join("\n");
  assert.deepEqual(parseImplicitDeclarationWarnings(stderr), [
    "SetVal8005E2BC",
    "SetVal8005E334",
  ]);
});

test("ignores other -Wimplicit forms and unrelated diagnostics", () => {
  const stderr = [
    "probe.c:3: warning: type defaults to `int' in declaration of `x'",
    "probe.c:9: warning: unused variable `p'",
    "",
  ].join("\n");
  assert.deepEqual(parseImplicitDeclarationWarnings(stderr), []);
});

test("empty stderr means every callee is declared", () => {
  assert.deepEqual(parseImplicitDeclarationWarnings(""), []);
});

test("a symbol's container comes from its own name", () => {
  /* An overlay's symbols carry their container id as a prefix and the
     executable's do not, so no caller ever has to name a container. */
  assert.equal(containerKindForSymbol("func_80011C24"), "exe");
  assert.equal(containerForSymbol("func_80011C24")?.id, "exe");
  assert.equal(containerKindForSymbol("ovl_31_func_800B82E8"), "overlay");
  assert.equal(containerForSymbol("ovl_31_func_800B82E8")?.id, "ovl_31");
  /* A name no container claims is the executable's, not an error: that is what
     a synthetic stem from a probe or a trace looks like. */
  assert.equal(containerKindForSymbol("probe_stem"), "exe");
});

test("source and assembly resolve into the symbol's own container", () => {
  assert.match(sourcePathFor("func_80011C24"), /\/src\/func_80011C24\.c$/);
  assert.match(sourcePathFor("ovl_31_func_800B82E8"), /\/src\/overlays\/ovl_31\/ovl_31_func_800B82E8\.c$/);
  assert.match(sourceDirFor("ovl_31_func_800B82E8"), /\/src\/overlays\/ovl_31$/);

  const asm = resolveAsmSource("ovl_31_func_800B8348");
  assert.ok(asm, "the overlay's original assembly should resolve");
  assert.match(asm!, /\/build\/ovl_31\//);
});

test("the small-data threshold is a per-container fact", () => {
  /* Overlay translation units were built -G0; the executable's -G8. Everything
     else in the set is shared, so the difference is swapped rather than
     restated — a second spelling of the flag list would drift. */
  const exe = configuredCc1FlagsForContainer("exe");
  const overlay = configuredCc1FlagsForContainer("overlay");
  assert.ok(exe.includes("-G8"));
  assert.ok(!overlay.includes("-G8"));
  assert.ok(overlay.includes("-G0"));
  assert.deepEqual(exe.filter((flag) => flag !== "-G8"), overlay.filter((flag) => flag !== "-G0"));

  assert.ok(configuredAsFlagsForContainer("overlay").includes("-G0"));
});
