import assert from "node:assert/strict";
import test from "node:test";

import { classifyZone, formatTokens, renderStatus } from "../src/status.ts";

const config = { yellowAt: 140_000, redAt: 150_000 };

test("zone classification changes at the configured absolute thresholds", () => {
  assert.equal(classifyZone(139_999, config), "normal");
  assert.equal(classifyZone(140_000, config), "warning");
  assert.equal(classifyZone(149_999, config), "warning");
  assert.equal(classifyZone(150_000, config), "error");
});

test("token counts use Pi-style compact formatting", () => {
  assert.equal(formatTokens(950), "950");
  assert.equal(formatTokens(1_500), "1.5k");
  assert.equal(formatTokens(87_000), "87k");
  assert.equal(formatTokens(1_200_000), "1.2M");
});

test("unavailable usage is shown as unknown", () => {
  const unknownStatus = {
    text: "? smart-zone     ?/ 150k",
    color: "dim",
  };

  assert.deepEqual(renderStatus(undefined, config), unknownStatus);
  assert.deepEqual(renderStatus(null, config), unknownStatus);
});

test("status rendering uses fixed-width fields, labels, and theme colors", () => {
  assert.deepEqual(renderStatus(87_000, config), {
    text: "✓ smart-zone   87k/ 150k",
    color: "dim",
  });
  assert.deepEqual(renderStatus(142_000, config), {
    text: "! smart-zone  142k/ 150k",
    color: "warning",
  });
  assert.deepEqual(renderStatus(152_000, config), {
    text: "✗ dumb-zone   152k/ 150k",
    color: "error",
  });
});
