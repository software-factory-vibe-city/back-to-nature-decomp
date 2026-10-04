/** General emission limitations demonstrated by frozen, original-assembly
 * fixtures. This audit never changes the emitted C or supplies missing types. */
import { field, parseC } from "./residual-source-search/tree-sitter-c.js";
import type { UnknownFact } from "./campaign/packet.js";

export function auditM2cArithmetic(source: string, path: string): UnknownFact[] {
  const tree = parseC(source);
  const pointers = new Set(tree.rootNode.descendantsOfType("pointer_declarator")
    .flatMap((n) => n.descendantsOfType("identifier").map((id) => id.text)));
  const facts: UnknownFact[] = [];
  for (const node of tree.rootNode.descendantsOfType("binary_expression")) {
    const op = field(node, "operator")?.text;
    const left = field(node, "left");
    if ((op !== "+" && op !== "-") || left?.type !== "identifier" || !pointers.has(left.text)) continue;
    facts.push({ subject: "typed-pointer byte displacement", strength: "conditional",
      span: { path, start: node.startIndex, end: node.endIndex }, constraints: [node.text],
      evidence: ["tools/agent/fixtures/static-preparation/byte-offset.s", "tools/agent/fixtures/static-preparation/context.c", path],
      missing: "m2c can emit machine byte offsets as C element offsets; verify this arithmetic against the original words",
      attempted: "frozen typed-pointer emission regression and AST audit", bound: "binary pointer arithmetic in this draft",
      stoppedBecause: "pointer element size/offset interpretation must agree with the original byte relation",
      inspectNext: ["psx_inventory", "psx_reverse_pipeline"] });
  }
  return facts;
}
