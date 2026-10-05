/** Scope identities and both context projections share this AST declaration model.
 * Preprocessing is performed by the configured target cpp, never the host ABI.
 */
import { children, field, namedChildren, parseC, walk, type Node } from "./residual-source-search/tree-sitter-c.js";
import { extractPrototypesFromSource, extractSignaturesFromSource, typeNamesIn } from "./sdkTypes.js";

export interface Declaration {
  name: string;
  kind: "type" | "object" | "function";
  scope: string;
  origin: string;
  text: string;
  dependencies: string[];
  visibility: "public-header" | "source-local";
  ownership?: "extern" | "definition";
}
export interface GlobalView {
  symbol: string;
  backing: string;
  expression: string;
  declaration: string;
  origin: string;
  baseOffset: number | null;
}
export interface DeclarationIndex {
  declarations: Declaration[];
  views: GlobalView[];
  conflicts: Array<{ name: string; origins: string[]; definitions: string[] }>;
  unsupported: Array<{ origin: string; text: string; reason: string }>;
}
export function emptyDeclarationIndex(): DeclarationIndex {
  return { declarations: [], views: [], conflicts: [], unsupported: [] };
}
function nameOf(node: Node | null | undefined): string | undefined {
  if (!node) return undefined;
  if (["identifier", "type_identifier"].includes(node.type)) return node.text;
  return nameOf(field(node, "declarator")) ?? namedChildren(node).map(nameOf).find(Boolean);
}
const normalized = new Map<string, string>();
const indexed = new WeakMap<DeclarationIndex, { seen: Set<string>; declarations: Declaration[]; length: number }>();
const normal = (source: string): string => {
  const cached = normalized.get(source);
  if (cached !== undefined) return cached;
  const tree = parseC(source);
  const tokens = (node: Node): string[] => {
    if (node.type === "comment" || (node.type === "storage_class_specifier" && node.text === "extern")) return [];
    const kids = children(node); return kids.length ? kids.flatMap(tokens) : [node.text];
  };
  try {
    const value = JSON.stringify(tokens(tree.rootNode));
    if (normalized.size >= 4096) normalized.clear();
    normalized.set(source, value);
    return value;
  } finally { tree.delete(); }
};
function forwardTag(source: string): boolean {
  const tree = parseC(source);
  try {
    const root = namedChildren(tree.rootNode).filter((n) => n.type !== "comment");
    const node = root[0], type = node?.type === "declaration" ? field(node, "type") : node;
    return root.length === 1 && !!type && ["struct_specifier", "union_specifier"].includes(type.type) && !field(type, "body") && !(node?.childrenForFieldName("declarator").length);
  } finally { tree.delete(); }
}

