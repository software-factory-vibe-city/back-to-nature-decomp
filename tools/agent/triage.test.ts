import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { detectBackendPacket, detectLoopIdiom, detectLoopNesting, detectParamResidence, detectSearchDomain, type TargetFacts } from "./triage.js";
import { sha256 } from "./variant-lab/artifacts.js";
import { analyzeFrame } from "./frameMap.js";
import { analyzeReturnValue } from "./frameMap.js";
import type { DisassembledInstruction } from "./decompToolchain.js";
import {
  BASELINE_LABEL,
  CURRENT_SOURCE_LABEL,
  concludeMatrix,
  type Fingerprint,
  type FlagMatrixRow,
} from "./flagProbe.js";

function code(lines: string[]): DisassembledInstruction[] {
  return lines.map((line, index) => {
    const [mnemonic, rest = ""] = line.trim().split(/\s+(.*)/);
    const operands = rest
      ? rest.split(/,(?![^(]*\))/).map((operand) => operand.trim()).filter(Boolean)
      : [];
    return {
      address: index * 4,
      mnemonic,
      operands,
      operandText: operands.join(","),
      raw: line.trim(),
    };
  });
}

function facts(lines: string[]): TargetFacts {
  const instructions = code(lines);
  return {
    frame: analyzeFrame(instructions),
    instructions,
    returnValue: analyzeReturnValue(instructions, []),
    raStores: [],
  };
}

/* func_800140C8's prefix. These five machine instructions were one
 * movstrsi_internal; treating them as five scheduling decisions is what made
 * the residual unreachable through any scalar source. */
test("backend-packet: a two-byte load-batch/store-batch run is reported", () => {
  const findings = detectBackendPacket(facts([
    "addiu $a3, $v0, %lo(D_8005E2AC)",
    "lb $v1, 0x0($a3)",
    "lb $a1, 0x1($a3)",
    "sb $v1, 0x10($sp)",
    "sb $a1, 0x11($sp)",
  ]));

  assert.equal(findings.length, 1);
  assert.equal(findings[0].detector, "backend-packet");
  assert.ok(findings[0].summary.includes("2 bytes") || findings[0].summary.includes("2 x 1-byte"));
  assert.ok(
    findings[0].evidence.some((line) => line.includes("does not prove")),
    "the finding must state compatibility rather than provenance",
  );
});

test("backend-packet: a four-word run is reported", () => {
  const findings = detectBackendPacket(facts([
    "lw $t3, 0x0($a0)",
    "lw $t4, 0x4($a0)",
    "lw $v1, 0x8($a0)",
    "lw $a2, 0xC($a0)",
    "sw $t3, 0x0($a3)",
    "sw $t4, 0x4($a3)",
    "sw $v1, 0x8($a3)",
    "sw $a2, 0xC($a3)",
  ]));

  assert.equal(findings.length, 1);
  assert.ok(
    findings[0].evidence.some((line) => line.includes("move_by_pieces")),
    "a word-aligned run of this size must carry the move_by_pieces caveat",
  );
});

/* Interleaved load/store pairs are exactly what move_by_pieces emits, and a
 * member-wise scalar source reproduces them byte-for-byte. Firing here would
 * send an investigation after an aggregate copy that does not exist. */
test("backend-packet: interleaved copies are not a packet", () => {
  const findings = detectBackendPacket(facts([
    "lw $v1, 0x0($a1)",
    "sw $v1, 0x0($a0)",
    "lw $v0, 0x4($a1)",
    "sw $v0, 0x4($a0)",
    "lw $v1, 0x8($a1)",
    "sw $v1, 0x8($a0)",
  ]));
  assert.deepEqual(findings, []);
});

test("backend-packet: mismatched value registers are not a packet", () => {
  const findings = detectBackendPacket(facts([
    "lw $v1, 0x0($a1)",
    "lw $v0, 0x4($a1)",
    "sw $v0, 0x0($a0)",
    "sw $v1, 0x4($a0)",
  ]));
  assert.deepEqual(findings, [], "a block mover stores in the order it loaded");
});

test("backend-packet: noncontiguous offsets are not a packet", () => {
  const findings = detectBackendPacket(facts([
    "lw $v1, 0x0($a1)",
    "lw $v0, 0x10($a1)",
    "sw $v1, 0x0($a0)",
    "sw $v0, 0x10($a0)",
  ]));
  assert.deepEqual(findings, []);
});

