import { basePointerText } from "./base-pointer.js";
import type { CandidatePlan } from "./enumerate.js";
import { groupNameAt } from "./enumerate.js";
import type { WebView } from "./web-partitions.js";
import type { SemanticGraph, SemanticNode } from "./types.js";

/**
 * Render one complete candidate source. Every change is a span replacement;
 * the baseline coordinate produces the input source byte-for-byte.
 */

interface Replacement {
  start: number;
  end: number;
  text: string;
}

/** Rename identifiers in statement text, skipping comments, strings, and field selectors. */
export function renameIdentifiers(text: string, renames: Map<string, string>): string {
  if (renames.size === 0) return text;
  let result = "";
  let index = 0;
  let previous = "";
  let beforePrevious = "";
  let state: "code" | "string" | "char" | "line-comment" | "block-comment" = "code";
  while (index < text.length) {
    const character = text[index]!;
    const next = text[index + 1];
    if (state === "line-comment") {
      result += character;
      if (character === "\n") state = "code";
      index++;
      continue;
    }
    if (state === "block-comment") {
      result += character;
      if (character === "*" && next === "/") { result += "/"; index += 2; state = "code"; continue; }
      index++;
      continue;
    }
    if (state === "string" || state === "char") {
      result += character;
      if (character === "\\") { result += next ?? ""; index += 2; continue; }
      if ((state === "string" && character === '"') || (state === "char" && character === "'")) state = "code";
      index++;
      continue;
    }
    if (character === "/" && next === "/") { state = "line-comment"; result += character; index++; continue; }
    if (character === "/" && next === "*") { state = "block-comment"; result += "/*"; index += 2; continue; }
    if (character === '"') { state = "string"; result += character; index++; continue; }
    if (character === "'") { state = "char"; result += character; index++; continue; }
    if (/[A-Za-z_]/.test(character)) {
      const match = text.slice(index).match(/^[A-Za-z_]\w*/)!;
      const name = match[0];
      const isField = previous === "." || (previous === ">" && beforePrevious === "-");
      result += !isField && renames.has(name) ? renames.get(name)! : name;
      index += name.length;
      beforePrevious = previous;
      previous = name[name.length - 1]!;
      continue;
    }
    result += character;
    if (!/\s/.test(character)) {
      beforePrevious = previous;
      previous = character;
    }
    index++;
  }
  return result;
}

function lineIndent(source: string, offset: number): string {
  const lineStart = source.lastIndexOf("\n", offset - 1) + 1;
  const match = source.slice(lineStart, offset).match(/^[ \t]*/);
  return match ? match[0] : "";
}

