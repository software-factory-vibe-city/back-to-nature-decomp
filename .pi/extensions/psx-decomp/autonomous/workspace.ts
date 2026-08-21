import { createHash, randomUUID } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readlinkSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type { AutodecompConfig, WorkspaceInfo } from "./types.ts";
import { runCommand } from "./process.ts";

async function git(projectRoot: string, args: string[], cwd = projectRoot, env?: NodeJS.ProcessEnv, timeoutMs = 120_000) {
  const result = await runCommand("git", args, { cwd, env, timeoutMs });
  if (result.code !== 0) throw new Error(`git ${args.join(" ")} failed:\n${result.stderr || result.stdout}`);
  /* trimEnd only: a leading trim would eat the status column of the first
     --porcelain line (" M path" -> "M path"), corrupting slice(3) parsing */
  return result.stdout.trimEnd();
}

export async function headRevision(projectRoot: string): Promise<string> {
  return git(projectRoot, ["rev-parse", "HEAD"]);
}

export async function trackedDirtyFiles(projectRoot: string): Promise<string[]> {
  const output = await git(projectRoot, ["status", "--porcelain=v1", "--untracked-files=no", "--ignore-submodules=dirty"]);
  return output ? output.split("\n").map((line) => line.slice(3).trim()).filter(Boolean) : [];
}

async function gitDir(projectRoot: string): Promise<string> {
  const path = await git(projectRoot, ["rev-parse", "--absolute-git-dir"]);
  return resolve(path);
}

