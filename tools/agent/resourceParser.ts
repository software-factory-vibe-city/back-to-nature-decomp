import { resourceCli } from "./resource-extraction/cli.ts";
import { recoverAbandonedResourceLocks } from "../lib/resourceLocks.ts"; // doc-ref-ignore: module-relative import
recoverAbandonedResourceLocks(process.cwd());
await resourceCli("parser", process.argv.slice(2));
