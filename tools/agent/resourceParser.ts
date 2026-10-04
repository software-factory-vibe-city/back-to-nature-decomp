import { parserOperation } from "./resource-extraction/parser-builder.ts";
import { readRequest } from "./resource-extraction/request-io.ts";
const controller = new AbortController();
const stop = (): void => controller.abort();
process.once("SIGINT", stop); process.once("SIGTERM", stop);
try {
  const request = readRequest(process.cwd(), process.argv.slice(2));
  if (!request) throw new Error("resourceParser.ts uses --request <build/assets-relative JSON>");
  const result = await parserOperation(process.cwd(), request, controller.signal);
  console.log(JSON.stringify({ type: "result", result }));
} catch (error) { console.error(String(error)); process.exitCode = 1; }
finally { process.off("SIGINT", stop); process.off("SIGTERM", stop); }