/** Input is already preprocessed; callers supply the actual declaration scope. */
export function indexDeclarations(index: DeclarationIndex, source: string, origin: string, scope: string,
  visibility: Declaration["visibility"]): void {
  let state = indexed.get(index);
  /* Projection callers may explicitly remove held-out declarations. Such an
     edit is a new index state, not permission to suppress their next input. */
  if (!state || state.declarations !== index.declarations || state.length !== index.declarations.length) {
    state = { seen: new Set(), declarations: index.declarations, length: index.declarations.length }; indexed.set(index, state);
  }
  const identity = JSON.stringify([origin, scope, visibility, source]);
  if (state.seen.has(identity)) return;
  const tree = parseC(source);
  const root = tree.rootNode;
  /* Scope and preprocessing output are both identity fields. Same text from a
     different TU is NOT the same declaration. Broken input remains explicit. */
  if (!root.hasError) state.seen.add(identity);
  const add = (name: string, kind: Declaration["kind"], text: string, ownership?: Declaration["ownership"]) => {
    const declaration: Declaration = { name, kind, text, origin, scope, visibility,
      dependencies: [...typeNamesIn(text)].filter((dep) => dep !== name).sort(), ...(ownership ? { ownership } : {}) };
    /* A struct tag is a separate namespace, not a missing typedef of the same name. */
    const tags = new Set<string>();
    const tagsTree = parseC(text);
    walk(tagsTree.rootNode, (n) => {
      if (["struct_specifier", "union_specifier", "enum_specifier"].includes(n.type)) {
        const tag = field(n, "name"); if (tag) tags.add(tag.text);
      }
      return true;
    });
    tagsTree.delete();
    declaration.dependencies = declaration.dependencies.filter((dep) => !tags.has(dep));
    const peers = index.declarations.filter((d) => d.name === name && d.kind === kind && d.scope === scope);
    if (peers.some((p) => normal(p.text) === normal(text))) return;
    if (kind === "type" && (name.startsWith("struct ") || name.startsWith("union "))) {
      if (forwardTag(text) && peers.length) return;
      const incomplete = peers.filter((p) => forwardTag(p.text));
      if (incomplete.length) index.declarations = index.declarations.filter((d) => !incomplete.includes(d));
      if (incomplete.length === peers.length) { index.declarations.push(declaration); return; }
    }
    if (peers.length) index.conflicts.push({ name, origins: [...peers.map((p) => p.origin), origin], definitions: [...peers.map((p) => p.text), text] });
    index.declarations.push(declaration);
  };
  for (const node of namedChildren(root)) {
    if (node.type === "type_definition") {
      for (const d of node.childrenForFieldName("declarator")) { const n = nameOf(d); if (n) add(n, "type", node.text); }
      const type = field(node, "type");
      if (type && ["struct_specifier", "union_specifier", "enum_specifier"].includes(type.type)) {
        const tag = field(type, "name");
        if (tag) add(`${type.type.split("_")[0]} ${tag.text}`, "type", `${type.text};`);
      }
    } else if (["struct_specifier", "union_specifier", "enum_specifier"].includes(node.type)) {
      const name = field(node, "name");
      if (name) add(`${node.type.split("_")[0]} ${name.text}`, "type", `${node.text};`);
    } else if (node.type === "declaration") {
      const prototypes = extractPrototypesFromSource(node.text);
      for (const p of prototypes) add(p.name, "function", p.signature);
      if (prototypes.length) continue;
      const asm = namedChildren(node).find((n) => n.type === "gnu_asm_expression");
      const text = asm ? source.slice(node.startIndex, asm.startIndex).trimEnd() + ";" : node.text;
      for (const d of node.childrenForFieldName("declarator")) {
        if (!d || d.type === "gnu_asm_expression") continue;
        const n = nameOf(d);
        if (n) add(n, "object", text, namedChildren(node).some((n) => n.type === "storage_class_specifier" && n.text === "extern") ? "extern" : "definition");
      }
      /* A named struct definition inside a declaration is also a type witness. */
      const type = field(node, "type");
      if (type && ["struct_specifier", "union_specifier", "enum_specifier"].includes(type.type)) {
        const name = field(type, "name");
        if (name && field(type, "body")) add(`${type.type.split("_")[0]} ${name.text}`, "type", `${type.text};`);
      }
    } else if (node.type === "function_definition") {
      for (const p of extractSignaturesFromSource(node.text)) add(p.name, "function", p.signature);
    } else if (node.type === "ERROR") {
      index.unsupported.push({ origin, text: node.text, reason: "target-preprocessed declaration did not parse" });
    }
  }
  tree.delete();
  state.declarations = index.declarations; state.length = index.declarations.length;
}

/** Interpret the existing alias idiom from its cast and backing declaration.
 * Arbitrary macros remain unsupported; a macro's textual name is not its type.
 */