test("backend-packet: mixed widths are not a packet", () => {
  const findings = detectBackendPacket(facts([
    "lw $v1, 0x0($a1)",
    "lh $v0, 0x4($a1)",
    "sw $v1, 0x0($a0)",
    "sh $v0, 0x4($a0)",
  ]));
  assert.deepEqual(findings, []);
});

test("backend-packet: ordinary code produces no finding", () => {
  const findings = detectBackendPacket(facts([
    "addiu $sp, $sp, -0x18",
    "sw $ra, 0x14($sp)",
    "jal func_80011370",
    "addu $a0, $s0, $zero",
    "lw $ra, 0x14($sp)",
    "jr $ra",
    "addiu $sp, $sp, 0x18",
  ]));
  assert.deepEqual(findings, []);
});

/* func_80013B04's shape: an outer port loop and an inner retry loop. The three
 * expressions between the two headers are invariant in the inner loop, which
 * is the whole reason the nesting is not a style choice. */
test("loop-nesting: nested back-edge ranges are reported", () => {
  const findings = detectLoopNesting(facts([
    "addu $s1, $zero, $zero",   /* 0x00 */
    "addiu $s3, $zero, 0x1",    /* 0x04 */
    "sll $s2, $s1, 3",          /* 0x08  outer header */
    "addiu $s6, $s1, 0x1",      /* 0x0c */
    "addu $v0, $s5, $s1",       /* 0x10 */
    "lbu $a0, 0x0($v0)",        /* 0x14  inner header */
    "jal PadGetState",          /* 0x18 */
    "nop",                      /* 0x1c */
    "beq $s3, $v0, 14",         /* 0x20  back-edge -> inner */
    "addu $s1, $s6, $zero",     /* 0x24 */
    "bnez $v0, 8",              /* 0x28  back-edge -> outer */
    "jr $ra",                   /* 0x2c */
  ]));

  assert.equal(findings.length, 1);
  assert.equal(findings[0].detector, "loop-nesting");
  assert.ok(findings[0].summary.includes("nested loops"));
  assert.ok(
    findings[0].evidence.some((line) => line.includes("sll") && line.includes("invariant")),
    "the invariant expressions between the headers must be listed",
  );
});

/* A flattened loop with `continue` also has two back-edges — but to the SAME
 * header. Firing here would send an agent after nesting that is not there. */
test("loop-nesting: two back-edges to one header are one loop", () => {
  const findings = detectLoopNesting(facts([
    "addu $s1, $zero, $zero",   /* 0x00 */
    "lbu $a0, 0x0($s5)",        /* 0x04  header */
    "jal PadGetState",          /* 0x08 */
    "nop",                      /* 0x0c */
    "beq $s3, $v0, 4",          /* 0x10  continue -> header */
    "addiu $s1, $s1, 0x1",      /* 0x14 */
    "bnez $v0, 4",              /* 0x18  loop  -> header */
    "jr $ra",                   /* 0x1c */
  ]));
  assert.deepEqual(findings, []);
});

/* Two loops one after the other are not nested; their ranges are disjoint. */
test("loop-nesting: sequential loops are not reported as nested", () => {
  const findings = detectLoopNesting(facts([
    "addu $s1, $zero, $zero",   /* 0x00 */
    "addiu $s1, $s1, 0x1",      /* 0x04  header A */
    "bnez $s1, 4",              /* 0x08  back-edge -> A */
    "addu $s2, $zero, $zero",   /* 0x0c */
    "addiu $s2, $s2, 0x1",      /* 0x10  header B */
    "bnez $s2, 10",             /* 0x14  back-edge -> B */
    "jr $ra",                   /* 0x18 */
  ]));
  assert.deepEqual(findings, []);
});

test("loop-nesting: straight-line code produces no finding", () => {
  const findings = detectLoopNesting(facts([
    "addiu $sp, $sp, -0x18",
    "sw $ra, 0x14($sp)",
    "jal func_80011370",
    "nop",
    "lw $ra, 0x14($sp)",
    "jr $ra",
    "addiu $sp, $sp, 0x18",
  ]));
  assert.deepEqual(findings, []);
});

/* func_80017300's shape: the RLE byte loop decrements $a1 into a bnez
 * back-edge, with the -1 step two insns above the branch (the count_rle
 * shift pair sits between). Ten of that function's thirteen residual words
 * traced back to hand-writing this as a countdown do-while instead of the
 * count-up loop check_dbra_loop reverses. */
