import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { type ConfigurationEnvironment, loadConfig } from "./src/config.ts";
import { registerSmartZone } from "./src/register.ts";

export default function smartZone(
  pi: ExtensionAPI,
  configurationEnvironment?: ConfigurationEnvironment,
): void {
  registerSmartZone(pi, loadConfig(configurationEnvironment));
}