export function globalViews(source: string, origin: string): { views: GlobalView[]; unsupported: DeclarationIndex["unsupported"] } {
  const views: GlobalView[] = [];
  const unsupported: DeclarationIndex["unsupported"] = [];
  const sourceTree = parseC(source), root = sourceTree.rootNode;
  const unparen = (node: Node | null | undefined): Node | null => node?.type === "parenthesized_expression" ? unparen(namedChildren(node)[0]) : node ?? null;
  const byteType = (node: Node | null | undefined): boolean => {
    if (!node) return false;
    const tokens = (n: Node): string[] => { const kids = children(n); return kids.length ? kids.flatMap(tokens) : [n.text]; };
    return new Set(["char", "unsigned char", "signed char", "u8", "s8"]).has(tokens(node).join(" "));
  };
  const objects = new Map<string, string>();
  walk(root, (node) => {
    if (node.type !== "declaration") return true;
    for (const d of node.childrenForFieldName("declarator")) {
      const name = nameOf(d); if (name && d?.type !== "gnu_asm_expression") objects.set(name, node.text);
    }
    return false;
  });
  walk(root, (node) => {
    if (node.type !== "preproc_def") return true;
    const name = field(node, "name")?.text;
    const expression = field(node, "value")?.text;
    if (!name?.startsWith("D_") || !expression) return false;
    const parsed = parseC(`void view(void) { ${expression}; }`);
    try {
    const statement = parsed.rootNode.descendantsOfType("expression_statement")[0];
    const exposed = unparen(statement ? namedChildren(statement)[0] : null);
    let cast: Node | undefined;
    walk(parsed.rootNode, (n) => { if (n.type === "cast_expression" && !cast) cast = n; return true; });
    if (!cast) {
      const ids = parsed.rootNode.descendantsOfType("identifier").filter((n) => objects.has(n.text));
      const backing = ids.length === 1 ? ids[0]!.text : undefined;
      if (backing && exposed?.type === "identifier" && exposed.text === backing) {
        const original = objects.get(backing)!;
        const tree = parseC(original);
        const id = tree.rootNode.descendantsOfType("identifier").find((n) => n.text === backing)!;
        const asm = tree.rootNode.descendantsOfType("gnu_asm_expression")[0];
        const end = asm?.startIndex ?? original.lastIndexOf(";");
        const declaration = (original.slice(0, id.startIndex) + name + original.slice(id.endIndex, end)).trimEnd() + ";";
        tree.delete();
        views.push({ symbol: name, backing, expression, declaration, origin, baseOffset: 0 });
        return false;
      }
    }
    const descriptor = cast ? field(cast, "type") : null;
    const value = cast ? field(cast, "value") : null;
    const backing = value?.descendantsOfType("identifier").find((n) => objects.has(n.text))?.text ??
      (value?.type === "identifier" && objects.has(value.text) ? value.text : undefined);
    /* The outer cast pointer exposes an object; inspect declarators, never
       a star-shaped text fragment that could occur inside a comment. */
    const arrayPointer = descriptor?.descendantsOfType("abstract_parenthesized_declarator").find((n) => namedChildren(n).some((d) => d.type === "abstract_pointer_declarator" && !field(d, "declarator")));
    const pointer = descriptor?.descendantsOfType("abstract_pointer_declarator").find((n) => !field(n, "declarator"));
    const type = descriptor && pointer ? (descriptor.text.slice(0, pointer.startIndex - descriptor.startIndex) + descriptor.text.slice(pointer.endIndex - descriptor.startIndex)).trim() : undefined;
    if (!type || !backing || exposed?.type !== "pointer_expression" || field(exposed, "operator")?.text !== "*") {
      unsupported.push({ origin, text: node.text, reason: "global alias is not a witnessed dereferenced pointer-cast view" });
      return false;
    }
    const literal = (n: Node): number | null => {
      if (n.type === "number_literal") { const v = Number(n.text.replace(/[uUlL]+$/, "")); return Number.isSafeInteger(v) ? v : null; }
      if (n.type === "unary_expression" && field(n, "operator")?.text === "-") {
        const operand = field(n, "argument"); const v = operand ? literal(operand) : null; return v === null ? null : -v;
      }
      return null;
    };
    const bias = (n: Node | null | undefined): { offset: number | null; bytePointer: boolean } => {
      if (!n) return { offset: null, bytePointer: false };
      if (n.type === "identifier" && n.text === backing) {
        const tree = parseC(objects.get(backing)!);
        try {
          const object = namedChildren(tree.rootNode)[0];
          return { offset: 0, bytePointer: byteType(object ? field(object, "type") : null) && !!object?.descendantsOfType("array_declarator").length };
        } finally { tree.delete(); }
      }
      if (n.type === "parenthesized_expression") return bias(namedChildren(n)[0] ?? null);
      if (n.type === "pointer_expression" && field(n, "operator")?.text === "&") return bias(field(n, "argument"));
      if (n.type === "cast_expression") {
        const p = bias(field(n, "value"));
        const descriptor = field(n, "type"), declaring = descriptor ? field(descriptor, "declarator") : null;
        return { ...p, bytePointer: byteType(descriptor ? field(descriptor, "type") : null) && declaring?.type === "abstract_pointer_declarator" && !field(declaring, "declarator") };
      }
      if (n.type === "binary_expression") {
        const left = field(n, "left"), right = field(n, "right"), op = field(n, "operator")?.text;
        const p = bias(left); const amount = right ? literal(right) : null;
        if (p.offset !== null && p.bytePointer && amount !== null && (op === "+" || op === "-")) return { offset: p.offset + (op === "+" ? amount : -amount), bytePointer: true };
      }
      return { offset: null, bytePointer: false };
    };
    const offset = bias(value).offset;
    const declaration = arrayPointer && descriptor ?
      `extern ${descriptor.text.slice(0, arrayPointer.startIndex - descriptor.startIndex)}${name}${descriptor.text.slice(arrayPointer.endIndex - descriptor.startIndex)};` : `extern ${type} ${name};`;
    views.push({ symbol: name, backing, expression, declaration, origin,
      /* A nontrivial base expression remains explicit, not silently rounded to zero. */
      baseOffset: offset });
    return false;
    } finally { parsed.delete(); }
  });
  sourceTree.delete();
  return { views, unsupported };
}

