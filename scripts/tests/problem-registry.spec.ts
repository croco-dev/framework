import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import ts from "typescript";
import { afterEach, describe, expect, it } from "vitest";

import {
  findBranchProtectionPolicyViolations,
  readExpectedBranchProtectionPolicy,
} from "../branch-protection-policy.mts";
import {
  createProblemCodeRegistry,
  createProblemRegistryArtifacts,
  discoverProblemCodes,
  formatProblemRegistryArtifacts,
  runProblemRegistryCheck,
} from "../problem-registry.mts";
import type { ProblemCodeRegistry } from "../problem-registry.mts";

const tempRepos: string[] = [];

describe("problem-registry.mts", () => {
  afterEach(() => {
    for (const repo of tempRepos.splice(0)) {
      rmSync(repo, { force: true, recursive: true });
    }
  });

  it.each([
    "inferred",
    "explicit",
    ...Array.from(
      { length: Math.ceil(readRegistry(resolve(".")).problems.length / 200) },
      (_, index) => index,
    ),
  ])("checks large registry declaration emit and exact literal precision (%s)", (mode) => {
    const repo = createTempRepo();
    const current = readRegistry(resolve("."));
    const problems =
      typeof mode === "number"
        ? current.problems.slice(mode * 200, (mode + 1) * 200)
        : Array.from({ length: 1600 }, (_, index) => ({
            ...current.problems[index % current.problems.length],
            code: `emit-regression/${index}`,
          }));
    const registry = { ...current, problemCount: problems.length, problems };
    const generated = createProblemRegistryArtifacts(registry).get(
      "packages/problems-core/src/generated/problem-code-registry.ts",
    );
    if (generated === undefined) throw new Error("Missing generated registry source");
    const source = generated
      .replace(
        '"../libs/Problem"',
        JSON.stringify(resolve("packages/problems-core/src/libs/Problem")),
      )
      .replace(
        '"../libs/ProblemRegistry"',
        JSON.stringify(resolve("packages/problems-core/src/libs/ProblemRegistry")),
      );
    const typeStart = source.indexOf("export type CrocoProblemRegistry =");
    const valueStart = source.indexOf("export const CROCO_PROBLEM_CODE_REGISTRY");
    expect(typeStart).toBeGreaterThan(0);
    const inferred =
      source.slice(0, typeStart) +
      source.slice(valueStart).replace(": CrocoProblemRegistry =", " =") +
      "\nexport type CrocoProblemRegistry = typeof CROCO_PROBLEM_CODE_REGISTRY;\n";
    const file = join(repo, "registry.ts");
    const compile = (text: string) => {
      writeFileSync(file, text);
      const program = ts.createProgram([file], {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        strict: true,
        skipLibCheck: true,
        types: [],
        declaration: true,
        emitDeclarationOnly: true,
      });
      const emitted = new Map<string, string>();
      const result = program.emit(undefined, (path, content) => emitted.set(path, content));
      return {
        diagnostics: [...ts.getPreEmitDiagnostics(program), ...result.diagnostics],
        emitted,
      };
    };
    if (mode === "inferred") {
      expect(compile(inferred).diagnostics.map(({ code }) => code)).toContain(7056);
      return;
    }
    if (mode === "explicit") {
      const result = compile(source);
      expect(result.diagnostics).toEqual([]);
      expect(result.emitted.get(join(repo, "registry.d.ts"))).toContain(
        "CROCO_PROBLEM_CODE_REGISTRY: CrocoProblemRegistry",
      );
      return;
    }
    const fixed = problems.find((entry) => !entry.statusPolicy && !entry.categoryPolicy);
    const configurable = problems.find((entry) => entry.statusPolicy);
    const correlated = problems.find((entry) => entry.categoryPolicy);

    const precision = `
const expected = ${JSON.stringify(registry)} as const;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
type RootKeys = Assert<Equal<keyof CrocoProblemRegistry, keyof typeof expected>>;
type Version = Assert<Equal<CrocoProblemRegistry['version'], typeof expected.version>>;
type Count = Assert<Equal<CrocoProblemRegistry['problemCount'], typeof expected.problemCount>>;
type Factories = Assert<Equal<CrocoProblemRegistry['dynamicCodeFactories'], typeof expected.dynamicCodeFactories>>;
type TupleKeys = Assert<Equal<keyof CrocoProblemRegistry['problems'], keyof typeof expected.problems>>;
type TupleLength = Assert<Equal<CrocoProblemRegistry['problems']['length'], typeof expected.problems['length']>>;
${problems.map((_, index) => `type Record${index} = Assert<Equal<CrocoProblemRegistry['problems'][${index}], typeof expected.problems[${index}]>>;`).join("\n")}
type ValueLiteral = Assert<Equal<typeof CROCO_PROBLEM_CODE_REGISTRY, CrocoProblemRegistry>>;
type Codes = Assert<Equal<CrocoProblemCode, typeof expected.problems[number]['code']>>;
${fixed ? `type FixedStatus = Assert<Equal<CrocoProblemStatus<${JSON.stringify(fixed.code)}>, ${fixed.status}>>;` : ""}
${configurable ? `type ConfigurableStatus = Assert<Equal<CrocoProblemStatus<${JSON.stringify(configurable.code)}>, number>>;` : ""}
${correlated ? `type CorrelatedStatus = Assert<Equal<CrocoProblemStatus<${JSON.stringify(correlated.code)}>, ${correlated.categoryPolicy?.possibleStatuses.join(" | ")}>>;` : ""}
${fixed ? `type DetailsCorrelation = Assert<Equal<CrocoProblemDetails<${JSON.stringify(fixed.code)}>['status'], ${fixed.status}>>;` : ""}
// @ts-expect-error The root properties remain readonly.
CROCO_PROBLEM_CODE_REGISTRY.problems = expected.problems;
// @ts-expect-error The generated tuple remains readonly.
CROCO_PROBLEM_CODE_REGISTRY.problems.push(expected.problems[0]);
// @ts-expect-error Unknown codes cannot enter the public code union.
const invalidCode: CrocoProblemCode = "not-a-registered-code";
`;
    const result = compile(source + precision);
    expect(
      result.diagnostics.map((diagnostic) =>
        ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
      ),
    ).toEqual([]);
    expect(result.emitted.get(join(repo, "registry.d.ts"))).toContain(
      "CROCO_PROBLEM_CODE_REGISTRY: CrocoProblemRegistry",
    );
  });

  it.each([
    `const TABLE = { one: { code: "a", category: ProblemCategory.Conflict }, two: { code: "b", category: ProblemCategory.InternalServerError } };
let key = false;
function next() { key = !key; return key ? "one" : "two"; }
class Unstable extends Problem { constructor() { super(TABLE[next()].code, TABLE[next()].category, "failed"); } }`,
    `let flag = true;
function code() { flag = false; return "a"; }
const a = { code: "a", category: ProblemCategory.Conflict };
const b = { code: "b", category: ProblemCategory.InternalServerError };
class Unstable extends Problem { constructor() { super(flag ? code() : "b", flag ? ProblemCategory.Conflict : ProblemCategory.InternalServerError, "failed"); } }`,
  ])("purity review regression: rejects effectful correlation (%s)", (body) => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/alpha/src/problems.ts",
      `import { Problem, ProblemCategory } from "@croco/problems-core";
${body}`,
    );
    expect(() => createProblemCodeRegistry(discoverProblemCodes(repo))).toThrow(
      /multiple categories|declared/,
    );
  });

  it("preserves correlation through an entry captured once in a const alias", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/alpha/src/problems.ts",
      `import { Problem, ProblemCategory } from "@croco/problems-core";
const TABLE = { one: { code: "a", category: ProblemCategory.Conflict }, two: { code: "b", category: ProblemCategory.InternalServerError } };
function select(key: boolean) { return key ? "one" : "two"; }
class Stable extends Problem { constructor(key: boolean) { const spec = TABLE[select(key)]; super(spec.code, spec.category, "failed"); } }`,
    );
    expect(
      createProblemCodeRegistry(discoverProblemCodes(repo)).problems.map((entry) => [
        entry.code,
        entry.status,
      ]),
    ).toEqual([
      ["a", 409],
      ["b", 500],
    ]);
  });

  it.each([
    `const metadata = { code: "a", category: ProblemCategory.Conflict };
class Multi extends Problem { constructor(code: "a" | "b", flag: boolean) { super(code, category(flag), "failed"); } }`,
    `abstract class Base extends Problem { constructor(options: { code: string; category: ProblemCategory }, flag: boolean) { super(options.code, category(flag), "failed"); } }
class Child extends Base { constructor(flag: boolean) { super({ code: "a", category: ProblemCategory.Conflict }, flag); } }`,
    `const TABLE = { one: { code: "a", category: ProblemCategory.Conflict } };
class Lookup extends Problem { constructor(key: keyof typeof TABLE, flag: boolean) { const spec = TABLE[key]; super(spec.code, category(flag), "failed"); } }`,
  ])("metadata review regression: rejects metadata that hides a runtime category (%s)", (body) => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/alpha/src/problems.ts",
      `import { Problem, ProblemCategory } from "@croco/problems-core";
function category(flag: boolean) { return flag ? ProblemCategory.Conflict : ProblemCategory.InternalServerError; }
${body}`,
    );
    expect(() => createProblemCodeRegistry(discoverProblemCodes(repo))).toThrow(
      /multiple categories|declared/,
    );
  });

  it("preserves categories correlated through metadata objects and conditional branches", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/alpha/src/codes.ts",
      'export const CODES = { three: "three", four: "four" } satisfies Record<string, string>;',
    );
    writeFile(
      repo,
      "packages/alpha/src/problems.ts",
      `import { Problem, ProblemCategory } from "@croco/problems-core";
const TABLE = { one: { code: "one", category: ProblemCategory.Conflict }, two: { code: "two", category: ProblemCategory.InternalServerError } };
class Lookup extends Problem { constructor(key: keyof typeof TABLE) { const spec = TABLE[key]; super(spec.code, spec.category, "failed"); } }
import { CODES } from "./codes";
class Conditional extends Problem { constructor(flag: boolean) { super(flag ? CODES.three : CODES.four, flag ? ProblemCategory.NotFound : ProblemCategory.BadRequest, "failed"); } }
const three = { code: "three", category: ProblemCategory.NotFound };
const four = { code: "four", category: ProblemCategory.BadRequest };`,
    );
    const registry = createProblemCodeRegistry(discoverProblemCodes(repo));
    expect(
      Object.fromEntries(registry.problems.map((entry) => [entry.code, entry.status])),
    ).toEqual({ one: 409, two: 500, three: 404, four: 400 });
  });

  it("review regression: checks subclasses imported from workspace package exports", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/base/package.json",
      JSON.stringify({
        name: "@croco/base",
        exports: {
          ".": "./src/index.ts",
          "./problem": { types: "./dist/problem.d.ts", import: "./dist/problem.js" },
        },
      }),
    );
    writeFile(repo, "packages/base/src/index.ts", 'export { Base } from "./problem";');
    writeFile(
      repo,
      "packages/base/src/problem.ts",
      `import { Problem } from "@croco/problems-core";
export abstract class Base extends Problem {}`,
    );
    writeFile(
      repo,
      "packages/child/src/problems.ts",
      `import { Base } from "@croco/base";
import { Base as SubpathBase } from "@croco/base/problem";
class Missing extends Base {}
class SubpathMissing extends SubpathBase {}`,
    );
    const result = runProblemRegistryCheck(repo);
    expect(result.diagnostics).toContainEqual(
      expect.stringContaining("packages/child/src/problems.ts:3:1: Missing"),
    );
    expect(result.diagnostics).toContainEqual(
      expect.stringContaining("packages/child/src/problems.ts:4:1: SubpathMissing"),
    );
  });

  it("review regression: rejects overlapping fixed and dynamic declarations of one code", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/alpha/src/problems.ts",
      `import { Problem, ProblemCategory } from "@croco/problems-core";
class Fixed extends Problem { constructor() { super("shared", ProblemCategory.Conflict, "fixed"); } }
function category(flag: boolean) { return flag ? ProblemCategory.Conflict : ProblemCategory.InternalServerError; }
class Dynamic extends Problem { constructor(flag: boolean) { super("shared", category(flag), "dynamic"); } }`,
    );
    expect(() => createProblemCodeRegistry(discoverProblemCodes(repo))).toThrow(
      /multiple categories|declared/,
    );
  });

  it("review regression: binds helper arguments instead of claiming their default category", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/alpha/src/problems.ts",
      `import { Problem, ProblemCategory } from "@croco/problems-core";
function category(value: ProblemCategory = ProblemCategory.Conflict) { return value; }
class Passed extends Problem { constructor() { super("passed", category(ProblemCategory.InternalServerError), "failed"); } }
class Defaulted extends Problem { constructor() { super("defaulted", category(), "failed"); } }`,
    );
    const registry = createProblemCodeRegistry(discoverProblemCodes(repo));
    expect(registry.problems.find((entry) => entry.code === "passed")?.status).toBe(500);
    expect(registry.problems.find((entry) => entry.code === "defaulted")?.status).toBe(409);
    writeFile(
      repo,
      "packages/alpha/src/unknown.ts",
      `import { Problem, ProblemCategory } from "@croco/problems-core";
function category(value: ProblemCategory = ProblemCategory.Conflict) { return value; }
class Unknown extends Problem { constructor(value: ProblemCategory) { super("unknown", category(value), "failed"); } }`,
    );
    expect(runProblemRegistryCheck(repo).diagnostics).toContainEqual(
      expect.stringContaining("packages/alpha/src/unknown.ts:3:1: Unknown"),
    );
  });

  it("accounts for dynamic categories, inherited codes, and finite lookup codes", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/alpha/src/base.ts",
      `
import { Problem, ProblemCategory } from "@croco/problems-core";
export class ConstraintProblem extends Problem {
  constructor(detail: string, extensions?: object, code = "constraint") {
    super(code, ProblemCategory.Forbidden, detail, { extensions });
  }
}`,
    );
    writeFile(
      repo,
      "packages/alpha/src/problems.ts",
      `
import { Problem, ProblemCategory } from "@croco/problems-core";
import { ConstraintProblem } from "./base";
function category(status: number): ProblemCategory {
  if (status === 429) return ProblemCategory.TooManyRequests;
  return ProblemCategory.InternalServerError;
}
export class UpstreamProblem extends Problem {
  readonly code = "upstream";
  constructor(status: number) { super("upstream", category(status), "failed"); }
}
export class LastOwnerProblem extends ConstraintProblem {
  constructor() { super("owner", {}, "last-owner"); }
}
const FAILURES = { first: { code: "first" }, second: { code: "second" } };
export class CommandProblem extends Problem {
  constructor(stage: keyof typeof FAILURES) {
    const failure = FAILURES[stage];
    super(failure.code, ProblemCategory.InternalServerError, "failed");
  }
}`,
    );
    const registry = createProblemCodeRegistry(discoverProblemCodes(repo));
    expect(registry.problems.map(({ code }) => code)).toEqual([
      "constraint",
      "first",
      "last-owner",
      "second",
      "upstream",
    ]);
    expect(registry.problems.find(({ code }) => code === "upstream")).toMatchObject({
      category: null,
      status: null,
      title: null,
      categoryPolicy: {
        kind: "runtime-dependent",
        possibleCategories: ["InternalServerError", "TooManyRequests"],
        possibleStatuses: [429, 500],
      },
    });
  });

  it("fails with a source location for unaccounted concrete Problem subclasses", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/alpha/src/problems.ts",
      `import { Problem } from "@croco/problems-core";
export class MissingProblem extends Problem {
  constructor() { super(computeCode(), computeCategory(), "failed"); }
}`,
    );
    const result = runProblemRegistryCheck(repo, "check");
    expect(result.status).toBe("fail");
    expect(result.diagnostics).toContainEqual(
      expect.stringContaining(
        "problem-class-unaccounted at packages/alpha/src/problems.ts:2:1: MissingProblem",
      ),
    );
  });

  it("records runtime code factories without changing factory call-site discovery", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/alpha/src/problems.ts",
      `
import { Problem, ProblemCategory } from "@croco/problems-core";
class GenericProblem extends Problem {
  constructor(code: string, category: ProblemCategory) { super(code, category, "failed"); }
}
class OptionProblem extends Problem {
  constructor(options: { code: string; category: ProblemCategory }) { super(options.code, options.category, "failed"); }
}
class TemplateProblem extends Problem {
  constructor(code: string) { super(\`alpha/\${code}\`, ProblemCategory.Conflict, "failed"); }
}
new GenericProblem("alpha/known", ProblemCategory.NotFound);
`,
    );
    const result = runProblemRegistryCheck(repo, "write");
    expect(result.diagnostics).toEqual([]);
    const registry = JSON.parse(
      readFileSync(join(repo, "docs/problem-code-registry.json"), "utf-8"),
    );
    expect(registry.problems.map((problem: { code: string }) => problem.code)).toEqual([
      "alpha/known",
    ]);
    expect(
      registry.dynamicCodeFactories.map((factory: { className: string }) => factory.className),
    ).toEqual(["GenericProblem", "OptionProblem", "TemplateProblem"]);
    expect(registry.dynamicCodeFactories[0].source).toMatchObject({
      file: "packages/alpha/src/problems.ts",
      line: 3,
    });
    expect(runProblemRegistryCheck(repo, "check").status).toBe("pass");
  });

  it("checks aliased and transitively inherited concrete classes but permits abstract bases", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/alpha/src/base.ts",
      `import { Problem as Base } from "@croco/problems-core";
export abstract class Intermediate extends Base {}`,
    );
    writeFile(
      repo,
      "packages/alpha/src/child.ts",
      `import { Intermediate as Parent } from "./base";
export class Unaccounted extends Parent {}`,
    );
    expect(runProblemRegistryCheck(repo).diagnostics).toContainEqual(
      expect.stringContaining(
        "problem-class-unaccounted at packages/alpha/src/child.ts:2:1: Unaccounted",
      ),
    );
  });

  it("rejects partially unresolved category functions instead of claiming a partial set", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/alpha/src/problems.ts",
      `import { Problem, ProblemCategory } from "@croco/problems-core";
function category(flag: boolean) { if (flag) return ProblemCategory.Conflict; return externalCategory(); }
class PartialProblem extends Problem { constructor(flag: boolean) { super("partial", category(flag), "failed"); } }`,
    );
    expect(runProblemRegistryCheck(repo).diagnostics).toContainEqual(
      expect.stringContaining("problem-class-unaccounted"),
    );
  });

  it("does not let unrelated nested metadata conceal missing class contracts", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/alpha/src/problems.ts",
      `import * as problems from "@croco/problems-core";
class Hidden extends problems.Problem {
  constructor() { super(computeCode(), computeCategory(), "failed"); }
  metadata() { return { code: "unrelated", category: ProblemCategory.Conflict }; }
}`,
    );
    expect(runProblemRegistryCheck(repo).diagnostics).toContainEqual(
      expect.stringContaining(
        "problem-class-unaccounted at packages/alpha/src/problems.ts:2:1: Hidden",
      ),
    );
  });

  it("does not classify a literal inherited code with unknown category as a dynamic code factory", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/alpha/src/problems.ts",
      `import { Problem } from "@croco/problems-core";
abstract class Base extends Problem { constructor(code: string) { super(code, unknownCategory(), "failed"); } }
class Missing extends Base { constructor() { super("literal"); } }`,
    );
    expect(runProblemRegistryCheck(repo).diagnostics).toContainEqual(
      expect.stringContaining(
        "problem-class-unaccounted at packages/alpha/src/problems.ts:3:1: Missing",
      ),
    );
  });

  it("rejects Problem constructors that drop Error and Error-union causes", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/alpha/src/problems.ts",
      [
        'import { Problem, ProblemCategory } from "@croco/problems-core";',
        "export class AlphaProblem extends Problem {",
        "  constructor(cause: Error) {",
        '    super("alpha/failed", ProblemCategory.InternalServerError, cause.message);',
        "  }",
        "}",
        "export class UnionProblem extends Problem {",
        "  constructor(originalError: Error | string) {",
        '    super("alpha/union", ProblemCategory.InternalServerError, String(originalError));',
        "  }",
        "}",
        "export class UnknownProblem extends Problem {",
        "  constructor(error: unknown) {",
        '    super("alpha/unknown", ProblemCategory.InternalServerError, String(error));',
        "  }",
        "}",
      ].join("\n"),
    );

    const result = runProblemRegistryCheck(repo, "write");

    expect(result.status).toBe("fail");
    expect(result.diagnostics).toContainEqual(
      expect.stringContaining("problem-cause-not-forwarded at packages/alpha/src/problems.ts:3:"),
    );
    expect(result.diagnostics).toContainEqual(
      expect.stringContaining("problem-cause-not-forwarded at packages/alpha/src/problems.ts:8:"),
    );
    expect(result.diagnostics).toContainEqual(
      expect.stringContaining("problem-cause-not-forwarded at packages/alpha/src/problems.ts:13:"),
    );
  }, 30_000);

  it("accepts direct, guarded, aliased, spread, and Error-union cause forwarding", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/alpha/src/problems.ts",
      [
        'import { Problem, ProblemCategory } from "@croco/problems-core";',
        'import type { ProblemOptions } from "@croco/problems-core";',
        "export class DirectProblem extends Problem {",
        "  constructor(cause: Error) {",
        '    super("alpha/direct", ProblemCategory.InternalServerError, "failed", { cause });',
        "  }",
        "}",
        "export class GuardedProblem extends Problem {",
        "  constructor(error: unknown) {",
        '    super("alpha/guarded", ProblemCategory.InternalServerError, "failed", error instanceof Error ? { cause: error } : undefined);',
        "  }",
        "}",
        "export class UnionProblem extends Problem {",
        "  constructor(originalError: Error | string) {",
        '    super("alpha/union", ProblemCategory.InternalServerError, "failed", { cause: originalError instanceof Error ? originalError : undefined });',
        "  }",
        "}",
        "export class NormalizedAliasProblem extends Problem {",
        "  constructor(error: unknown) {",
        "    const causeError = error instanceof Error ? error : new Error(String(error));",
        '    super("alpha/normalized", ProblemCategory.InternalServerError, "failed", { cause: causeError });',
        "  }",
        "}",
        "export class OptionsAliasProblem extends Problem {",
        "  constructor(cause?: Error) {",
        "    const options = cause ? ({ cause } satisfies ProblemOptions) : undefined;",
        '    super("alpha/options", ProblemCategory.InternalServerError, "failed", options);',
        "  }",
        "}",
        "export class SpreadProblem extends Problem {",
        "  constructor(cause: Error) {",
        "    const options = { cause };",
        '    super("alpha/spread", ProblemCategory.InternalServerError, "failed", { ...options });',
        "  }",
        "}",
        "export class OptionalCauseProblem extends Problem {",
        "  constructor(cause?: Error) {",
        '    super("alpha/optional-cause", ProblemCategory.InternalServerError, "failed", cause !== undefined ? { cause } : undefined);',
        "  }",
        "}",
        "export class ReboundAliasProblem extends Problem {",
        "  constructor(cause: Error) {",
        "    const options: { cause?: Error } = { cause };",
        "    let alias = options;",
        "    alias = {};",
        "    alias.cause = undefined;",
        '    super("alpha/rebound-alias", ProblemCategory.InternalServerError, "failed", options);',
        "  }",
        "}",
      ].join("\n"),
    );

    expect(runProblemRegistryCheck(repo, "write").status).toBe("pass");
  }, 30_000);

  it("rejects cause forwarding hidden by overloads, overwritten options, unrelated branches, and mutable aliases", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/alpha/src/problems.ts",
      [
        'import { Problem, ProblemCategory } from "@croco/problems-core";',
        'import type { ProblemOptions } from "@croco/problems-core";',
        "export class OverloadedProblem extends Problem {",
        "  constructor(cause: Error);",
        "  constructor(cause: Error) {",
        '    super("alpha/overloaded", ProblemCategory.InternalServerError, cause.message);',
        "  }",
        "}",
        "export class OverwrittenSpreadProblem extends Problem {",
        "  constructor(cause: Error) {",
        '    super("alpha/overwritten", ProblemCategory.InternalServerError, "failed", { cause, ...{ cause: undefined } });',
        "  }",
        "}",
        "export class FalseConditionalProblem extends Problem {",
        "  constructor(cause: Error) {",
        '    super("alpha/false-branch", ProblemCategory.InternalServerError, "failed", false ? { cause } : undefined);',
        "  }",
        "}",
        "export class UnrelatedConditionalProblem extends Problem {",
        "  constructor(cause: Error, flag: boolean) {",
        '    super("alpha/unrelated-branch", ProblemCategory.InternalServerError, "failed", flag ? { cause } : undefined);',
        "  }",
        "}",
        "export class ReassignedAliasProblem extends Problem {",
        "  constructor(cause: Error) {",
        "    let options: ProblemOptions = { cause };",
        "    options = {};",
        '    super("alpha/reassigned", ProblemCategory.InternalServerError, "failed", options);',
        "  }",
        "}",
        "function toError(_error: unknown): Error { return new Error('unrelated'); }",
        "export class BogusHelperProblem extends Problem {",
        "  constructor(error: unknown) {",
        '    super("alpha/bogus-helper", ProblemCategory.InternalServerError, "failed", { cause: toError(error) });',
        "  }",
        "}",
        "export class ConjunctiveGuardProblem extends Problem {",
        "  constructor(error: unknown, flag: boolean) {",
        '    super("alpha/conjunctive-guard", ProblemCategory.InternalServerError, "failed", flag && error instanceof Error ? { cause: error } : undefined);',
        "  }",
        "}",
        "export class MutatedConstOptionsProblem extends Problem {",
        "  constructor(cause: Error) {",
        "    const options: ProblemOptions = { cause };",
        "    options['cause'] = undefined;",
        '    super("alpha/mutated-const-options", ProblemCategory.InternalServerError, "failed", options);',
        "  }",
        "}",
        "function extras(options: { cause?: Error }) { return options; }",
        "export class HelperSpreadProblem extends Problem {",
        "  constructor(cause: Error) {",
        "    const options = { extensions: {} };",
        '    super("alpha/helper-spread", ProblemCategory.InternalServerError, "failed", { cause, ...extras({ cause: undefined }) });',
        "  }",
        "}",
        "export class DeletedCauseProblem extends Problem {",
        "  constructor(cause: Error) {",
        "    const options: { cause?: Error } = { cause };",
        "    delete options.cause;",
        '    super("alpha/deleted-cause", ProblemCategory.InternalServerError, "failed", options);',
        "  }",
        "}",
        "export class MutatedSecondAliasProblem extends Problem {",
        "  constructor(cause: Error) {",
        "    const options: { cause?: Error } = { cause };",
        "    const alias = options;",
        "    alias.cause = undefined;",
        '    super("alpha/mutated-second-alias", ProblemCategory.InternalServerError, "failed", options);',
        "  }",
        "}",
        "export class MutatedLetAliasProblem extends Problem {",
        "  constructor(cause: Error) {",
        "    const options: { cause?: Error } = { cause };",
        "    let alias = options;",
        "    delete alias.cause;",
        '    super("alpha/mutated-let-alias", ProblemCategory.InternalServerError, "failed", options);',
        "  }",
        "}",
        "export class MutatedBeforeRebindProblem extends Problem {",
        "  constructor(cause: Error) {",
        "    const options: { cause?: Error } = { cause };",
        "    let alias = options;",
        "    delete alias.cause;",
        "    alias = {};",
        '    super("alpha/mutated-before-rebind", ProblemCategory.InternalServerError, "failed", options);',
        "  }",
        "}",
        "export class ConditionalRebindDeleteProblem extends Problem {",
        "  constructor(cause: Error, flag: boolean) {",
        "    const options: { cause?: Error } = { cause };",
        "    let alias = options;",
        "    if (flag) alias = {};",
        "    delete alias.cause;",
        '    super("alpha/conditional-rebind-delete", ProblemCategory.InternalServerError, "failed", options);',
        "  }",
        "}",
        "export class MutatedParenthesizedAliasProblem extends Problem {",
        "  constructor(cause: Error) {",
        "    const options: { cause?: Error } = { cause };",
        "    const alias = (options as { cause?: Error });",
        "    alias.cause = undefined;",
        '    super("alpha/mutated-parenthesized-alias", ProblemCategory.InternalServerError, "failed", options);',
        "  }",
        "}",
        "export class MutatedAssertedTargetProblem extends Problem {",
        "  constructor(cause: Error) {",
        "    const options: { cause?: Error } = { cause };",
        "    (options as { cause?: Error }).cause = undefined;",
        '    super("alpha/mutated-asserted-target", ProblemCategory.InternalServerError, "failed", options);',
        "  }",
        "}",
        "export class DeletedAssertedTargetProblem extends Problem {",
        "  constructor(cause: Error) {",
        "    const options: { cause?: Error } = { cause };",
        "    delete (options as { cause?: Error }).cause;",
        '    super("alpha/deleted-asserted-target", ProblemCategory.InternalServerError, "failed", options);',
        "  }",
        "}",
        "export class MutatedNonNullAliasProblem extends Problem {",
        "  constructor(cause: Error) {",
        "    const options: { cause?: Error } = { cause };",
        "    const alias = options!;",
        "    alias.cause = undefined;",
        '    super("alpha/mutated-non-null-alias", ProblemCategory.InternalServerError, "failed", options);',
        "  }",
        "}",
        "export class LogicalRebindProblem extends Problem {",
        "  constructor(cause: Error) {",
        "    const options: { cause?: Error } = { cause };",
        "    let alias = options;",
        "    alias ??= {};",
        "    delete alias.cause;",
        '    super("alpha/logical-rebind", ProblemCategory.InternalServerError, "failed", options);',
        "  }",
        "}",
        "export class LogicalOrRebindProblem extends Problem {",
        "  constructor(cause: Error) {",
        "    const options: { cause?: Error } = { cause };",
        "    let alias = options;",
        "    alias ||= {};",
        "    delete alias.cause;",
        '    super("alpha/logical-or-rebind", ProblemCategory.InternalServerError, "failed", options);',
        "  }",
        "}",
        "export class ClosureRebindProblem extends Problem {",
        "  constructor(cause: Error) {",
        "    const options: { cause?: Error } = { cause };",
        "    let alias = options;",
        "    const reset = () => { alias = {}; };",
        "    delete alias.cause;",
        '    super("alpha/closure-rebind", ProblemCategory.InternalServerError, "failed", options);',
        "  }",
        "}",
        "export class ComputedCauseProblem extends Problem {",
        "  constructor(cause: Error) {",
        '    super("alpha/computed-cause", ProblemCategory.InternalServerError, "failed", { cause, ["cause"]: undefined });',
        "  }",
        "}",
        "export class ComputedSpreadProblem extends Problem {",
        "  constructor(cause: Error) {",
        '    super("alpha/computed-spread", ProblemCategory.InternalServerError, "failed", { cause, ...{ ["cause"]: undefined } });',
        "  }",
        "}",
        "export class DynamicComputedCauseProblem extends Problem {",
        "  constructor(cause: Error) {",
        '    const key = "cause";',
        '    super("alpha/dynamic-computed-cause", ProblemCategory.InternalServerError, "failed", { cause, [key]: undefined });',
        "  }",
        "}",
        "export class GetterCauseProblem extends Problem {",
        "  constructor(cause: Error) {",
        '    super("alpha/getter-cause", ProblemCategory.InternalServerError, "failed", { ...{ cause }, get cause() { return undefined; } });',
        "  }",
        "}",
        "export class MethodCauseProblem extends Problem {",
        "  constructor(cause: Error) {",
        '    super("alpha/method-cause", ProblemCategory.InternalServerError, "failed", { ...{ cause }, cause() {} });',
        "  }",
        "}",
      ].join("\n"),
    );

    const result = runProblemRegistryCheck(repo, "write");

    expect(result.status).toBe("fail");
    for (const className of [
      "OverloadedProblem",
      "OverwrittenSpreadProblem",
      "FalseConditionalProblem",
      "UnrelatedConditionalProblem",
      "ReassignedAliasProblem",
      "BogusHelperProblem",
      "ConjunctiveGuardProblem",
      "MutatedConstOptionsProblem",
      "HelperSpreadProblem",
      "DeletedCauseProblem",
      "MutatedSecondAliasProblem",
      "MutatedLetAliasProblem",
      "MutatedBeforeRebindProblem",
      "ConditionalRebindDeleteProblem",
      "MutatedParenthesizedAliasProblem",
      "MutatedAssertedTargetProblem",
      "DeletedAssertedTargetProblem",
      "MutatedNonNullAliasProblem",
      "LogicalRebindProblem",
      "LogicalOrRebindProblem",
      "ClosureRebindProblem",
      "ComputedCauseProblem",
      "ComputedSpreadProblem",
      "DynamicComputedCauseProblem",
      "GetterCauseProblem",
      "MethodCauseProblem",
    ]) {
      expect(result.diagnostics).toContainEqual(
        expect.stringContaining(`${className} must forward`),
      );
    }
  }, 30_000);

  it("accepts a cause property that overrides an earlier spread", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/alpha/src/problems.ts",
      [
        'import { Problem, ProblemCategory } from "@croco/problems-core";',
        "export class FinalCauseProblem extends Problem {",
        "  constructor(cause: Error) {",
        '    super("alpha/final-cause", ProblemCategory.InternalServerError, "failed", { ...{ cause: undefined }, cause });',
        "  }",
        "}",
        "export class FinalComputedCauseProblem extends Problem {",
        "  constructor(cause: Error) {",
        '    super("alpha/final-computed-cause", ProblemCategory.InternalServerError, "failed", { ...{ cause: undefined }, ["cause"]: cause });',
        "  }",
        "}",
      ].join("\n"),
    );

    expect(runProblemRegistryCheck(repo, "write").status).toBe("pass");
  }, 30_000);

  it("accepts an owned, reasoned, unexpired cause exception", () => {
    const repo = createTempRepo();
    writeCauseViolation(repo);
    writeCauseAllowlist(repo, [causeAllowlistEntry()]);

    expect(runProblemRegistryCheck(repo, "write").status).toBe("pass");
  }, 30_000);

  it.each(["owner", "reason", "expiresOn"])(
    "rejects a cause exception without %s",
    (field) => {
      const repo = createTempRepo();
      writeCauseViolation(repo);
      const entry = causeAllowlistEntry();
      delete entry[field];
      writeCauseAllowlist(repo, [entry]);

      const result = runProblemRegistryCheck(repo, "write");

      expect(result.status).toBe("fail");
      expect(result.diagnostics).toContainEqual(
        expect.stringContaining("scripts/problem-cause-allowlist.json"),
      );
    },
    30_000,
  );

  it("rejects an expired cause exception", () => {
    const repo = createTempRepo();
    writeCauseViolation(repo);
    writeCauseAllowlist(repo, [causeAllowlistEntry({ expiresOn: "2000-01-01" })]);

    const result = runProblemRegistryCheck(repo, "write");

    expect(result.status).toBe("fail");
    expect(result.diagnostics).toContainEqual(
      expect.stringContaining("scripts/problem-cause-allowlist.json"),
    );
  }, 30_000);

  it("rejects an unused cause exception", () => {
    const repo = createTempRepo();
    writeFile(repo, "packages/alpha/src/problems.ts", "");
    writeCauseAllowlist(repo, [causeAllowlistEntry()]);

    const result = runProblemRegistryCheck(repo, "write");

    expect(result.status).toBe("fail");
    expect(result.diagnostics).toContainEqual(expect.stringContaining("unused exception"));
  }, 30_000);

  it("rejects a cause exception added without increasing the baseline count", () => {
    const repo = createTempRepo();
    writeCauseViolation(repo);
    writeCauseAllowlist(repo, [causeAllowlistEntry()], 0);

    const result = runProblemRegistryCheck(repo, "write");

    expect(result.status).toBe("fail");
    expect(result.diagnostics).toContainEqual(expect.stringContaining("baselineEntryCount"));
  }, 30_000);

  it("discovers Problem codes and writes deterministic registry and cookbook artifacts", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/alpha/src/problems.ts",
      [
        'import { Problem, ProblemCategory, ProblemFactory } from "@croco/problems-core";',
        "export class AlphaNotFoundProblem extends Problem {",
        "  constructor() {",
        '    super("alpha/not-found", ProblemCategory.NotFound, "missing");',
        "  }",
        "}",
        "export function failUpload() {",
        '  throw ProblemFactory.internalServerError("alpha/upload-failed", "failed");',
        "}",
        "export const routeFailure = {",
        '  code: "alpha/invalid-input",',
        "  category: ProblemCategory.ValidationError,",
        "};",
        "",
      ].join("\n"),
    );

    const writeResult = runProblemRegistryCheck(repo, "write");
    const registry = JSON.parse(
      readFileSync(join(repo, "docs/problem-code-registry.json"), "utf-8"),
    );
    const cookbook = readFileSync(
      join(repo, "packages/docs/src/content/docs/en/reference/problem-recovery-cookbook.md"),
      "utf-8",
    );
    const generatedRegistrySource = readFileSync(
      join(repo, "packages/problems-core/src/generated/problem-code-registry.ts"),
      "utf-8",
    );
    const checkResult = runProblemRegistryCheck(repo, "check");

    expect(writeResult).toEqual(
      expect.objectContaining({
        status: "pass",
        discoveryCount: 3,
        problemCount: 3,
      }),
    );
    expect(registry).toMatchObject({
      version: "croco.problem-code-registry.v1",
      problemCount: 3,
      problems: [
        {
          code: "alpha/invalid-input",
          category: "ValidationError",
          status: 422,
          lifecycle: { status: "active" },
        },
        {
          code: "alpha/not-found",
          category: "NotFound",
          status: 404,
          lifecycle: { status: "active" },
        },
        {
          code: "alpha/upload-failed",
          category: "InternalServerError",
          status: 500,
          lifecycle: { status: "active" },
        },
      ],
    });
    expect(cookbook).toContain("Generated by `pnpm problem-registry:write`");
    expect(cookbook).toContain("## `alpha/not-found`");
    expect(cookbook).toContain("User action:");
    expect(cookbook).toContain("generated client union types");
    expect(generatedRegistrySource).toContain("export type CrocoProblemCode");
    expect(generatedRegistrySource).toContain("export type CrocoProblemDetails");
    expect(checkResult.status).toBe("pass");
  });

  it("discovers generated RPC Problems from generator metadata exactly once", () => {
    const repo = createTempRepo();
    const sourcePath = "packages/rpc-codegen/src/libs/generate.ts";
    writeFile(repo, sourcePath, readFileSync(join(process.cwd(), sourcePath), "utf-8"));

    const registry = createProblemCodeRegistry(discoverProblemCodes(repo));
    for (const [code, category, status] of [
      ["rpc-codegen/status-mismatch", "InternalServerError", 500],
      ["rpc-codegen/query-key-input-unsupported", "ValidationError", 422],
      ["rpc-codegen/path-param-input-unsupported", "ValidationError", 422],
    ] as const) {
      expect(registry.problems.find((problem) => problem.code === code)).toMatchObject({
        category,
        status,
        sources: [
          {
            file: sourcePath,
            kind: "problem-metadata",
            line: expect.any(Number),
            column: expect.any(Number),
          },
        ],
      });
    }
  });

  it("publishes profile-selection recovery for SaaS profile mismatches", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/create-croco-app/templates/saas/apps/api-server/src/problems.ts",
      readFileSync(
        join(
          process.cwd(),
          "packages/create-croco-app/templates/saas/apps/api-server/src/problems.ts",
        ),
        "utf-8",
      ),
    );

    const registry = createProblemCodeRegistry(discoverProblemCodes(repo));
    const mismatch = registry.problems.find(({ code }) => code === "CROCO_SAAS_PROFILE_MISMATCH");

    expect(mismatch?.recovery).toEqual({
      cause: "The generated profile and requested profile do not match.",
      userAction: "Select the generated profile or correct the explicit profile override.",
      operatorAction: "Compare the generated manifest with the requested profile override.",
      retryability: "not-retryable",
      redactionPolicy: "public",
      telemetry: {
        eventName: "croco.problem.info",
        severity: "info",
        attributes: ["problem.code", "problem.category", "problem.status"],
      },
    });
  });

  it("requires a configuration correction for invalid batch loader sizes", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/dataloader-core/src/problems.ts",
      [
        'import { Problem, ProblemCategory } from "@croco/problems-core";',
        "export class InvalidBatchLoaderConfigurationProblem extends Problem {",
        "  constructor() {",
        '    super("dataloader-core/invalid-configuration", ProblemCategory.InternalServerError);',
        "  }",
        "}",
      ].join("\n"),
    );

    const registry = createProblemCodeRegistry(discoverProblemCodes(repo));

    expect(registry.problems[0]?.recovery).toMatchObject({
      cause: expect.stringContaining("maxBatchSize"),
      operatorAction: expect.stringContaining("positive safe integer or Infinity"),
      retryability: "not-retryable",
      redactionPolicy: "operator-only",
    });
  });

  it("publishes installation recovery for missing testing resource drivers", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/testing-resources/src/problems.ts",
      [
        'import { Problem, ProblemCategory } from "@croco/problems-core";',
        "export class TestResourceMissingDependencyProblem extends Problem {",
        "  constructor() {",
        '    super("testing-resources/missing-live-dependency", ProblemCategory.InternalServerError);',
        "  }",
        "}",
        "",
      ].join("\n"),
    );

    const registry = createProblemCodeRegistry(discoverProblemCodes(repo));

    expect(registry.problems[0]?.recovery).toMatchObject({
      cause: expect.stringContaining("optional live driver"),
      userAction: expect.stringContaining("extensions.installCommand"),
      operatorAction: expect.stringContaining("extensions.dependency"),
      retryability: "not-retryable",
      redactionPolicy: "public",
      telemetry: { severity: "error" },
    });
  });

  it.each([
    ["analysis-cancelled", "BadRequest", "cancelled"],
    ["analysis-invalid-json", "ValidationError", "model"],
    ["analysis-invalid-plan", "ValidationError", "plan"],
    ["analysis-invalid-usage", "ValidationError", "usage"],
    ["analysis-invalid-completion", "ValidationError", "completion"],
    ["analysis-output-budget-exceeded", "ValidationError", "output"],
  ])("publishes growth analysis recovery for %s", (code, category, cause) => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/analytics-core/src/problems.ts",
      [
        'import { Problem, ProblemCategory } from "@croco/problems-core";',
        "export class AnalysisProblem extends Problem {",
        "  constructor() {",
        `    super("analytics-core/${code}", ProblemCategory.${category});`,
        "  }",
        "}",
      ].join("\n"),
    );
    const registry = createProblemCodeRegistry(discoverProblemCodes(repo));
    expect(registry.problems[0]?.recovery).toMatchObject({
      cause: expect.stringContaining(cause),
      retryability: "conditional",
      redactionPolicy: "public",
      telemetry: { severity: "info" },
    });
    expect(registry.problems[0]?.recovery.operatorAction).toContain("receipt");
  });

  it.each([
    {
      code: "analysis-input-budget-exceeded",
      category: "ValidationError",
      cause: [/serialized|payload/i, /byte/i],
      user: [/shorten|narrow|reduce/i],
      operator: [/maxInputBytes|input.*budget|input.*limit/i, /definition|choice/i],
      retryability: "not-retryable",
      redactionPolicy: "public",
      severity: "info",
    },
    {
      code: "analysis-invalid-facts",
      category: "InternalServerError",
      cause: [/fact|project/i],
      user: [/operator|report/i],
      operator: [/project|facts/i, /numeric|decimal|number/i],
      retryability: "conditional",
      redactionPolicy: "operator-only",
      severity: "error",
    },
    {
      code: "analysis-invalid-limits",
      category: "ValidationError",
      cause: [/limit/i],
      user: [/operator|configuration|configur/i],
      operator: [/positive/i, /safe.integer/i],
      retryability: "not-retryable",
      redactionPolicy: "public",
      severity: "info",
    },
    {
      code: "analysis-invalid-registration",
      category: "ValidationError",
      cause: [/registration|registered/i],
      user: [/operator|registration/i],
      operator: [/duplicate|unique/i, /32|bound|limit/i, /JSON/i],
      retryability: "not-retryable",
      redactionPolicy: "public",
      severity: "info",
    },
    {
      code: "analysis-question-blocked",
      category: "Forbidden",
      cause: [/question|content/i, /policy/i],
      user: [/personal|sensitive|redact|remove/i],
      operator: [/prepareQuestion|content.*policy/i],
      retryability: "not-retryable",
      redactionPolicy: "safe-message",
      severity: "warning",
    },
  ])("publishes boundary-specific growth analysis recovery for $code", (contract) => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/analytics-core/src/problems.ts",
      [
        'import { Problem, ProblemCategory } from "@croco/problems-core";',
        "export class AnalysisProblem extends Problem {",
        "  constructor() {",
        `    super("analytics-core/${contract.code}", ProblemCategory.${contract.category});`,
        "  }",
        "}",
      ].join("\n"),
    );
    const registry = createProblemCodeRegistry(discoverProblemCodes(repo));
    const recovery = registry.problems[0]?.recovery;
    expect(recovery).toMatchObject({
      retryability: contract.retryability,
      redactionPolicy: contract.redactionPolicy,
      telemetry: {
        eventName: `croco.problem.${contract.severity}`,
        severity: contract.severity,
        attributes: ["problem.code", "problem.category", "problem.status"],
      },
    });
    for (const expected of contract.cause) expect(recovery?.cause).toMatch(expected);
    for (const expected of contract.user) expect(recovery?.userAction).toMatch(expected);
    for (const expected of contract.operator) expect(recovery?.operatorAction).toMatch(expected);
  });

  it("recovers growth analysis settlement without repeating inference", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/analytics-core/src/problems.ts",
      [
        'import { Problem, ProblemCategory } from "@croco/problems-core";',
        "export class AnalysisSettlementProblem extends Problem {",
        "  constructor() {",
        '    super("analytics-core/analysis-settlement-failed", ProblemCategory.InternalServerError);',
        "  }",
        "}",
      ].join("\n"),
    );
    const registry = createProblemCodeRegistry(discoverProblemCodes(repo));
    const recovery = registry.problems[0]?.recovery;
    expect(recovery).toMatchObject({
      cause: expect.stringMatching(/usage.*receipt.*settlement/i),
      userAction: expect.stringMatching(/operator/i),
      retryability: "conditional",
      redactionPolicy: "operator-only",
      telemetry: { severity: "error" },
    });
    expect(recovery?.userAction).toMatch(/do not resubmit/i);
    expect(recovery?.operatorAction).toMatch(/AnalysisSettlementProblem\.resume\(\)/);
    expect(recovery?.operatorAction).toMatch(/same invocationId/i);
    expect(recovery?.operatorAction).toMatch(/without repeating inference/i);
    expect(recovery?.operatorAction).toMatch(/process-local/i);
    expect(recovery?.operatorAction).toMatch(/durable.*restart recovery/i);
  });

  it("publishes cancellation-specific recovery for aborted search operations", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/search-core/src/problems.ts",
      [
        'import { Problem, ProblemCategory } from "@croco/problems-core";',
        "export class SearchOperationAbortedProblem extends Problem {",
        "  constructor() {",
        '    super("search-core/operation-aborted", ProblemCategory.BadRequest);',
        "  }",
        "}",
        "",
      ].join("\n"),
    );

    const registry = createProblemCodeRegistry(discoverProblemCodes(repo));

    expect(registry.problems[0]?.recovery).toMatchObject({
      cause: expect.stringContaining("AbortSignal"),
      userAction: expect.stringContaining("new non-aborted AbortSignal"),
      operatorAction: expect.stringContaining("extensions.operation"),
      retryability: "conditional",
    });
  });

  it("publishes non-retryable recovery for canceled Meilisearch tasks", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/search-meilisearch/src/problems.ts",
      [
        'import { Problem, ProblemCategory } from "@croco/problems-core";',
        "export class MeilisearchTaskCanceledProblem extends Problem {",
        "  constructor() {",
        '    super("search-meilisearch/task-canceled", ProblemCategory.InternalServerError);',
        "  }",
        "}",
        "",
      ].join("\n"),
    );

    const registry = createProblemCodeRegistry(discoverProblemCodes(repo));

    expect(registry.problems[0]?.recovery).toMatchObject({
      cause: expect.stringContaining("Meilisearch canceled"),
      userAction: expect.stringContaining("Do not retry automatically"),
      operatorAction: expect.stringContaining("extensions.operation"),
      retryability: "not-retryable",
      redactionPolicy: "operator-only",
      telemetry: { severity: "error" },
    });
  });

  it("invalidates stale checks before validating a concurrent generated-state merge candidate", () => {
    const repo = createTempRepo();
    writeProblemFactories(
      repo,
      "packages/base/src/problems.ts",
      Array.from(
        { length: 640 },
        (_, index) => `middle/problem-number-${String(index).padStart(3, "0")}`,
      ),
    );
    expect(writeProblemRegistryFixtureArtifacts(repo)).toEqual(
      expect.objectContaining({ problemCount: 640 }),
    );
    runGit(repo, "init", "--initial-branch=trunk");
    runGit(repo, "config", "user.email", "fixture@croco.dev");
    runGit(repo, "config", "user.name", "Croco fixture");
    commitAll(repo, "base generated state");
    const originalBaseOid = runGit(repo, "rev-parse", "HEAD");

    runGit(repo, "switch", "--create", "first-problem");
    writeProblemFactories(repo, "packages/first/src/problems.ts", ["a/first"]);
    const firstRegistry = writeProblemRegistryFixtureArtifacts(repo);
    expect(firstRegistry.problemCount).toBe(641);
    expect(firstRegistry.problems).toHaveLength(641);
    expect(runProblemRegistryCheck(repo, "check", { baseRegistry: null })).toEqual(
      expect.objectContaining({ status: "pass", discoveryCount: 641, problemCount: 641 }),
    );
    commitAll(repo, "first generated state");
    const advancedBaseOid = runGit(repo, "rev-parse", "HEAD");

    runGit(repo, "switch", "--create", "second-problem", originalBaseOid);
    writeProblemFactories(repo, "packages/second/src/problems.ts", ["z/second"]);
    const secondRegistry = writeProblemRegistryFixtureArtifacts(repo);
    expect(secondRegistry.problemCount).toBe(641);
    expect(secondRegistry.problems).toHaveLength(641);
    expect(runProblemRegistryCheck(repo, "check", { baseRegistry: null })).toEqual(
      expect.objectContaining({ status: "pass", discoveryCount: 641, problemCount: 641 }),
    );
    commitAll(repo, "second generated state");
    const secondHeadOid = runGit(repo, "rev-parse", "HEAD");

    runGit(repo, "switch", "trunk");
    runGit(repo, "merge", "--ff-only", "first-problem");
    expect(runGit(repo, "rev-parse", "HEAD")).toBe(advancedBaseOid);
    expect(originalBaseOid).not.toBe(advancedBaseOid);
    expect(
      findBranchProtectionPolicyViolations({
        branch: "trunk",
        classicProtection: null,
        defaultBranch: "trunk",
        effectiveRules: (
          readExpectedBranchProtectionPolicy().rules as readonly Record<string, unknown>[]
        ).map((rule) => ({ ...structuredClone(rule), ruleset_id: 21_250_891 })),
        rulesets: [
          {
            ...structuredClone(readExpectedBranchProtectionPolicy()),
            id: 21_250_891,
            source_type: "Repository",
          },
        ],
      }),
    ).toEqual([]);

    const merge = spawnSync("git", ["merge", "--no-commit", "--no-ff", secondHeadOid], {
      cwd: repo,
      encoding: "utf-8",
    });
    expect({ status: merge.status, stderr: merge.stderr, stdout: merge.stdout }).toEqual(
      expect.objectContaining({ status: 0 }),
    );
    expect(readRegistry(repo)).toEqual(
      expect.objectContaining({
        problemCount: 641,
        problems: expect.arrayContaining([
          expect.objectContaining({ code: "a/first" }),
          expect.objectContaining({ code: "z/second" }),
        ]),
      }),
    );
    expect(readRegistry(repo).problems).toHaveLength(642);

    const statusBeforeCheck = runGit(repo, "status", "--porcelain=v1");
    const candidateResult = runProblemRegistryCheck(repo, "check", { baseRegistry: null });
    expect(candidateResult).toEqual(
      expect.objectContaining({ status: "fail", discoveryCount: 642, problemCount: 642 }),
    );
    expect(candidateResult.diagnostics).toEqual([
      "docs/problem-code-registry.json drift detected; run pnpm problem-registry:write.",
      "packages/docs/src/content/docs/en/reference/problem-recovery-cookbook.md drift detected; run pnpm problem-registry:write.",
      "packages/problems-core/src/generated/problem-code-registry.ts drift detected; run pnpm problem-registry:write.",
    ]);
    expect(runGit(repo, "status", "--porcelain=v1")).toBe(statusBeforeCheck);
  }, 60_000);

  it("keeps queued candidates on their exact Problem registry base after trunk advances", () => {
    const repo = createTempRepo();
    writeProblemFactories(repo, "packages/base/src/problems.ts", ["base/original"]);
    writeProblemRegistryFixtureArtifacts(repo);
    runGit(repo, "init", "--initial-branch=trunk");
    runGit(repo, "config", "user.email", "fixture@croco.dev");
    runGit(repo, "config", "user.name", "Croco fixture");
    commitAll(repo, "old base");
    const oldBaseOid = runGit(repo, "rev-parse", "HEAD");

    runGit(repo, "switch", "--create", "old-candidate");
    writeProblemFactories(repo, "packages/candidate/src/problems.ts", ["candidate/existing"]);
    writeProblemRegistryFixtureArtifacts(repo);
    commitAll(repo, "old candidate");
    const oldCandidateOid = runGit(repo, "rev-parse", "HEAD");

    runGit(repo, "switch", "trunk");
    writeProblemFactories(repo, "packages/new-base/src/problems.ts", ["base/new"]);
    writeProblemRegistryFixtureArtifacts(repo);
    commitAll(repo, "advance trunk");
    const newBaseOid = runGit(repo, "rev-parse", "HEAD");

    runGit(repo, "switch", "--detach", oldCandidateOid);
    expect(runProblemRegistryCheck(repo, "check", { baseRef: oldBaseOid })).toEqual(
      expect.objectContaining({ status: "pass", discoveryCount: 2, problemCount: 2 }),
    );
    expect(runProblemRegistryCheck(repo, "check", { baseRef: "trunk" })).toEqual(
      expect.objectContaining({
        status: "fail",
        diagnostics: expect.arrayContaining([
          expect.stringContaining(
            "Problem code 'base/new' is registered but has no corresponding implementation",
          ),
        ]),
      }),
    );

    runGit(repo, "switch", "--create", "current-candidate", newBaseOid);
    writeProblemFactories(repo, "packages/candidate/src/problems.ts", ["candidate/existing"]);
    writeProblemRegistryFixtureArtifacts(repo);
    expect(runProblemRegistryCheck(repo, "check", { baseRef: newBaseOid })).toEqual(
      expect.objectContaining({ status: "pass", discoveryCount: 3, problemCount: 3 }),
    );

    rmSync(join(repo, "packages/new-base"), { force: true, recursive: true });
    writeProblemRegistryFixtureArtifacts(repo);
    const removal = runProblemRegistryCheck(repo, "check", { baseRef: newBaseOid });
    expect(removal.status).toBe("fail");
    expect(removal.diagnostics).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          "Problem code 'base/new' is registered but has no corresponding implementation",
        ),
      ]),
    );
  }, 30_000);

  it("publishes runtime-configurable status policy in generated contracts", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/transports-http/src/problems.ts",
      [
        'import { Problem, ProblemCategory } from "@croco/problems-core";',
        "export class HttpRequestBodyTooLargeProblem extends Problem {",
        "  constructor() {",
        '    super("transports-http/request-body-too-large", ProblemCategory.PayloadTooLarge);',
        "  }",
        "}",
        "",
      ].join("\n"),
    );

    expect(runProblemRegistryCheck(repo, "write").status).toBe("pass");

    const registry = JSON.parse(
      readFileSync(join(repo, "docs/problem-code-registry.json"), "utf-8"),
    );
    const cookbook = readFileSync(
      join(repo, "packages/docs/src/content/docs/en/reference/problem-recovery-cookbook.md"),
      "utf-8",
    );
    const generatedRegistrySource = readFileSync(
      join(repo, "packages/problems-core/src/generated/problem-code-registry.ts"),
      "utf-8",
    );

    expect(registry.problems[0]).toMatchObject({
      code: "transports-http/request-body-too-large",
      status: 413,
      statusPolicy: {
        kind: "runtime-configurable",
        defaultStatus: 413,
        configuration: "bodyLimitMiddleware.statusCode",
      },
    });
    expect(cookbook).toContain("413\\*");
    expect(cookbook).toContain("Runtime-configurable statuses show their canonical default");
    expect(cookbook).toContain("runtime-configurable via `bodyLimitMiddleware.statusCode`");
    expect(generatedRegistrySource).toContain("CrocoProblemEntryStatus");
    expect(generatedRegistrySource).toContain("? number");
    expect(generatedRegistrySource).toContain(': Extract<Entry["status"], number>');
  });

  it("publishes deterministic recovery metadata for graceful shutdown configuration", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/transports-http/src/problems.ts",
      [
        'import { Problem, ProblemCategory } from "@croco/problems-core";',
        "export class GracefulShutdownConfigurationProblem extends Problem {",
        "  constructor() {",
        '    super("transports-http/graceful-shutdown-configuration", ProblemCategory.InternalServerError);',
        "  }",
        "}",
        "export class HttpRequestBodyTooLargeProblem extends Problem {",
        "  constructor() {",
        '    super("transports-http/request-body-too-large", ProblemCategory.PayloadTooLarge);',
        "  }",
        "}",
        "",
      ].join("\n"),
    );

    expect(runProblemRegistryCheck(repo, "write").status).toBe("pass");
    const registry = readRegistry(repo);
    const problem = registry.problems.find(
      ({ code }) => code === "transports-http/graceful-shutdown-configuration",
    );

    expect(problem?.recovery).toEqual({
      cause: "Graceful shutdown was configured with a non-finite total or event-bus drain timeout.",
      userAction:
        "Ask the operator to correct the graceful shutdown timeout configuration before reconstructing the HTTP application.",
      operatorAction:
        "Set timeoutMs and eventBusDrainTimeoutMs to finite numbers, then reconstruct the middleware or controller before retrying shutdown.",
      retryability: "not-retryable",
      redactionPolicy: "operator-only",
      telemetry: {
        eventName: "croco.problem.error",
        severity: "error",
        attributes: ["problem.code", "problem.category", "problem.status"],
      },
    });
    expect(problem?.recovery.telemetry.attributes).not.toContain("receivedValue");
  });

  it("publishes non-retryable recovery metadata for failed AI usage ingestion", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/ai-usage/src/problems.ts",
      [
        'import { Problem, ProblemCategory } from "@croco/problems-core";',
        "export class AiUsageRecordFailedProblem extends Problem {",
        "  constructor() {",
        '    super("ai-usage/record-failed", ProblemCategory.InternalServerError);',
        "  }",
        "}",
        "",
      ].join("\n"),
    );

    expect(runProblemRegistryCheck(repo, "write").status).toBe("pass");
    const registry = readRegistry(repo);
    const problem = registry.problems.find(({ code }) => code === "ai-usage/record-failed");

    expect(problem?.recovery).toEqual({
      cause:
        "The provider completed billable work, but the application could not record its usage in the metering ledger.",
      userAction:
        "Hand the opaque failure reference to an operator; do not invoke the provider again for the same request.",
      operatorAction:
        "Recover the metering dependency, then replay the preserved usage receipt with the same idempotency key without repeating the provider call.",
      retryability: "not-retryable",
      redactionPolicy: "operator-only",
      telemetry: {
        eventName: "croco.problem.error",
        severity: "error",
        attributes: ["problem.code", "problem.category", "problem.status"],
      },
    });
  });

  it("requires provider evidence to reconcile unknown contact policy acceptance", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/engagement-core/src/problems.ts",
      [
        'import { Problem, ProblemCategory } from "@croco/problems-core";',
        "export class ContactPolicyAcceptanceUnknownProblem extends Problem {",
        "  constructor() {",
        '    super("engagement-core/contact-policy-acceptance-unknown", ProblemCategory.InternalServerError);',
        "  }",
        "}",
        "",
      ].join("\n"),
    );

    expect(runProblemRegistryCheck(repo, "write").status).toBe("pass");
    const problem = readRegistry(repo).problems.find(
      ({ code }) => code === "engagement-core/contact-policy-acceptance-unknown",
    );

    expect(problem?.recovery).toEqual({
      cause: "Provider acceptance could not be durably confirmed for a contact policy reservation.",
      userAction:
        "Do not automatically resend the message or refund the contact budget; request operator reconciliation.",
      operatorAction:
        "Verify provider evidence, then call ContactPolicy.reconcile with the evidence reference, actor, and reason. Record accepted execution IDs or release the reservation only when evidence confirms non-acceptance; expiry alone must not refund the budget.",
      retryability: "not-retryable",
      redactionPolicy: "operator-only",
      telemetry: {
        eventName: "croco.problem.error",
        severity: "error",
        attributes: ["problem.code", "problem.category", "problem.status"],
      },
    });
  });

  it("publishes non-retryable recovery metadata for invalid auth route targets", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/auth-core/src/problems.ts",
      [
        'import { Problem, ProblemCategory } from "@croco/problems-core";',
        "export class InvalidRouteMetadataTargetProblem extends Problem {",
        "  constructor() {",
        '    super("auth-core/invalid-route-metadata-target", ProblemCategory.InternalServerError);',
        "  }",
        "}",
        "",
      ].join("\n"),
    );

    expect(runProblemRegistryCheck(repo, "write").status).toBe("pass");
    const registry = readRegistry(repo);
    const problem = registry.problems.find(
      ({ code }) => code === "auth-core/invalid-route-metadata-target",
    );

    expect(problem?.recovery).toEqual({
      cause:
        "An authentication guard received a route metadata target that was neither an object nor a function.",
      userAction:
        "Do not retry the unchanged request; ask the service operator to correct the route metadata configuration.",
      operatorAction:
        "Inspect the route adapter metadata target and ensure it returns the controller object or constructor before handling requests.",
      retryability: "not-retryable",
      redactionPolicy: "operator-only",
      telemetry: {
        eventName: "croco.problem.error",
        severity: "error",
        attributes: ["problem.code", "problem.category", "problem.status"],
      },
    });
  });

  it("does not recommend resending notifications with invalid persisted delivery evidence", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/notifications-core/src/problems.ts",
      [
        'import { Problem, ProblemCategory } from "@croco/problems-core";',
        "export class NotificationTaskResultInvalidProblem extends Problem {",
        "  constructor() {",
        '    super("notifications-core/task-result-invalid", ProblemCategory.InternalServerError);',
        "  }",
        "}",
        "",
      ].join("\n"),
    );

    expect(runProblemRegistryCheck(repo, "write").status).toBe("pass");
    const problem = readRegistry(repo).problems.find(
      ({ code }) => code === "notifications-core/task-result-invalid",
    );

    expect(problem?.recovery).toMatchObject({
      retryability: "not-retryable",
      redactionPolicy: "operator-only",
      userAction:
        "Do not retry the unchanged delivery or resend automatically; report the execution ID to the service operator.",
      operatorAction:
        "Inspect and reconcile the persisted task result against the original provider delivery before repairing the record.",
    });
  });

  it("publishes non-retryable recovery metadata for React Email rendering failures", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/notifications-react-email/src/problems.ts",
      [
        'import { Problem, ProblemCategory } from "@croco/problems-core";',
        "export class ReactEmailRenderProblem extends Problem {",
        "  constructor() {",
        '    super("notifications-react-email/render-failed", ProblemCategory.InternalServerError);',
        "  }",
        "}",
        "",
      ].join("\n"),
    );

    expect(runProblemRegistryCheck(repo, "write").status).toBe("pass");
    const registry = readRegistry(repo);
    const problem = registry.problems.find(
      ({ code }) => code === "notifications-react-email/render-failed",
    );

    expect(problem?.recovery).toEqual({
      cause:
        "A React Email component failed while producing deterministic HTML or plain text output.",
      userAction:
        "Do not retry unchanged message data; report the unavailable message so its email component can be corrected.",
      operatorAction:
        "Inspect the component implementation with redacted fixture data, correct the render failure, and redeploy before retrying.",
      retryability: "not-retryable",
      redactionPolicy: "operator-only",
      telemetry: {
        eventName: "croco.problem.error",
        severity: "error",
        attributes: ["problem.code", "problem.category", "problem.status"],
      },
    });
  });

  it("publishes deterministic recovery metadata for graceful shutdown timeout", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/transports-http/src/problems.ts",
      [
        'import { Problem, ProblemCategory } from "@croco/problems-core";',
        "export class GracefulShutdownTimeoutProblem extends Problem {",
        "  constructor() {",
        '    super("transports-http/graceful-shutdown-timeout", ProblemCategory.InternalServerError);',
        "  }",
        "}",
        "export class HttpRequestBodyTooLargeProblem extends Problem {",
        "  constructor() {",
        '    super("transports-http/request-body-too-large", ProblemCategory.PayloadTooLarge);',
        "  }",
        "}",
        "",
      ].join("\n"),
    );

    expect(runProblemRegistryCheck(repo, "write").status).toBe("pass");
    const registry = readRegistry(repo);
    const problem = registry.problems.find(
      ({ code }) => code === "transports-http/graceful-shutdown-timeout",
    );

    expect(problem?.recovery).toEqual({
      cause:
        "Graceful shutdown did not finish a phase before that phase's configured deadline elapsed.",
      userAction:
        "Wait for the stalled shutdown phase to be investigated before retrying; active requests or cleanup work may still be settling.",
      operatorAction:
        "Inspect the reported phase, timeoutMs, and elapsedMs extensions, then investigate slow request handlers, event-bus draining, or shutdown hooks.",
      retryability: "conditional",
      redactionPolicy: "operator-only",
      telemetry: {
        eventName: "croco.problem.error",
        severity: "error",
        attributes: ["problem.code", "problem.category", "problem.status"],
      },
    });
    expect(problem?.recovery.telemetry.attributes).not.toContain("receivedValue");
  });

  it("fails when a configured status policy no longer resolves to a discovered code", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/transports-http/src/problems.ts",
      [
        'import { Problem, ProblemCategory } from "@croco/problems-core";',
        "export class RenamedBodyTooLargeProblem extends Problem {",
        "  constructor() {",
        '    super("transports-http/renamed-body-too-large", ProblemCategory.PayloadTooLarge);',
        "  }",
        "}",
        "",
      ].join("\n"),
    );

    expect(runProblemRegistryCheck(repo, "write")).toEqual(
      expect.objectContaining({
        status: "fail",
        diagnostics: [
          "Status policy references unknown Problem code 'transports-http/request-body-too-large'.",
        ],
      }),
    );
  });

  it("fails check mode when generated artifacts are missing", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/alpha/src/problems.ts",
      [
        'import { Problem, ProblemCategory } from "@croco/problems-core";',
        "export class AlphaNotFoundProblem extends Problem {",
        "  constructor() {",
        '    super("alpha/not-found", ProblemCategory.NotFound, "missing");',
        "  }",
        "}",
        "",
      ].join("\n"),
    );

    const result = runProblemRegistryCheck(repo, "check");

    expect(result.status).toBe("fail");
    expect(result.diagnostics).toEqual([
      "docs/problem-code-registry.json is missing; run pnpm problem-registry:write.",
      "packages/docs/src/content/docs/en/reference/problem-recovery-cookbook.md is missing; run pnpm problem-registry:write.",
      "packages/problems-core/src/generated/problem-code-registry.ts is missing; run pnpm problem-registry:write.",
    ]);
  });

  it("fails when a duplicate Problem code drifts across categories", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/alpha/src/problems.ts",
      [
        'import { Problem, ProblemCategory } from "@croco/problems-core";',
        "export class AlphaNotFoundProblem extends Problem {",
        "  constructor() {",
        '    super("shared/problem", ProblemCategory.NotFound, "missing");',
        "  }",
        "}",
        "export const routeFailure = {",
        '  code: "shared/problem",',
        "  category: ProblemCategory.InternalServerError,",
        "};",
        "",
      ].join("\n"),
    );

    const result = runProblemRegistryCheck(repo, "check");

    expect(result.status).toBe("fail");
    expect(result.diagnostics).toEqual([
      "Problem code 'shared/problem' has multiple categories: InternalServerError, NotFound.",
    ]);
  });

  it("fails when a duplicate Problem code uses the same category", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/alpha/src/problems.ts",
      [
        'import { Problem, ProblemCategory } from "@croco/problems-core";',
        "export class AlphaNotFoundProblem extends Problem {",
        "  constructor() {",
        '    super("shared/problem", ProblemCategory.NotFound, "missing");',
        "  }",
        "}",
        "export class AlphaAlsoNotFoundProblem extends Problem {",
        "  constructor() {",
        '    super("shared/problem", ProblemCategory.NotFound, "missing again");',
        "  }",
        "}",
        "",
      ].join("\n"),
    );

    const result = runProblemRegistryCheck(repo, "check");

    expect(result.status).toBe("fail");
    expect(result.diagnostics).toEqual([
      "Problem code 'shared/problem' is declared 2 times: packages/alpha/src/problems.ts:4:5, packages/alpha/src/problems.ts:9:5.",
    ]);
  });

  it("ignores defineRouteProblem metadata projections of Problem classes", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/alpha/src/problems.ts",
      [
        'import { Problem, ProblemCategory } from "@croco/problems-core";',
        "export class AlphaNotFoundProblem extends Problem {",
        '  readonly code = "alpha/not-found";',
        "  readonly category = ProblemCategory.NotFound;",
        "  constructor() {",
        '    super(undefined, undefined, "missing");',
        "  }",
        "}",
        "",
      ].join("\n"),
    );
    writeFile(
      repo,
      "packages/alpha/src/routes.ts",
      [
        'import { ProblemCategory } from "@croco/problems-core";',
        'import { defineRouteProblem } from "@croco/protocols-rest";',
        'import { AlphaNotFoundProblem } from "./problems";',
        "export const alphaNotFoundRouteProblem = defineRouteProblem(AlphaNotFoundProblem, {",
        '  code: "alpha/not-found",',
        "  category: ProblemCategory.NotFound,",
        '  description: "The requested alpha resource does not exist.",',
        "});",
        "",
      ].join("\n"),
    );

    expect(discoverProblemCodes(repo)).toEqual([
      expect.objectContaining({
        code: "alpha/not-found",
        sources: [
          expect.objectContaining({
            column: 1,
            file: "packages/alpha/src/problems.ts",
            kind: "problem-class",
            line: 2,
          }),
        ],
      }),
    ]);
  });

  it("keeps defineRouteProblem metadata when no implementation source is visible", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/alpha/src/routes.ts",
      [
        'import { ProblemCategory } from "@croco/problems-core";',
        'import { defineRouteProblem } from "@croco/protocols-rest";',
        "declare class GeneratedAlphaNotFoundProblem {}",
        "export const alphaNotFoundRouteProblem = defineRouteProblem(GeneratedAlphaNotFoundProblem, {",
        '  code: "alpha/generated-not-found",',
        "  category: ProblemCategory.NotFound,",
        '  description: "The generated alpha resource does not exist.",',
        "});",
        "",
      ].join("\n"),
    );

    expect(discoverProblemCodes(repo)).toEqual([
      expect.objectContaining({
        code: "alpha/generated-not-found",
        sources: [
          expect.objectContaining({
            file: "packages/alpha/src/routes.ts",
            kind: "problem-metadata",
          }),
        ],
      }),
    ]);
  });

  it("discovers class-field, static-code, and local constant Problem codes", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/alpha/src/problems.ts",
      [
        'import { Problem, ProblemCategory } from "@croco/problems-core";',
        'export const ALPHA_CODES = { policy: "alpha/policy" } as const;',
        "export abstract class AlphaProblem extends Problem {}",
        "export class DirectClassFieldProblem extends Problem {",
        '  readonly code = "alpha/class-field";',
        "  readonly category = ProblemCategory.BadRequest;",
        "  constructor() {",
        '    super(undefined, undefined, "class field");',
        "  }",
        "}",
        "export class IndirectClassFieldProblem extends AlphaProblem {",
        "  readonly code = ALPHA_CODES.policy;",
        "  readonly category = ProblemCategory.Forbidden;",
        "  constructor() {",
        '    super(undefined, undefined, "policy");',
        "  }",
        "}",
        "export class StaticCodeProblem extends Problem {",
        '  static readonly CODE = "alpha/static-code";',
        "  constructor() {",
        '    super(StaticCodeProblem.CODE, ProblemCategory.InternalServerError, "static");',
        "  }",
        "}",
        "export class DefaultCodeProblem extends Problem {",
        '  constructor(code = "alpha/default-code") {',
        '    super(code, ProblemCategory.Conflict, "default");',
        "  }",
        "}",
        "",
      ].join("\n"),
    );

    expect(discoverProblemCodes(repo).map((discovery) => discovery.code)).toEqual([
      "alpha/class-field",
      "alpha/default-code",
      "alpha/policy",
      "alpha/static-code",
    ]);
  });

  it("discovers relative imported constant Problem codes", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/alpha/src/codes.ts",
      [
        "export const PROBLEM_CODES = {",
        '  direct: "alpha/imported-direct",',
        '  aliased: "alpha/imported-aliased",',
        '  metadata: "alpha/imported-metadata",',
        "} as const;",
        "",
      ].join("\n"),
    );
    writeFile(
      repo,
      "packages/alpha/src/problems.ts",
      [
        'import { Problem, ProblemCategory } from "@croco/problems-core";',
        'import { PROBLEM_CODES as CODES } from "./codes.js";',
        "export class ImportedDirectProblem extends Problem {",
        "  constructor() {",
        '    super(CODES.direct, ProblemCategory.BadRequest, "direct");',
        "  }",
        "}",
        "export class ImportedAliasedProblem extends Problem {",
        "  readonly code = CODES.aliased;",
        "  readonly category = ProblemCategory.Forbidden;",
        "  constructor() {",
        '    super(undefined, undefined, "aliased");',
        "  }",
        "}",
        "export const importedMetadata = {",
        "  code: CODES.metadata,",
        "  category: ProblemCategory.Conflict,",
        "} as const;",
        "",
      ].join("\n"),
    );

    expect(discoverProblemCodes(repo).map((discovery) => discovery.code)).toEqual([
      "alpha/imported-aliased",
      "alpha/imported-direct",
      "alpha/imported-metadata",
    ]);
  });

  it("discovers enum-backed Problem wrapper factory codes", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/execution/src/problems.ts",
      [
        'import { Problem, ProblemCategory } from "@croco/problems-core";',
        "export enum ExecutionProblemCode {",
        '  NOT_FOUND = "execution/not-found",',
        '  CONFLICT = "execution/conflict",',
        '  MAX_RETRIES_EXCEEDED = "execution/max-retries-exceeded",',
        '  INVALID_STATE_TRANSITION = "execution/invalid-state-transition",',
        "}",
        "export class ExecutionProblem extends Problem {",
        "  constructor(code: ExecutionProblemCode, category: ProblemCategory, detail?: string) {",
        "    super(code, category, detail);",
        "  }",
        "}",
        "export class ExecutionProblems {",
        "  static notFound(detail: string): ExecutionProblem {",
        "    return new ExecutionProblem(ExecutionProblemCode.NOT_FOUND, ProblemCategory.NotFound, detail);",
        "  }",
        "  static conflict(detail: string): ExecutionProblem {",
        "    return new ExecutionProblem(ExecutionProblemCode.CONFLICT, ProblemCategory.Conflict, detail);",
        "  }",
        "  static maxRetriesExceeded(detail: string): ExecutionProblem {",
        "    return new ExecutionProblem(ExecutionProblemCode.MAX_RETRIES_EXCEEDED, ProblemCategory.Conflict, detail);",
        "  }",
        "  static invalidStateTransition(detail: string): ExecutionProblem {",
        "    return new ExecutionProblem(ExecutionProblemCode.INVALID_STATE_TRANSITION, ProblemCategory.Conflict, detail);",
        "  }",
        "}",
        "",
      ].join("\n"),
    );

    expect(discoverProblemCodes(repo).map((discovery) => discovery.code)).toEqual([
      "execution/conflict",
      "execution/invalid-state-transition",
      "execution/max-retries-exceeded",
      "execution/not-found",
    ]);
  });

  it("ignores tests while discovering public package source codes", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/alpha/src/problems.ts",
      [
        'import { Problem, ProblemCategory } from "@croco/problems-core";',
        "export class AlphaNotFoundProblem extends Problem {",
        "  constructor() {",
        '    super("alpha/not-found", ProblemCategory.NotFound, "missing");',
        "  }",
        "}",
        "",
      ].join("\n"),
    );
    writeFile(
      repo,
      "packages/alpha/src/tests/problems.spec.ts",
      [
        'import { ProblemFactory } from "@croco/problems-core";',
        'ProblemFactory.badRequest("fixture/test-only");',
        "",
      ].join("\n"),
    );
    writeFile(
      repo,
      "packages/alpha/src/problems.mts",
      [
        'import { Problem, ProblemCategory } from "@croco/problems-core";',
        "export class AlphaConflictProblem extends Problem {",
        "  constructor() {",
        '    super("alpha/conflict", ProblemCategory.Conflict, "conflict");',
        "  }",
        "}",
        "",
      ].join("\n"),
    );
    writeFile(
      repo,
      "packages/alpha/src/tests/problems.spec.mts",
      [
        'import { ProblemFactory } from "@croco/problems-core";',
        'ProblemFactory.badRequest("fixture/mts-test-only");',
        "",
      ].join("\n"),
    );

    expect(discoverProblemCodes(repo).map((discovery) => discovery.code)).toEqual([
      "alpha/conflict",
      "alpha/not-found",
    ]);
  });

  it("fails when an active registry entry no longer has an implementation", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/alpha/src/problems.ts",
      [
        'import { Problem, ProblemCategory } from "@croco/problems-core";',
        "export class AlphaRemovedProblem extends Problem {",
        "  constructor() {",
        '    super("alpha/removed", ProblemCategory.NotFound, "removed");',
        "  }",
        "}",
        "",
      ].join("\n"),
    );
    expect(runProblemRegistryCheck(repo, "write").status).toBe("pass");

    writeFile(repo, "packages/alpha/src/problems.ts", "");

    const result = runProblemRegistryCheck(repo, "check");

    expect(result.status).toBe("fail");
    expect(result.diagnostics).toEqual([
      "Problem code 'alpha/removed' is registered but has no corresponding implementation; mark it deprecated with migration metadata before removing the source.",
    ]);
  });

  it("preserves explicitly deprecated registry entries after their implementation is removed", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/alpha/src/problems.ts",
      [
        'import { Problem, ProblemCategory } from "@croco/problems-core";',
        "export class AlphaKeptProblem extends Problem {",
        "  constructor() {",
        '    super("alpha/kept", ProblemCategory.NotFound, "kept");',
        "  }",
        "}",
        "export class AlphaRemovedProblem extends Problem {",
        "  constructor() {",
        '    super("alpha/removed", ProblemCategory.NotFound, "removed");',
        "  }",
        "}",
        "",
      ].join("\n"),
    );
    expect(runProblemRegistryCheck(repo, "write").status).toBe("pass");

    writeFile(
      repo,
      "packages/alpha/src/problems.ts",
      [
        'import { Problem, ProblemCategory } from "@croco/problems-core";',
        "export class AlphaKeptProblem extends Problem {",
        "  constructor() {",
        '    super("alpha/kept", ProblemCategory.NotFound, "kept");',
        "  }",
        "}",
        "",
      ].join("\n"),
    );
    const registry = readRegistry(repo);
    writeRegistry(repo, {
      ...registry,
      problems: registry.problems.map((problem) =>
        problem.code === "alpha/removed"
          ? {
              ...problem,
              lifecycle: {
                status: "deprecated",
                deprecation: {
                  reason: "The code was replaced by alpha/kept.",
                  migrationNote: "Branch clients on alpha/kept before removing alpha/removed.",
                  replacementCode: "alpha/kept",
                },
              },
              sources: [],
            }
          : problem,
      ),
    });

    const writeResult = runProblemRegistryCheck(repo, "write");
    const checkResult = runProblemRegistryCheck(repo, "check");
    const updatedRegistry = readRegistry(repo);

    expect(writeResult.status).toBe("pass");
    expect(checkResult.status).toBe("pass");
    expect(
      updatedRegistry.problems.find((problem) => problem.code === "alpha/removed"),
    ).toMatchObject({
      lifecycle: { status: "deprecated" },
      sources: [],
    });
  });

  it("preserves deprecated registry entries without replacements when a no-replacement reason is present", () => {
    const repo = setupDeprecatedAlphaRemovedRegistry({
      reason: "The upstream capability was removed.",
      migrationNote: "Stop branching on alpha/removed in generated clients.",
      noReplacementReason: "The retired capability has no supported equivalent.",
    });

    const writeResult = runProblemRegistryCheck(repo, "write");
    const cookbook = readFileSync(
      join(repo, "packages/docs/src/content/docs/en/reference/problem-recovery-cookbook.md"),
      "utf-8",
    );

    expect(writeResult.status).toBe("pass");
    expect(runProblemRegistryCheck(repo, "check").status).toBe("pass");
    expect(cookbook).toContain(
      "- No replacement reason: The retired capability has no supported equivalent.",
    );
  });

  it("rejects deprecated lifecycle metadata without replacement guidance", () => {
    const repo = setupDeprecatedAlphaRemovedRegistry({
      reason: "The code was retired.",
      migrationNote: "Stop branching on alpha/removed.",
    });

    const result = runProblemRegistryCheck(repo, "check");

    expect(result.status).toBe("fail");
    expect(result.diagnostics).toEqual([
      "Deprecated Problem code 'alpha/removed' must declare replacementCode or noReplacementReason.",
    ]);
  });

  it("rejects deprecated replacement codes that are self-references, unknown, or deprecated", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/alpha/src/problems.ts",
      [
        'import { Problem, ProblemCategory } from "@croco/problems-core";',
        'export class AlphaSelfProblem extends Problem { constructor() { super("alpha/self", ProblemCategory.Gone, "self"); } }',
        'export class AlphaUnknownProblem extends Problem { constructor() { super("alpha/unknown", ProblemCategory.Gone, "unknown"); } }',
        'export class AlphaOldTargetProblem extends Problem { constructor() { super("alpha/old-target", ProblemCategory.Gone, "old"); } }',
        'export class AlphaDeprecatedTargetProblem extends Problem { constructor() { super("alpha/deprecated-target", ProblemCategory.Gone, "target"); } }',
        "",
      ].join("\n"),
    );
    expect(runProblemRegistryCheck(repo, "write").status).toBe("pass");

    const registry = readRegistry(repo);
    writeRegistry(repo, {
      ...registry,
      problems: registry.problems.map((problem) => {
        const deprecation = {
          reason: "The code was retired.",
          migrationNote: "Follow the replacement guidance before removing branches.",
        };

        if (problem.code === "alpha/self") {
          return {
            ...problem,
            lifecycle: {
              status: "deprecated",
              deprecation: { ...deprecation, replacementCode: "alpha/self" },
            },
          };
        }

        if (problem.code === "alpha/unknown") {
          return {
            ...problem,
            lifecycle: {
              status: "deprecated",
              deprecation: { ...deprecation, replacementCode: "alpha/missing" },
            },
          };
        }

        if (problem.code === "alpha/old-target") {
          return {
            ...problem,
            lifecycle: {
              status: "deprecated",
              deprecation: { ...deprecation, replacementCode: "alpha/deprecated-target" },
            },
          };
        }

        if (problem.code === "alpha/deprecated-target") {
          return {
            ...problem,
            lifecycle: {
              status: "deprecated",
              deprecation: {
                ...deprecation,
                noReplacementReason: "The deprecated target has no active equivalent.",
              },
            },
          };
        }

        return problem;
      }),
    });

    const result = runProblemRegistryCheck(repo, "check");

    expect(result.status).toBe("fail");
    expect(result.diagnostics).toEqual([
      "Deprecated Problem code 'alpha/old-target' replacementCode 'alpha/deprecated-target' points to a deprecated Problem code.",
      "Deprecated Problem code 'alpha/self' replacementCode must reference a different Problem code.",
      "Deprecated Problem code 'alpha/unknown' replacementCode 'alpha/missing' is not registered.",
    ]);
  });

  it("requires changeset or migration evidence for category, status, or retryability changes", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/alpha/src/problems.ts",
      [
        'import { Problem, ProblemCategory } from "@croco/problems-core";',
        "export class AlphaChangedProblem extends Problem {",
        "  constructor() {",
        '    super("alpha/changed", ProblemCategory.NotFound, "changed");',
        "  }",
        "}",
        "",
      ].join("\n"),
    );
    expect(runProblemRegistryCheck(repo, "write").status).toBe("pass");

    writeFile(
      repo,
      "packages/alpha/src/problems.ts",
      [
        'import { Problem, ProblemCategory } from "@croco/problems-core";',
        "export class AlphaChangedProblem extends Problem {",
        "  constructor() {",
        '    super("alpha/changed", ProblemCategory.Conflict, "changed");',
        "  }",
        "}",
        "",
      ].join("\n"),
    );

    const blockedResult = runProblemRegistryCheck(repo, "write");
    expect(blockedResult.status).toBe("fail");
    expect(blockedResult.diagnostics).toEqual([
      "Problem code 'alpha/changed' changed category NotFound -> Conflict, status 404 -> 409, retryability not-retryable -> conditional without an explicit changeset or migration note mentioning that code.",
    ]);

    writeFile(
      repo,
      ".changeset/alpha-problem-change.md",
      [
        "---",
        '"@croco/alpha": patch',
        "---",
        "",
        "Document the `alpha/changed` Problem code migration from 404 to 409 handling.",
        "",
      ].join("\n"),
    );

    expect(runProblemRegistryCheck(repo, "write").status).toBe("pass");
    expect(runProblemRegistryCheck(repo, "check").status).toBe("pass");
  });

  it("compares committed registry artifacts against the base registry for contract changes", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/alpha/src/problems.ts",
      [
        'import { Problem, ProblemCategory } from "@croco/problems-core";',
        "export class AlphaChangedProblem extends Problem {",
        "  constructor() {",
        '    super("alpha/changed", ProblemCategory.NotFound, "changed");',
        "  }",
        "}",
        "",
      ].join("\n"),
    );
    expect(runProblemRegistryCheck(repo, "write").status).toBe("pass");
    const baseRegistry = readRegistry(repo);

    writeFile(
      repo,
      "packages/alpha/src/problems.ts",
      [
        'import { Problem, ProblemCategory } from "@croco/problems-core";',
        "export class AlphaChangedProblem extends Problem {",
        "  constructor() {",
        '    super("alpha/changed", ProblemCategory.Conflict, "changed");',
        "  }",
        "}",
        "",
      ].join("\n"),
    );
    writeRegistry(repo, {
      ...baseRegistry,
      problems: baseRegistry.problems.map((problem) =>
        problem.code === "alpha/changed"
          ? {
              ...problem,
              category: "Conflict",
              status: 409,
              title: "Conflict",
              recovery: {
                ...problem.recovery,
                retryability: "conditional",
              },
            }
          : problem,
      ),
    });

    const result = runProblemRegistryCheck(repo, "check", { baseRegistry });

    expect(result.status).toBe("fail");
    expect(result.diagnostics).toEqual([
      "Problem code 'alpha/changed' changed category NotFound -> Conflict, status 404 -> 409, retryability not-retryable -> conditional without an explicit changeset or migration note mentioning that code.",
    ]);
  });

  it("requires changeset or migration evidence for lifecycle deprecation changes", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/alpha/src/problems.ts",
      [
        'import { Problem, ProblemCategory } from "@croco/problems-core";',
        "export class AlphaChangedProblem extends Problem {",
        "  constructor() {",
        '    super("alpha/changed", ProblemCategory.Gone, "changed");',
        "  }",
        "}",
        "export class AlphaReplacementProblem extends Problem {",
        "  constructor() {",
        '    super("alpha/replacement", ProblemCategory.Gone, "replacement");',
        "  }",
        "}",
        "",
      ].join("\n"),
    );
    expect(runProblemRegistryCheck(repo, "write").status).toBe("pass");
    const baseRegistry = readRegistry(repo);
    writeRegistry(repo, {
      ...baseRegistry,
      problems: baseRegistry.problems.map((problem) =>
        problem.code === "alpha/changed"
          ? {
              ...problem,
              lifecycle: {
                status: "deprecated",
                deprecation: {
                  reason: "The code was replaced.",
                  migrationNote: "Branch clients on alpha/replacement.",
                  replacementCode: "alpha/replacement",
                },
              },
            }
          : problem,
      ),
    });

    const blockedResult = runProblemRegistryCheck(repo, "check", { baseRegistry });
    expect(blockedResult.status).toBe("fail");
    expect(blockedResult.diagnostics).toEqual([
      "Problem code 'alpha/changed' changed lifecycle active -> deprecated, deprecation.reason (none) -> The code was replaced., deprecation.migrationNote (none) -> Branch clients on alpha/replacement., deprecation.replacementCode (none) -> alpha/replacement without an explicit changeset or migration note mentioning that code.",
    ]);

    writeFile(
      repo,
      "docs/release/problem-code-migrations.md",
      [
        "# Problem code migrations",
        "",
        "- `alpha/changed` is deprecated in favor of `alpha/replacement`.",
        "",
      ].join("\n"),
    );

    expect(runProblemRegistryCheck(repo, "write", { baseRegistry }).status).toBe("pass");
    expect(runProblemRegistryCheck(repo, "check", { baseRegistry }).status).toBe("pass");
  });

  it("rejects unsafe Problem extension redaction fixtures", () => {
    const repo = createTempRepo();
    writeFile(
      repo,
      "packages/alpha/src/problems.ts",
      [
        'import { ProblemFactory } from "@croco/problems-core";',
        "export function failProvider() {",
        '  return ProblemFactory.internalServerError("alpha/upstream", "failed", {',
        "    extensions: {",
        "      rawProviderResponse: { status: 500 },",
        '      message: "Bearer sk_live_secret",',
        "    },",
        "  });",
        "}",
        "",
      ].join("\n"),
    );

    const result = runProblemRegistryCheck(repo, "check");

    expect(result.status).toBe("fail");
    expect(result.diagnostics).toEqual([
      "Unsafe Problem extension 'rawProviderResponse' at packages/alpha/src/problems.ts:5:7: raw request/provider payloads must be summarized and redacted before they enter Problem extensions.",
      "Unsafe Problem extension 'message' at packages/alpha/src/problems.ts:6:16: literal secret-looking values must be redacted before they enter Problem extensions.",
    ]);
  });
});

