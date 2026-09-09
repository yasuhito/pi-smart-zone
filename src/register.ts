import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import type { ResolvedConfig } from "./config.ts";
import { createContextUsagePresentation } from "./context-usage-presentation.ts";

const STATUS_KEY = "pi-smart-zone";

export function registerSmartZone(
  pi: ExtensionAPI,
  { config, warning }: ResolvedConfig,
): void {
  const presentation = createContextUsagePresentation(config);
  let warningShown = false;

  const updateStatus = (ctx: ExtensionContext): void => {
    const persistentPresentation = presentation.persistentPresentation(
      ctx.getContextUsage(),
    );
    ctx.ui.setStatus(
      STATUS_KEY,
      ctx.ui.theme.fg(
        persistentPresentation.color,
        persistentPresentation.text,
      ),
    );
  };

  pi.registerTool({
    name: "context_usage",
    label: "Context Usage",
    description:
      "Get the active model's context usage and context window. Use only when the user explicitly asks about current context usage, context window, or remaining context capacity.",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      return presentation.contextUsageToolResult(ctx.getContextUsage());
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

  pi.on("agent_settled", updateStatusAfterEvent);
  pi.on("session_compact", updateStatusAfterEvent);
  pi.on("session_tree", updateStatusAfterEvent);
  pi.on("model_select", updateStatusAfterEvent);
}
