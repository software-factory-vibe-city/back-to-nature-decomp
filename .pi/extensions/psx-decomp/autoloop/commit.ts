import { runCommand } from "../autonomous/process.ts";

export interface CommitResult {
  committed: boolean;
  detail: string;
}

/**
 * The subject line matches the project's history: `match <function>`, with the
 * escalation tier recorded in the body so a later reader can tell which rung
 * of the ladder produced the source. No attribution trailers.
 */
export function commitMessage(functionName: string, tierLabel: string): string {
  return [
    `match ${functionName}`,
    "",
    `Byte-exact and finalized by /auto_decompilation_loop on ${tierLabel}.`,
  ].join("\n");
}

/**
 * Commit exactly the files this function's work touched.
 *
 * The file list comes from the finalize oracle, which has already subtracted
 * the dirt that pre-dated the loop — so unrelated working-tree state stays
 * where the user left it instead of being swept into an automated commit.
 * Committing happens on the current branch, never on a new one.
 */
export async function commitMatchedFunction(
  projectRoot: string,
  functionName: string,
  tierLabel: string,
  files: string[],
): Promise<CommitResult> {
  if (files.length === 0) return { committed: false, detail: "nothing to commit" };

  const staged = await runCommand("git", ["add", "--", ...files], { cwd: projectRoot, timeoutMs: 60_000 });
  if (staged.code !== 0) {
    return { committed: false, detail: `git add failed: ${staged.stderr || staged.stdout}` };
  }

  const pending = await runCommand("git", ["diff", "--cached", "--name-only"], { cwd: projectRoot, timeoutMs: 60_000 });
  if (pending.code === 0 && !pending.stdout.trim()) {
    return { committed: false, detail: "nothing staged" };
  }

  const commit = await runCommand("git", ["commit", "-m", commitMessage(functionName, tierLabel)], {
    cwd: projectRoot,
    timeoutMs: 120_000,
  });
  if (commit.code !== 0) {
    return { committed: false, detail: `git commit failed: ${commit.stderr || commit.stdout}` };
  }

  const head = await runCommand("git", ["rev-parse", "--short", "HEAD"], { cwd: projectRoot, timeoutMs: 30_000 });
  return { committed: true, detail: head.code === 0 ? head.stdout.trim() : "committed" };
}
