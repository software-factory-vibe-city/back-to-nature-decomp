# Call-graph worklist selection strategies

## Swappable call-graph selection strategies

Originally discussed on October 3; subsequently implemented in `tools/agent/callGraphStrategies.ts`, with selection in `tools/agent/callGraph.ts`.

Introduce explicit strategies for ordering the call-graph decompilation worklist, rather than baking one ordering into `tools/agent/callGraph.ts`. The current preference is to select/swap strategies in code; no CLI or configuration interface is decided or requested.

Implemented strategies:

- **Container-first (original behavior):** container order, dependency tier, dependency depth within tier 3, instruction count ascending, then caller count descending.
- **Dependency-ready / small-first (default):** dependency depth, instruction count ascending, caller count descending, then container order as a final tie-breaker. Tiers 1 and 2 both have depth zero and compete together, so small functions in later overlays and small SDK wrappers can come before larger functions in earlier containers.

Instruction count is a proxy for difficulty, not a guarantee. The proposed small-first strategy remains dependency-first, rather than globally smallest regardless of unresolved callees.

Keep eligibility and loop behavior separate from ranking: existing exclusions for decompiled, handwritten/GTE, dead, parked, and already-attempted functions should remain intact, as should the loop's family deferrals. Parked/attempted exclusions and deferrals currently belong to the loop, not the graph builder.

The strategy interface and the in-code default are in `tools/agent/callGraphStrategies.ts` and `tools/agent/callGraph.ts`, respectively. One selected strategy ranks the generated `build/callGraph.json`, which its consumers share. A strictly size-first strategy was discussed but not implemented.
