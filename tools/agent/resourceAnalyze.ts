import { resourceCli } from "./resource-extraction/cli.ts";
await resourceCli("analyze", process.argv.slice(2));
