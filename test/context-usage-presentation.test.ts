import assert from "node:assert/strict";
import test from "node:test";

import { createContextUsagePresentation } from "../src/context-usage-presentation.ts";

const presentation = createContextUsagePresentation({
  yellowAt: 140_000,
  redAt: 150_000,
});

const zoneCases = [
  [139_999, "dim"],
  [140_000, "warning"],
  [149_999, "warning"],
  [150_000, "error"],
] as const;

for (const [tokens, expected] of zoneCases) {
  test(`${tokens} tokens use the ${expected} presentation`, () => {
    assert.equal(
      presentation.persistentPresentation({ tokens, contextWindow: 200_000 })
        .color,
      expected,
    );
  });
}

const formatCases = [
  [950, "950/200k"],
  [1_500, "1.5k/200k"],
  [87_000, "87k/200k"],
  [1_200_000, "1.2M/2.0M"],
] as const;

for (const [tokens, expected] of formatCases) {
  test(`${tokens} tokens are formatted in the context usage presentation`, () => {
    const contextWindow = tokens > 200_000 ? 2_000_000 : 200_000;

    assert.equal(
      presentation
        .persistentPresentation({ tokens, contextWindow })
        .text.endsWith(expected),
      true,
    );
  });
}

test("unavailable context usage and context window have unknown persistent presentation text", () => {
  assert.equal(
    presentation.persistentPresentation(undefined).text,
    "? unknown     ?/?",
  );
});

test("unavailable context usage and context window use the dim color", () => {
  assert.equal(presentation.persistentPresentation(undefined).color, "dim");
});

test("temporarily unavailable context usage retains the known context window and smart-zone boundary", () => {
  assert.equal(
    presentation.persistentPresentation({
      tokens: null,
      contextWindow: 200_000,
    }).text,
    "? unknown     ─────────│──  ?/200k",
  );
});

test("temporarily unavailable context usage uses the dim color", () => {
  assert.equal(
    presentation.persistentPresentation({
      tokens: null,
      contextWindow: 200_000,
    }).color,
    "dim",
  );
});

test("normal context usage is presented across the context window", () => {
  assert.equal(
    presentation.persistentPresentation({
      tokens: 87_000,
      contextWindow: 200_000,
    }).text,
    "✓ smart-zone  ━━━━━────│──  87k/200k",
  );
});

test("warning context usage is presented below the smart-zone boundary", () => {
  assert.equal(
    presentation.persistentPresentation({
      tokens: 142_000,
      contextWindow: 200_000,
    }).text,
    "! smart-zone  ━━━━━━━━━│──  142k/200k",
  );
});

test("context usage beyond the smart-zone boundary is presented as in the dumb zone", () => {
  assert.equal(
    presentation.persistentPresentation({
      tokens: 152_000,
      contextWindow: 200_000,
    }).text,
    "✗ dumb-zone   ━━━━━━━━━│──  152k/200k",
  );
});

test("the smart-zone boundary scales with a larger context window", () => {
  assert.equal(
    presentation.persistentPresentation({
      tokens: 150_000,
      contextWindow: 1_000_000,
    }).text,
    "✗ dumb-zone   ━━│─────────  150k/1.0M",
  );
});

test("a smart-zone boundary equal to the context window occupies the final cell", () => {
  assert.equal(
    presentation.persistentPresentation({
      tokens: 150_000,
      contextWindow: 150_000,
    }).text,
    "✗ dumb-zone   ━━━━━━━━━━━│  150k/150k",
  );
});

test("a smart-zone boundary beyond the context window is omitted", () => {
  assert.equal(
    presentation.persistentPresentation({
      tokens: 50_000,
      contextWindow: 100_000,
    }).text,
    "✓ smart-zone  ━━━━━━──────  50k/100k",
  );
});

test("a configured smart-zone boundary determines the marker position", () => {
  const customPresentation = createContextUsagePresentation({
    yellowAt: 90_000,
    redAt: 100_000,
  });

  assert.equal(
    customPresentation.persistentPresentation({
      tokens: 50_000,
      contextWindow: 200_000,
    }).text,
    "✓ smart-zone  ━━━───│─────  50k/200k",
  );
});

test("context usage beyond the context window leaves the bar full", () => {
  assert.equal(
    presentation.persistentPresentation({
      tokens: 250_000,
      contextWindow: 200_000,
    }).text,
    "✗ dumb-zone   ━━━━━━━━━│━━  250k/200k",
  );
});

test("known context usage produces context_usage tool content", () => {
  const result = presentation.contextUsageToolResult({
    tokens: 142_381,
    contextWindow: 200_000,
  });

  assert.deepEqual(result.content, [
    {
      type: "text",
      text: "Estimated context usage: 142381 tokens\nContext window: 200000 tokens",
    },
  ]);
});

test("known context usage produces context_usage tool details", () => {
  const result = presentation.contextUsageToolResult({
    tokens: 142_381,
    contextWindow: 200_000,
  });

  assert.deepEqual(result.details, {
    tokens: 142_381,
    contextWindow: 200_000,
  });
});

test("temporarily unavailable context usage produces context_usage tool content", () => {
  const result = presentation.contextUsageToolResult({
    tokens: null,
    contextWindow: 200_000,
  });

  assert.deepEqual(result.content, [
    {
      type: "text",
      text: "Context usage is temporarily unavailable after compaction.\nContext window: 200000 tokens",
    },
  ]);
});

test("temporarily unavailable context usage produces context_usage tool details", () => {
  const result = presentation.contextUsageToolResult({
    tokens: null,
    contextWindow: 200_000,
  });

  assert.deepEqual(result.details, {
    tokens: null,
    contextWindow: 200_000,
  });
});

test("the context_usage tool result fails when context usage and context window are unavailable", () => {
  assert.throws(
    () => presentation.contextUsageToolResult(undefined),
    new Error("Context usage is unavailable for the active model."),
  );
});
