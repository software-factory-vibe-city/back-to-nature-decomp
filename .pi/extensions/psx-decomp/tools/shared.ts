import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const MAX_OUTPUT_BYTES = 50 * 1024;
const MAX_OUTPUT_LINES = 2000;

export interface CommandDetails {
  command: string;
  code: number;
  killed: boolean;
}

function truncateTail(output: string): string {
  const lines = output.split("\n");
  let kept = lines.length > MAX_OUTPUT_LINES ? lines.slice(-MAX_OUTPUT_LINES).join("\n") : output;
  let omittedLines = Math.max(0, lines.length - MAX_OUTPUT_LINES);
  const bytes = Buffer.byteLength(kept, "utf8");

  if (bytes > MAX_OUTPUT_BYTES) {
    const buffer = Buffer.from(kept, "utf8");
    kept = buffer.subarray(buffer.length - MAX_OUTPUT_BYTES).toString("utf8");
  }

  if (omittedLines > 0 || bytes > MAX_OUTPUT_BYTES) {
    kept = `[Output truncated; showing the tail. Omitted lines before byte truncation: ${omittedLines}.]\n${kept}`;
  }

  return kept;
}

export function validateFunctionName(name: string): void {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`Invalid function name: ${name}`);
  }
}

export async function runProjectCommand(
  pi: ExtensionAPI,
  cwd: string,
  command: string,
  args: string[],
  signal: AbortSignal | undefined,
  timeout: number,
): Promise<{ content: Array<{ type: "text"; text: string }>; details: CommandDetails }> {
  const display = [command, ...args].join(" ");
  const result = await pi.exec(command, args, { cwd, signal, timeout });
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
  const text = truncateTail(output || `${display} completed with no output.`);
  const details: CommandDetails = { command: display, code: result.code, killed: result.killed };

  if (result.code !== 0) {
    throw new Error(`${display} failed with exit code ${result.code}.\n${text}`);
  }

  return { content: [{ type: "text", text }], details };
}