function createTempRepo(): string {
  const repo = mkdtempSync(join(tmpdir(), "croco-problem-registry-"));
  tempRepos.push(repo);
  return repo;
}

function writeFile(repo: string, path: string, content: string): void {
  const absolutePath = join(repo, path);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content);
}

function writeCauseViolation(repo: string): void {
  writeFile(
    repo,
    "packages/alpha/src/problems.ts",
    [
      'import { Problem, ProblemCategory } from "@croco/problems-core";',
      "export class AlphaProblem extends Problem {",
      "  constructor(cause: Error) {",
      '    super("alpha/failed", ProblemCategory.InternalServerError, cause.message);',
      "  }",
      "}",
    ].join("\n"),
  );
}

function causeAllowlistEntry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    code: "problem-cause-not-forwarded",
    file: "packages/alpha/src/problems.ts",
    className: "AlphaProblem",
    parameter: "cause",
    owner: "alpha-maintainers",
    reason: "The cause must remain detached for this fixture.",
    expiresOn: "2999-12-31",
    ...overrides,
  };
}

function writeCauseAllowlist(
  repo: string,
  entries: readonly Record<string, unknown>[],
  baselineEntryCount = entries.length,
): void {
  writeFile(
    repo,
    "scripts/problem-cause-allowlist.json",
    `${JSON.stringify({ schemaVersion: 1, baselineEntryCount, entries }, null, 2)}\n`,
  );
}

