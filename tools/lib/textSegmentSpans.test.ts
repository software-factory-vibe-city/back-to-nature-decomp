import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSegmentSpans,
  isStrictlyInsideSegmentSpan,
} from "./textSegmentSpans.ts";

const spans = buildSegmentSpans([0x100, 0x200]);

test("an address inside an existing segment span is covered", () => {
  assert.equal(isStrictlyInsideSegmentSpan(0x180, spans), true);
});

test("an address in a true gap outside existing spans is not covered", () => {
  assert.equal(isStrictlyInsideSegmentSpan(0x280, spans), false);
});

test("an address exactly at a segment start is not inside a span", () => {
  assert.equal(isStrictlyInsideSegmentSpan(0x200, spans), false);
});
