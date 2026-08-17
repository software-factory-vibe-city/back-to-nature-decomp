import { runCommand } from "../autonomous/process.ts";
import type { ParkReason } from "./types.ts";

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
 * A park is a result too, and it is spelled `park <function>` so history says
 * plainly which functions the ladder handed back rather than finished.
 */
export function parkCommitMessage(
  functionName: string,
  reason: ParkReason,
  tierLabel: string,
  notePath: string,
): string {
  return [
    `park ${functionName}`,
    "",
    `Parked by /auto_decompilation_loop on ${tierLabel}: ${reason}.`,
    `The function is back on INCLUDE_ASM and needs a human decision; see ${notePath}.`,
  ].join("\n");
}

/**
 * Commit exactly the files this function's work touched, on the current branch.
 *
 * The file list comes from the loop's own changed-file reading, which has
 * already subtracted the dirt that pre-dated the loop — so unrelated working
 * tree state stays where the user left it instead of being swept into an
 * automated commit.
 */
async function commitFiles(projectRoot: string, files: string[], message: string): Promise<CommitResult> {
  if (files.length === 0) return { committed: false, detail: "nothing to commit" };

  const staged = await runCommand("git", ["add", "--", ...files], { cwd: projectRoot, timeoutMs: 60_000 });
  if (staged.code !== 0) {
    return { committed: false, detail: `git add failed: ${staged.stderr || staged.stdout}` };
  }

  const pending = await runCommand("git", ["diff", "--cached", "--name-only"], { cwd: projectRoot, timeoutMs: 60_000 });
  if (pending.code === 0 && !pending.stdout.trim()) {
    return { committed: false, detail: "nothing staged" };
  }

  const commit = await runCommand("git", ["commit", "-m", message], {
    cwd: projectRoot,
    timeoutMs: 120_000,
  });
  if (commit.code !== 0) {
    return { committed: false, detail: `git commit failed: ${commit.stderr || commit.stdout}` };
  }

  const head = await runCommand("git", ["rev-parse", "--short", "HEAD"], { cwd: projectRoot, timeoutMs: 30_000 });
  return { committed: true, detail: head.code === 0 ? head.stdout.trim() : "committed" };
}

export async function commitMatchedFunction(
  projectRoot: string,
  functionName: string,
  tierLabel: string,
  files: string[],
): Promise<CommitResult> {
  return commitFiles(projectRoot, files, commitMessage(functionName, tierLabel));
}

/**
 * Commit the park, for the same reason a match is committed: the next function
 * must start from a tree that holds no unfinished business of the last one.
 *
 * An uncommitted park is charged to whoever comes next. Its `src/<fn>.c` and
 * its approvals note are dirt the loop cannot tell apart from the next
 * function's own edits, so they fail that function's scope gate, or ride into
 * its `match` commit under a subject line that names the wrong function. Either
 * way the park's cost is paid by a function that had nothing to do with it.
 */
export async function commitParkedFunction(
  projectRoot: string,
  functionName: string,
  reason: ParkReason,
  tierLabel: string,
  notePath: string,
  files: string[],
): Promise<CommitResult> {
  return commitFiles(projectRoot, files, parkCommitMessage(functionName, reason, tierLabel, notePath));
}
