import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import { loadConfig } from "./src/config.ts";
import { renderStatus } from "./src/status.ts";

const STATUS_KEY = "pi-smart-zone";

export default function smartZone(pi: ExtensionAPI): void {
  const { config, warning } = loadConfig();
  let warningShown = false;

  const updateStatus = (ctx: ExtensionContext): void => {
    const usage = ctx.getContextUsage();
    const status = renderStatus(usage?.tokens, config);
    ctx.ui.setStatus(
      STATUS_KEY,
      ctx.ui.theme.fg(status.color, status.text),
    );
  };

  pi.registerTool({
    name: "context_usage",
    label: "Context Usage",
    description:
      "Get the active model's context usage and context window. Use only when the user explicitly asks about current context usage, context window, or remaining context capacity.",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      const usage = ctx.getContextUsage();
      if (usage === undefined) {
        throw new Error("Context usage is unavailable for the active model.");
      }

      const usageText = usage.tokens === null
        ? "Context usage is temporarily unavailable after compaction."
        : `Estimated context usage: ${usage.tokens} tokens`;

      return {
        content: [
          {
            type: "text",
            text: `${usageText}\nContext window: ${usage.contextWindow} tokens`,
          },
        ],
        details: {
          tokens: usage.tokens,
          contextWindow: usage.contextWindow,
        },
      };
    },
  });

  pi.on("session_start", (_event, ctx) => {
    updateStatus(ctx);
    if (warning !== undefined && !warningShown) {
      warningShown = true;
      ctx.ui.notify(warning, "warning");
    }
  });

  const updateStatusAfterEvent = (
    _event: unknown,
    ctx: ExtensionContext,
  ): void => updateStatus(ctx);

  pi.on("message_end", updateStatusAfterEvent);
  pi.on("session_compact", updateStatusAfterEvent);
  pi.on("session_tree", updateStatusAfterEvent);
  pi.on("model_select", updateStatusAfterEvent);
}
