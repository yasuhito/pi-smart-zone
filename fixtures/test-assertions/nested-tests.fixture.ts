import assert from "node:assert/strict";
import { test } from "node:test";

test("outer test", async (context) => {
  await context.test("inner test", () => {
    assert.equal(1, 1);
  });
});
