import assert from "node:assert/strict";
import test from "node:test";
import { cpSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { parserFingerprints } from "./fingerprints.ts";
import { fixture } from "./test-fixtures.ts";
import { PARSERS } from "./registry.ts";
test("actual transitive XA decoder changes invalidate XA, not TIM or unrelated files", () => {
  const f = fixture(), repository = fileURLToPath(new URL("../../../", import.meta.url));
  try {
    cpSync(join(repository, "tools/agent/resource-extraction"), join(f.root, "tools/agent/resource-extraction"), { recursive: true });
    const before = parserFingerprints(PARSERS, f.root), helper = "tools/agent/resource-extraction/parsers/xa-audio.ts";
    f.put(helper, readFileSync(join(f.root, helper), "utf8") + "\n/* changed transitive implementation */\n");
    const changed = parserFingerprints(PARSERS, f.root);
    assert.equal(changed.find(p => p.id === "tim-v1")!.hash, before.find(p => p.id === "tim-v1")!.hash);
    assert.notEqual(changed.find(p => p.id === "xa-v1")!.hash, before.find(p => p.id === "xa-v1")!.hash);
    f.put("src/unrelated.c", "not an extractor input"); f.put("notes/unrelated.md", "not an extractor implementation");
    assert.deepEqual(parserFingerprints(PARSERS, f.root), changed);
  } finally { f.cleanup(); }
});
