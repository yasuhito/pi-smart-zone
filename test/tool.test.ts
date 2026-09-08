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

function createStatusFixture() {
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

  return {
    ctx,
    extension,
    latestStatus: () => statuses.at(-1) ?? "",
    setTokens: (value: number | null) => {
      tokens = value;
    },
  };
}

test("session start displays the current usage", async () => {
  const fixture = createStatusFixture();

  await emit(fixture.extension.handlers, "session_start", fixture.ctx);

  assert.match(fixture.latestStatus(), /87k/);
});

test("session compaction displays unknown usage", async () => {
  const fixture = createStatusFixture();
  fixture.setTokens(null);

  await emit(fixture.extension.handlers, "session_compact", fixture.ctx);

  assert.match(fixture.latestStatus(), /\?/);
});

test("message end does not trigger a status refresh", () => {
  const fixture = createStatusFixture();

  assert.equal(fixture.extension.handlers.has("message_end"), false);
});

test("status remains unknown until the agent settles", async () => {
  const fixture = createStatusFixture();
  fixture.setTokens(null);
  await emit(fixture.extension.handlers, "session_compact", fixture.ctx);

  fixture.setTokens(90_000);

  assert.match(fixture.latestStatus(), /\?/);
});

test("agent settled refreshes the status with current usage", async () => {
  const fixture = createStatusFixture();
  fixture.setTokens(null);
  await emit(fixture.extension.handlers, "session_compact", fixture.ctx);
  fixture.setTokens(90_000);

  await emit(fixture.extension.handlers, "agent_settled", fixture.ctx);

  assert.match(fixture.latestStatus(), /90k/);
});

const statusRefreshEvents = [
  "session_start",
  "session_compact",
  "session_tree",
  "model_select",
  "agent_settled",
];

for (const event of statusRefreshEvents) {
  test(`${event} has a status refresh handler`, () => {
    const extension = registerExtension();

    assert.equal(extension.handlers.has(event), true);
  });
}
