import { resourceCli } from "./resource-extraction/cli.ts";
await resourceCli("probe", process.argv.slice(2));
