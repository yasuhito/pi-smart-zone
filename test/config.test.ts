import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_CONFIG, resolveConfig } from "../src/config.ts";

test("missing configuration uses defaults silently", () => {
  assert.deepEqual(resolveConfig(undefined), {
    config: DEFAULT_CONFIG,
    warning: undefined,
  });
});

test("valid configuration replaces both defaults", () => {
  assert.deepEqual(resolveConfig('{"yellowAt":120000,"redAt":130000}'), {
    config: { yellowAt: 120_000, redAt: 130_000 },
    warning: undefined,
  });
});

test("malformed JSON uses all defaults with a warning", () => {
  assert.deepEqual(resolveConfig("{"), {
    config: DEFAULT_CONFIG,
    warning: "Invalid pi-smart-zone configuration; using defaults.",
  });
});

test("invalid threshold configurations use all defaults with a warning", () => {
  const invalidConfigurations = [
    "null",
    "[]",
    '{}',
    '{"yellowAt":0,"redAt":150000}',
    '{"yellowAt":140000.5,"redAt":150000}',
    '{"yellowAt":"140000","redAt":150000}',
    '{"yellowAt":140000,"redAt":140000}',
    '{"yellowAt":160000,"redAt":150000}',
    '{"yellowAt":140000,"redAt":1e999}',
  ];

  for (const contents of invalidConfigurations) {
    assert.deepEqual(resolveConfig(contents), {
      config: DEFAULT_CONFIG,
      warning: "Invalid pi-smart-zone configuration; using defaults.",
    });
  }
});
