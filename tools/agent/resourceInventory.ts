import { resourceCli } from "./resource-extraction/cli.ts";
await resourceCli("inventory", process.argv.slice(2));
