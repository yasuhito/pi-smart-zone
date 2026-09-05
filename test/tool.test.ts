import assert from "node:assert/strict";
import test from "node:test";

import type {
  ExtensionAPI,
  ExtensionContext,
  ToolDefinition,
} from "@earendil-works/pi-coding-agent";

import smartZone from "../index.ts";

function registerContextUsageTool(): ToolDefinition {
  let registeredTool: ToolDefinition | undefined;
  const pi = {
    registerTool(tool: ToolDefinition): void {
      registeredTool = tool;
    },
    on(): void {},
  } as unknown as ExtensionAPI;

  smartZone(pi);
  assert.ok(registeredTool);
  return registeredTool;
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
