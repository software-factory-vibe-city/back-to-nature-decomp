import { resourceCli } from "./resource-extraction/cli.ts";
import { recoverAbandonedResourceLocks } from "../lib/resourceLocks.ts";
recoverAbandonedResourceLocks(process.cwd());
await resourceCli("verify", process.argv.slice(2));
