import { readFileSync, readdirSync, type Dirent } from "node:fs";
import { join } from "node:path";
import { CPP_FLAGS } from "../decompToolchain.js";
import { children, declaratorName, field, namedChildren, parseC, walk, type Node } from "./tree-sitter-c.js";
import type { BasePointerSite, SemanticGraph, SemanticNode } from "./types.js";

/**
 * How many independent base groups one function may lift. Each is a mask bit,
 * so the section count doubles per site; the bound keeps a wide function from
 * making the domain unenumerable on this axis alone.
 */
export const MAX_BASE_POINTER_SITES = 3;

/** Below two uses a pointer is a rename, not a shared base. */
const MIN_USES = 2;

/* ------------------------------------------------------------------ */
/* Data symbol types, read from the configured include path            */
/* ------------------------------------------------------------------ */

export interface SymbolTypes {
  /** `s32 NAME[3];` -> element type of `NAME[i]`. */
  arrays: Map<string, string>;
  /** `s32 NAME;` -> element type of `(&NAME)[i]`, the repo's run idiom. */
  scalars: Map<string, string>;
}

let cachedSymbolTypes: SymbolTypes | undefined;

/**
 * The declared type of each data symbol the include path names.
 *
 * The type has to come from a declaration, never from the shape of a use:
 * `&D_80049370[i]` is an `s32 *` only because a header says the array holds
 * `s32`. A symbol this cannot read has no entry, and every site that would
 * need it is refused rather than typed by guess.
 */
export function symbolTypes(): SymbolTypes {
  if (cachedSymbolTypes) return cachedSymbolTypes;
  const arrays = new Map<string, string>();
  const scalars = new Map<string, string>();
  const seen = new Set<string>();

  /**
   * Declarations live under the header guard, so this descends through
   * preprocessor blocks rather than reading only the translation unit's direct
   * children. Function bodies are skipped: a local is not a data symbol.
   */
  const record = (root: Node, text: string): void => {
    const visit = (node: Node): void => {
      if (node.type === "function_definition" || node.type === "compound_statement") return;

      /* `#define NAME (*((T*)_NAME))` is how the generated header spells a
       * symbol the source indexes as `(&NAME)[i]`; the cast names the element
       * type outright, so the run idiom is typed from the declaration too. */
      if (node.type === "preproc_def") {
        const name = field(node, "name");
        const value = field(node, "value");
        if (name && value) {
          const match = text.slice(value.startIndex, value.endIndex)
            .match(/^\s*\(\s*\*\s*\(\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\*\s*\)/);
          if (match) scalars.set(name.text, match[1]!);
        }
        return;
      }

      if (node.type === "declaration") {
        const typeNode = field(node, "type");
        if (typeNode) {
          const typeText = text.slice(typeNode.startIndex, typeNode.endIndex).trim().replace(/\s+/g, " ");
          if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(typeText)) {
            for (const child of namedChildren(node)) {
              if (child.id === typeNode.id) continue;
              if (child.type === "array_declarator") {
                const inner = field(child, "declarator");
                if (inner?.type === "identifier") arrays.set(inner.text, typeText);
                continue;
              }
              if (child.type === "identifier") scalars.set(child.text, typeText);
            }
          }
        }
        return;
      }
      for (const child of namedChildren(node)) visit(child);
    };
    visit(root);
  };

  const scan = (directory: string, depth: number): void => {
    if (depth > 4) return;
    let entries: Dirent[];
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        scan(path, depth + 1);
        continue;
      }
      if (!entry.name.endsWith(".h") || seen.has(path)) continue;
      seen.add(path);
      try {
        const text = readFileSync(path, "utf8");
        record(parseC(text).rootNode, text);
      } catch {
        /* An unreadable or unparsable header contributes no types. */
      }
    }
  };
  for (const flag of CPP_FLAGS) {
    if (flag.startsWith("-I")) scan(flag.slice(2), 0);
  }
  cachedSymbolTypes = { arrays, scalars };
  return cachedSymbolTypes;
}

/* ------------------------------------------------------------------ */
/* Subscripts that share a base                                        */
/* ------------------------------------------------------------------ */

interface Occurrence {
  nodeId: string;
  start: number;
  end: number;
  offset: number;
  reads: string[];
}

