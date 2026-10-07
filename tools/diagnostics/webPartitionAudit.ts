/** Bounded retirement probe. The shared C AST guard identifies only local
 * register declarator bindings; strings, symbol aliases, file-scope register
 * context, disabled branches and instruction asm are not transformed. */
import { analyzeCSource, localRegisterBindings } from "../agent/cSourceGuard.js";
export function unpinDeclarations(source: string): { source: string; removed: number } {
  const sites = localRegisterBindings(source);
  let result = source;
  for (const site of sites.sort((a,b) => b.start - a.start)) result = result.slice(0, site.start) + result.slice(site.end);
  const guard = analyzeCSource(result);
  if (!guard.parses) throw new Error(`Pin-erased source is invalid: ${guard.reasons.join("; ")}`);
  return { source: result, removed: sites.length };
}
