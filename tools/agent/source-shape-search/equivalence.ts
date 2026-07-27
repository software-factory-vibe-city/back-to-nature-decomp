import type { EquivalenceClass, VariantLineage } from "./types.js";

export function equivalenceClasses(
  stage: EquivalenceClass["stage"],
  entries: Array<{ id: string; hash?: string }>,
  lineages: Map<string, VariantLineage>,
): EquivalenceClass[] {
  const groups = new Map<string, string[]>();
  for (const entry of entries) {
    if (!entry.hash) continue;
    const members = groups.get(entry.hash) || [];
    members.push(entry.id);
    groups.set(entry.hash, members);
  }
  return [...groups].map(([hash, members]) => {
    const sorted = [...members].sort((left, right) => compareLineage(lineages.get(left), lineages.get(right), left, right));
    return { stage, hash, representative: sorted[0]!, members: sorted };
  }).sort((left, right) => left.hash.localeCompare(right.hash));
}

function compareLineage(left: VariantLineage | undefined, right: VariantLineage | undefined, leftId: string, rightId: string): number {
  if (!left || !right) return leftId.localeCompare(rightId);
  return left.changedDimensions - right.changedDimensions ||
    left.editRegions - right.editRegions ||
    left.changedSpan - right.changedSpan ||
    left.naturalPriority - right.naturalPriority ||
    left.sourceHash.localeCompare(right.sourceHash) ||
    leftId.localeCompare(rightId);
}
