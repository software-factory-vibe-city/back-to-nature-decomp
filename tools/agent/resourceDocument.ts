import { resourceCli } from "./resource-extraction/cli.ts";
await resourceCli("document", process.argv.slice(2));
