/**
 * fileGroupings.ts — who else was in this function's translation unit.
 *
 * `notes/file-groupings.md` is a hand-maintained ledger of suspected same-file
 * membership, with the evidence that justifies each entry. It is prose for a
 * human, and three tools already read it by the same shallow convention: a
 * group is a `## ` heading, its members are the `- <symbol> (m|s|?)` bullets
 * under a `Members` heading, and everything else in the note is for the reader.
 *
 * Requiring the match-status marker is what separates a member from the prose
 * bullets that share the list — without it, an evidence bullet contributes its
 * first word as a function name.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./decompToolchain.js";

const NOTE = join(ROOT, "notes/file-groupings.md");

export interface FileGroup {
  /** The `## ` heading the group was recorded under. */
  heading: string;
  members: string[];
}

export function readGroups(path = NOTE): FileGroup[] {
  if (!existsSync(path)) return [];
  const groups: FileGroup[] = [];
  let heading = "";
  let members: string[] | undefined;

  const flush = (): void => {
    if (members && members.length > 0) groups.push({ heading, members });
    members = undefined;
  };

  for (const line of readFileSync(path, "utf8").split("\n")) {
    const head = line.match(/^##\s+(.*)$/);
    if (head) {
      flush();
      heading = head[1]!.trim();
      continue;
    }
    if (/^Members\b/i.test(line.trim())) {
      members = [];
      continue;
    }
    if (members === undefined) continue;
    /* The marker terminates on punctuation or space rather than on a word
       boundary: `(?)` has no word character after the `?`, so a `\b` test drops
       every membership-uncertain entry — which is a whole class of the note's
       own notation, and the class most worth reading. */
    const bullet = line.match(/^-\s+([A-Za-z_]\w*)\b[^(\n]*\((?:m|s|\?)(?=[,)\s])/);
    if (bullet) members.push(bullet[1]!);
  }
  flush();
  return groups;
}

/**
 * The other members of every group this function is recorded in.
 *
 * Empty when the note records no group for it, which is the common case and
 * not an error: the ledger is a prior, not a partition.
 */
export function siblingsOf(functionName: string, path = NOTE): string[] {
  const seen = new Set<string>();
  for (const group of readGroups(path)) {
    if (!group.members.includes(functionName)) continue;
    for (const member of group.members) if (member !== functionName) seen.add(member);
  }
  return [...seen];
}

/** The heading of the first group this function is recorded in. */
export function groupHeadingOf(functionName: string, path = NOTE): string | undefined {
  return readGroups(path).find((group) => group.members.includes(functionName))?.heading;
}
