import assert from "node:assert/strict";
import test from "node:test";
import {
  LAYOUT_STRATEGIES,
  PSYQ_SECTION_ORDER,
  RETURN_CLUSTERING,
  deriveLayoutByStrategy,
  layoutFromConsensus,
  selectLayoutStrategies,
} from "./overlayStrategies.ts";
import { UNKNOWN_TOOLCHAIN, type ToolchainProfile } from "./toolchainProfile.ts";

const PSYQ: ToolchainProfile = { id: "psyq", version: "470", verdict: "detected", evidence: [] };
const SN64: ToolchainProfile = { id: "sn64", version: null, verdict: "detected", evidence: [] };
const EXE_IMAGE = { start: 0x80010000, end: 0x8005e800 };

const FUNCTION = [0x27bdffe8, 0xafbf0014, 0x00000000, 0x8fbf0014, 0x03e00008, 0x27bd0018];

/** rodata pointers, then `functions` bodies, then trailing data. */
function member(functions: number, rodataWords: number, trailingWords: number): Buffer {
  const total = rodataWords + functions * FUNCTION.length + trailingWords;
  const buf = Buffer.alloc(total * 4);
  buf.writeUInt32LE(0x00000006, 0); // overlay id
  for (let i = 1; i < rodataWords; i++) buf.writeUInt32LE(0x800b8000 + i * 4, i * 4);
  for (let f = 0; f < functions; f++) {
    FUNCTION.forEach((w, i) => buf.writeUInt32LE(w >>> 0, (rodataWords + f * FUNCTION.length + i) * 4));
  }
  for (let i = 0; i < trailingWords; i++) {
    buf.writeUInt32LE(0x7c817c81, (rodataWords + functions * FUNCTION.length + i) * 4);
  }
  return buf;
}

test("a toolchain-specific strategy runs only for the toolchain it declares", () => {
  assert.deepEqual(selectLayoutStrategies(PSYQ).map((s) => s.id), ["psyq-section-order", "return-clustering"]);
  assert.deepEqual(selectLayoutStrategies(SN64).map((s) => s.id), ["return-clustering"]);
  assert.deepEqual(selectLayoutStrategies(UNKNOWN_TOOLCHAIN).map((s) => s.id), ["return-clustering"]);
});

test("every strategy in the registry declares what it applies to", () => {
  for (const strategy of LAYOUT_STRATEGIES) {
    assert.ok(strategy.appliesTo.length > 0, `${strategy.id} declares no toolchain`);
    assert.ok(strategy.rationale.length > 0, `${strategy.id} states no rationale`);
  }
});

test("both strategies find the same code region in a well-formed member", () => {
  const bytes = member(8, 6, 32);
  const input = { id: "ovl_test", bytes, exeImage: EXE_IMAGE };
  const psyq = PSYQ_SECTION_ORDER.run(input);
  const generic = RETURN_CLUSTERING.run(input);
  assert.equal(psyq.spans.length, 1);
  assert.deepEqual(generic.spans, psyq.spans);
});

test("consensus reports which strategy was adopted and whether they agreed", () => {
  const consensus = deriveLayoutByStrategy({ id: "ovl_test", bytes: member(8, 6, 32), exeImage: EXE_IMAGE }, PSYQ);
  assert.equal(consensus.adopted, "psyq-section-order");
  assert.equal(consensus.agree, true);
  assert.ok(consensus.evidence.some((e) => e.includes("selects 2 of 2 strategies")));
});

test("an unknown toolchain still gets an answer, from the generic strategy alone", () => {
  const consensus = deriveLayoutByStrategy(
    { id: "ovl_test", bytes: member(8, 6, 32), exeImage: EXE_IMAGE },
    UNKNOWN_TOOLCHAIN
  );
  assert.equal(consensus.adopted, "return-clustering");
  assert.equal(consensus.spans.length, 1);
  assert.ok(consensus.evidence.some((e) => e.includes("selects 1 of 2")));
});

test("a member with no returns yields no code region rather than a guessed one", () => {
  const bytes = Buffer.alloc(4096);
  for (let i = 0; i + 4 <= bytes.length; i += 4) bytes.writeUInt32LE(0x7c817c81, i);
  const consensus = deriveLayoutByStrategy({ id: "ovl_test", bytes, exeImage: EXE_IMAGE }, PSYQ);
  assert.deepEqual(consensus.spans, []);
  const layout = layoutFromConsensus(consensus, bytes.length);
  assert.equal(layout.textStart, layout.dataStart);
  assert.deepEqual(layout.residuals, ["no code region"]);
});

test("two code regions separated by data are reported as a residual, not flattened silently", () => {
  const gap = Buffer.alloc(8192);
  for (let i = 0; i + 4 <= gap.length; i += 4) gap.writeUInt32LE(0x7c817c81, i);
  const bytes = Buffer.concat([member(8, 6, 0), gap, member(8, 1, 8)]);
  const result = RETURN_CLUSTERING.run({ id: "ovl_test", bytes, exeImage: EXE_IMAGE });
  assert.equal(result.spans.length, 2, "the generic strategy sees both regions");
  const layout = layoutFromConsensus(
    { spans: result.spans, adopted: result.strategy, results: [result], agree: true, evidence: [] },
    bytes.length
  );
  assert.ok(layout.residuals.some((r) => r.includes("not one contiguous .text")));
});
