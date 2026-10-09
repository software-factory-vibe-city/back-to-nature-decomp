/** All C/type inspection goes through the pinned tree-sitter front end. */
import { parseC, namedChildren, children, field, declaratorName, type Node } from "../residual-source-search/tree-sitter-c.js";
import { declaredFunction } from "../sdkTypes.js";
const narrowScalars = new Set(["char", "signed char", "unsigned char", "short", "short int", "signed short", "signed short int", "unsigned short", "unsigned short int", "int", "signed", "signed int", "unsigned", "unsigned int", "long", "long int", "signed long", "signed long int", "unsigned long", "unsigned long int", "s8", "u8", "s16", "u16", "s32", "u32", "u_char", "u_short", "u_int", "u_long"]);
function typedefName(node: Node): string {
  if (node.type === "type_identifier" || node.type === "identifier") return node.text;
  const inner = field(node, "declarator") ?? namedChildren(node).find((n) => n.type !== "parameter_list");
  return inner ? typedefName(inner) : node.text;
}
function tokens(node: Node): string[] {
  if (node.type === "comment") return [];
  const kids = children(node); return kids.length ? kids.flatMap(tokens) : [node.text];
}
interface TypeInspection { key: string; word: boolean; pointer: boolean; void: boolean; scopeSensitive: boolean; abiWords: 1 | 2 | null }
const wideScalars = new Set(["double", "long long", "long long int", "unsigned long long", "unsigned long long int", "signed long long", "signed long long int"]);
const inspections = new Map<string, TypeInspection>();
export function inspectType(type: string): TypeInspection {
  const existing = inspections.get(type); if (existing) return existing;
  const remember = (info: TypeInspection) => {
    if (inspections.size >= 4096) inspections.delete(inspections.keys().next().value!);
    inspections.set(type, info); return info;
  };
  const tree = parseC(`void M2C_type_probe(${type});`);
  try {
    const parameter = tree.rootNode.descendantsOfType("parameter_declaration")[0];
    if (!parameter || parameter.hasError) return remember({ key: type, word: false, pointer: false, void: false, scopeSensitive: true, abiWords: null });
    const declaring = field(parameter, "declarator");
    const pointerChain = (n: Node): boolean => ["abstract_pointer_declarator", "pointer_declarator", "abstract_array_declarator", "array_declarator"].includes(n.type) ||
      (n.type !== "parameter_list" && namedChildren(n).some(pointerChain));
    const pointer = !!declaring && pointerChain(declaring);
    const base = field(parameter, "type");
    const scalar = base ? tokens(base).join(" ") : "";
    return remember({ key: tokens(parameter).join(" "), word: pointer || narrowScalars.has(scalar), pointer, void: !declaring && scalar === "void", abiWords: pointer || narrowScalars.has(scalar) || scalar === "float" ? 1 : wideScalars.has(scalar) ? 2 : null, scopeSensitive: parameter.descendantsOfType("type_identifier").some((n) => !narrowScalars.has(n.text)) || parameter.descendantsOfType("struct_specifier").length > 0 || parameter.descendantsOfType("union_specifier").length > 0 });
  } finally { tree.delete(); }
}

/** The existing fixed-scalar storage-view layout, recovered from field ASTs.
 * No regex declaration parser, invented records, nonliteral bounds or bitfields. */
export function layoutFields(body: string): { fields: Array<{ name: string; offset: number; size: number }>; size: number } | null {
  const tree = parseC(`struct M2C_storage { ${body} };`);
  try {
    if (tree.rootNode.hasError) return null;
    const structure = tree.rootNode.descendantsOfType("struct_specifier")[0];
    const list = structure ? field(structure, "body") : null;
    if (!list) return null;
    const sizes = new Map<string, number>([["char", 1], ["u_char", 1], ["uchar", 1], ["s8", 1], ["u8", 1], ["short", 2], ["u_short", 2], ["ushort", 2], ["s16", 2], ["u16", 2], ["int", 4], ["long", 4], ["u_long", 4], ["ulong", 4], ["unsigned", 4], ["s32", 4], ["u32", 4]]);
    const fields: Array<{ name: string; offset: number; size: number }> = [];
    let offset = 0, alignment = 1;
    for (const declaration of namedChildren(list).filter((n) => n.type !== "comment")) {
      const base = field(declaration, "type"), size = base ? sizes.get(tokens(base).join(" ")) : undefined;
      if (!size || declaration.type !== "field_declaration" || declaration.descendantsOfType("bitfield_clause").length) return null;
      for (const declaring of declaration.childrenForFieldName("declarator")) {
        let name: string | undefined, count = 1;
        if (declaring.type === "field_identifier") name = declaring.text;
        else if (declaring.type === "array_declarator") {
          const inner = field(declaring, "declarator"), bound = field(declaring, "size");
          if (inner?.type !== "field_identifier" || bound?.type !== "number_literal") return null;
          name = inner.text; count = Number(bound.text);
          if (!Number.isSafeInteger(count) || count < 1 || count > 65536) return null;
        } else return null;
        offset = Math.ceil(offset / size) * size;
        fields.push({ name, offset, size: size * count });
        offset += size * count; alignment = Math.max(alignment, size);
      }
    }
    return fields.length ? { fields, size: Math.ceil(offset / alignment) * alignment } : null;
  } finally { tree.delete(); }
}

/** O32 word positions only when the type's own AST/dependency declaration proves
 * its width. No guessed size for an arbitrary typedef or by-value aggregate. */
