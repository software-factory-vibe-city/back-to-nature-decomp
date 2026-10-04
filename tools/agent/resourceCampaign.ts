import { resourceCli } from "./resource-extraction/cli.ts";
await resourceCli("campaign", process.argv.slice(2));
