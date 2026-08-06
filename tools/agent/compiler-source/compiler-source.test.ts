import { strict as assert } from "node:assert";
import { test } from "node:test";
import { loadIndex, scanMachineDescription, collectDumpPasses, verifyTree, resolveVersion, vendoredVersions } from "./index.js";
import { configuredGccVersion } from "../decompToolchain.js";
import { definitionText, findDefinitions, findDumpPass, findPatterns, referencesIn } from "./query.js";

/* The vendored tree is the source cc1 was built from. If it drifts, every
 * citation taken from it silently stops describing the real compiler. */
test("vendored tree matches its pin", () => {
  const result = verifyTree();
  assert.equal(result.version, configuredGccVersion(), "verify defaults to the configured version");
  assert.equal(result.ok, true, `tree hash ${result.actual} != pin ${result.expected}`);
});

/* Each of these is a claim a research note already cites. They are tests so a
 * reindex cannot quietly stop reproducing them. */
test("citations in the func_80016C08 note resolve", () => {
  const index = loadIndex();

  const wantToGcse = findDefinitions(index, "want_to_gcse_p").find((d) => d.kind === "function");
  assert.ok(wantToGcse, "want_to_gcse_p function definition");
  assert.equal(wantToGcse.file, "gcc/gcse.c");
  /* Section 19.5: "it rejects only REG/SUBREG/CONST_INT/CONST_DOUBLE/CALL". */
  const body = definitionText(index, wantToGcse);
  for (const code of ["REG", "SUBREG", "CONST_INT", "CONST_DOUBLE", "CALL"]) {
    assert.ok(new RegExp(`case ${code}:`).test(body), `${code} rejected in want_to_gcse_p`);
  }

  /* Section 12: the local-alloc priority formula. */
  const priority = findDefinitions(index, "QTY_CMP_PRI").find((d) => d.kind === "macro");
  assert.ok(priority, "QTY_CMP_PRI macro");
  assert.equal(priority.file, "gcc/local-alloc.c");

  /* Section 19.2: reload assigns stack slots through alter_reg. */
  const alterReg = findDefinitions(index, "alter_reg").find((d) => d.kind === "function");
  assert.ok(alterReg, "alter_reg function definition");
  assert.equal(alterReg.file, "gcc/reload1.c");

  /* Section 7.4: movsi_internal2 gives the destination a plain "=d". */
  const pattern = findPatterns(index, "movsi_internal2");
  assert.equal(pattern.length, 1);
  assert.equal(pattern[0]!.file, "gcc/config/mips/mips.md");
});

test("PROTO-style prototypes are not classified as variables", () => {
  const index = loadIndex();
  const kinds = findDefinitions(index, "want_to_gcse_p").map((d) => d.kind);
  assert.ok(kinds.includes("function"));
  assert.ok(!kinds.includes("variable"), `PROTO declaration misclassified: ${kinds.join(",")}`);
});

test("dump suffixes map to the passes that ran before the close", () => {
  const index = loadIndex();

  const gcse = findDumpPass(index, "gcse")[0];
  assert.ok(gcse, ".gcse dump site");
  assert.ok(gcse.guards.some((guard) => guard.includes("flag_gcse")), "flag_gcse guard");
  assert.ok(gcse.writtenAfter.some((call) => call.name === "gcse_main"), "gcse_main in the dumped span");

  /* .greg and .lreg have different syntactic shapes; both must come out right. */
  const greg = findDumpPass(index, "greg")[0];
  assert.ok(greg!.writtenAfter.some((call) => call.name === "reload"), "reload in the .greg span");

  const lreg = findDumpPass(index, "lreg")[0];
  assert.ok(lreg!.writtenAfter.every((call) => call.name !== "local_alloc"),
    ".lreg's own block runs no pass");
  assert.ok(lreg!.stateEntering.some((call) => call.name === "local_alloc"),
    "local_alloc precedes the .lreg open");
});

test("machine-description scanning balances parens across strings and comments", () => {
  const text = [
    '(define_insn "with_paren_in_string"',
    '  [(set (match_operand 0 "" ""))]',
    '  "a ) string with an unbalanced paren"',
    '  "* return \\"x)\\";"  ; a ) comment',
    '  [(set_attr "type" "move")])',
    '',
    '(define_expand "next_one"',
    '  [(set (match_operand 0 "" ""))]',
    '  ""',
    '  "")',
  ].join("\n");
  const found = scanMachineDescription(text, "test.md");
  assert.equal(found.length, 2);
  assert.equal(found[0]!.name, "with_paren_in_string");
  assert.equal(found[0]!.form, "define_insn");
  assert.ok(text.slice(found[0]!.start, found[0]!.end).endsWith("])"),
    "first form ends at its own closing paren, not inside the string");
  assert.equal(found[1]!.name, "next_one");
  assert.equal(found[1]!.line, 7);
});

test("references exclude comments and string literals, and label macro bodies", () => {
  const source = [
    "/* target_flags is mentioned in this comment */",
    'const char *note = "target_flags in a string";',
    "#define TARGET_THING (target_flags & 1)",
    "int f (void) { return target_flags; }",
  ].join("\n");
  const found = referencesIn(source, "x.c", "target_flags");
  assert.equal(found.length, 2, JSON.stringify(found));
  assert.deepEqual(found.map((reference) => reference.line).sort(), [3, 4]);
  assert.equal(found.find((reference) => reference.line === 3)!.context, "macro-body");
  assert.equal(found.find((reference) => reference.line === 4)!.context, "code");
});

test("dump collection reads open/close pairs rather than a fixed nesting", () => {
  const source = [
    "void rest_of_compilation (decl) tree decl; {",
    "  if (optimize > 0 && flag_thing)",
    "    {",
    "      if (thing_dump)",
    '        open_dump_file (".thing", name);',
    "      thing_main (insns);",
    "      if (thing_dump)",
    "        close_dump_file (print_rtl, insns);",
    "    }",
    "}",
  ].join("\n");
  const passes = collectDumpPasses(source, "toplev.c");
  assert.equal(passes.length, 1);
  assert.equal(passes[0]!.suffix, "thing");
  assert.ok(passes[0]!.guards.some((guard) => guard.includes("flag_thing")));
  assert.deepEqual(passes[0]!.writtenAfter.map((call) => call.name), ["thing_main"]);
});

test("the vendored tree is resolved from project config, not a hardcoded version", () => {
  const configured = configuredGccVersion();
  assert.equal(resolveVersion(), configured);
  assert.ok(vendoredVersions().includes(configured),
    `GCC ${configured} is configured but not vendored under tools/vendor/gcc/`);
  assert.throws(() => resolveVersion("0.0.0"), /No vendored source for GCC 0\.0\.0/);
  assert.equal(loadIndex().version, configured);
});
