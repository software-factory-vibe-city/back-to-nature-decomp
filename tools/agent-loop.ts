/**
 * agent-loop.ts — Generic agent loop using @mariozechner/pi-coding-agent SDK
 *
 * Creates an agent session with a custom system prompt, streams all output
 * (text, thinking, tool calls) verbosely to stdout, and supports an outer
 * retry loop with an external success check.
 *
 * Requires AGENT env var: {"provider": "openrouter", "apiKey": "...", "modelId": "minimax/minimax-m2.5"}
 * Run with: npx tsx --env-file=.env tools/agent-loop.ts
 */

import {
  AuthStorage,
  ModelRegistry,
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
  SettingsManager,
  createBashTool,
  createReadTool,
  createEditTool,
} from "@mariozechner/pi-coding-agent";

const DEFAULT_MAX_RETRIES = 10;

export interface AgentLoopOptions {
  systemPrompt: string;
  userMessage: string;
  cwd?: string;
  maxRetries?: number;
  /** Called after each prompt() returns. Return true if the task is done. */
  checkSuccess?: () => boolean;
}

export interface AgentLoopResult {
  success: boolean;
  output: string;
  retries: number;
}

interface AgentConfig {
  provider: string;
  apiKey: string;
  modelId: string;
}

function parseAgentConfig(): AgentConfig {
  const raw = process.env.AGENT;
  if (!raw) {
    throw new Error(
      "AGENT env var not set. Expected JSON: {\"provider\": \"...\", \"apiKey\": \"...\", \"modelId\": \"...\"}\n" +
      "Run with: npx tsx --env-file=.env tools/agent-loop.ts"
    );
  }
  const config = JSON.parse(raw);
  if (!config.provider || !config.apiKey || !config.modelId) {
    throw new Error("AGENT env var must have provider, apiKey, and modelId fields");
  }
  return config;
}

export async function runAgentLoop(options: AgentLoopOptions): Promise<AgentLoopResult> {
  const {
    systemPrompt,
    userMessage,
    cwd = process.cwd(),
    maxRetries = DEFAULT_MAX_RETRIES,
    checkSuccess,
  } = options;

  const agentConfig = parseAgentConfig();

  // Set up auth and model
  const authStorage = AuthStorage.create();
  authStorage.setRuntimeApiKey(agentConfig.provider, agentConfig.apiKey);
  const modelRegistry = new ModelRegistry(authStorage);
  const model = modelRegistry.find(agentConfig.provider, agentConfig.modelId);

  if (!model) {
    const all = modelRegistry.getAll();
    const providerModels = all
      .filter((m) => m.provider === agentConfig.provider)
      .map((m) => m.id)
      .slice(0, 10);
    throw new Error(
      `Model "${agentConfig.modelId}" not found for provider "${agentConfig.provider}".\n` +
      `Available models for this provider (first 10): ${providerModels.join(", ") || "(none)"}`
    );
  }

  console.log(`[agent-loop] Model: ${model.provider}/${model.id}`);
  console.log(`[agent-loop] CWD: ${cwd}`);

  // Custom system prompt — replace entirely, no appended defaults
  const loader = new DefaultResourceLoader({
    systemPromptOverride: () => systemPrompt,
    appendSystemPromptOverride: () => [],
  });
  await loader.reload();

  const { session } = await createAgentSession({
    cwd,
    model,
    thinkingLevel: "off",
    authStorage,
    modelRegistry,
    resourceLoader: loader,
    tools: [createBashTool(cwd), createReadTool(cwd), createEditTool(cwd)],
    sessionManager: SessionManager.inMemory(),
    settingsManager: SettingsManager.inMemory({
      compaction: { enabled: true },
      retry: { enabled: true, maxRetries: 3 },
    }),
  });

  // Verbose event logging
  let output = "";

  session.subscribe((event) => {
    switch (event.type) {
      case "message_update": {
        const ame = event.assistantMessageEvent;
        if (ame.type === "text_delta") {
          process.stdout.write(ame.delta);
          output += ame.delta;
        } else if (ame.type === "thinking_delta") {
          process.stdout.write(`\x1b[2m${ame.delta}\x1b[0m`);  // dim for thinking
        }
        break;
      }
      case "tool_execution_start":
        console.log(`\n\x1b[36m[tool:${event.toolName}]\x1b[0m ${formatToolArgs(event.toolName, event.args)}`);
        break;
      case "tool_execution_end": {
        const resultStr = formatToolResult(event.result);
        if (event.isError) {
          console.log(`\x1b[31m[tool:${event.toolName} ERROR]\x1b[0m ${truncate(resultStr, 500)}`);
        } else {
          console.log(`\x1b[32m[tool:${event.toolName} done]\x1b[0m ${truncate(resultStr, 200)}`);
        }
        break;
      }
      case "turn_start":
        console.log(`\n\x1b[33m--- turn start ---\x1b[0m`);
        break;
      case "turn_end":
        console.log(`\x1b[33m--- turn end ---\x1b[0m\n`);
        break;
      case "agent_start":
        console.log(`\x1b[33m[agent start]\x1b[0m`);
        break;
      case "agent_end":
        console.log(`\x1b[33m[agent end]\x1b[0m`);
        break;
    }
  });

  // Outer retry loop
  let retries = 0;
  let success = false;

  try {
    console.log(`\n\x1b[1m[agent-loop] Sending initial prompt...\x1b[0m\n`);
    await session.prompt(userMessage);

    // Check success after initial prompt
    if (checkSuccess) {
      success = checkSuccess();
    }

    while (!success && retries < maxRetries) {
      retries++;
      console.log(`\n\x1b[1m[agent-loop] Retry ${retries}/${maxRetries} — not yet successful, prompting again...\x1b[0m\n`);
      await session.prompt(
        "You haven't reached 100% match yet. Keep iterating. Run diffFunc.ts to see the current diff and fix the remaining issues."
      );

      if (checkSuccess) {
        success = checkSuccess();
      }
    }

    // Log final stats
    const stats = session.getSessionStats();
    console.log(`\n\x1b[1m[agent-loop] Done. Success: ${success}, Retries: ${retries}\x1b[0m`);
    console.log(`[agent-loop] Tokens: ${stats.tokens.total} total (${stats.tokens.input} in, ${stats.tokens.output} out)`);
    console.log(`[agent-loop] Cost: $${stats.cost.toFixed(4)}`);
  } catch (err: any) {
    console.error(`\n\x1b[31m[agent-loop] Error: ${err.message}\x1b[0m`);
    output += `\nError: ${err.message}`;
  } finally {
    session.dispose();
  }

  return { success, output, retries };
}

