import type { SmartZoneConfig } from "./config.ts";

export type Zone = "normal" | "warning" | "error";

export function formatTokens(tokens: number): string {
  if (tokens < 1_000) return String(tokens);
  if (tokens < 10_000) return `${(tokens / 1_000).toFixed(1)}k`;
  if (tokens < 1_000_000) return `${Math.round(tokens / 1_000)}k`;
  if (tokens < 10_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  return `${Math.round(tokens / 1_000_000)}M`;
}

export function classifyZone(tokens: number, config: SmartZoneConfig): Zone {
  if (tokens >= config.redAt) return "error";
  if (tokens >= config.yellowAt) return "warning";
  return "normal";
}

export interface RenderedStatus {
  text: string;
  color: "dim" | "warning" | "error";
}

const ZONE_PRESENTATION = {
  normal: { indicator: "✓", label: "smart-zone", color: "dim" },
  warning: { indicator: "!", label: "smart-zone", color: "warning" },
  error: { indicator: "✗", label: "dumb-zone", color: "error" },
} as const satisfies Record<
  Zone,
  { indicator: string; label: string; color: RenderedStatus["color"] }
>;

const BAR_WIDTH = 12;

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

export function renderStatus(
  tokens: number | null | undefined,
  config: SmartZoneConfig,
  contextWindow?: number,
): RenderedStatus {
  if (contextWindow === undefined) {
    return { text: "? unknown     ?/?", color: "dim" };
  }

  const effectiveTokens = tokens ?? 0;
  const zone = classifyZone(effectiveTokens, config);
  const presentation =
    tokens == null
      ? { indicator: "?", label: "unknown", color: "dim" as const }
      : ZONE_PRESENTATION[zone];
  const current = tokens == null ? "?" : formatTokens(effectiveTokens);

  const bar = renderContextBar(effectiveTokens, contextWindow, config.redAt);
  return {
    text: `${presentation.indicator} ${presentation.label.padEnd(10)}  ${bar}  ${current}/${formatTokens(contextWindow)}`,
    color: presentation.color,
  };
}