export function slotsWithTypedefs(types: string[], source: string): Array<number | null> {
  const tree = parseC(source);
  try {
    const definitions = new Map(tree.rootNode.descendantsOfType("type_definition").flatMap((d) =>
      d.childrenForFieldName("declarator").map((decl) => [typedefName(decl), { definition: d, declarator: decl }] as const)));
    const classify = (type: string, active = new Set<string>()): number | null => {
      const info = inspectType(type); if (info.word) return 1;
      if (active.has(type)) return null;
      const definition = definitions.get(type);
      if (!definition) return null;
      const declarator = definition.declarator;
      /* Named callback pointer typedefs have parenthesised pointer chains. */
      const probe = (n: Node): boolean => n.type === "pointer_declarator" ||
        (n.type !== "parameter_list" && namedChildren(n).some(probe));
      if (probe(declarator)) return 1;
      const base = field(definition.definition, "type");
      return base ? classify(base.text, new Set(active).add(type)) : null;
    };
    let position: number | null = 0;
    return types.map((type) => {
      const width = classify(type);
      if (position === null || width === null) { position = null; return null; }
      const slot = position; position += width; return slot;
    });
  } finally { tree.delete(); }
}

/** Resolve named-type identity in its defining preprocessed scope. Public
 * headers keep one identity across callers; private equal spellings do not. */
export function typeScopes(types: string[], source: string, lineOf: (row: number) => { file: string; line: number }, fallback: string): string[] {
  const tree = parseC(source);
  try {
    const origins = new Map<string, string>();
    for (const definition of tree.rootNode.descendantsOfType("type_definition")) for (const declarator of definition.childrenForFieldName("declarator"))
      origins.set(typedefName(declarator), lineOf(definition.startPosition.row).file);
    for (const definition of [...tree.rootNode.descendantsOfType("struct_specifier"), ...tree.rootNode.descendantsOfType("union_specifier")]) {
      const tag = field(definition, "name"); if (tag && field(definition, "body")) origins.set(`${definition.type}:${tag.text}`, lineOf(definition.startPosition.row).file);
    }
    return types.map((type) => {
      const descriptor = parseC(`void M2C_scope(${type});`);
      try {
        const names = descriptor.rootNode.descendantsOfType("type_identifier").filter((n) => !narrowScalars.has(n.text)).map((n) => n.text);
        for (const tag of [...descriptor.rootNode.descendantsOfType("struct_specifier"), ...descriptor.rootNode.descendantsOfType("union_specifier")]) {
          const name = field(tag, "name"); if (name) names.push(`${tag.type}:${name.text}`);
        }
        return names.length ? [...new Set(names)].sort().map((name) => `${origins.get(name) ?? fallback}:${name}`).join(";") : "word";
      } finally { descriptor.delete(); }
    });
  } finally { tree.delete(); }
}

/** Defining-C reads are seed evidence, not reads of held-out root bodies.
 * Inner declarations shadow parameters. Declaring identifiers, field names,
 * comments, strings and plain assignment LHSs are not reads. */
export function parameterReads(source: string, functionName: string): boolean[] {
  const tree = parseC(source);
  try {
    const fn = tree.rootNode.descendantsOfType("function_definition").find((n) => declaratorName(field(n, "declarator"))?.text === functionName);
    if (!fn) return [];
    const declaring = field(fn, "declarator");
    const core = declaring ? declaredFunction(declaring) : undefined;
    const list = core ? field(core, "parameters") : undefined;
    const params = list ? namedChildren(list).filter((n) => n.type === "parameter_declaration") : [];
    const body = field(fn, "body");
    return params.filter((p) => !!field(p, "declarator") || !inspectType(field(p, "type")?.text ?? "").void).map((parameter) => {
      const name = declaratorName(field(parameter, "declarator"))?.text;
      if (!name || !body) return false;
      return body.descendantsOfType("identifier").some((identifier) => {
        if (identifier.text !== name) return false;
        const parent = identifier.parent;
        if (parent?.type === "assignment_expression" && field(parent, "left")?.id === identifier.id && field(parent, "operator")?.text === "=") return false;
        for (let ancestor = identifier.parent; ancestor && ancestor.id !== fn.id; ancestor = ancestor.parent) {
          if (ancestor.type === "declaration" && ancestor.childrenForFieldName("declarator").some((d) => declaratorName(d)?.id === identifier.id)) return false;
          if (ancestor.type === "compound_statement" && namedChildren(ancestor).filter((n) => n.type === "declaration" && n.startIndex <= identifier.startIndex)
            .some((d) => d.childrenForFieldName("declarator").some((declarator) => declaratorName(declarator)?.text === name))) return false;
        }
        return true;
      });
    });
  } finally { tree.delete(); }
}

/** Project only the outer parameter list. Dependencies, return spelling and
 * nested callback parameters remain intact. null means genuinely unspecified. */
export function projectParameters(signature: string, count: number | null, name?: string): string {
  const tree = parseC(signature);
  try {
    const functionDecl = namedChildren(tree.rootNode).filter((n) => n.type === "declaration")
      .flatMap((n) => n.childrenForFieldName("declarator").map(declaredFunction))
      .find((n) => n && (!name || declaratorName(n)?.text === name));
    const parameters = functionDecl ? field(functionDecl, "parameters") : undefined;
    if (!parameters) throw new Error("No AST function parameter list in seed signature");
    const declarations = namedChildren(parameters).filter((n) => n.type === "parameter_declaration" && n.text !== "void");
    if (count !== null && (!Number.isInteger(count) || count < 0 || count > declarations.length)) throw new Error("Invalid projected parameter count");
    const projected = count === null ? "()" : count === 0 ? "(void)" : `(${declarations.slice(0, count).map((n) => n.text).join(", ")})`;
    return signature.slice(0, parameters.startIndex) + projected + signature.slice(parameters.endIndex);
  } finally { tree.delete(); }
}

export function unspecifiedParameters(signature: string, name?: string): string {
  return projectParameters(signature, null, name);
}