test("loop-idiom: a countdown latch is reported with its counter", () => {
  const findings = detectLoopIdiom(facts([
    "move $a1, $s4",            /* 0x00 */
    "lbu $v0, 0x0($s0)",        /* 0x04  header */
    "addiu $s0, $s0, 0x1",      /* 0x08 */
    "addiu $a1, $a1, -0x1",     /* 0x0c  counter step */
    "sb $v0, 0x0($a0)",         /* 0x10 */
    "bnez $a1, 4",              /* 0x14  back-edge on the counter */
    "addiu $a0, $a0, 0x1",      /* 0x18  delay slot */
  ]));

  assert.equal(findings.length, 1);
  assert.equal(findings[0].detector, "loop-idiom");
  assert.ok(findings[0].summary.includes("COUNT-UP"));
  assert.ok(findings[0].evidence.some((line) => line.includes("$a1")));
});

/* A count-up loop's back-edge tests a comparison result, not the stepped
 * register — the prior is already satisfied, so the detector stays quiet. */
test("loop-idiom: a count-up sltu/bnez loop is not reported", () => {
  const findings = detectLoopIdiom(facts([
    "addu $a1, $zero, $zero",   /* 0x00 */
    "lbu $v0, 0x0($s0)",        /* 0x04  header */
    "addiu $a1, $a1, 0x1",      /* 0x08  counter step, +1 */
    "sltu $v0, $a1, $s3",       /* 0x0c */
    "bnez $v0, 4",              /* 0x10  back-edge on the compare result */
    "nop",                      /* 0x14 */
  ]));
  assert.deepEqual(findings, []);
});

/* A pointer walked down by -1 and tested against a bound via bne reg,reg is
 * not the counter-to-zero shape; only bne against $zero qualifies. */
test("loop-idiom: bne against a non-zero register is not reported", () => {
  const findings = detectLoopIdiom(facts([
    "addiu $a1, $a1, -0x1",     /* 0x00  header */
    "bne $a1, $s3, 0",          /* 0x04 */
    "nop",                      /* 0x08 */
  ]));
  assert.deepEqual(findings, []);
});

/* Forward branches are not back-edges; no loop, no finding. */
test("loop-idiom: straight-line code produces no finding", () => {
  const findings = detectLoopIdiom(facts([
    "addiu $a1, $a1, -0x1",
    "bnez $a1, 3",
    "nop",
    "jr $ra",
  ]));
  assert.deepEqual(findings, []);
});

/* ------------------------------------------------------------------ */
/* Flag-probe matrix conclusions                                       */
/* ------------------------------------------------------------------ */

function row(label: string, masked: number | null, instructions: number | null): FlagMatrixRow {
  const entry: FlagMatrixRow = {
    label,
    flags: label === BASELINE_LABEL ? "" : label,
    source: CURRENT_SOURCE_LABEL,
    masked,
    instructions,
    targetInstructions: 105,
  };
  if (masked === null) entry.error = "compile failed";
  return entry;
}

const SPLIT_ADDRESSES: Fingerprint = {
  kind: "self-clobber-shape",
  detail: "lui/lw self-clobber at words 6-7 (reg $3)",
  candidates: ["-mno-split-addresses"],
};

test("flag matrix: a tie with baseline is not support for the flag on this source", () => {
  const verdict = concludeMatrix({
    rows: [row(BASELINE_LABEL, 105, 105), row("-mno-split-addresses", 72, 105)],
    fingerprints: [SPLIT_ADDRESSES],
    sourceLabel: CURRENT_SOURCE_LABEL,
  });
  assert.equal(verdict.conclusion, "not-supported-current-source");
  assert.deepEqual(verdict.dominantRows, []);
  /* The scope has to survive into the wording: this is a statement about one
     source, never about the flag in general. */
  assert.ok(verdict.reasons.some((reason) => reason.includes("scoped to the current source only")));
});

test("flag matrix: a strictly better column is support, and is named", () => {
  const verdict = concludeMatrix({
    rows: [row(BASELINE_LABEL, 80, 111), row("-mno-split-addresses", 105, 105)],
    fingerprints: [SPLIT_ADDRESSES],
    sourceLabel: CURRENT_SOURCE_LABEL,
  });
  assert.equal(verdict.conclusion, "supported");
  assert.deepEqual(verdict.dominantRows, ["-mno-split-addresses"]);
  assert.equal(verdict.candidates[0].conclusion, "supported");
});

test("flag matrix: a higher masked score bought with an instruction regression is not dominant", () => {
  const verdict = concludeMatrix({
    rows: [row(BASELINE_LABEL, 100, 105), row("-mno-split-addresses", 102, 111)],
    fingerprints: [SPLIT_ADDRESSES],
    sourceLabel: CURRENT_SOURCE_LABEL,
  });
  assert.equal(verdict.conclusion, "not-supported-current-source");
  assert.deepEqual(verdict.dominantRows, []);
});

