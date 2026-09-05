import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface SmartZoneConfig {
  yellowAt: number;
  redAt: number;
}

export const DEFAULT_CONFIG: Readonly<SmartZoneConfig> = Object.freeze({
  yellowAt: 140_000,
  redAt: 150_000,
});

export interface ResolvedConfig {
  config: Readonly<SmartZoneConfig>;
  warning: string | undefined;
}

const INVALID_CONFIG: ResolvedConfig = {
  config: DEFAULT_CONFIG,
  warning: "Invalid pi-smart-zone configuration; using defaults.",
};

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

export function resolveConfig(contents: string | undefined): ResolvedConfig {
  if (contents === undefined) {
    return { config: DEFAULT_CONFIG, warning: undefined };
  }

  try {
    const parsed: unknown = JSON.parse(contents);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return INVALID_CONFIG;
    }

    const { yellowAt, redAt } = parsed as Record<string, unknown>;
    if (!isPositiveInteger(yellowAt) || !isPositiveInteger(redAt) || yellowAt >= redAt) {
      return INVALID_CONFIG;
    }

    return { config: { yellowAt, redAt }, warning: undefined };
  } catch {
    return INVALID_CONFIG;
  }
}

export function loadConfig(): ResolvedConfig {
  const path = join(homedir(), ".pi", "agent", "pi-smart-zone.json");

  try {
    return resolveConfig(readFileSync(path, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return resolveConfig(undefined);
    }
    return INVALID_CONFIG;
  }
}
