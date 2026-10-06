import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DEFAULT_LOOP_CONFIG } from "./config.ts";
import { runLoop, type LoopDeps } from "./loop.ts";
import { createTurnGate } from "./turn-gate.ts";
import { buildInputs, inputIdentity } from "../tools/prepared-attempt.ts";
import { configuredToolchainIdentity, ROOT } from "../../../../tools/agent/decompToolchain.ts";

/* Exercise the controller's first dispatch, not just a prompt builder. The
   temporary project's preparation CLI supplies a synthetic exact packet;
   no model, production compiler or live project state is touched. */
test("a prep-led run does not start with old documentation or static finalization", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "autoloop-startup-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const dir of [".pi", "src", "tools/agent", "build", "run_output"]) mkdirSync(join(root, dir), { recursive: true });
  symlinkSync(join(ROOT, "node_modules"), join(root, "node_modules"));
  const pending = "func_80012345", fresh = "func_80012380";
  const source = `void ${fresh}(void) {}\n`;
  writeFileSync(join(root, "src", `${fresh}.c`), source);
  writeFileSync(join(root, "src", `${pending}.c`), `void ${pending}(void) {}\n`);
  writeFileSync(join(root, ".pi/autoloop.json"), "{}\n");
  writeFileSync(join(root, "build/callGraph.json"), JSON.stringify({ functions: [
    { name: pending, vram: "0x80012345", decompiled: true, handwritten: false, dead: false },
    { name: fresh, vram: "0x80012380", decompiled: false, handwritten: false, dead: false },
  ] }));
  writeFileSync(join(root, "tools/agent/callGraph.ts"), "/* Fixture graph is already written. */\n");
  const packet = {
    schemaVersion: 1, identity: { functionName: fresh, container: "exe", destination: `src/${fresh}.c`,
      assembly: "build/original.s", data: [], inputs: {}, flags: [], tools: configuredToolchainIdentity() },
    primary: { origin: "existing-attempt", path: `src/${fresh}.c`, text: source, sha256: "", declarationsRequired: [] },
    context: { projection: "build/context.c", unknown: [], headers: [] },
    generation: { status: "generated" }, compilation: { status: "succeeded", diagnostics: "", commands: [] },
    comparison: { status: "exact" }, integration: { state: "live", blockers: [], destinationHash: "" },
    discovery: { unknowns: [], priorExperiments: [], preflight: [] }, finalization: { status: "not-attempted" },
  };
  writeFileSync(join(root, "tools/agent/m2cFunc.ts"), `
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
const packet = ${JSON.stringify(packet)};
packet.identity.functionName = process.argv[2];
packet.identity.destination = 'src/' + process.argv[2] + '.c';
packet.primary.path = packet.identity.destination;
packet.primary.text = readFileSync(packet.primary.path, 'utf8');
packet.primary.sha256 = createHash('sha256').update(packet.primary.text).digest('hex');
writeFileSync('build/packet.json', JSON.stringify(packet));
console.log(JSON.stringify({ path: 'build/packet.json' }));
`);
  const inputs = buildInputs(root);
  const state = { parked: {}, approvals: {}, completions: { [pending]: {
    origin: "static", inputs, verifiedIdentity: inputIdentity(inputs), verification: "passed",
    documentation: "pending", changedFiles: [],
  } } };
  const statePath = join(root, "run_output/state.json");
  const messages: string[] = [];
  const flag = { aborted: false };
  let tools = ["read", "bash", "edit", "write", "psx_finalize_function"];
  const deps = {
    projectRoot: root, baseline: new Set<string>(), flag,
    config: { ...DEFAULT_LOOP_CONFIG, runtimeDir: join(root, "run_output"), maxFunctions: 1,
      ladder: [{ provider: "fixture", model: "prep", label: "prep", thinking: "off", role: "prep" },
        { provider: "fixture", model: "match", label: "match", thinking: "off" }] },
    sink: { verdict: {}, handoff: {}, prep: {}, gate: createTurnGate() },
    pi: { getActiveTools: () => tools, setActiveTools: (value: string[]) => { tools = value; },
      getThinkingLevel: () => "off", setThinkingLevel: () => {}, setModel: async () => true,
      sendUserMessage: (message: string) => { messages.push(message); flag.aborted = true; } },
    ctx: { model: { id: "fixture" }, isIdle: () => true, waitForIdle: async () => {}, getContextUsage: () => undefined,
      sessionManager: { getEntries: () => [] }, modelRegistry: { find: () => ({ id: "fixture" }) },
      ui: { notify: () => {}, setStatus: () => {}, theme: { fg: (_color: string, text: string) => text } } },
  } as unknown as LoopDeps;

  writeFileSync(statePath, JSON.stringify(state));
  await runLoop(deps);
  assert.equal(messages.length, 1);
  assert.match(messages[0]!, /Role: prep/);
  assert.match(messages[0]!, new RegExp(`Target: ${fresh}`));
  assert.doesNotMatch(messages[0]!, /psx-post-decompile-documentation/);
  assert.equal(JSON.parse(readFileSync(join(root, "build/packet.json"), "utf8")).finalization.status, "not-attempted");
  assert.equal(JSON.parse(readFileSync(statePath, "utf8")).completions[pending].documentation, "pending");

  /* An explicit completed target must also enter prep rather than bypass it. */
  messages.length = 0; flag.aborted = false;
  writeFileSync(statePath, JSON.stringify(state));
  await runLoop(deps, { firstTarget: pending });
  assert.match(messages[0]!, /Role: prep/);
  assert.match(messages[0]!, new RegExp(`Target: ${pending}`));
  assert.doesNotMatch(messages[0]!, /psx-post-decompile-documentation/);

  /* Omitting role retains the original documentation-resume behavior. */
  messages.length = 0; flag.aborted = false;
  delete deps.config.ladder[0]!.role;
  writeFileSync(statePath, JSON.stringify(state));
  await runLoop(deps);
  assert.match(messages[0]!, /psx-post-decompile-documentation/);
  assert.match(messages[0]!, new RegExp(`Target: ${pending}`));
});
