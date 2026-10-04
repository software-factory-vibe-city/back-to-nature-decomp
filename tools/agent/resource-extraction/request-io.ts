import { readFileSync } from "node:fs";
import { Store } from "./storage.ts";
import type { Request } from "./types.ts";
export function readRequest(root: string, args: string[]): Request | undefined {
  if (args[0] !== "--request") return undefined;
  if (args.length !== 2 || !args[1]) throw new Error("Use --request - (stdin) or --request <build/assets-relative request.json>");
  const bytes = args[1] === "-" ? readFileSync(0) : readFileSync(new Store(root).path(args[1]));
  if (bytes.length > 65536) throw new Error("Request budget exceeded");
  return JSON.parse(bytes.toString()) as Request;
}
