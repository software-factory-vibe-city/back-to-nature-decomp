import { resourceCli } from "./resource-extraction/cli.ts";
await resourceCli("iteration", process.argv.slice(2));
