import { readFileSync, readdirSync, statSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import process from "node:process";

import { parse } from "@babel/parser";

const assertionMethods = new Set([
  "deepEqual",
  "deepStrictEqual",
  "doesNotMatch",
  "doesNotReject",
  "doesNotThrow",
  "equal",
  "fail",
  "ifError",
  "match",
  "notDeepEqual",
  "notDeepStrictEqual",
  "notEqual",
  "notStrictEqual",
  "ok",
  "partialDeepStrictEqual",
  "rejects",
  "strictEqual",
  "throws",
]);

interface AstNode {
  readonly type: string;
  readonly [key: string]: unknown;
}

interface Imports {
  readonly assertionFunctions: ReadonlySet<string>;
  readonly assertionNamespaces: ReadonlySet<string>;
  readonly testFunctions: ReadonlySet<string>;
}

interface Diagnostic {
  readonly column: number;
  readonly count: number;
  readonly fileName: string;
  readonly line: number;
  readonly title: string;
}

function isNode(value: unknown): value is AstNode {
  return typeof value === "object" && value !== null && "type" in value;
}

function identifierName(node: unknown): string | undefined {
  return isNode(node) && node.type === "Identifier" && typeof node.name === "string"
    ? node.name
    : undefined;
}

function childNodes(node: AstNode): ReadonlyArray<AstNode> {
  const children: Array<AstNode> = [];
  for (const [key, value] of Object.entries(node)) {
    if (key === "loc" || key === "start" || key === "end") continue;
    if (isNode(value)) children.push(value);
    if (Array.isArray(value)) children.push(...value.filter(isNode));
  }
  return children;
}

function collectImports(program: AstNode): Imports {
  const assertionFunctions = new Set<string>();
  const assertionNamespaces = new Set<string>();
  const testFunctions = new Set<string>();
  const statements = Array.isArray(program.body) ? program.body.filter(isNode) : [];

  for (const statement of statements) {
    if (statement.type !== "ImportDeclaration" || !isNode(statement.source)) continue;
    const moduleName = statement.source.value;
    if (typeof moduleName !== "string") continue;
    const specifiers = Array.isArray(statement.specifiers)
      ? statement.specifiers.filter(isNode)
      : [];

    for (const specifier of specifiers) {
      const localName = identifierName(specifier.local);
      if (localName === undefined) continue;

      if (moduleName === "node:test") {
        if (specifier.type === "ImportDefaultSpecifier") testFunctions.add(localName);
        if (specifier.type === "ImportSpecifier") {
          const importedName = identifierName(specifier.imported);
          if (importedName === "test" || importedName === "it") {
            testFunctions.add(localName);
          }
        }
      }

      if (moduleName === "node:assert/strict") {
        if (
          specifier.type === "ImportDefaultSpecifier" ||
          specifier.type === "ImportNamespaceSpecifier"
        ) {
          assertionNamespaces.add(localName);
        }
        if (specifier.type === "ImportSpecifier") {
          const importedName = identifierName(specifier.imported);
          if (importedName !== undefined && assertionMethods.has(importedName)) {
            assertionFunctions.add(localName);
          }
        }
      }
    }
  }

  return { assertionFunctions, assertionNamespaces, testFunctions };
}

function memberNames(node: unknown): readonly [string, string] | undefined {
  if (!isNode(node) || node.type !== "MemberExpression" || node.computed === true) {
    return undefined;
  }
  const objectName = identifierName(node.object);
  const propertyName = identifierName(node.property);
  return objectName !== undefined && propertyName !== undefined
    ? [objectName, propertyName]
    : undefined;
}

function isImportedTestCall(call: AstNode, testFunctions: ReadonlySet<string>): boolean {
  const calleeName = identifierName(call.callee);
  if (calleeName !== undefined) return testFunctions.has(calleeName);
  const member = memberNames(call.callee);
  return (
    member !== undefined &&
    testFunctions.has(member[0]) &&
    (member[1] === "only" || member[1] === "skip")
  );
}

function isContextTestCall(call: AstNode, contextNames: ReadonlySet<string>): boolean {
  const member = memberNames(call.callee);
  return member !== undefined && contextNames.has(member[0]) && member[1] === "test";
}

function isAssertionCall(call: AstNode, imports: Imports): boolean {
  const calleeName = identifierName(call.callee);
  if (calleeName !== undefined) {
    return (
      imports.assertionNamespaces.has(calleeName) ||
      imports.assertionFunctions.has(calleeName)
    );
  }
  const member = memberNames(call.callee);
  return (
    member !== undefined &&
    imports.assertionNamespaces.has(member[0]) &&
    assertionMethods.has(member[1])
  );
}

function callbackOf(call: AstNode): AstNode | undefined {
  const argumentsList = Array.isArray(call.arguments) ? call.arguments.filter(isNode) : [];
  const callback = argumentsList.at(-1);
  return callback !== undefined &&
      (callback.type === "ArrowFunctionExpression" || callback.type === "FunctionExpression")
    ? callback
    : undefined;
}

function isFunction(node: AstNode): boolean {
  return (
    node.type === "ArrowFunctionExpression" ||
    node.type === "FunctionExpression" ||
    node.type === "FunctionDeclaration" ||
    node.type === "ObjectMethod" ||
    node.type === "ClassMethod"
  );
}

function countDirectAssertions(callback: AstNode, imports: Imports): number {
  let count = 0;
  const body = isNode(callback.body) ? callback.body : undefined;
  if (body === undefined) return count;

  const visit = (node: AstNode): void => {
    if (node !== body && isFunction(node)) return;
    if (node.type === "CallExpression" && isAssertionCall(node, imports)) count += 1;
    for (const child of childNodes(node)) visit(child);
  };

  visit(body);
  return count;
}

function testTitle(call: AstNode): string {
  const argumentsList = Array.isArray(call.arguments) ? call.arguments.filter(isNode) : [];
  const title = argumentsList[0];
  return title?.type === "StringLiteral" && typeof title.value === "string"
    ? title.value
    : "<unnamed>";
}

function firstParameterName(callback: AstNode): string | undefined {
  const parameters = Array.isArray(callback.params) ? callback.params.filter(isNode) : [];
  return identifierName(parameters[0]);
}

function sourceLocation(node: AstNode): { readonly column: number; readonly line: number } {
  const location = node.loc;
  if (typeof location !== "object" || location === null || !("start" in location)) {
    return { column: 1, line: 1 };
  }
  const start = location.start;
  if (typeof start !== "object" || start === null) return { column: 1, line: 1 };
  const column = "column" in start && typeof start.column === "number"
    ? start.column + 1
    : 1;
  const line = "line" in start && typeof start.line === "number" ? start.line : 1;
  return { column, line };
}

function checkSource(fileName: string, sourceText: string): ReadonlyArray<Diagnostic> {
  const file = parse(sourceText, { sourceType: "module", plugins: ["typescript"] });
  const program = file.program as unknown as AstNode;
  const imports = collectImports(program);
  const diagnostics: Array<Diagnostic> = [];

  const visit = (node: AstNode, contextNames: ReadonlySet<string>): void => {
    if (node.type === "CallExpression") {
      const isTest =
        isImportedTestCall(node, imports.testFunctions) ||
        isContextTestCall(node, contextNames);
      if (isTest) {
        const callback = callbackOf(node);
        if (callback !== undefined) {
          const count = countDirectAssertions(callback, imports);
          if (count !== 1) {
            diagnostics.push({
              ...sourceLocation(node),
              count,
              fileName,
              title: testTitle(node),
            });
          }

          const nestedContexts = new Set(contextNames);
          const contextName = firstParameterName(callback);
          if (contextName !== undefined) nestedContexts.add(contextName);
          const body = isNode(callback.body) ? callback.body : undefined;
          if (body !== undefined) {
            for (const child of childNodes(body)) visit(child, nestedContexts);
          }
          return;
        }
      }
    }
    for (const child of childNodes(node)) visit(child, contextNames);
  };

  visit(program, new Set());
  return diagnostics;
}

function testFiles(directory: string): ReadonlyArray<string> {
  const files: Array<string> = [];
  for (const entry of readdirSync(directory).sort()) {
    const path = resolve(directory, entry);
    if (statSync(path).isDirectory()) {
      files.push(...testFiles(path));
    } else if (entry.endsWith(".test.ts") || entry.endsWith(".spec.ts")) {
      files.push(path);
    }
  }
  return files;
}

const requestedFiles = process.argv.slice(2);
const files = requestedFiles.length > 0
  ? requestedFiles.map((file) => resolve(file))
  : testFiles(resolve("test"));
const diagnostics = files.flatMap((file) => {
  const displayName = relative(process.cwd(), file).split(sep).join("/");
  return checkSource(displayName, readFileSync(file, "utf8"));
});

for (const diagnostic of diagnostics) {
  process.stderr.write(
    `${diagnostic.fileName}:${diagnostic.line}:${diagnostic.column}: ` +
      `test ${JSON.stringify(diagnostic.title)} must contain exactly one direct assertion; ` +
      `found ${diagnostic.count}\n`,
  );
}
if (diagnostics.length > 0) process.exitCode = 1;