/** Dependency closure in one scope, with public declarations as the shared scope.
 * Conflicts and missing definitions refuse projection rather than order-ranking witnesses.
 */
export function projectDeclarations(index: DeclarationIndex, names: Iterable<string>, scope: string, options: { omitPublicTypes?: boolean } = {}): {
  text: string; selected: Declaration[]; unknown: string[]; excluded: string[];
} {
  const selected: Declaration[] = [];
  const unknown = new Set<string>();
  const done = new Set<string>();
  const active = new Set<string>();
  const visit = (name: string) => {
    if (done.has(name) || active.has(name)) return;
    active.add(name);
    const local = index.declarations.filter((d) => d.name === name && d.scope === scope);
    const candidates = local.length ? local : index.declarations.filter((d) => d.name === name && d.scope === "public");
    if (candidates.length !== 1) { unknown.add(name); active.delete(name); done.add(name); return; }
    const d = candidates[0]!;
    for (const dep of d.dependencies) visit(dep);
    /* struct-tag uses need their definitions too, not just typedef identifiers. */
    const tree = parseC(d.text);
    walk(tree.rootNode, (n) => {
      if (["struct_specifier", "union_specifier"].includes(n.type) && !field(n, "body")) {
        const tag = field(n, "name"); if (tag && `${n.type.split("_")[0]} ${tag.text}` !== name) visit(`${n.type.split("_")[0]} ${tag.text}`);
      }
      return true;
    });
    tree.delete();
    selected.push(d);
    active.delete(name); done.add(name);
  };
  for (const name of [...names].sort()) visit(name);
  /* Tags are forward-declared to make pointer cycles legal. No fake complete layouts. */
  const emitted = selected.filter((d) => !options.omitPublicTypes || d.kind !== "type" || d.visibility !== "public-header");
  const forwards = emitted.filter((d) => d.name.startsWith("struct ") || d.name.startsWith("union ")).map((d) => `${d.name};`);
  const definitions: string[] = [];
  for (const d of emitted) {
    const tree = parseC(d.text);
    const node = namedChildren(tree.rootNode)[0];
    const type = node ? field(node, "type") : null;
    const tag = type ? field(type, "name") : null;
    if (node?.type === "type_definition" && type && tag && ["struct_specifier", "union_specifier"].includes(type.type)) {
      const key = `${type.type.split("_")[0]} ${tag.text}`;
      forwards.push(`${key};`, `typedef ${key} ${d.name};`);
      if (field(type, "body")) definitions.push(`${type.text};`);
    } else definitions.push(d.text);
    tree.delete();
  }
  return { text: [...new Set(forwards), ...new Set(definitions)].join("\n\n") + "\n",
    selected, unknown: [...unknown].sort(), excluded: index.declarations.filter((d) => !selected.includes(d)).map((d) => `${d.scope}:${d.name}`) };
}
