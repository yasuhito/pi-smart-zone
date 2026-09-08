import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { test } from "node:test";

function checkFixture(name: string) {
  const checker = join(process.cwd(), "scripts", "check-test-assertions.ts");
  const fixture = join("fixtures", "test-assertions", `${name}.fixture.ts`);
  return spawnSync(process.execPath, [checker, fixture], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

test("checker accepts one direct assertion", () => {
  const result = checkFixture("one-assertion");

  assert.equal(result.status, 0);
});

test("checker reports a test without an assertion", () => {
  const result = checkFixture("zero-assertions");

  assert.deepEqual(
    { status: result.status, stderr: result.stderr },
    {
      status: 1,
      stderr:
        'fixtures/test-assertions/zero-assertions.fixture.ts:3:1: test "zero assertions" must contain exactly one direct assertion; found 0\n',
    },
  );
});

test("checker reports a test with multiple assertions", () => {
  const result = checkFixture("two-assertions");

  assert.deepEqual(
    { status: result.status, stderr: result.stderr },
    {
      status: 1,
      stderr:
        'fixtures/test-assertions/two-assertions.fixture.ts:4:1: test "two assertions" must contain exactly one direct assertion; found 2\n',
    },
  );
});

test("checker follows aliased test and assertion imports", () => {
  const result = checkFixture("aliased-imports");

  assert.equal(result.status, 0);
});

test("checker does not count an assertion hidden in a helper", () => {
  const result = checkFixture("helper-assertion");

  assert.deepEqual(
    { status: result.status, stderr: result.stderr },
    {
      status: 1,
      stderr:
        'fixtures/test-assertions/helper-assertion.fixture.ts:8:1: test "helper assertion" must contain exactly one direct assertion; found 0\n',
    },
  );
});

test("checker validates nested tests independently", () => {
  const result = checkFixture("nested-tests");

  assert.deepEqual(
    { status: result.status, stderr: result.stderr },
    {
      status: 1,
      stderr:
        'fixtures/test-assertions/nested-tests.fixture.ts:4:1: test "outer test" must contain exactly one direct assertion; found 0\n',
    },
  );
});
