import assert from "node:assert/strict";
import test from "node:test";

function body() {
  assert.equal(1, 1);
  assert.equal(2, 2);
}

test("named callback", body);
