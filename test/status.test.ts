import assert from "node:assert/strict";
import test from "node:test";

import { classifyZone, formatTokens, renderStatus } from "../src/status.ts";

const config = { yellowAt: 140_000, redAt: 150_000 };

const zoneCases = [
  [139_999, "normal"],
  [140_000, "warning"],
  [149_999, "warning"],
  [150_000, "error"],
] as const;

for (const [tokens, expected] of zoneCases) {
  test(`${tokens} tokens are classified as ${expected}`, () => {
    assert.equal(classifyZone(tokens, config), expected);
  });
}

const formatCases = [
  [950, "950"],
  [1_500, "1.5k"],
  [87_000, "87k"],
  [1_200_000, "1.2M"],
] as const;

for (const [tokens, expected] of formatCases) {
  test(`${tokens} tokens are formatted as ${expected}`, () => {
    assert.equal(formatTokens(tokens), expected);
  });
}

const unknownStatus = {
  text: "? smart-zone     ?/ 150k",
  color: "dim",
};

test("undefined usage is shown as unknown", () => {
  assert.deepEqual(renderStatus(undefined, config), unknownStatus);
});

test("null usage is shown as unknown", () => {
  assert.deepEqual(renderStatus(null, config), unknownStatus);
});

test("normal status uses the smart-zone label and dim color", () => {
  assert.deepEqual(renderStatus(87_000, config), {
    text: "✓ smart-zone   87k/ 150k",
    color: "dim",
  });
});

test("warning status uses the smart-zone label and warning color", () => {
  assert.deepEqual(renderStatus(142_000, config), {
    text: "! smart-zone  142k/ 150k",
    color: "warning",
  });
});

test("error status uses the dumb-zone label and error color", () => {
  assert.deepEqual(renderStatus(152_000, config), {
    text: "✗ dumb-zone   152k/ 150k",
    color: "error",
  });
});