test("flag matrix: a compile failure is inconclusive, never a refutation", () => {
  assert.equal(concludeMatrix({
    rows: [row(BASELINE_LABEL, 105, 105), row("-mno-split-addresses", null, null)],
    fingerprints: [SPLIT_ADDRESSES],
    sourceLabel: CURRENT_SOURCE_LABEL,
  }).conclusion, "inconclusive");

  assert.equal(concludeMatrix({
    rows: [row(BASELINE_LABEL, null, null), row("-mno-split-addresses", 105, 105)],
    fingerprints: [SPLIT_ADDRESSES],
    sourceLabel: CURRENT_SOURCE_LABEL,
  }).conclusion, "inconclusive");
});

test("flag matrix: no measured source is inconclusive rather than silence", () => {
  const verdict = concludeMatrix({ rows: [], fingerprints: [SPLIT_ADDRESSES], sourceLabel: CURRENT_SOURCE_LABEL });
  assert.equal(verdict.conclusion, "inconclusive");
  assert.match(verdict.reasons[0], /no flag matrix was measured/);
});

test("flag matrix: rows scored on a candidate shape never decide the current source's verdict", () => {
  const verdict = concludeMatrix({
    rows: [
      row(BASELINE_LABEL, 105, 105),
      row("-mno-split-addresses", 72, 105),
      { ...row("-mno-split-addresses", 105, 105), source: "build/candidate.c" },
    ],
    fingerprints: [SPLIT_ADDRESSES],
    sourceLabel: CURRENT_SOURCE_LABEL,
  });
  assert.equal(verdict.conclusion, "not-supported-current-source");
});

/* func_80014CBC's parameter-residence class: arg4 re-read from its slot at
 * each use, arg1 homed to old_sp+4 and reloaded at the recursion. Both are
 * compiler-emitted patterns, not source statements, and the memory-resident
 * declaration reading is what closed that function. */
test("param-residence: an incoming slot re-read per use is reported", () => {
  const findings = detectParamResidence(facts([
    "addiu $sp, $sp, -0x40",
    "sw $s0, 0x18($sp)",
    "lw $v0, 0x50($sp)",
    "sw $v0, 0x0($s0)",
    "lw $v0, 0x50($sp)",
    "jr $ra",
    "addiu $sp, $sp, 0x40",
  ]));

  const rereads = findings.filter((f) => f.summary.includes("re-read per use"));
  assert.equal(rereads.length, 1);
  assert.equal(rereads[0].detector, "param-residence");
  assert.ok(rereads[0].evidence.some((line) => line.includes("read 2x")));
  assert.ok(rereads[0].summary.includes("BLK"), "must name the memory-resident declaration lever");
});

test("param-residence: a homed register argument with a later reload is reported", () => {
  const findings = detectParamResidence(facts([
    "addiu $sp, $sp, -0x40",
    "sw $a1, 0x44($sp)",
    "jal 0x80014CBC",
    "nop",
    "lw $a1, 0x44($sp)",
    "jr $ra",
    "addiu $sp, $sp, 0x40",
  ]));

  const homed = findings.filter((f) => f.summary.includes("home slot"));
  assert.equal(homed.length, 1);
  assert.equal(homed[0].detector, "param-residence");
  assert.ok(homed[0].evidence.some((line) => line.includes("arg1 home slot")));
});

test("param-residence: a single entry copy from an incoming slot stays silent", () => {
  const findings = detectParamResidence(facts([
    "addiu $sp, $sp, -0x18",
    "lw $s0, 0x28($sp)",
    "sw $a0, 0x10($sp)",
    "jr $ra",
    "addiu $sp, $sp, 0x18",
  ]));

  assert.equal(findings.length, 0);
});

/* ------------------------------------------------------------------ */
/* search-domain                                                       */
/* ------------------------------------------------------------------ */

function searchRun(
  root: string,
  name: string,
  runId: string,
  source: string,
  grammar: Record<string, unknown>,
  status: string,
  classesSource: { sampled: boolean; evaluatedCandidates: string; totalCandidates: string } = {
    sampled: false, evaluatedCandidates: "1", totalCandidates: "1",
  },
): void {
  const directory = join(root, name, runId);
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "baseline.json"), JSON.stringify({ sourceHash: sha256(source) }));
  writeFileSync(join(directory, "grammar.json"), JSON.stringify(grammar));
  writeFileSync(join(directory, "summary.json"), JSON.stringify({ status, classes: [], classesSource }));
}

