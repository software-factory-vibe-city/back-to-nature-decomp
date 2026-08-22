import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readLedger } from "../../../../tools/agent/experimentLedger.ts";
import { buildIndex } from "../../../../tools/agent/residualSignatures.ts";

/**
 * The functions a park has implicated.
 *
 * Two relations, both cheap and both derived rather than guessed:
 *
 *  - **residual signature.** The parked function's measurements recorded the
 *    shapes of its open blocks. Any other function whose measurements carried
 *    one of those shapes is the same problem written twice — that is what a
 *    signature means — so whatever stopped this one will stop that one.
 *  - **suspected translation unit.** `notes/file-groupings.md` records
 *    same-file membership with evidence. Members of a group share the author's
 *    idioms and the build's per-TU facts, which is exactly the layer a park
 *    most often turns out to be about.
 *
 * Deferred, never skipped. The relation says "the answer to this one is
 * probably the answer to those", which is a reason to work them *after* the
 * cause is understood, not a reason to abandon them. Working them before is
 * what turned four functions of one family into three hours and four parks.
 */
export function implicatedByPark(projectRoot: string, parked: string): string[] {
  const implicated = new Set<string>();

  for (const name of bySignature(parked)) implicated.add(name);
  for (const name of byGrouping(projectRoot, parked)) implicated.add(name);
  implicated.delete(parked);
  return [...implicated];
}

function bySignature(parked: string): string[] {
  const signatures = new Set(readLedger(parked).flatMap((entry) => entry.signatures ?? []));
  if (signatures.size === 0) return [];
  const out = new Set<string>();
  for (const record of buildIndex().records) {
    if (!signatures.has(record.signature)) continue;
    for (const carrier of record.carriers) out.add(carrier.function);
  }
  return [...out];
}

/**
 * The other members of the parked function's suspected group.
 *
 * Read from the ledger note rather than from a derived index, because the note
 * is where the evidence lives and there is no other record of it. The parse is
 * deliberately shallow: a group is a `## ` heading, its members are the
 * `- <symbol>` bullets under a `Members` heading, and anything the note says
 * beyond that is for a human.
 */
function byGrouping(projectRoot: string, parked: string): string[] {
  const path = join(projectRoot, "notes/file-groupings.md");
  if (!existsSync(path)) return [];
  const lines = readFileSync(path, "utf8").split("\n");

  const groups: string[][] = [];
  let members: string[] | undefined;
  for (const line of lines) {
    if (/^##\s/.test(line)) {
      if (members && members.length > 0) groups.push(members);
      members = undefined;
      continue;
    }
    if (/^Members\b/i.test(line.trim())) {
      members = [];
      continue;
    }
    if (members === undefined) continue;
    /* The file's own convention for a member: a symbol, then a match-status
       marker in parentheses — `(m)`, `(s)`, `(?)`. Requiring the marker is what
       separates a member from the prose bullets that share the list, which
       otherwise contribute their first word as a function name. */
    const bullet = line.match(/^-\s+([A-Za-z_]\w*)\b[^(\n]*\((?:m|s|\?)\b/);
    if (bullet) members.push(bullet[1]!);
  }
  if (members && members.length > 0) groups.push(members);

  return groups.filter((group) => group.includes(parked)).flat();
}