/** `E`, `E + 3`, and `3 + E` all index the same base at a constant offset. */
export function splitIndex(index: Node, source: string): { base: string; offset: number } {
  const text = (node: Node): string =>
    source.slice(node.startIndex, node.endIndex).trim().replace(/\s+/g, " ");
  if (index.type === "binary_expression") {
    const operator = children(index).find((child) => child.type === "+" || child.type === "-");
    const left = field(index, "left");
    const right = field(index, "right");
    if (operator && left && right) {
      if (/^\d+$/.test(text(right))) {
        return { base: text(left), offset: (operator.type === "+" ? 1 : -1) * Number(text(right)) };
      }
      /* Only addition commutes; `3 - E` is not `E` at an offset. */
      if (operator.type === "+" && /^\d+$/.test(text(left))) {
        return { base: text(right), offset: Number(text(left)) };
      }
    }
  }
  return { base: text(index), offset: 0 };
}

function identifiersIn(node: Node): string[] {
  const names = new Set<string>();
  walk(node, (item) => {
    if (item.type === "identifier") names.add(item.text);
    return true;
  });
  return [...names];
}

/** True when the subtree can be evaluated once without changing the program. */
function isPure(node: Node): boolean {
  let pure = true;
  walk(node, (item) => {
    if (item.type === "call_expression" || item.type === "assignment_expression" ||
      item.type === "update_expression" || item.type === "comma_expression") {
      pure = false;
      return false;
    }
    return true;
  });
  return pure;
}

/** `D_80049370` from `D_80049370[i]`; `D_8006BF48` from `(&D_8006BF48)[i]`. */
function arraySymbol(argument: Node, source: string, types: SymbolTypes):
{ name: string; elementType: string; addressOf: boolean } | undefined {
  if (argument.type === "identifier") {
    const elementType = types.arrays.get(argument.text);
    return elementType ? { name: argument.text, elementType, addressOf: false } : undefined;
  }
  const text = source.slice(argument.startIndex, argument.endIndex).trim();
  const match = text.match(/^\(\s*&\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)$/);
  if (!match) return undefined;
  const elementType = types.scalars.get(match[1]!);
  return elementType ? { name: match[1]!, elementType, addressOf: true } : undefined;
}

/** The parse node whose span is exactly this statement's. */
function statementNode(root: Node, node: SemanticNode): Node | undefined {
  let found: Node | undefined;
  walk(root, (item) => {
    if (item.startIndex > node.span.start || item.endIndex < node.span.end) return false;
    if (item.startIndex === node.span.start && item.endIndex === node.span.end) found = item;
    return found === undefined;
  });
  return found;
}

/**
 * Groups of subscripts on one array that share an index, so one pointer to
 * that element reaches all of them.
 *
 * This is the form the residual keeps asking for and the grammar could not
 * spell. `D_80049370[i]`, `D_80049370[i + 1]`, `D_80049370[i + 2]` are three
 * addresses off one base. The source can say that outright —
 * `s32 *p = &D_80049370[i];` and then `p[0]`, `p[1]`, `p[2]` — and the choice
 * between the two spellings is a decision the original author made, not a
 * cosmetic one: it changes which quantity is live, for how long, and therefore
 * what the allocator does with it. Hand-authored variants of exactly this
 * shape are what have moved this project's allocation residual; the point of
 * the rule is that the search can now reach them without being told.
 *
 * Nothing is assumed. The index must be pure; every use must sit in one block
 * the grammar can rewrite; nothing from the declaration's insertion point
 * through the last use may write what the index reads or touch memory the
 * model cannot see; and the element type must come from a declaration.
 */