const SEARCH_SOURCE = "int f(void) { return 0; }\n";

const EMPTY_PARTITION = {
  grammarSchemaVersion: 6,
  activeRules: ["web-partition", "statement-order"],
  partitionWebIds: [],
  webs: [{ id: "a#0" }, { id: "b#0" }],
  regions: [{ id: "r0-0" }],
  caveats: ["len is declared inside a frozen construct; its webs stay frozen."],
};

test("search-domain: an exhausted run with an empty active axis is a blocker", () => {
  const root = mkdtempSync(join(tmpdir(), "triage-search-"));
  searchRun(root, "func_1", "run0001", SEARCH_SOURCE, EMPTY_PARTITION, "exhausted-no-exact");

  const findings = detectSearchDomain("func_1", SEARCH_SOURCE, root);
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.severity, "blocker");
  assert.match(findings[0]!.summary, /web-partition/);
  assert.match(findings[0]!.summary, /0 of 2 value web\(s\)/);
  /* The exclusion reason is the actionable half and must be carried through. */
  assert.equal(findings[0]!.evidence.some((line) => /its webs stay frozen/.test(line)), true);
  rmSync(root, { recursive: true, force: true });
});

test("search-domain: a non-empty axis produces no finding", () => {
  const root = mkdtempSync(join(tmpdir(), "triage-search-"));
  searchRun(root, "func_1", "run0001", SEARCH_SOURCE, {
    ...EMPTY_PARTITION,
    partitionWebIds: ["a#0"],
  }, "exhausted-no-exact");

  assert.deepEqual(detectSearchDomain("func_1", SEARCH_SOURCE, root), []);
  rmSync(root, { recursive: true, force: true });
});

test("search-domain: a run against different source is not a reading of this one", () => {
  const root = mkdtempSync(join(tmpdir(), "triage-search-"));
  searchRun(root, "func_1", "run0001", "int other(void) { return 1; }\n", EMPTY_PARTITION, "exhausted-no-exact");

  assert.deepEqual(detectSearchDomain("func_1", SEARCH_SOURCE, root), []);
  rmSync(root, { recursive: true, force: true });
});

test("search-domain: an unfinished run downgrades to a signal", () => {
  const root = mkdtempSync(join(tmpdir(), "triage-search-"));
  searchRun(root, "func_1", "run0001", SEARCH_SOURCE, EMPTY_PARTITION, "incomplete-budget");

  const findings = detectSearchDomain("func_1", SEARCH_SOURCE, root);
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.severity, "signal");
  rmSync(root, { recursive: true, force: true });
});

test("search-domain: the strongest run wins, not the newest, and a partial is skipped", () => {
  const root = mkdtempSync(join(tmpdir(), "triage-search-"));
  /* An exhaustive run and a later sample of the same source: the exhaustive
     one is the reading, whichever was written last. */
  searchRun(root, "func_1", "aaa-full", SEARCH_SOURCE, EMPTY_PARTITION, "exhausted-no-exact", {
    sampled: false, evaluatedCandidates: "500", totalCandidates: "500",
  });
  searchRun(root, "func_1", "zzz-sample", SEARCH_SOURCE, EMPTY_PARTITION, "derived", {
    sampled: true, evaluatedCandidates: "64", totalCandidates: "500",
  });
  /* A directory with no summary.json is an interrupted run, not a reading. */
  mkdirSync(join(root, "func_1", "partial"), { recursive: true });
  writeFileSync(join(root, "func_1", "partial", "baseline.json"), JSON.stringify({ sourceHash: sha256(SEARCH_SOURCE) }));

  const findings = detectSearchDomain("func_1", SEARCH_SOURCE, root);
  assert.equal(findings.length, 1);
  assert.match(findings[0]!.summary, /run aaa-full/);
  assert.equal(findings[0]!.severity, "blocker");
  rmSync(root, { recursive: true, force: true });
});

test("search-domain: a sampled run cannot lend a verdict", () => {
  const root = mkdtempSync(join(tmpdir(), "triage-search-"));
  searchRun(root, "func_1", "run0001", SEARCH_SOURCE, {
    ...EMPTY_PARTITION, partitionWebIds: ["a#0"],
  }, "derived", { sampled: true, evaluatedCandidates: "64", totalCandidates: "500000" });

  const findings = detectSearchDomain("func_1", SEARCH_SOURCE, root);
  assert.equal(findings.length, 1);
  assert.match(findings[0]!.summary, /64 of 500000/);
  assert.match(findings[0]!.summary, /not a ranking over the domain/);
  rmSync(root, { recursive: true, force: true });
});
