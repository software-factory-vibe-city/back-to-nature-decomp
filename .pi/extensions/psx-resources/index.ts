import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerResourceCommand } from "./controller.ts";
import { registerResourceTools } from "./tools/index.ts";

export function projectRoot(start: string): string {
  let root = resolve(start);
  while (true) {
    if (existsSync(join(root, "AGENTS.md")) && existsSync(join(root, "tools/agent"))) return root;
    const parent = dirname(root);
    if (parent === root) return resolve(start);
    root = parent;
  }
}
export default function psxResources(pi: ExtensionAPI): void {
  const harness = registerResourceCommand(pi, projectRoot);
  registerResourceTools(pi, harness.binding, projectRoot);
}
