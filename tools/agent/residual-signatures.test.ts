import { strict as assert } from "node:assert";
import { test } from "node:test";
import { lookupSignature, unifiedDiff, type SignatureIndex } from "./residualSignatures.js";

test("a unified diff keeps the edit and drops the unchanged bulk", () => {
  const before = ["int f(void) {", "    int i;", "    u8 *p = base;", "    for (;;) {", "        use(*p);", "    }", "}"].join("\n");
  const after = ["int f(void) {", "    int i;", "    for (;;) {", "        use(base[i]);", "    }", "}"].join("\n");
  const diff = unifiedDiff(before, after, 1);
  assert.match(diff, /^- {5}u8 \*p = base;$/m);
  assert.match(diff, /^\+ {9}use\(base\[i\]\);$/m);
  /* The function's opening line is context, not an edit — with one line of
     context it should not be in the output at all. */
  assert.equal(/int f\(void\)/.test(diff), false);
});

test("a shape with a closure hands back the edit that closed it", () => {
  const index: SignatureIndex = {
    generatedAt: "2026-08-22T00:00:00.000Z",
    ledgers: 2,
    ledgersWithSignatures: 2,
    records: [{
      signature: "addiu <s>,<s>,<lo16>|addiu <s>,<s>,1",
      carriers: [
        { function: "twin", at: "2026-08-22T00:00:00.000Z", key: [0, 0, 2, 1], matchedWords: 300, totalWords: 303 },
        { function: "asking", at: "2026-08-22T01:00:00.000Z", key: [0, 0, 3, 1], matchedWords: 299, totalWords: 301 },
      ],
      closures: [{
        function: "twin",
        before: { function: "twin", at: "2026-08-22T00:00:00.000Z", key: [0, 0, 2, 1], matchedWords: 300, totalWords: 303 },
        diff: "-     u8 *p = base;\n+     use(base[i]);",
      }],
    }],
  };
  const text = lookupSignature("addiu <s>,<s>,<lo16>|addiu <s>,<s>,1", "asking", index);
  assert.match(text, /closed in twin/);
  assert.match(text, /u8 \*p = base;/);
  assert.match(text, /proven answer/);
});

test("a shape only this function has carried says nothing", () => {
  const index: SignatureIndex = {
    generatedAt: "", ledgers: 1, ledgersWithSignatures: 1,
    records: [{
      signature: "sig",
      carriers: [{ function: "asking", at: "", key: [0, 0, 1, 0], matchedWords: 1, totalWords: 2 }],
      closures: [],
    }],
  };
  assert.equal(lookupSignature("sig", "asking", index), "");
  /* And a shape nobody has carried is not a finding either. */
  assert.equal(lookupSignature("unseen", "asking", index), "");
  assert.equal(lookupSignature("", "asking", index), "");
});

test("a shape carried but not closed elsewhere says so without pretending to an answer", () => {
  const index: SignatureIndex = {
    generatedAt: "", ledgers: 2, ledgersWithSignatures: 2,
    records: [{
      signature: "sig",
      carriers: [
        { function: "asking", at: "", key: [0, 0, 1, 0], matchedWords: 1, totalWords: 2 },
        { function: "other", at: "", key: [0, 0, 1, 0], matchedWords: 1, totalWords: 2 },
      ],
      closures: [],
    }],
  };
  const text = lookupSignature("sig", "asking", index);
  assert.match(text, /other carried it too/);
  assert.match(text, /has not closed it/);
});
