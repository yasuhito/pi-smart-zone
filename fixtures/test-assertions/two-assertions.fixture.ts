import assert from "node:assert/strict";
import { test } from "node:test";

test("two assertions", () => {
  assert.equal(1, 1);
  assert.equal(2, 2);
});