function formatToolArgs(toolName: string, args: any): string {
  if (toolName === "bash" && args?.command) {
    return `$ ${args.command}`;
  }
  if (toolName === "read" && args?.file_path) {
    return args.file_path;
  }
  if (toolName === "edit" && args?.file_path) {
    return `${args.file_path} (edit)`;
  }
  return JSON.stringify(args).slice(0, 200);
}

function formatToolResult(result: any): string {
  if (typeof result === "string") return result;
  if (result && typeof result === "object") {
    // pi-coding-agent tool results have content array with text items
    if (Array.isArray(result.content)) {
      return result.content
        .filter((c: any) => c.type === "text")
        .map((c: any) => c.text)
        .join("\n");
    }
    return JSON.stringify(result, null, 2);
  }
  return String(result);
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + "...";
}

// --- Plan-then-execute mode ---

export interface PlanThenExecuteOptions {
  systemPrompt: string;
  planMessage: string;
  cwd?: string;
  maxRetries?: number;
  checkSuccess?: () => boolean;
  /** Max tasks to execute from the plan. 0 = unlimited. */
  maxTasks?: number;
}

export interface PlanThenExecuteResult {
  plan: string[];
  results: Array<{ task: string; success: boolean }>;
}

/**
 * Two-phase agent execution:
 * 1. Planning: agent surveys the codebase and outputs a JSON task list
 * 2. Execution: each task runs in a fresh agent session with clean context
 *
 * The planning prompt MUST instruct the agent to output a JSON array of
 * task strings as its final output, fenced in ```json ... ```.
 */
export async function runPlanThenExecute(options: PlanThenExecuteOptions): Promise<PlanThenExecuteResult> {
  const {
    systemPrompt,
    planMessage,
    cwd = process.cwd(),
    maxRetries = 3,
    checkSuccess,
    maxTasks = 0,
  } = options;

  /* Phase 1: Planning */
  console.log(`\n\x1b[1m[plan-execute] Phase 1: Planning...\x1b[0m\n`);

  const planResult = await runAgentLoop({
    systemPrompt,
    userMessage: planMessage,
    cwd,
    maxRetries: 0, /* no retries for planning */
  });

  /* Extract JSON task list from the plan output */
  const jsonMatch = planResult.output.match(/```json\s*([\s\S]*?)```/);
  if (!jsonMatch) {
    console.error(`[plan-execute] No JSON task list found in plan output.`);
    return { plan: [], results: [] };
  }

  let plan: string[];
  try {
    plan = JSON.parse(jsonMatch[1]);
    if (!Array.isArray(plan) || !plan.every((t) => typeof t === "string")) {
      throw new Error("Expected JSON array of strings");
    }
  } catch (e: any) {
    console.error(`[plan-execute] Failed to parse task list: ${e.message}`);
    return { plan: [], results: [] };
  }

  if (maxTasks > 0) {
    plan = plan.slice(0, maxTasks);
  }

  console.log(`\n\x1b[1m[plan-execute] Plan: ${plan.length} task(s)\x1b[0m`);
  for (let i = 0; i < plan.length; i++) {
    console.log(`  ${i + 1}. ${plan[i].slice(0, 120)}`);
  }

  /* Phase 2: Execute each task */
  const results: Array<{ task: string; success: boolean }> = [];

  for (let i = 0; i < plan.length; i++) {
    const task = plan[i];
    console.log(`\n\x1b[1m[plan-execute] Task ${i + 1}/${plan.length}: ${task.slice(0, 100)}\x1b[0m\n`);

    const taskResult = await runAgentLoop({
      systemPrompt,
      userMessage: task,
      cwd,
      maxRetries,
      checkSuccess,
    });

    results.push({ task, success: taskResult.success });

    if (checkSuccess && !checkSuccess()) {
      console.error(`\n\x1b[31m[plan-execute] checkSuccess failed after task ${i + 1} — stopping.\x1b[0m`);
      break;
    }
  }

  console.log(`\n\x1b[1m[plan-execute] Done: ${results.filter((r) => r.success).length}/${results.length} task(s) succeeded.\x1b[0m`);

  return { plan, results };
}

// --- CLI test mode ---

if (process.argv[1]?.endsWith("agent-loop.ts")) {
  const testPrompt = process.argv[2] || "List the files in the current directory and tell me what this project is about.";
  console.log(`[agent-loop] Test mode. Prompt: "${testPrompt}"`);

  runAgentLoop({
    systemPrompt: "You are a helpful coding assistant. Be concise.",
    userMessage: testPrompt,
  }).then((result) => {
    console.log(`\n[agent-loop] Result: success=${result.success}, retries=${result.retries}`);
  }).catch((err) => {
    console.error(`[agent-loop] Fatal: ${err.message}`);
    process.exit(1);
  });
}
