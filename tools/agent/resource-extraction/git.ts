import { spawnSync } from "node:child_process";
import { safePath } from "./storage.ts";

export function git(root: string, args: string[]): string {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`git ${args[0]} failed: ${result.stderr || result.error || result.stdout}`);
  return args.includes("-z") ? result.stdout : result.stdout.trim();
}
export function changedFiles(root: string): string[] {
  const output = git(root, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
  if (!output) return [];
  const tokens = output.split("\0");
  const files: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const record = tokens[i]!;
    if (record.length < 4) continue;
    files.push(record.slice(3));
    if (record[0] === "R" || record[0] === "C" || record[1] === "R" || record[1] === "C") files.push(tokens[++i]!);
  }
  return [...new Set(files)].sort();
}
export function commitScoped(root: string, files: string[], message: string): string {
  if (!files.length) throw new Error("No accepted iteration files to commit");
  for (const file of files) {
    safePath(root, file);
    if (file.startsWith("build/") || file.startsWith("extracted/") || file.startsWith("src/")) throw new Error("Generated assets/inputs/game sources cannot enter an extraction commit");
  }
  // Refuse unrelated staged work, never sweep it into our commit. Unrelated
  // unstaged work is neither restored nor included.
  const staged = git(root, ["diff", "--cached", "--name-only", "-z"]).split("\0").filter(Boolean);
  if (staged.some(file => !files.includes(file))) throw new Error("Unrelated staged files: refusing automatic commit");
  git(root, ["add", "--", ...files]);
  try {
    git(root, ["commit", "--only", "-m", message, "--", ...files]);
  } catch (error) {
    // Leave a failed commit available for inspection, not silently discarded.
    throw error;
  }
  return git(root, ["rev-parse", "HEAD"]);
}