export function basePointerSites(options: {
  graph: SemanticGraph;
  source: string;
  closureNodes: Set<string>;
  flowOrder: string[];
  reserved: Set<string>;
}): { sites: BasePointerSite[]; refusals: string[] } {
  const { graph, source, closureNodes, flowOrder, reserved } = options;
  const types = symbolTypes();
  const refusals: string[] = [];
  const orderIndex = new Map(flowOrder.map((id, index) => [id, index]));
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const variableNames = new Set(graph.variables.map((variable) => variable.name));
  const tree = parseC(source);

  /* symbol -> index text -> occurrences */
  const groups = new Map<string, Map<string, Occurrence[]>>();
  const elementTypeOf = new Map<string, string>();
  const symbolOf = new Map<string, string>();

  for (const node of graph.nodes) {
    if (!closureNodes.has(node.id) || !orderIndex.has(node.id)) continue;
    /* An `if` condition holds subscripts too, and the renderer rewrites a
     * condition span, so those uses are as reachable as a statement's. */
    if (node.kind !== "assign" && node.kind !== "store" &&
      node.kind !== "known-macro" && node.kind !== "if") continue;
    const statement = statementNode(tree.rootNode, node);
    if (!statement) continue;
    /* An `if` owns its condition, not its branches: the branch statements are
     * nodes of their own, in blocks of their own, and a pointer declared out
     * here would be scoped to the wrong one. */
    const own = node.kind === "if" && node.condSpan ? node.condSpan : undefined;
    walk(statement, (item) => {
      if (item.type !== "subscript_expression") return true;
      if (own && (item.startIndex < own.start || item.endIndex > own.end)) return true;
      const argument = field(item, "argument");
      const index = field(item, "index");
      if (!argument || !index || !isPure(index)) return true;
      const symbol = arraySymbol(argument, source, types);
      if (!symbol) return true;
      const split = splitIndex(index, source);
      /* One pointer is declared in one block and serves that block's uses, so
       * the block is part of the group's identity. The same shared base in
       * three cases is three independent decisions, not one. */
      const key = `${symbol.addressOf ? `(&${symbol.name})` : symbol.name}#b${node.block}`;
      elementTypeOf.set(key, symbol.elementType);
      symbolOf.set(key, symbol.addressOf ? `(&${symbol.name})` : symbol.name);
      const byIndex = groups.get(key) ?? new Map<string, Occurrence[]>();
      const bucket = byIndex.get(split.base) ?? [];
      bucket.push({
        nodeId: node.id,
        start: item.startIndex,
        end: item.endIndex,
        offset: split.offset,
        reads: identifiersIn(index),
      });
      byIndex.set(split.base, bucket);
      groups.set(key, byIndex);
      return true;
    });
  }

  interface Admissible {
    key: string; indexText: string; occurrences: Occurrence[]; block: number;
    declareBefore: string; defineBefore: string; distinctOffsets: number;
  }
  const admissible: Admissible[] = [];
  const ordered = [...groups].sort((left, right) => left[0].localeCompare(right[0]));
  for (const [key, byIndex] of ordered) {
    for (const [indexText, occurrences] of [...byIndex].sort((left, right) => left[0].localeCompare(right[0]))) {
      if (occurrences.length < MIN_USES) continue;

      const blocks = new Set(occurrences.map((item) => nodeById.get(item.nodeId)!.block));
      if (blocks.size !== 1) {
        refusals.push(`${key}[${indexText}]: used across ${blocks.size} blocks, so one declaration cannot scope them`);
        continue;
      }
      const block = [...blocks][0]!;
      const blockNodes = graph.blocks[block]!.nodeIds;

      /* C89 puts every declaration at the top of the block, so the pointer is
       * declared there and assigned where its index is ready. That is one
       * spelling of two: `T *p = &X[i];` is a different program to GCC than
       * `T *p; p = &X[i];`, and only the second is general, because an index
       * computed inside the block is not available at the block top. The
       * initializer spelling is recorded as unsearched rather than pretended. */
      let prologue = 0;
      while (prologue < blockNodes.length && nodeById.get(blockNodes[prologue]!)?.kind === "declaration") prologue++;
      const declareBefore = blockNodes[prologue];
      if (declareBefore === undefined || !orderIndex.has(declareBefore)) {
        refusals.push(`${key}[${indexText}]: the block has no statement after its declarations to declare against`);
        continue;
      }

      const positions = occurrences.map((item) => orderIndex.get(item.nodeId)!);
      const firstUse = Math.min(...positions);
      const indexReads = new Set(occurrences.flatMap((item) => item.reads).filter((name) => variableNames.has(name)));

      /* The assignment goes after the last in-block definition of anything the
       * index reads; that statement is the pointer's input, not a disturbance. */
      let definePosition = orderIndex.get(declareBefore)!;
      for (let position = definePosition; position < firstUse; position++) {
        const node = nodeById.get(flowOrder[position]!);
        if (!node || node.block !== block) continue;
        if (node.writes.some((write) => indexReads.has(write))) definePosition = position + 1;
      }
      const defineBefore = flowOrder[definePosition];
      if (defineBefore === undefined || nodeById.get(defineBefore)?.block !== block) {
        refusals.push(`${key}[${indexText}]: no statement in the block follows the index's definition`);
        continue;
      }

      const to = Math.max(...positions);
      const disturber = firstDisturber({
        nodeById, flowOrder, from: definePosition, to, indexReads,
        useNodes: new Set(occurrences.map((item) => item.nodeId)),
      });
      if (disturber) {
        refusals.push(`${key}[${indexText}]: ${disturber} between the pointer's assignment and its last use`);
        continue;
      }

      admissible.push({
        key, indexText, occurrences, block, declareBefore, defineBefore,
        distinctOffsets: new Set(occurrences.map((item) => item.offset)).size,
      });
    }
  }

  /* Rank before capping. A group with several distinct offsets is a shared
   * base — one address serving `p[0]`, `p[1]`, `p[2]` — which is the form the
   * allocation residual responds to. A group whose offsets are all the same is
   * plain redundancy, worth less, and goes after. Ties break on use count and
   * then on the key, so the choice is deterministic. */
  admissible.sort((left, right) =>
    right.distinctOffsets - left.distinctOffsets ||
    right.occurrences.length - left.occurrences.length ||
    left.key.localeCompare(right.key));

  const sites: BasePointerSite[] = [];
  for (const entry of admissible) {
    const { key, indexText, occurrences, block, declareBefore, defineBefore } = entry;
    if (sites.length >= MAX_BASE_POINTER_SITES) {
      refusals.push(
        `${key}[${indexText}] is admissible but not enumerated; ` +
        `the bound is ${MAX_BASE_POINTER_SITES} base-pointer site(s) and it ranked ${admissible.indexOf(entry) + 1}`);
      continue;
    }

    let variable = `p${sites.length}`;
    while (reserved.has(variable)) variable = `${variable}_`;
    reserved.add(variable);

    {
      sites.push({
        siteId: `base@${key}@${indexText.replace(/\s+/g, "")}`,
        symbol: symbolOf.get(key)!,
        indexText,
        elementType: elementTypeOf.get(key)!,
        variable,
        block,
        declareBeforeNodeId: declareBefore,
        defineBeforeNodeId: defineBefore,
        uses: occurrences
          .slice()
          .sort((left, right) => left.start - right.start)
          .map((item) => ({ nodeId: item.nodeId, start: item.start, end: item.end, offset: item.offset })),
        evidence: [
          `${occurrences.length} subscript(s) of ${key} share the index ${indexText}, so one pointer to ` +
          `&${key}[${indexText}] reaches all of them at offsets ` +
          `${[...new Set(occurrences.map((item) => item.offset))].sort((a, b) => a - b).join(", ")}.`,
          `Element type ${elementTypeOf.get(key)!} comes from a declaration in the configured include path.`,
          "Nothing between the pointer's assignment and its last use writes what the index reads, " +
          "and no unknown-effect statement sits between them.",
          "Spelled as a block-top declaration plus an assignment; the initializer spelling is not searched.",
        ],
      });
    }
  }
  return { sites, refusals };
}

