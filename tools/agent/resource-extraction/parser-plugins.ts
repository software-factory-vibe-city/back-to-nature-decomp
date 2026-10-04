import type { AssetParser } from "./registry.ts";

/** Parser-building iterations add pure plugins here. Existing core parsers stay
 * in registry.ts, so adding a format never rewrites the pipeline. */
export const EXTRA_PARSERS: AssetParser[] = [];
