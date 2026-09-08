import { strictEqual as verify } from "node:assert/strict";
import { test as check } from "node:test";

check("aliased imports", () => {
  verify(1, 1);
});