/**
 * The first statement that would make the lifted address wrong, or undefined.
 *
 * A direct write to something the index reads disqualifies the whole range,
 * including the statements that hold uses: if a use's own statement assigns
 * the index, the later uses in it read a different element.
 *
 * Unknown memory effects are judged only in the gaps between uses. A statement
 * that holds a use evaluates that subscript as part of itself, so its own call
 * cannot retroactively move an address the same statement just computed —
 * whereas a call sitting *between* two uses genuinely can, and is refused.
 */
function firstDisturber(options: {
  nodeById: Map<string, SemanticNode>;
  flowOrder: string[];
  from: number;
  to: number;
  indexReads: Set<string>;
  useNodes: Set<string>;
}): string | undefined {
  const { nodeById, flowOrder, from, to, indexReads, useNodes } = options;
  for (let position = from; position <= to; position++) {
    const node = nodeById.get(flowOrder[position]!);
    if (!node) continue;
    const clobbered = node.writes.filter((write) => indexReads.has(write));
    if (clobbered.length > 0) return `${node.id} writes ${clobbered.join(", ")}`;
    if (useNodes.has(node.id)) continue;
    if (node.memoryWrites.includes("*unknown*")) return `${node.id} has unknown memory effects`;
  }
  return undefined;
}

/**
 * The declaration and the rewritten uses for one lifted base.
 *
 * `offset 0` reads as `*p` rather than `p[0]`: both compile identically, and
 * the pointer form is what period source writes when the base itself is the
 * value it wants.
 */
export function basePointerText(site: BasePointerSite): {
  declaration: string;
  assignment: string;
  useText: (offset: number) => string;
} {
  return {
    declaration: `${site.elementType} *${site.variable};`,
    assignment: `${site.variable} = &${site.symbol}[${site.indexText}];`,
    useText: (offset: number) => (offset === 0 ? `*${site.variable}` : `${site.variable}[${offset}]`),
  };
}