export async function createTreeFromWorktree(
  projectRoot: string,
  worktree: string,
  roots: string[],
): Promise<string> {
  const temp = mkdtempSync(join(tmpdir(), "autodecomp-index-"));
  const index = join(temp, "index");
  const env = { GIT_INDEX_FILE: index, GIT_DIR: await gitDir(projectRoot), GIT_WORK_TREE: resolve(worktree) };
  try {
    await git(projectRoot, ["read-tree", "HEAD"], worktree, env);
    await git(projectRoot, ["add", "-A", "--", ...roots], worktree, env);
    return await git(projectRoot, ["write-tree"], worktree, env);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

export async function treePatch(projectRoot: string, fromTree: string, toTree: string, roots: string[]): Promise<string> {
  const result = await runCommand("git", ["diff", "--binary", "--no-ext-diff", fromTree, toTree, "--", ...roots], {
    cwd: projectRoot,
    timeoutMs: 120_000,
    maxCaptureBytes: 32 * 1024 * 1024,
  });
  if (result.code !== 0) throw new Error(`Unable to create integration patch:\n${result.stderr || result.stdout}`);
  return result.stdout;
}

export async function changedFilesBetweenTrees(projectRoot: string, fromTree: string, toTree: string): Promise<string[]> {
  const output = await git(projectRoot, ["diff", "--name-only", fromTree, toTree]);
  return output ? output.split("\n").filter(Boolean) : [];
}

export async function workspaceChangedFiles(workspace: string): Promise<string[]> {
  const output = await git(workspace, ["status", "--porcelain=v1", "--untracked-files=all", "--ignore-submodules=all"]);
  if (!output) return [];
  const files: string[] = [];
  for (const line of output.split("\n")) {
    const raw = line.slice(3).trim();
    const renamed = raw.includes(" -> ") ? raw.split(" -> ").at(-1)! : raw;
    if (renamed) files.push(renamed.replace(/^\"|\"$/g, ""));
  }
  return [...new Set(files)].sort();
}

/**
 * Split a changed-file list into files that were already dirty when a
 * baseline was captured (preExisting) and files dirtied afterwards (newFiles).
 * Used by the finalize scope gate so pre-existing workspace dirt (user WIP,
 * local vendor patches) cannot block finalization of an unrelated function.
 */
export function filterNewChanges(
  changedFiles: string[],
  baseline: Iterable<string>,
): { newFiles: string[]; preExisting: string[] } {
  const baselineSet = baseline instanceof Set ? baseline : new Set(baseline);
  const newFiles: string[] = [];
  const preExisting: string[] = [];
  for (const file of changedFiles) {
    (baselineSet.has(file) ? preExisting : newFiles).push(file);
  }
  return { newFiles, preExisting };
}

export function patchHash(patch: string): string {
  return createHash("sha256").update(patch).digest("hex");
}

function ensureSymlink(target: string, link: string): void {
  if (!existsSync(target)) return;
  mkdirSync(dirname(link), { recursive: true });
  try {
    const stat = lstatSync(link, { throwIfNoEntry: false });
    if (stat?.isSymbolicLink() && readlinkSync(link) === target) return;
    if (stat) rmSync(link, { recursive: true, force: true });
  } catch {
    /* Missing destination. */
  }
  symlinkSync(target, link);
}

/**
 * The make goals that populate a workspace's generated sources.
 *
 * `null` — an unpinned run — means every container, which is `split-all`. A
 * pinned run splits the executable plus each named container; `split-exe` is
 * spelled `split`, the target that predates containers and every note that
 * names it.
 */
export function splitTargets(containers: string[] | null): string[] {
  if (containers === null) return ["split-all"];
  const overlays = containers.filter((id) => id !== "exe").map((id) => `split-${id}`);
  return ["split", ...overlays];
}

export async function createWorkspace(
  projectRoot: string,
  config: AutodecompConfig,
  id: string = randomUUID(),
  containers: string[] | null = null,
): Promise<WorkspaceInfo> {
  const baseHead = await headRevision(projectRoot);
  const baselineTree = await createTreeFromWorktree(projectRoot, projectRoot, config.integration.allowedRoots);
  const path = resolve(config.runtimeDir, "workspaces", id);
  mkdirSync(dirname(path), { recursive: true });
  if (existsSync(path)) rmSync(path, { recursive: true, force: true });

  await git(projectRoot, ["worktree", "add", "--detach", path, baseHead], projectRoot, undefined, 120_000);
  try {
    const submodules = await runCommand("git", ["submodule", "update", "--init", "--recursive"], {
      cwd: path,
      timeoutMs: 10 * 60_000,
    });
    if (submodules.code !== 0) throw new Error(`Submodule preparation failed:\n${submodules.stderr || submodules.stdout}`);

    ensureSymlink(join(projectRoot, "extracted"), join(path, "extracted"));
    ensureSymlink(join(projectRoot, "node_modules"), join(path, "node_modules"));

    const oldGcc = join(projectRoot, "tools", "vendor", "old-gcc");
    if (existsSync(oldGcc)) {
      for (const entry of readdirSync(oldGcc)) {
        if (entry.startsWith("build-gcc-") && entry.endsWith("-psx")) {
          ensureSymlink(join(oldGcc, entry), join(path, "tools", "vendor", "old-gcc", entry));
        }
      }
    }

    if (baselineTree !== baseHead) {
      const baselinePatch = await treePatch(projectRoot, baseHead, baselineTree, config.integration.allowedRoots);
      if (baselinePatch.trim()) {
        const patchPath = join(config.runtimeDir, "workspaces", `${id}.baseline.patch`);
        writeFileSync(patchPath, baselinePatch);
        const applied = await runCommand("git", ["apply", "--whitespace=nowarn", patchPath], { cwd: path, timeoutMs: 120_000 });
        if (applied.code !== 0) throw new Error(`Unable to apply accumulated baseline to workspace:\n${applied.stderr || applied.stdout}`);
      }
    }

    /* Every container this workspace may have to build. The executable is
       always split — every overlay links against its symbol export — and beyond
       that either the named containers or, when the run is not pinned, all of
       them. Splitting only the executable leaves an overlay with no assembly to
       include and a link that fails on symbols the workspace never saw. */
    const targets = splitTargets(containers);
    const split = await runCommand("make", targets, { cwd: path, timeoutMs: 15 * 60_000 });
    if (split.code !== 0) throw new Error(`Workspace ${targets.join(" ")} failed:\n${split.stderr || split.stdout}`);
    return { id, path, baseHead, baselineTree };
  } catch (error) {
    await removeWorkspace(projectRoot, path);
    throw error;
  }
}

export async function cleanupRuntimeWorkspaces(projectRoot: string, runtimeDir: string): Promise<void> {
  const result = await runCommand("git", ["worktree", "list", "--porcelain"], { cwd: projectRoot, timeoutMs: 120_000 });
  if (result.code !== 0) return;
  const root = resolve(runtimeDir, "workspaces");
  for (const line of result.stdout.split("\n")) {
    if (!line.startsWith("worktree ")) continue;
    const path = resolve(line.slice("worktree ".length));
    if (path === root || path.startsWith(`${root}/`)) await removeWorkspace(projectRoot, path);
  }
}

export async function removeWorkspace(projectRoot: string, path: string): Promise<void> {
  await runCommand("git", ["worktree", "remove", "--force", path], { cwd: projectRoot, timeoutMs: 120_000 });
  await runCommand("git", ["worktree", "prune"], { cwd: projectRoot, timeoutMs: 120_000 });
  if (existsSync(path)) rmSync(path, { recursive: true, force: true });
}

export async function applyPatch(projectRoot: string, patchPath: string): Promise<void> {
  const check = await runCommand("git", ["apply", "--check", patchPath], { cwd: projectRoot, timeoutMs: 120_000 });
  if (check.code !== 0) throw new Error(`Patch no longer applies to trunk:\n${check.stderr || check.stdout}`);
  const apply = await runCommand("git", ["apply", "--whitespace=nowarn", patchPath], { cwd: projectRoot, timeoutMs: 120_000 });
  if (apply.code !== 0) throw new Error(`Patch application failed:\n${apply.stderr || apply.stdout}`);
}

export async function reversePatch(projectRoot: string, patchPath: string): Promise<void> {
  const result = await runCommand("git", ["apply", "-R", "--whitespace=nowarn", patchPath], { cwd: projectRoot, timeoutMs: 120_000 });
  if (result.code !== 0) throw new Error(`Patch rollback failed:\n${result.stderr || result.stdout}`);
}
