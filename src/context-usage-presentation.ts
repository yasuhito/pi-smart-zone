import type { SmartZoneConfig } from "./config.ts";

interface ContextUsage {
  readonly tokens: number | null;
  readonly contextWindow: number;
}

type ContextUsageInput = ContextUsage | undefined;

interface PersistentContextUsagePresentation {
  readonly text: string;
  readonly color: "dim" | "warning" | "error";
}

interface ContextUsageToolResult {
  readonly content: Array<{
    readonly type: "text";
    readonly text: string;
  }>;
  readonly details: ContextUsage;
}

interface ContextUsagePresentation {
  persistentPresentation(
    usage: ContextUsageInput,
  ): PersistentContextUsagePresentation;
  contextUsageToolResult(usage: ContextUsageInput): ContextUsageToolResult;
}

type UsageClassification = "normal" | "warning" | "error";

const ZONE_PRESENTATION = {
  normal: { indicator: "✓", label: "smart-zone", color: "dim" },
  warning: { indicator: "!", label: "smart-zone", color: "warning" },
  error: { indicator: "✗", label: "dumb-zone", color: "error" },
} as const satisfies Record<
  UsageClassification,
  {
    indicator: string;
    label: string;
    color: PersistentContextUsagePresentation["color"];
  }
>;

const BAR_WIDTH = 12;
const CONTEXT_USAGE_UNAVAILABLE_MESSAGE =
  "Context usage is unavailable for the active model.";

function formatTokens(tokens: number): string {
  if (tokens < 1_000) return String(tokens);
  if (tokens < 10_000) return `${(tokens / 1_000).toFixed(1)}k`;
  if (tokens < 1_000_000) return `${Math.round(tokens / 1_000)}k`;
  if (tokens < 10_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  return `${Math.round(tokens / 1_000_000)}M`;
}

function classifyZone(
  tokens: number,
  config: SmartZoneConfig,
): UsageClassification {
  if (tokens >= config.redAt) return "error";
  if (tokens >= config.yellowAt) return "warning";
  return "normal";
}

function renderContextBar(
  tokens: number,
  contextWindow: number,
  smartZoneBoundary: number,
): string {
  const usedCells = Math.round(
    Math.min(Math.max(tokens / contextWindow, 0), 1) * BAR_WIDTH,
  );
  const boundaryCell =
    smartZoneBoundary <= contextWindow
      ? Math.min(
          BAR_WIDTH - 1,
          Math.round((smartZoneBoundary / contextWindow) * BAR_WIDTH),
        )
      : undefined;

  return Array.from({ length: BAR_WIDTH }, (_, index) => {
    if (index === boundaryCell) return "│";
    return index < usedCells ? "━" : "─";
  }).join("");
}

export function createContextUsagePresentation(
  config: Readonly<SmartZoneConfig>,
): ContextUsagePresentation {
  return {
    persistentPresentation(usage) {
      if (usage === undefined) {
        return { text: "? unknown     ?/?", color: "dim" };
      }

      const effectiveTokens = usage.tokens ?? 0;
      const presentation =
        usage.tokens === null
          ? { indicator: "?", label: "unknown", color: "dim" as const }
          : ZONE_PRESENTATION[classifyZone(effectiveTokens, config)];
      const current =
        usage.tokens === null ? "?" : formatTokens(effectiveTokens);
      const bar = renderContextBar(
        effectiveTokens,
        usage.contextWindow,
        config.redAt,
      );

      return {
        text: `${presentation.indicator} ${presentation.label.padEnd(10)}  ${bar}  ${current}/${formatTokens(usage.contextWindow)}`,
        color: presentation.color,
      };
    },

    contextUsageToolResult(usage) {
      if (usage === undefined) {
        throw new Error(CONTEXT_USAGE_UNAVAILABLE_MESSAGE);
      }

      const usageText =
        usage.tokens === null
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
  };
}
