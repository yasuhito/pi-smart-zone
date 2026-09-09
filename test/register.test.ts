import assert from "node:assert/strict";
import test from "node:test";

import type {
  ExtensionAPI,
  ExtensionContext,
  ToolDefinition,
} from "@earendil-works/pi-coding-agent";

import smartZone from "../index.ts";
import { DEFAULT_CONFIG, type ResolvedConfig } from "../src/config.ts";
import { registerSmartZone } from "../src/register.ts";

const DEFAULT_RESOLVED_CONFIG: ResolvedConfig = {
  config: DEFAULT_CONFIG,
  warning: undefined,
};

type ExtensionHandler = (
  event: unknown,
  ctx: ExtensionContext,
) => void | Promise<void>;

interface RegisteredExtension {
  tool: ToolDefinition;
  handlers: ReadonlyMap<string, readonly ExtensionHandler[]>;
}

function registerExtension(
  resolvedConfig: ResolvedConfig = DEFAULT_RESOLVED_CONFIG,
): RegisteredExtension {
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

  registerSmartZone(pi, resolvedConfig);
  if (registeredTool === undefined) {
    throw new Error("smart-zone did not register the context_usage tool");
  }
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

function createStatusFixture(
  resolvedConfig: ResolvedConfig = DEFAULT_RESOLVED_CONFIG,
) {
  const extension = registerExtension(resolvedConfig);
  let tokens: number | null = 87_000;
  const statuses: string[] = [];
  const notifications: Array<{ message: string; level: string }> = [];
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
      notify: (message: string, level: string) =>
        notifications.push({ message, level }),
    },
  } as unknown as ExtensionContext;

  return {
    ctx,
    extension,
    latestStatus: () => statuses.at(-1) ?? "",
    notifications,
    setTokens: (value: number | null) => {
      tokens = value;
    },
  };
}

test("entry point registers the context_usage tool", () => {
  let registeredTools = 0;
  const pi = {
    registerTool: () => {
      registeredTools += 1;
    },
    on: () => {},
  } as unknown as ExtensionAPI;

  smartZone(pi);

  assert.equal(registeredTools, 1);
});

test("session start displays usage across the active context window", async () => {
  const fixture = createStatusFixture();

  await emit(fixture.extension.handlers, "session_start", fixture.ctx);

  assert.equal(fixture.latestStatus(), "✓ smart-zone  ━━━━━────│──  87k/200k");
});

test("configured smart-zone boundaries reach status rendering", async () => {
  const fixture = createStatusFixture({
    config: { yellowAt: 80_000, redAt: 85_000 },
    warning: undefined,
  });

  await emit(fixture.extension.handlers, "session_start", fixture.ctx);

  assert.equal(fixture.latestStatus(), "✗ dumb-zone   ━━━━━│──────  87k/200k");
});

test("configuration warning is shown on session start", async () => {
  const warning = "Invalid pi-smart-zone configuration; using defaults.";
  const fixture = createStatusFixture({ config: DEFAULT_CONFIG, warning });

  await emit(fixture.extension.handlers, "session_start", fixture.ctx);

  assert.deepEqual(fixture.notifications, [
    { message: warning, level: "warning" },
  ]);
});

test("configuration warning is shown only once", async () => {
  const fixture = createStatusFixture({
    config: DEFAULT_CONFIG,
    warning: "Invalid pi-smart-zone configuration; using defaults.",
  });

  await emit(fixture.extension.handlers, "session_start", fixture.ctx);
  await emit(fixture.extension.handlers, "session_start", fixture.ctx);

  assert.equal(fixture.notifications.length, 1);
});

test("session start does not notify without a configuration warning", async () => {
  const fixture = createStatusFixture();

  await emit(fixture.extension.handlers, "session_start", fixture.ctx);

  assert.deepEqual(fixture.notifications, []);
});

test("session compaction displays an unclassified status with the known smart-zone boundary", async () => {
  const fixture = createStatusFixture();
  fixture.setTokens(null);

  await emit(fixture.extension.handlers, "session_compact", fixture.ctx);

  assert.equal(fixture.latestStatus(), "? unknown     ─────────│──  ?/200k");
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
