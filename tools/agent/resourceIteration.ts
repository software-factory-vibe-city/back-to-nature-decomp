import { resourceCli } from "./resource-extraction/cli.ts";
import { recoverAbandonedResourceLocks } from "../lib/resourceLocks.ts";
recoverAbandonedResourceLocks(process.cwd());
await resourceCli("iteration", process.argv.slice(2));
