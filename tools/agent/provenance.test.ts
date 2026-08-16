import { strict as assert } from "node:assert";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  computeProvenance,
  describeStaleReason,
  ensureArtifact,
  implementationHash,
  renderProvenance,
  stamped,
  staleReason,
  writeStableJson,
} from "./provenance.js";

function scratch(): string {
  return mkdtempSync(join(tmpdir(), "provenance-"));
}

/* --- fingerprints --------------------------------------------------------- */

test("a file's bytes decide the fingerprint, not its mtime", () => {
  const dir = scratch();
  try {
    const path = join(dir, "input.c");
    writeFileSync(path, "int a;\n");
    const first = computeProvenance("func_1", { files: [path] });

    /* Rewriting identical bytes moves the mtime and must not count as a change:
     * an mtime comparison would rebuild on every `touch` and, worse, would miss
     * a content change that preserved the timestamp. */
    writeFileSync(path, "int a;\n");
    assert.equal(computeProvenance("func_1", { files: [path] }).fingerprint, first.fingerprint);

    writeFileSync(path, "int b;\n");
    assert.notEqual(computeProvenance("func_1", { files: [path] }).fingerprint, first.fingerprint);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a missing input is recorded as absent, so creating it counts as a change", () => {
  const dir = scratch();
  try {
    const path = join(dir, "later.c");
    const before = computeProvenance("func_1", { files: [path] });
    assert.equal(Object.values(before.files)[0], "absent");

    writeFileSync(path, "int a;\n");
    assert.notEqual(computeProvenance("func_1", { files: [path] }).fingerprint, before.fingerprint);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("non-file inputs change the fingerprint", () => {
  const base = computeProvenance("func_1", { values: { flags: ["-O2"] } });
  const other = computeProvenance("func_1", { values: { flags: ["-O2", "-fno-gcse"] } });
  assert.notEqual(base.fingerprint, other.fingerprint);
});

test("the implementation hash covers a directory's non-test sources", () => {
  const dir = scratch();
  try {
    mkdirSync(join(dir, "tool"));
    writeFileSync(join(dir, "tool", "a.ts"), "export const a = 1;\n");
    writeFileSync(join(dir, "tool", "a.test.ts"), "/* tests do not decide results */\n");
    const before = implementationHash([join(dir, "tool")]);

    writeFileSync(join(dir, "tool", "a.test.ts"), "/* edited test */\n");
    assert.equal(implementationHash([join(dir, "tool")]), before, "a test edit must not invalidate a cache");

    writeFileSync(join(dir, "tool", "a.ts"), "export const a = 2;\n");
    assert.notEqual(implementationHash([join(dir, "tool")]), before, "a logic edit must invalidate a cache");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/* --- staleness reasons ---------------------------------------------------- */

test("a stale stamp names the input that changed, not the fingerprint", () => {
  const dir = scratch();
  try {
    const path = join(dir, "input.c");
    writeFileSync(path, "int a;\n");
    const stored = computeProvenance("func_1", { files: [path] });
    writeFileSync(path, "int b;\n");
    const fresh = computeProvenance("func_1", { files: [path] });

    const reason = staleReason(stored, fresh);
    assert.equal(reason?.kind, "files");
    assert.match(describeStaleReason(reason!), /input\.c changed/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("an unstamped or absent artifact is stale rather than an error", () => {
  const fresh = computeProvenance("func_1", { values: { a: 1 } });
  assert.equal(staleReason(undefined, fresh)?.kind, "absent");
  assert.equal(staleReason({} as never, fresh)?.kind, "unstamped");
});

test("an identical stamp is not stale", () => {
  const fresh = computeProvenance("func_1", { values: { a: 1 } });
  assert.equal(staleReason(fresh, computeProvenance("func_1", { values: { a: 1 } })), undefined);
});

/* --- ensureArtifact ------------------------------------------------------- */

test("ensureArtifact produces on a miss and reuses on a hit", () => {
  const dir = scratch();
  try {
    const input = join(dir, "input.c");
    const artifact = join(dir, "analysis.json");
    writeFileSync(input, "int a;\n");
    let produced = 0;
    const notices: string[] = [];

    const call = () => ensureArtifact<{ value: number }>({
      artifactPath: artifact,
      label: "analysis",
      functionName: "func_1",
      inputs: { files: [input] },
      notify: (message) => notices.push(message),
      produce: (provenance) => {
        produced++;
        writeStableJson(artifact, stamped({ value: produced }, provenance));
        return { value: produced };
      },
      read: (stored) => stored as { value: number },
    });

    assert.equal(call().regenerated, true);
    assert.equal(produced, 1);

    const second = call();
    assert.equal(second.regenerated, false, "unchanged inputs must reuse");
    assert.equal(produced, 1);
    assert.equal(second.value.value, 1);

    writeFileSync(input, "int b;\n");
    const third = call();
    assert.equal(third.regenerated, true, "a changed input must regenerate");
    assert.equal(third.value.value, 2);
    assert.equal(notices.length, 2, "only regenerations are announced");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a matching stamp whose artifact cannot be read is a miss, not a throw", () => {
  const dir = scratch();
  try {
    const input = join(dir, "input.c");
    const artifact = join(dir, "analysis.json");
    writeFileSync(input, "int a;\n");
    let produced = 0;
    let refuseRead = false;

    const call = () => ensureArtifact<{ value: number }>({
      artifactPath: artifact,
      label: "analysis",
      functionName: "func_1",
      inputs: { files: [input] },
      notify: () => {},
      produce: (provenance) => {
        produced++;
        writeStableJson(artifact, stamped({ value: produced }, provenance));
        return { value: produced };
      },
      /* Stands in for a stamp that points at a file since deleted. */
      read: (stored) => {
        if (refuseRead) throw new Error("downstream artifact is gone");
        return stored as { value: number };
      },
    });

    call();
    refuseRead = true;
    assert.equal(call().regenerated, true);
    assert.equal(produced, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a truncated artifact is a miss rather than a parse error", () => {
  const dir = scratch();
  try {
    const input = join(dir, "input.c");
    const artifact = join(dir, "analysis.json");
    writeFileSync(input, "int a;\n");
    writeFileSync(artifact, "{ not json");

    const ensured = ensureArtifact<{ value: number }>({
      artifactPath: artifact,
      label: "analysis",
      functionName: "func_1",
      inputs: { files: [input] },
      notify: () => {},
      produce: (provenance) => {
        writeStableJson(artifact, stamped({ value: 1 }, provenance));
        return { value: 1 };
      },
      read: (stored) => stored as { value: number },
    });

    assert.equal(ensured.regenerated, true);
    assert.equal(JSON.parse(readFileSync(artifact, "utf8")).value, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/* --- reporting ------------------------------------------------------------ */

test("the provenance line names the file and whether it was derived now", () => {
  const dir = scratch();
  try {
    const input = join(dir, "input.c");
    writeFileSync(input, "int a;\n");
    const provenance = computeProvenance("func_1", { files: [input] });

    const derived = renderProvenance([{
      label: "candidate",
      ensured: { value: null, provenance, regenerated: true, reason: { kind: "absent" } },
    }]);
    assert.match(derived, /candidate: derived now \(no previous run\)/);
    assert.match(derived, /input\.c@[0-9a-f]{8}/);

    const reused = renderProvenance([{
      label: "candidate",
      ensured: { value: null, provenance, regenerated: false },
    }]);
    assert.match(reused, /candidate: reused \(inputs unchanged\)/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