function writeProblemFactories(repo: string, path: string, codes: readonly string[]): void {
  writeFile(
    repo,
    path,
    [
      'import { ProblemFactory } from "@croco/problems-core";',
      ...codes.map(
        (code, index) =>
          `export function problem${index}() { return ProblemFactory.badRequest("${code}"); }`,
      ),
      "",
    ].join("\n"),
  );
}

function writeProblemRegistryFixtureArtifacts(repo: string): ProblemCodeRegistry {
  const registry = createProblemCodeRegistry(discoverProblemCodes(repo));

  for (const [path, content] of formatProblemRegistryArtifacts(
    createProblemRegistryArtifacts(registry),
  )) {
    writeFile(repo, path, content);
  }

  return registry;
}

function runGit(repo: string, ...arguments_: readonly string[]): string {
  return execFileSync("git", arguments_, { cwd: repo, encoding: "utf-8" }).trim();
}

function commitAll(repo: string, message: string): void {
  runGit(repo, "add", ".");
  runGit(repo, "commit", "--message", message);
}

function setupDeprecatedAlphaRemovedRegistry(deprecation: Record<string, unknown>): string {
  const repo = createTempRepo();
  writeFile(
    repo,
    "packages/alpha/src/problems.ts",
    [
      'import { Problem, ProblemCategory } from "@croco/problems-core";',
      "export class AlphaRemovedProblem extends Problem {",
      "  constructor() {",
      '    super("alpha/removed", ProblemCategory.Gone, "removed");',
      "  }",
      "}",
      "",
    ].join("\n"),
  );
  expect(runProblemRegistryCheck(repo, "write").status).toBe("pass");

  writeFile(repo, "packages/alpha/src/problems.ts", "");
  const registry = readRegistry(repo);
  const deprecatedLifecycle = JSON.parse(
    JSON.stringify({ status: "deprecated", deprecation }),
  ) as ProblemCodeRegistry["problems"][number]["lifecycle"];

  writeRegistry(repo, {
    ...registry,
    problems: registry.problems.map((problem) =>
      problem.code === "alpha/removed"
        ? {
            ...problem,
            lifecycle: deprecatedLifecycle,
            sources: [],
          }
        : problem,
    ),
  });

  return repo;
}

function readRegistry(repo: string): ProblemCodeRegistry {
  return JSON.parse(readFileSync(join(repo, "docs/problem-code-registry.json"), "utf-8"));
}

function writeRegistry(repo: string, registry: ProblemCodeRegistry): void {
  writeFile(repo, "docs/problem-code-registry.json", `${JSON.stringify(registry, null, 2)}\n`);
}