export function renderCandidate(
  source: string,
  graph: SemanticGraph,
  view: WebView,
  plan: CandidatePlan,
): string {
  const named = plan.partition.named;
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  /* Synthetic entries first: adjusted materialization hosts shadow originals. */
  const resolveNode = (id: string): SemanticNode => {
    const node = plan.syntheticNodes.get(id) ?? nodeById.get(id);
    if (!node) throw new Error(`internal: unknown node ${id} in render plan`);
    return node;
  };
  const regionNodeIds = new Set(plan.partition.regions.flatMap((region) => region.nodeIds));
  const replacements: Replacement[] = [];

  /* ---------------------------------------------------------------- */
  /* Base pointers: rewrite uses inside statement text, not as spans.  */
  /* ---------------------------------------------------------------- */

  /**
   * A lifted subscript sits inside a statement that a region may also reorder
   * and a partition may also rename, and all three want the same bytes. Region
   * and rename both work on the node's text, so this does too: the use spans
   * are converted to node-relative offsets and applied before renaming, which
   * is why the index that moved into the declaration is no longer there to be
   * renamed twice.
   */
  const liftedUses = new Map<string, Array<{ start: number; end: number; text: string }>>();
  const liftedSites = (plan.basePointers ?? []);
  for (const site of liftedSites) {
    const { useText } = basePointerText(site);
    for (const use of site.uses) {
      const bucket = liftedUses.get(use.nodeId) ?? [];
      bucket.push({ start: use.start, end: use.end, text: useText(use.offset) });
      liftedUses.set(use.nodeId, bucket);
    }
  }
  const applyLifts = (nodeId: string, text: string, baseOffset: number): string => {
    const uses = liftedUses.get(nodeId);
    if (!uses || uses.length === 0) return text;
    /* Right to left, so an earlier replacement cannot move a later offset. */
    let result = text;
    for (const use of [...uses].sort((left, right) => right.start - left.start)) {
      const from = use.start - baseOffset;
      const to = use.end - baseOffset;
      if (from < 0 || to > text.length) continue;
      result = result.slice(0, from) + use.text + result.slice(to);
    }
    return result;
  };
  const emitText = (node: SemanticNode, renames: Map<string, string>): string =>
    renameIdentifiers(applyLifts(node.id, node.text, node.span.start), renames);

  /**
   * Where each pointer's assignment goes, by the statement it precedes. A
   * region emits its statements as one replacement, so an assignment landing
   * inside one has to join that list rather than claim a span of its own —
   * two replacements over the same bytes is how a renderer corrupts a
   * candidate silently.
   */
  const assignmentsBefore = new Map<string, string[]>();

  const renameMapOf = (node: SemanticNode): Map<string, string> => {
    const renames = new Map<string, string>();
    for (const variable of node.reads) {
      const group = groupNameAt(view, named, node.id, variable, "read");
      if (group !== variable) renames.set(variable, group);
    }
    for (const variable of node.writes) {
      const group = groupNameAt(view, named, node.id, variable, "write");
      if (group !== variable) renames.set(variable, group);
    }
    return renames;
  };

  for (const site of liftedSites) {
    const { assignment } = basePointerText(site);
    const defineNode = nodeById.get(site.defineBeforeNodeId);
    assignmentsBefore.set(site.defineBeforeNodeId, [
      ...(assignmentsBefore.get(site.defineBeforeNodeId) ?? []),
      defineNode ? renameIdentifiers(assignment, renameMapOf(defineNode)) : assignment,
    ]);
  }
  const regionOwned = new Set(plan.partition.regions.flatMap((region) => region.nodeIds));

  /* ---------------------------------------------------------------- */
  /* Regions: reorder, drop birth definitions, apply renames.          */
  /* ---------------------------------------------------------------- */

  for (const region of plan.partition.regions) {
    const originalIds = region.nodeIds;
    const emittedIds = (plan.regionOrders.get(region.region.id) ?? originalIds)
      .filter((id) => !plan.birthNodes.has(id));
    const renamed = new Map(emittedIds.map((id) => [id, renameMapOf(resolveNode(id))]));

    /* A `for` header keeps only the updates this coordinate left behind. */
    const movable = region.region.movableUpdates;
    const moved = new Set(plan.movedUpdates.get(region.region.id) ?? []);
    if (movable.length > 0 && moved.size > 0) {
      const retained = movable.filter((id) => !moved.has(id));
      const nodes = movable.map((id) => nodeById.get(id)!);
      const text = retained
        .map((id) => {
          const node = nodeById.get(id)!;
          return renameIdentifiers(node.text, renameMapOf(node));
        })
        .join(", ");
      replacements.push({
        start: nodes[0]!.span.start,
        end: nodes[nodes.length - 1]!.span.end,
        text,
      });
    }

    const identical =
      moved.size === 0 &&
      emittedIds.join(",") === originalIds.join(",") &&
      [...renamed.values()].every((map) => map.size === 0) &&
      !originalIds.some((id) => liftedUses.has(id) || assignmentsBefore.has(id));
    if (identical) continue;
    const first = nodeById.get(originalIds[0]!)!;
    const last = nodeById.get(originalIds[originalIds.length - 1]!)!;
    const indent = lineIndent(source, first.span.start);
    const text = emittedIds
      .flatMap((id) => [...(assignmentsBefore.get(id) ?? []), emitText(resolveNode(id), renamed.get(id)!)])
      .join(`\n${indent}`);
    replacements.push({ start: first.span.start, end: last.span.end, text });
  }

  /* Which group each dropped definition is reborn on, needed both by the
   * scoped declarations below and by the entry cluster further down. */
  const birthByGroup = new Map<string, SemanticNode>();
  for (const id of plan.birthNodes) {
    const node = nodeById.get(id)!;
    const group = groupNameAt(view, named, id, node.writes[0]!, "write");
    birthByGroup.set(group, node);
  }

  /* ---------------------------------------------------------------- */
  /* Renames outside regions (conditions, returns, stores, macros).    */
  /* ---------------------------------------------------------------- */

  for (const node of graph.nodes) {
    if (regionNodeIds.has(node.id)) continue;
    /* Entry-block declarations belong to the cluster rewritten below. A
     * declaration in an opened case body has a scope of its own, so it is
     * renamed where it stands — including its initializer, which the cluster
     * has no way to reach, and including a birth, whose definition the region
     * has already dropped. */
    if (node.kind === "declaration") {
      if (node.block === 0) continue;
      const renames = renameMapOf(node);
      const declared = renames.get(node.declName!) ?? node.declName!;
      const birth = birthByGroup.get(declared);
      if (birth) {
        const rhs = renameIdentifiers(birth.rhs!, renameMapOf(birth));
        replacements.push({
          start: node.span.start,
          end: node.span.end,
          text: `${node.declType} ${declared} = ${rhs};`,
        });
      } else if (renames.size > 0 || liftedUses.has(node.id)) {
        replacements.push({ start: node.span.start, end: node.span.end, text: emitText(node, renames) });
      }
      continue;
    }
    /* A call's argument list is ordinary text over exact reads and writes, so
     * it renames like any other statement. An unknown node's text may hold a
     * nested scope or identifiers that are not variables at all, and a barrier
     * holds no identifiers, so neither is rewritten. */
    if (node.kind === "unknown" || node.kind === "barrier") continue;
    if (node.kind === "if") {
      const renames = new Map<string, string>();
      for (const variable of node.reads) {
        const group = groupNameAt(view, named, node.id, variable, "read");
        if (group !== variable) renames.set(variable, group);
      }
      if ((renames.size > 0 || liftedUses.has(node.id)) && node.condSpan) {
        const condition = source.slice(node.condSpan.start, node.condSpan.end);
        replacements.push({
          start: node.condSpan.start,
          end: node.condSpan.end,
          text: renameIdentifiers(applyLifts(node.id, condition, node.condSpan.start), renames),
        });
      }
      continue;
    }
    const renames = renameMapOf(node);
    if (renames.size > 0 || liftedUses.has(node.id)) {
      replacements.push({ start: node.span.start, end: node.span.end, text: emitText(node, renames) });
    }
  }

  /* ---------------------------------------------------------------- */
  /* Base-pointer declarations, at the top of the block they serve.    */
  /* ---------------------------------------------------------------- */

  /* The declaration always claims its own zero-width insertion at the block
   * top. The assignment does too, but only when its statement is not inside a
   * region that already emitted it above. */
  const insertions = new Map<string, string[]>();
  for (const site of liftedSites) {
    const { declaration } = basePointerText(site);
    insertions.set(site.declareBeforeNodeId,
      [...(insertions.get(site.declareBeforeNodeId) ?? []), declaration]);
  }
  for (const [nodeId, lines] of assignmentsBefore) {
    if (regionOwned.has(nodeId)) continue;
    insertions.set(nodeId, [...(insertions.get(nodeId) ?? []), ...lines]);
  }
  for (const [nodeId, lines] of insertions) {
    const node = nodeById.get(nodeId);
    if (!node) continue;
    const indent = lineIndent(source, node.span.start);
    replacements.push({
      start: node.span.start,
      end: node.span.start,
      text: `${lines.join(`\n${indent}`)}\n${indent}`,
    });
  }

  /* ---------------------------------------------------------------- */
  /* Switch form: the compare chain replaces the whole construct.      */
  /* ---------------------------------------------------------------- */

  for (const nodeId of plan.coordinate.switchForms ?? []) {
    const site = plan.switchForms.get(nodeId);
    const node = nodeById.get(nodeId);
    if (!site || !node) continue;
    replacements.push({ start: node.span.start, end: node.span.end, text: site.chainText });
  }

  /* ---------------------------------------------------------------- */
  /* Entry-block declaration cluster.                                  */
  /* ---------------------------------------------------------------- */

  const entryBlock = graph.blocks.find((block) => block.index === 0)!;
  const declarationNodes = entryBlock.nodeIds
    .map((id) => nodeById.get(id)!)
    .filter((node) => node.kind === "declaration");
  const groupByName = new Map(named.groups.map((group) => [group.name, group]));
  const originalNames = new Set(graph.variables.map((variable) => variable.name));
  /* Variables whose webs participate in the partition (their declarations may change). */
  const partitionedNames = new Set<string>();
  for (const group of named.groups) {
    for (const webId of group.webIds) {
      const web = view.websById.get(webId);
      if (web) partitionedNames.add(web.variable);
    }
  }

  const lines: string[] = [];
  let declarationsChanged = false;
  for (const declaration of declarationNodes) {
    const name = declaration.declName!;
    if (!partitionedNames.has(name)) {
      lines.push(declaration.text);
      continue;
    }
    const group = groupByName.get(name);
    if (!group) {
      /* Every web of this variable was renamed into other groups. */
      declarationsChanged = true;
      continue;
    }
    const birth = birthByGroup.get(name);
    if (birth) {
      const rhs = renameIdentifiers(birth.rhs!, renameMapOf(birth));
      lines.push(`${declaration.declType} ${name} = ${rhs};`);
      declarationsChanged = true;
    } else {
      lines.push(declaration.text);
    }
  }
  for (const group of named.groups) {
    if (group.parameterName !== undefined) continue;
    if (originalNames.has(group.name)) continue;
    const birth = birthByGroup.get(group.name);
    if (birth) {
      const rhs = renameIdentifiers(birth.rhs!, renameMapOf(birth));
      lines.push(`${group.typeText} ${group.name} = ${rhs};`);
    } else {
      lines.push(`${group.typeText} ${group.name};`);
    }
    declarationsChanged = true;
  }

  if (declarationsChanged) {
    if (declarationNodes.length > 0) {
      const first = declarationNodes[0]!;
      const last = declarationNodes[declarationNodes.length - 1]!;
      const indent = lineIndent(source, first.span.start);
      replacements.push({ start: first.span.start, end: last.span.end, text: lines.join(`\n${indent}`) });
    } else {
      const firstNode = entryBlock.nodeIds.map((id) => nodeById.get(id)!)[0];
      const insertAt = firstNode ? firstNode.span.start : graph.bodySpan.start + 1;
      const indent = firstNode ? lineIndent(source, firstNode.span.start) : "    ";
      replacements.push({ start: insertAt, end: insertAt, text: `${lines.join(`\n${indent}`)}\n${indent}` });
    }
  }

  /* ---------------------------------------------------------------- */
  /* Apply non-overlapping replacements.                               */
  /* ---------------------------------------------------------------- */

  replacements.sort((left, right) => left.start - right.start || left.end - right.end);
  for (let index = 1; index < replacements.length; index++) {
    if (replacements[index]!.start < replacements[index - 1]!.end) {
      throw new Error(`internal: overlapping render replacements at byte ${replacements[index]!.start}`);
    }
  }
  let result = "";
  let cursor = 0;
  for (const replacement of replacements) {
    result += source.slice(cursor, replacement.start);
    result += replacement.text;
    cursor = replacement.end;
  }
  result += source.slice(cursor);
  return result;
}
