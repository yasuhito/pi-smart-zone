import assert from "node:assert/strict";
import test from "node:test";

import type {
  ExtensionAPI,
  ExtensionContext,
  ToolDefinition,
} from "@earendil-works/pi-coding-agent";

import smartZone from "../index.ts";

type ExtensionHandler = (
  event: unknown,
  ctx: ExtensionContext,
) => void | Promise<void>;

interface RegisteredExtension {
  tool: ToolDefinition;
  handlers: ReadonlyMap<string, readonly ExtensionHandler[]>;
}

function registerExtension(): RegisteredExtension {
  let registeredTool: ToolDefinition | undefined;
  const handlers = new Map<string, ExtensionHandler[]>();
  const pi = {
    registerTool(tool: ToolDefinition): void {
      registeredTool = tool;
    },
    on(event: string, handler: ExtensionHandler): void {
      const eventHandlers = handlers.get(event) ?? [];
      eventHandlers.push(handler);
      handlers.set(event, eventHandlers);
    },
  } as unknown as ExtensionAPI;

  smartZone(pi);
  assert.ok(registeredTool);
  return { tool: registeredTool, handlers };
}

function registerContextUsageTool(): ToolDefinition {
  return registerExtension().tool;
}

async function emit(
  handlers: RegisteredExtension["handlers"],
  event: string,
  ctx: ExtensionContext,
): Promise<void> {
  for (const handler of handlers.get(event) ?? []) {
    await handler({}, ctx);
  }
}

test("context_usage reports context usage and context window", async () => {
  const tool = registerContextUsageTool();
  const ctx = {
    getContextUsage: () => ({
      tokens: 142_381,
      contextWindow: 200_000,
      percent: 71.1905,
    }),
  } as unknown as ExtensionContext;

  const result = await tool.execute("call-1", {}, undefined, undefined, ctx);

  assert.deepEqual(result, {
    content: [
      {
        type: "text",
        text: "Estimated context usage: 142381 tokens\nContext window: 200000 tokens",
      },
    ],
    details: {
      tokens: 142_381,
      contextWindow: 200_000,
    },
  });
});

test("context_usage reports temporarily unknown usage after compaction", async () => {
  const tool = registerContextUsageTool();
  const ctx = {
    getContextUsage: () => ({
      tokens: null,
      contextWindow: 200_000,
      percent: null,
    }),
  } as unknown as ExtensionContext;

  const result = await tool.execute("call-2", {}, undefined, undefined, ctx);

  assert.deepEqual(result, {
    content: [
      {
        type: "text",
        text: "Context usage is temporarily unavailable after compaction.\nContext window: 200000 tokens",
      },
    ],
    details: {
      tokens: null,
      contextWindow: 200_000,
    },
  });
});

test("context_usage fails when context information is unavailable", async () => {
  const tool = registerContextUsageTool();
  const ctx = {
    getContextUsage: () => undefined,
  } as unknown as ExtensionContext;

  await assert.rejects(
    tool.execute("call-3", {}, undefined, undefined, ctx),
    new Error("Context usage is unavailable for the active model."),
  );
});

test("status refreshes after compaction and the next settled run", async () => {
  const extension = registerExtension();
  let tokens: number | null = 87_000;
  const statuses: string[] = [];
  const ctx = {
    getContextUsage: () => ({
      tokens,
      contextWindow: 200_000,
      percent: tokens === null ? null : (tokens / 200_000) * 100,
    }),
    ui: {
      theme: {
        fg: (_color: string, text: string) => text,
      },
      setStatus: (_key: string, text: string) => statuses.push(text),
      notify: () => {},
    },
  } as unknown as ExtensionContext;

  await emit(extension.handlers, "session_start", ctx);
  assert.match(statuses.at(-1) ?? "", /87k/);

  tokens = null;
  await emit(extension.handlers, "session_compact", ctx);
  assert.match(statuses.at(-1) ?? "", /\?/);

  tokens = 90_000;
  assert.equal(extension.handlers.has("message_end"), false);
  assert.match(statuses.at(-1) ?? "", /\?/);

  await emit(extension.handlers, "agent_settled", ctx);
  assert.doesNotMatch(statuses.at(-1) ?? "", /\?/);
  assert.match(statuses.at(-1) ?? "", /90k/);
});

test("status refreshes for session and model changes", async () => {
  const extension = registerExtension();
  const expectedEvents = [
    "session_start",
    "session_compact",
    "session_tree",
    "model_select",
    "agent_settled",
  ];

  for (const event of expectedEvents) {
    assert.equal(extension.handlers.has(event), true, `${event} handler missing`);
  }
});
