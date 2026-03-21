/**
 * worktree.ts — Git worktree isolation for the orchestrator
 *
 * Each agent run gets its own worktree so failures can't leave dirty state
 * in the main repo. On success, results are merged back into trunk.
 */

import { execSync } from "child_process";
import { existsSync, symlinkSync, lstatSync, readlinkSync, rmSync } from "fs";
import { join, resolve } from "path";

export interface WorktreeInfo {
  funcName: string;
  branch: string;
  path: string;
  mainRoot: string;
}

export class WorktreeManager {
  constructor(private mainRoot: string) {}

  /**
   * Create a worktree for the given function.
   * Cleans up any stale worktree/branch from a prior failed run first.
   */
  create(funcName: string): WorktreeInfo {
    const branch = `decomp/${funcName}`;
    const wtPath = resolve(this.mainRoot, "..", "btn-worktrees", funcName);

    const info: WorktreeInfo = {
      funcName,
      branch,
      path: wtPath,
      mainRoot: this.mainRoot,
    };

    // Clean up stale worktree/branch if exists
    this.cleanupStaleWorktree(info);

    console.log(`  Worktree: creating ${wtPath} on branch ${branch}`);
    execSync(`git worktree add -b "${branch}" "${wtPath}" HEAD`, {
      cwd: this.mainRoot,
      stdio: ["pipe", "pipe", "pipe"],
    });

    return info;
  }

  /**
   * Prepare the worktree for building:
   * - Symlink gitignored paths from the main repo
   * - Initialize submodules
   * - Run make split to generate build artifacts
   */
  prepare(info: WorktreeInfo): void {
    console.log(`  Worktree: preparing ${info.path}`);

    // Initialize submodules FIRST (before symlinks, since rmSync of submodule
    // dirs would destroy symlinks placed inside them like old-gcc/build-gcc-2.8.1-psx)
    console.log(`  Worktree: initializing submodules`);
    const registeredSubs = execSync("git config --file .gitmodules --get-regexp path", {
      cwd: info.mainRoot,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim().split("\n").map((line) => line.split(" ")[1]);

    for (const sub of registeredSubs) {
      // git worktree add creates empty submodule dirs that block clone;
      // remove them so git submodule update --init can clone fresh
      const subPath = join(info.path, sub);
      if (existsSync(subPath)) {
        rmSync(subPath, { recursive: true, force: true });
      }
      execSync(`git submodule update --init "${sub}"`, {
        cwd: info.path,
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 60000,
      });
    }

    // Symlink gitignored paths AFTER submodule init (some symlinks go inside
    // submodule dirs like tools/old-gcc/build-gcc-2.8.1-psx)
    const symlinks: Array<{ target: string; link: string }> = [
      { target: join(info.mainRoot, "extracted"), link: join(info.path, "extracted") },
      { target: join(info.mainRoot, "node_modules"), link: join(info.path, "node_modules") },
      {
        target: join(info.mainRoot, "tools/old-gcc/build-gcc-2.8.1-psx"),
        link: join(info.path, "tools/old-gcc/build-gcc-2.8.1-psx"),
      },
    ];

    // .env is optional
    const envFile = join(info.mainRoot, ".env");
    if (existsSync(envFile)) {
      symlinks.push({ target: envFile, link: join(info.path, ".env") });
    }

    for (const { target, link } of symlinks) {
      if (!existsSync(target)) {
        console.log(`  Worktree: warning — ${target} does not exist, skipping symlink`);
        continue;
      }
      // Remove existing file/symlink at destination if present
      try {
        const stat = lstatSync(link, { throwIfNoEntry: false });
        if (stat?.isSymbolicLink() && readlinkSync(link) === target) continue;
        if (stat) rmSync(link, { recursive: true, force: true });
      } catch {
        // doesn't exist — fine
      }
      symlinkSync(target, link);
    }

    // Run make split to generate build/ artifacts in the worktree
    console.log(`  Worktree: running make split`);
    execSync("make split", {
      cwd: info.path,
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 120000,
    });
  }

  /**
   * Commit changes in the worktree. Returns true if a commit was created.
   */
  commit(info: WorktreeInfo, message: string): boolean {
    try {
      execSync("git add src/ include/ configs/", {
        cwd: info.path,
        stdio: ["pipe", "pipe", "pipe"],
      });

      // Check if there are staged changes
      try {
        execSync("git diff --cached --quiet", {
          cwd: info.path,
          stdio: ["pipe", "pipe", "pipe"],
        });
        // diff --quiet exits 0 = no changes
        console.log(`  Worktree: no changes to commit`);
        return false;
      } catch {
        // diff --quiet exits 1 = there are changes — commit them
      }

      execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
        cwd: info.path,
        stdio: ["pipe", "pipe", "pipe"],
      });
      console.log(`  Worktree: committed "${message}"`);
      return true;
    } catch (e: any) {
      console.log(`  Worktree: commit failed — ${e.message}`);
      return false;
    }
  }

