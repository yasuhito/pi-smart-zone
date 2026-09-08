import assert from "node:assert/strict";
import { test } from "node:test";

function verifyValue(): void {
  assert.equal(1, 1);
}

test("helper assertion", () => {
  verifyValue();
});
