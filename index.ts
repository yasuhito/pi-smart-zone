import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";

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

  pi.on("session_start", (_event, ctx) => {
    updateStatus(ctx);
    if (warning !== undefined && !warningShown) {
      warningShown = true;
      ctx.ui.notify(warning, "warning");
    }
  });

  pi.on("message_end", (_event, ctx) => updateStatus(ctx));
  pi.on("session_compact", (_event, ctx) => updateStatus(ctx));
  pi.on("session_tree", (_event, ctx) => updateStatus(ctx));
  pi.on("model_select", (_event, ctx) => updateStatus(ctx));
}