  /**
   * Merge the worktree branch back into the current branch of the main repo.
   * Returns success status and error message on conflict.
   */
  merge(info: WorktreeInfo): { success: boolean; error?: string } {
    try {
      execSync(`git merge --no-ff "${info.branch}"`, {
        cwd: this.mainRoot,
        stdio: ["pipe", "pipe", "pipe"],
      });
      console.log(`  Worktree: merged ${info.branch} into trunk`);
      return { success: true };
    } catch (e: any) {
      // Merge conflict — abort and report
      try {
        execSync("git merge --abort", {
          cwd: this.mainRoot,
          stdio: ["pipe", "pipe", "pipe"],
        });
      } catch {
        // merge --abort can fail if there's nothing to abort
      }
      const error = `Merge conflict for ${info.branch}: ${e.message}`;
      console.log(`  Worktree: ${error}`);
      return { success: false, error };
    }
  }

  /**
   * Remove the worktree and optionally force-delete the branch.
   */
  cleanup(info: WorktreeInfo, force?: boolean): void {
    try {
      execSync(`git worktree remove --force "${info.path}"`, {
        cwd: this.mainRoot,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch {
      // Worktree may already be gone
    }

    try {
      const branchFlag = force ? "-D" : "-d";
      execSync(`git branch ${branchFlag} "${info.branch}"`, {
        cwd: this.mainRoot,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch {
      // Branch may already be gone or not fully merged
    }

    try {
      execSync("git worktree prune", {
        cwd: this.mainRoot,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch {
      // Non-fatal
    }

    console.log(`  Worktree: cleaned up ${info.path}`);
  }

  /**
   * Clean up any leftover worktrees from crashed runs (call at startup).
   */
  cleanupStale(): void {
    const wtDir = resolve(this.mainRoot, "..", "btn-worktrees");
    if (!existsSync(wtDir)) return;

    try {
      const output = execSync("git worktree list --porcelain", {
        cwd: this.mainRoot,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });

      // Parse worktree list for entries in our btn-worktrees directory
      const lines = output.split("\n");
      for (const line of lines) {
        if (line.startsWith("worktree ") && line.includes("btn-worktrees/")) {
          const wtPath = line.replace("worktree ", "");
          const funcName = wtPath.split("/").pop()!;
          console.log(`  Worktree: cleaning up stale worktree for ${funcName}`);
          this.cleanup(
            {
              funcName,
              branch: `decomp/${funcName}`,
              path: wtPath,
              mainRoot: this.mainRoot,
            },
            true,
          );
        }
      }
    } catch {
      // Non-fatal — just prune what we can
      try {
        execSync("git worktree prune", {
          cwd: this.mainRoot,
          stdio: ["pipe", "pipe", "pipe"],
        });
      } catch {
        // ignore
      }
    }
  }

  /**
   * Remove a specific stale worktree/branch (used internally before creating a new one).
   */
  private cleanupStaleWorktree(info: WorktreeInfo): void {
    // Check if worktree path already exists
    if (existsSync(info.path)) {
      try {
        execSync(`git worktree remove --force "${info.path}"`, {
          cwd: this.mainRoot,
          stdio: ["pipe", "pipe", "pipe"],
        });
      } catch {
        // May not be a registered worktree — ignore
      }
    }

    // Check if branch already exists
    try {
      execSync(`git rev-parse --verify "${info.branch}"`, {
        cwd: this.mainRoot,
        stdio: ["pipe", "pipe", "pipe"],
      });
      // Branch exists — delete it
      execSync(`git branch -D "${info.branch}"`, {
        cwd: this.mainRoot,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch {
      // Branch doesn't exist — fine
    }

    try {
      execSync("git worktree prune", {
        cwd: this.mainRoot,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch {
      // Non-fatal
    }
  }
}
