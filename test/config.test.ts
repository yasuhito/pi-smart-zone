import assert from "node:assert/strict";
import test from "node:test";

import {
  type ConfigurationEnvironment,
  DEFAULT_CONFIG,
  loadConfig,
  resolveConfig,
} from "../src/config.ts";

function loadConfigWithReadFile(
  readFile: ConfigurationEnvironment["readFile"],
) {
  return loadConfig({
    homeDirectory: () => "/test-home",
    readFile,
  });
}

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

const invalidConfigurations = [
  "null",
  "[]",
  "{}",
  '{"yellowAt":0,"redAt":150000}',
  '{"yellowAt":140000.5,"redAt":150000}',
  '{"yellowAt":"140000","redAt":150000}',
  '{"yellowAt":140000,"redAt":140000}',
  '{"yellowAt":160000,"redAt":150000}',
  '{"yellowAt":140000,"redAt":1e999}',
];

for (const contents of invalidConfigurations) {
  test(`invalid configuration ${contents} uses defaults with a warning`, () => {
    assert.deepEqual(resolveConfig(contents), {
      config: DEFAULT_CONFIG,
      warning: "Invalid pi-smart-zone configuration; using defaults.",
    });
  });
}

test("configuration loader uses defaults when the file is absent", () => {
  const result = loadConfigWithReadFile(() => {
    throw Object.assign(new Error("missing"), { code: "ENOENT" });
  });

  assert.equal(result.config, DEFAULT_CONFIG);
});

test("configuration loader resolves valid file contents", () => {
  const result = loadConfigWithReadFile(
    () => '{"yellowAt":120000,"redAt":130000}',
  );

  assert.deepEqual(result.config, { yellowAt: 120_000, redAt: 130_000 });
});

test("configuration loader warns about invalid file contents", () => {
  const result = loadConfigWithReadFile(() => "{");

  assert.equal(
    result.warning,
    "Invalid pi-smart-zone configuration; using defaults.",
  );
});

test("configuration loader warns when the file cannot be read", () => {
  const result = loadConfigWithReadFile(() => {
    throw Object.assign(new Error("denied"), { code: "EACCES" });
  });

  assert.equal(
    result.warning,
    "Invalid pi-smart-zone configuration; using defaults.",
  );
});
