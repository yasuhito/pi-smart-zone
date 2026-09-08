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

export function renderStatus(
  tokens: number | null | undefined,
  config: SmartZoneConfig,
): RenderedStatus {
  const effectiveTokens = tokens ?? 0;
  const zone = classifyZone(effectiveTokens, config);
  const presentation = ZONE_PRESENTATION[zone];
  const indicator = tokens == null ? "?" : presentation.indicator;
  const current = tokens == null ? "?" : formatTokens(effectiveTokens);
  const limit = formatTokens(config.redAt);

  return {
    text: `${indicator} ${presentation.label.padEnd(10)} ${current.padStart(5)}/${limit.padStart(5)}`,
    color: presentation.color,
  };
}
