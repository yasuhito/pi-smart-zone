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

test("unavailable context information has no zone classification", () => {
  assert.equal(renderStatus(undefined, config).text, "? unknown     ?/?");
});

test("temporarily unavailable context usage retains the known context window and smart-zone boundary", () => {
  assert.equal(
    renderStatus(null, config, 200_000).text,
    "? unknown     ─────────│──  ?/200k",
  );
});

test("normal status shows context usage across the context window", () => {
  assert.equal(
    renderStatus(87_000, config, 200_000).text,
    "✓ smart-zone  ━━━━━────│──  87k/200k",
  );
});

test("warning status shows usage below the smart-zone boundary", () => {
  assert.equal(
    renderStatus(142_000, config, 200_000).text,
    "! smart-zone  ━━━━━━━━━│──  142k/200k",
  );
});

test("usage beyond the smart-zone boundary renders its status", () => {
  assert.equal(
    renderStatus(152_000, config, 200_000).text,
    "✗ dumb-zone   ━━━━━━━━━│──  152k/200k",
  );
});

const colorCases = [
  [undefined, undefined, "dim", "unavailable context information"],
  [null, 200_000, "dim", "temporarily unavailable context usage"],
  [87_000, 200_000, "dim", "normal context usage"],
  [142_000, 200_000, "warning", "warning context usage"],
  [152_000, 200_000, "error", "context usage beyond the smart-zone boundary"],
] as const;

for (const [tokens, contextWindow, expected, description] of colorCases) {
  test(`${description} uses the ${expected} color`, () => {
    assert.equal(renderStatus(tokens, config, contextWindow).color, expected);
  });
}

test("the smart-zone boundary scales with a larger context window", () => {
  assert.equal(
    renderStatus(150_000, config, 1_000_000).text,
    "✗ dumb-zone   ━━│─────────  150k/1.0M",
  );
});

test("a smart-zone boundary equal to the context window occupies the final cell", () => {
  assert.equal(
    renderStatus(150_000, config, 150_000).text,
    "✗ dumb-zone   ━━━━━━━━━━━│  150k/150k",
  );
});

test("a smart-zone boundary beyond the context window is omitted", () => {
  assert.equal(
    renderStatus(50_000, config, 100_000).text,
    "✓ smart-zone  ━━━━━━──────  50k/100k",
  );
});

test("a configured smart-zone boundary determines the marker position", () => {
  const customConfig = { yellowAt: 90_000, redAt: 100_000 };

  assert.equal(
    renderStatus(50_000, customConfig, 200_000).text,
    "✓ smart-zone  ━━━───│─────  50k/200k",
  );
});

test("usage beyond the context window leaves the bar full", () => {
  assert.equal(
    renderStatus(250_000, config, 200_000).text,
    "✗ dumb-zone   ━━━━━━━━━│━━  250k/200k",
  );
});
