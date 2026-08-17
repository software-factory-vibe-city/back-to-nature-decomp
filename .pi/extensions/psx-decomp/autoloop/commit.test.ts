import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runCommand } from "../autonomous/process.ts";
import { commitMatchedFunction, commitMessage, commitParkedFunction, parkCommitMessage } from "./commit.ts";

async function git(cwd: string, args: string[]): Promise<string> {
  const result = await runCommand("git", args, { cwd, timeoutMs: 30_000 });
  assert.equal(result.code, 0, `git ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  return result.stdout.trim();
}

/** A throwaway repository with one commit, so HEAD exists to diff against. */
async function repo(): Promise<{ dir: string; cleanup: () => void }> {
  const dir = mkdtempSync(join(tmpdir(), "autoloop-commit-"));
  await git(dir, ["init", "--quiet", "--initial-branch=main"]);
  await git(dir, ["config", "user.email", "test@example.com"]);
  await git(dir, ["config", "user.name", "Test"]);
  writeFileSync(join(dir, "README.md"), "seed\n");
  await git(dir, ["add", "README.md"]);
  await git(dir, ["commit", "--quiet", "-m", "seed"]);
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

function write(dir: string, file: string, body: string): void {
  const path = join(dir, file);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, body);
}

test("the park subject names the park, and the body carries the reason and the note", () => {
  const message = parkCommitMessage(
    "func_80012345",
    "escalation-exhausted",
    "gpt-5.6-sol",
    "notes/human-needed-approvals/func_80012345.md",
  );
  assert.match(message.split("\n")[0], /^park func_80012345$/);
  assert.match(message, /escalation-exhausted/);
  assert.match(message, /gpt-5\.6-sol/);
  assert.match(message, /notes\/human-needed-approvals\/func_80012345\.md/);
  assert.match(commitMessage("func_80012345", "gpt-5.6-sol").split("\n")[0], /^match func_80012345$/);
});

test("committing a park takes the park's files and leaves the rest of the tree dirty", async () => {
  const { dir, cleanup } = await repo();
  try {
    write(dir, "src/func_80012345.c", "INCLUDE_ASM(...);\n");
    write(dir, "notes/human-needed-approvals/func_80012345.md", "# needs a decision\n");
    write(dir, "unrelated.txt", "user work in progress\n");

    const result = await commitParkedFunction(
      dir,
      "func_80012345",
      "escalation-exhausted",
      "gpt-5.6-sol",
      "notes/human-needed-approvals/func_80012345.md",
      ["src/func_80012345.c", "notes/human-needed-approvals/func_80012345.md"],
    );

    assert.equal(result.committed, true);
    assert.equal(await git(dir, ["log", "-1", "--format=%s"]), "park func_80012345");
    assert.deepEqual((await git(dir, ["show", "--name-only", "--format=", "HEAD"])).split("\n").sort(), [
      "notes/human-needed-approvals/func_80012345.md",
      "src/func_80012345.c",
    ]);
    assert.match(await git(dir, ["status", "--porcelain"]), /unrelated\.txt/);
  } finally {
    cleanup();
  }
});

test("a park commit clears the tree so the next function's changes stand alone", async () => {
  const { dir, cleanup } = await repo();
  try {
    write(dir, "src/parked.c", "INCLUDE_ASM(...);\n");
    await commitParkedFunction(dir, "parked", "escalation-exhausted", "tier", "notes/parked.md", ["src/parked.c"]);

    write(dir, "src/next.c", "int next(void) { return 0; }\n");
    const matched = await commitMatchedFunction(dir, "next", "tier", ["src/next.c"]);

    assert.equal(matched.committed, true);
    assert.deepEqual((await git(dir, ["show", "--name-only", "--format=", "HEAD"])).split("\n"), ["src/next.c"]);
  } finally {
    cleanup();
  }
});

test("a commit with nothing to stage reports it instead of making an empty commit", async () => {
  const { dir, cleanup } = await repo();
  try {
    assert.deepEqual(await commitParkedFunction(dir, "fn", "escalation-exhausted", "tier", "note.md", []), {
      committed: false,
      detail: "nothing to commit",
    });

    write(dir, "src/unchanged.c", "int unchanged(void) { return 0; }\n");
    await git(dir, ["add", "src/unchanged.c"]);
    await git(dir, ["commit", "--quiet", "-m", "unchanged"]);
    const again = await commitParkedFunction(dir, "fn", "escalation-exhausted", "tier", "note.md", ["src/unchanged.c"]);
    assert.equal(again.committed, false);
    assert.equal(again.detail, "nothing staged");
  } finally {
    cleanup();
  }
});
