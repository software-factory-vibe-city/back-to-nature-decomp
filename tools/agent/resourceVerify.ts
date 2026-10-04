import { resourceCli } from "./resource-extraction/cli.ts";
await resourceCli("verify", process.argv.slice(2));
