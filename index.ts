import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { loadConfig } from "./src/config.ts";
import { registerSmartZone } from "./src/register.ts";

export default function smartZone(pi: ExtensionAPI): void {
  registerSmartZone(pi, loadConfig());
}
