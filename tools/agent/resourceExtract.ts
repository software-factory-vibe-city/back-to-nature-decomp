import { resourceCli } from "./resource-extraction/cli.ts";
await resourceCli("extract", process.argv.slice(2));
