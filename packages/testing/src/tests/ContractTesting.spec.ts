import {
  createRuntimeCapabilityManifest,
  type RuntimeCapabilityManifest,
} from "@croco/framework-context";
import { ProblemCategory } from "@croco/problems-core";
import type { ContractGraphRoute } from "@croco/protocols-core";
import * as fc from "fast-check";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  assertContractObservation,
  CONTRACT_RUNTIME_LIFECYCLE_CAPABILITIES,
  CONTRACT_TEST_PROFILES,
  type ContractExecutionObservation,
  type ContractFailureArtifact,
  type ContractFailureSink,
  type ContractGeneratedCase,
  type ContractLifecycleObservation,
  type ContractLifecycleOutcome,
  ContractInvariantProblem,
  ContractRuntimeMismatchProblem,
  createContractCaseArbitrary,
  runContractFuzz,
  runContractRuntimeDifferential,
  UnsupportedContractGenerationProblem,
} from "../libs/contract-testing";

const inputSchema = z.object({ name: z.string().min(1).max(12) });
const outputSchema = z.object({ id: z.string(), accepted: z.boolean() });

enum NumericMode {
  Read,
  Write,
}

const route = {
  routeId: "UsersController.create",
  operationId: "createUser",
  controllerName: "UsersController",
  controllerPath: "/users",
  methodName: "create",
  httpMethod: "POST",
  path: "/users",
  routeContract: null,
  params: [],
  inputSchema,
  inputSchemas: { body: inputSchema, path: null, query: null, headers: null },
  outputSchema,
  problemResponses: [
    { code: "users/invalid", category: ProblemCategory.ValidationError, status: 422 },
    { code: "users/conflict", category: ProblemCategory.Conflict, status: 409 },
  ],
  domain: "users",
  access: { guards: [], roles: [] },
  entitlements: [],
} satisfies ContractGraphRoute;

const validCase: ContractGeneratedCase = {
  kind: "valid",
  canarySecret: "croco-canary-contract-secret",
  input: { body: { name: "Ada" } },
};

const invalidCase: ContractGeneratedCase = {
  kind: "invalid",
  canarySecret: "croco-canary-contract-secret",
  input: { body: { name: 42 } },
};

const successObservation: ContractExecutionObservation = {
  status: 200,
  body: { id: "user-1", accepted: true },
  headers: { "content-type": "application/json" },
  tracePropagation: { propagated: true },
};

function errorObservation(hidden: string, enumerable = false): Error {
  const error = new Error("same");
  Object.defineProperty(error, "stack", { value: "stable", configurable: true, writable: true });
  Object.defineProperty(error, "hidden", {
    value: hidden,
    configurable: true,
    enumerable,
    writable: true,
  });
  return error;
}

function lifecycleFor(
  manifest: RuntimeCapabilityManifest,
  outcomes: Partial<Record<(typeof CONTRACT_RUNTIME_LIFECYCLE_CAPABILITIES)[number], unknown>> = {},
) {
  return Object.fromEntries(
    CONTRACT_RUNTIME_LIFECYCLE_CAPABILITIES.map((capability) => [
      capability,
      {
        supported: manifest.capabilities[capability],
        outcome: manifest.capabilities[capability]
          ? ({
              status: "succeeded",
              value: outcomes[capability] ?? "supported",
            } satisfies ContractLifecycleOutcome)
          : ({
              status: "unsupported",
              reason: outcomes[capability] ?? "unsupported",
            } satisfies ContractLifecycleOutcome),
      },
    ]),
  ) as Record<
    (typeof CONTRACT_RUNTIME_LIFECYCLE_CAPABILITIES)[number],
    ContractLifecycleObservation
  >;
}

function nestedEvidence(depth: number): unknown {
  let value: unknown = "leaf";
  for (let index = 0; index < depth; index += 1) {
    value = { value };
  }
  return value;
}

describe("contract testing", () => {
  it.each([
    [
      "ownKeys",
      new Proxy(
        {},
        {
          ownKeys() {
            throw new Error("inspection failed");
          },
        },
      ),
    ],
    [
      "getOwnPropertyDescriptor",
      new Proxy(
        {},
        {
          ownKeys: () => ["evidence"],
          getOwnPropertyDescriptor() {
            throw new Error("inspection failed");
          },
        },
      ),
    ],
  ])("contains top-level extension %s traps in the intended Problem", (_trap, extensions) => {
    const problem = new ContractRuntimeMismatchProblem("runtime mismatch", extensions);

    expect(problem).toMatchObject({
      code: "testing/contract-runtime-mismatch",
      extensions: {
        unsupportedEvidence: {
          evidenceFormat: "unsupported-extensions-v1",
          reason: "inspection-failed",
        },
      },
    });
  });

  it.each([
    [
      "wide object",
      Object.fromEntries(Array.from({ length: 10_001 }, (_, index) => [`key-${index}`, index])),
    ],
    [
      "nested aggregate",
      {
        left: Array.from({ length: 5_000 }, (_, index) => index),
        right: Array.from({ length: 5_000 }, (_, index) => index),
      },
    ],
  ])("contains %s evidence beyond the Problem node budget", (_case, extensions) => {
    const problem = new ContractInvariantProblem("oversized evidence", extensions);

    expect(problem).toMatchObject({
      code: "testing/contract-invariant-failed",
      extensions: {
        unsupportedEvidence: {
          evidenceFormat: "unsupported-extensions-v1",
          reason: "size-limit",
        },
      },
    });
  });

  it("represents symbol-keyed extensions as unsupported evidence", () => {
    const extensions: Record<string | symbol, unknown> = { capability: "flush" };
    extensions[Symbol("secret")] = "hidden";
    const problem = new ContractRuntimeMismatchProblem("runtime mismatch", extensions);

    expect(problem).toMatchObject({
      code: "testing/contract-runtime-mismatch",
      extensions: {
        unsupportedEvidence: {
          evidenceFormat: "unsupported-extensions-v1",
          reason: "symbol-key",
        },
      },
    });
  });

  it("keeps the deepest supported extension evidence structural", () => {
    const problem = new ContractRuntimeMismatchProblem("runtime mismatch", {
      outcome: nestedEvidence(99),
    });

    expect(problem.code).toBe("testing/contract-runtime-mismatch");
    expect(problem.extensions).toHaveProperty("outcome");
    expect(problem.extensions).not.toHaveProperty("unsupportedEvidence");
  });

  it("tags extension evidence beyond the supported depth without replacing the Problem", () => {
    const problem = new ContractRuntimeMismatchProblem("runtime mismatch", {
      outcome: nestedEvidence(100),
    });

    expect(problem).toMatchObject({
      code: "testing/contract-runtime-mismatch",
      extensions: {
        outcome: {
          evidenceFormat: "canonical-v1",
        },
      },
    });
  });

  it("defines bounded deterministic PR, nightly, and manual profiles", () => {
    expect(CONTRACT_TEST_PROFILES).toEqual({
      pr: { numRuns: 32, seed: 1489 },
      nightly: { numRuns: 512, seed: 1489 },
      manual: { numRuns: 2048, seed: 1489 },
    });
    expect(CONTRACT_TEST_PROFILES.pr.numRuns).toBeLessThan(CONTRACT_TEST_PROFILES.nightly.numRuns);
    expect(CONTRACT_TEST_PROFILES.nightly.numRuns).toBeLessThan(
      CONTRACT_TEST_PROFILES.manual.numRuns,
    );
  });

  it.each([0, 1.5, CONTRACT_TEST_PROFILES.pr.numRuns + 1])(
    "rejects numRuns outside the active profile bound: %s",
    async (numRuns) => {
      await expect(
        runContractFuzz({
          route,
          runtime: "node",
          arbitrary: fc.constant(validCase),
          numRuns,
          execute: () => successObservation,
        }),
      ).rejects.toThrow(/numRuns/);
    },
  );

  it("generates both valid and malformed contract-guided requests", () => {
    const cases = fc.sample(createContractCaseArbitrary(route), { seed: 1489, numRuns: 100 });
    expect(
      cases.some(
        ({ kind, input }) => kind === "valid" && inputSchema.safeParse(input.body).success,
      ),
    ).toBe(true);
    expect(
      cases.some(
        ({ kind, input }) => kind === "invalid" && !inputSchema.safeParse(input.body).success,
      ),
    ).toBe(true);
    expect(
      cases.every(
        ({ canarySecret, input }) =>
          (input.headers as Record<string, unknown>)["x-croco-fuzz-canary"] === canarySecret,
      ),
    ).toBe(true);
    expect(cases.every(({ canarySecret }) => /^croco-canary-[0-9a-f-]+$/.test(canarySecret))).toBe(
      true,
    );
  });

  it("generates only accepted numeric native-enum values", () => {
    const enumSchema = z.object({ mode: z.nativeEnum(NumericMode) });
    const enumRoute = {
      ...route,
      inputSchemas: { ...route.inputSchemas, body: enumSchema },
    } satisfies ContractGraphRoute;
    const cases = fc
      .sample(createContractCaseArbitrary(enumRoute), { seed: 1489, numRuns: 100 })
      .filter(({ kind }) => kind === "valid");

    expect(cases.length).toBeGreaterThan(0);
    expect(cases.every(({ input }) => enumSchema.safeParse(input.body).success)).toBe(true);
  });

  it("fails clearly when a route uses an unsupported generation shape", () => {
    const unsupported = {
      ...route,
      inputSchemas: { ...route.inputSchemas, body: z.string().email() },
    } satisfies ContractGraphRoute;

    expect(() => createContractCaseArbitrary(unsupported)).toThrow(
      "Contract generation does not support ZodString.email at 'input.body'",
    );
  });

  it("fails clearly when a union has no generation options", () => {
    const emptyUnion = z.ZodUnion.create([] as unknown as readonly [z.ZodTypeAny, z.ZodTypeAny]);
    const unsupported = {
      ...route,
      inputSchemas: { ...route.inputSchemas, body: emptyUnion },
    } satisfies ContractGraphRoute;

    expect(() => createContractCaseArbitrary(unsupported)).toThrow("a union without options");
  });

  it("blocks malformed input that escapes as an undocumented raw 500", () => {
    expect(() =>
      assertContractObservation(route, invalidCase, { status: 500, body: "Internal Server Error" }),
    ).toThrow("Malformed input for route 'UsersController.create' became an undocumented raw 500");
  });

  it("blocks undocumented Problem status and code pairs", () => {
    expect(() =>
      assertContractObservation(route, validCase, {
        status: 403,
        body: { code: "users/forbidden", status: 403, title: "Forbidden", type: "about:blank" },
      }),
    ).toThrow("undocumented Problem 'users/forbidden' with status 403");
  });

  it.each([
    ["response", (secret: string) => ({ body: { id: secret, accepted: true } })],
    ["logs", (secret: string) => ({ logs: [{ message: secret }] })],
    ["spans", (secret: string) => ({ spans: [{ attributes: { value: secret } }] })],
    ["serialized", (secret: string) => ({ serialized: [`problem=${secret}`] })],
  ] as const)("detects canary reflection in %s observations", (surface, leaked) => {
    expect(() =>
      assertContractObservation(route, validCase, {
        ...successObservation,
        ...leaked(validCase.canarySecret),
      }),
    ).toThrow(`Canary secret was reflected in ${surface} observations`);
  });

  it("detects canary reflection in Error fields without recursing forever", () => {
    const error = new Error("outer");
    Object.defineProperty(error, "cause", { value: new Error(validCase.canarySecret) });
    Object.defineProperty(error, "self", { value: error, enumerable: true });

    expect(() =>
      assertContractObservation(route, validCase, {
        ...successObservation,
        logs: [error],
      }),
    ).toThrow("Canary secret was reflected in logs observations");
  });

  it("traverses class-instance canary surfaces without rejecting benign prototypes", () => {
    class SpanObservation {
      constructor(readonly attribute: string) {}
    }

    expect(
      assertContractObservation(route, validCase, {
        ...successObservation,
        spans: [new SpanObservation("safe")],
      }),
    ).toBe("success");
    expect(() =>
      assertContractObservation(route, validCase, {
        ...successObservation,
        spans: [new SpanObservation(validCase.canarySecret)],
      }),
    ).toThrow("Canary secret was reflected in spans observations");
  });

  it.each([
    ["symbol value", (secret: string) => Symbol(secret)],
    ["string property key", (secret: string) => ({ [secret]: true })],
    ["symbol property key", (secret: string) => ({ [Symbol(secret)]: true })],
  ] as const)("detects canaries in a %s", (_name, leaked) => {
    expect(() =>
      assertContractObservation(route, validCase, {
        ...successObservation,
        logs: [leaked(validCase.canarySecret)],
      }),
    ).toThrow("Canary secret was reflected in logs observations");
  });

  it("accepts the declared success-or-Problem response union", () => {
    expect(assertContractObservation(route, validCase, successObservation)).toBe("success");
    expect(
      assertContractObservation(route, validCase, {
        status: 409,
        body: { code: "users/conflict", status: 409, title: "Conflict", type: "about:blank" },
      }),
    ).toBe("problem");
  });

  it("rejects undocumented 2xx statuses and malformed RFC 7807 bodies", () => {
    expect(() =>
      assertContractObservation(route, validCase, { ...successObservation, status: 201 }),
    ).toThrow("undocumented success status 201");
    expect(() =>
      assertContractObservation(route, validCase, {
        status: 409,
        body: { code: "users/conflict", status: 409 },
      }),
    ).toThrow("invalid Problem response");
  });

  it("accepts a route's declared non-200 success status", () => {
    const createdRoute = { ...route, successStatus: 201 } satisfies ContractGraphRoute;
    expect(
      assertContractObservation(createdRoute, validCase, {
        ...successObservation,
        status: 201,
      }),
    ).toBe("success");
  });

  it("intersects chained bounds and preserves strict-header case classification", () => {
    const boundedHeaders = z
      .object({ "x-request-id": z.string().min(5).min(2).max(8).max(10) })
      .strict();
    const boundedRoute = {
      ...route,
      inputSchemas: { ...route.inputSchemas, headers: boundedHeaders },
    } satisfies ContractGraphRoute;
    const cases = fc.sample(createContractCaseArbitrary(boundedRoute), {
      seed: 1489,
      numRuns: 100,
    });
    for (const testCase of cases) {
      const bodyValid = inputSchema.safeParse(testCase.input.body).success;
      const headersValid = boundedHeaders.safeParse(testCase.input.headers).success;
      expect(bodyValid && headersValid).toBe(testCase.kind === "valid");
      expect(testCase.input.transportHeaders?.["x-croco-fuzz-canary"]).toBe(testCase.canarySecret);
      if (testCase.kind === "valid") {
        const requestId = (testCase.input.headers as { "x-request-id": string })["x-request-id"];
        expect(requestId.length).toBeGreaterThanOrEqual(5);
        expect(requestId.length).toBeLessThanOrEqual(8);
      }
    }
    expect(() =>
      createContractCaseArbitrary({
        ...route,
        inputSchemas: { ...route.inputSchemas, body: z.string().min(10).max(5) },
      }),
    ).toThrow("impossible ZodString length range (10..5)");
  });

  it.each(["path", "query", "headers"] as const)(
    "keeps malformed %s fields invalid after string encoding",
    (transportKey) => {
      const transportSchema = z.object({ value: z.literal("0") });
      const transportRoute = {
        ...route,
        inputSchema: null,
        inputSchemas: {
          body: null,
          path: null,
          query: null,
          headers: null,
          [transportKey]: transportSchema,
        },
      } satisfies ContractGraphRoute;
      const invalidCases = fc
        .sample(createContractCaseArbitrary(transportRoute), { seed: 1489, numRuns: 100 })
        .filter(({ kind }) => kind === "invalid");

      expect(invalidCases.length).toBeGreaterThan(0);
      for (const testCase of invalidCases) {
        const transportInput = testCase.input[transportKey] as { value: unknown };
        const encoded = {
          value: Array.isArray(transportInput.value)
            ? transportInput.value.map((entry) => String(entry))
            : String(transportInput.value),
        };
        expect(transportSchema.safeParse(encoded).success).toBe(false);
      }
    },
  );

  it("models singleton query arrays as scalars before array-schema normalization", () => {
    const acceptsEveryTransportedSentinel = z
      .enum(["", "__croco_invalid__", "0", "false", "null"])
      .optional();

    expect(() =>
      createContractCaseArbitrary({
        ...route,
        inputSchema: null,
        inputSchemas: {
          body: null,
          path: null,
          query: z.object({ value: acceptsEveryTransportedSentinel }),
          headers: null,
        },
      }),
    ).toThrow(UnsupportedContractGenerationProblem);
  });

  it("models comma-split header strings before array-schema validation", () => {
    const acceptsEveryNormalizedSentinel = z
      .array(z.enum(["", "__croco_invalid__", "0", "false", "null"]))
      .optional();

    expect(() =>
      createContractCaseArbitrary({
        ...route,
        inputSchema: null,
        inputSchemas: {
          body: null,
          path: null,
          query: null,
          headers: z.object({ value: acceptsEveryNormalizedSentinel }),
        },
      }),
    ).toThrow(UnsupportedContractGenerationProblem);
  });

  it("keeps generated counterexamples losslessly JSON-safe", () => {
    const cases = fc.sample(createContractCaseArbitrary(route), { seed: 77, numRuns: 200 });
    for (const testCase of cases) {
      expect(JSON.parse(JSON.stringify(testCase))).toEqual(testCase);
    }
  });

  it("persists a shrunk failure artifact with replay metadata through an injected sink", async () => {
    const artifacts: ContractFailureArtifact[] = [];
    const sink: ContractFailureSink = { persist: (artifact) => void artifacts.push(artifact) };
    const arbitrary = fc.integer({ min: 1, max: 100 }).map(
      (count): ContractGeneratedCase => ({
        kind: "valid",
        canarySecret: "croco-canary-minimize",
        input: { body: { name: "x".repeat(count) } },
      }),
    );

    await expect(
      runContractFuzz({
        route,
        runtime: "node",
        arbitrary,
        numRuns: 20,
        seed: 42,
        failureSink: sink,
        execute: ({ input }) => ({
          status: 200,
          body: { id: input.body, accepted: "not-boolean" },
        }),
      }),
    ).rejects.toThrow("outside its success schema");

    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]).toMatchObject({
      schemaVersion: "croco.contract-test-failure.v1",
      routeId: route.routeId,
      runtime: "node",
      seed: 42,
      minimalInput: { input: { body: { name: "x" } } },
      error: { code: "testing/contract-invariant-failed" },
    });
    expect(artifacts[0]?.counterexamplePath).not.toBe("");
    expect(artifacts[0]?.replayCommand).toContain("CROCO_CONTRACT_SEED=42");
    expect(artifacts[0]?.replayCommand).toContain("CROCO_CONTRACT_PATH=");
    expect(artifacts[0]?.replayCommand).toContain("CROCO_CONTRACT_RUNTIME='node'");
    expect(artifacts[0]?.replayCommand).toContain(`CROCO_CONTRACT_ROUTE='${route.routeId}'`);
  });

  it("consumes targeted replay environment without hijacking other suites", async () => {
    const artifacts: ContractFailureArtifact[] = [];
    const arbitrary = fc.constant(validCase);
    const failing = () => ({ status: 200, body: { id: "x", accepted: "invalid" } });
    try {
      await expect(
        runContractFuzz({
          route,
          runtime: "node",
          arbitrary,
          seed: 71,
          numRuns: 1,
          execute: failing,
          failureSink: { persist: (artifact) => void artifacts.push(artifact) },
        }),
      ).rejects.toThrow();
      const first = artifacts[0];
      if (!first) throw new TypeError("Expected an initial replay artifact.");
      vi.stubEnv("CROCO_CONTRACT_ROUTE", route.routeId);
      vi.stubEnv("CROCO_CONTRACT_RUNTIME", "node");
      vi.stubEnv("CROCO_CONTRACT_SEED", String(first.seed));
      vi.stubEnv("CROCO_CONTRACT_PATH", first.counterexamplePath);
      await expect(
        runContractFuzz({
          route,
          runtime: "node",
          arbitrary,
          seed: 999,
          numRuns: 1,
          execute: failing,
          failureSink: { persist: (artifact) => void artifacts.push(artifact) },
        }),
      ).rejects.toThrow();
      expect(artifacts[1]).toMatchObject({
        seed: first.seed,
        counterexamplePath: first.counterexamplePath,
      });

      vi.stubEnv("CROCO_CONTRACT_ROUTE", "OtherController.route");
      vi.stubEnv("CROCO_CONTRACT_SEED", "not-an-integer");
      const report = await runContractFuzz({
        route,
        runtime: "node",
        arbitrary,
        seed: 123,
        numRuns: 1,
        execute: () => successObservation,
      });
      expect(report.seed).toBe(123);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it.each([undefined, Number.NaN, Number.POSITIVE_INFINITY])(
    "refuses to persist non-JSON counterexample value %s",
    async (unsafe) => {
      await expect(
        runContractFuzz({
          route,
          runtime: "node",
          arbitrary: fc.constant({ ...validCase, input: { body: unsafe } }),
          numRuns: 1,
          failureSink: {
            persist: () => {
              throw new TypeError("must not persist");
            },
          },
          execute: () => ({ status: 200, body: { accepted: "invalid" } }),
        }),
      ).rejects.toThrow("not losslessly JSON serializable");
    },
  );

  it.each([
    Object.defineProperty({ body: { name: "Ada" } }, "hidden", { value: "lost" }),
    Object.assign({ body: { name: "Ada" } }, { [Symbol("lost")]: true }),
    (() => {
      const cyclic: Record<string, unknown> = { body: { name: "Ada" } };
      cyclic.self = cyclic;
      return cyclic;
    })(),
  ])("refuses to persist structurally lossy JSON counterexamples", async (unsafeInput) => {
    await expect(
      runContractFuzz({
        route,
        runtime: "node",
        arbitrary: fc.constant({ ...validCase, input: unsafeInput }),
        numRuns: 1,
        failureSink: {
          persist: () => {
            throw new TypeError("must not persist");
          },
        },
        execute: () => ({ status: 200, body: { accepted: "invalid" } }),
      }),
    ).rejects.toThrow("not losslessly JSON serializable");
  });

  it("rejects duplicate runtime target names before executing them", async () => {
    const node = createRuntimeCapabilityManifest("node");
    let executions = 0;
    await expect(
      runContractRuntimeDifferential({
        route,
        testCase: validCase,
        targets: [
          {
            runtime: "node",
            capabilities: node,
            execute: () => {
              executions += 1;
              return { ...successObservation, lifecycle: lifecycleFor(node) };
            },
          },
          {
            runtime: "node",
            capabilities: node,
            execute: () => {
              executions += 1;
              return { ...successObservation, lifecycle: lifecycleFor(node) };
            },
          },
        ],
      }),
    ).rejects.toThrow("Runtime differential target 'node' is declared more than once");
    expect(executions).toBe(0);
  });

  it("fails fast when a transport field accepts every invalid sentinel", () => {
    const acceptsTransportPalette = z
      .union([z.string(), z.number(), z.boolean(), z.array(z.string())])
      .nullable();
    expect(() =>
      createContractCaseArbitrary({
        ...route,
        inputSchema: null,
        inputSchemas: {
          body: null,
          path: null,
          query: z.object({ value: acceptsTransportPalette }),
          headers: null,
        },
      }),
    ).toThrow(UnsupportedContractGenerationProblem);
  });

  it("skips transport fields without invalid sentinels when another field can be invalidated", () => {
    const mixedTransportRoute = {
      ...route,
      inputSchema: null,
      inputSchemas: {
        body: null,
        path: null,
        query: z.object({
          passthrough: z.string().optional(),
          constrained: z.literal("accepted"),
        }),
        headers: null,
      },
    } satisfies ContractGraphRoute;

    const invalidCases = fc
      .sample(createContractCaseArbitrary(mixedTransportRoute), { seed: 1489, numRuns: 100 })
      .filter(({ kind }) => kind === "invalid");

    expect(invalidCases.length).toBeGreaterThan(0);
    for (const testCase of invalidCases) {
      expect(mixedTransportRoute.inputSchemas.query.safeParse(testCase.input.query).success).toBe(
        false,
      );
    }
  });

  it("rejects mislabeled custom cases before executing them", async () => {
    let executions = 0;
    await expect(
      runContractFuzz({
        route,
        runtime: "node",
        arbitrary: fc.constant({ ...validCase, kind: "invalid" }),
        numRuns: 1,
        failureSink: { persist: () => undefined },
        execute: () => {
          executions += 1;
          return successObservation;
        },
      }),
    ).rejects.toThrow("Generated invalid case");
    expect(executions).toBe(0);
  });

  it("blocks undeclared cross-runtime differences", async () => {
    const node = createRuntimeCapabilityManifest("node");
    const lambda = createRuntimeCapabilityManifest("lambda");

    await expect(
      runContractRuntimeDifferential({
        route,
        testCase: validCase,
        targets: [
          {
            runtime: "node",
            capabilities: node,
            execute: () => ({ ...successObservation, lifecycle: lifecycleFor(node) }),
          },
          {
            runtime: "lambda",
            capabilities: lambda,
            execute: () => ({
              ...successObservation,
              headers: { "content-type": "text/plain" },
              lifecycle: lifecycleFor(lambda),
            }),
          },
        ],
      }),
    ).rejects.toThrow("differs from 'node' for stable header 'content-type'");
  });

  it("rejects successful responses for schema-invalid cases", () => {
    expect(() => assertContractObservation(route, invalidCase, successObservation)).toThrow(
      "Schema-invalid input",
    );
  });

  it("allows lifecycle differences only when runtime capability declarations differ", async () => {
    const node = createRuntimeCapabilityManifest("node");
    const lambda = createRuntimeCapabilityManifest("lambda");
    const workers = createRuntimeCapabilityManifest("cloudflare-workers");
    const report = await runContractRuntimeDifferential({
      route,
      testCase: validCase,
      stableHeaders: ["content-type"],
      targets: [
        {
          runtime: "node",
          capabilities: node,
          execute: () => ({
            ...successObservation,
            lifecycle: lifecycleFor(node, { waitUntil: "not-scheduled" }),
          }),
        },
        {
          runtime: "lambda",
          capabilities: lambda,
          execute: () => ({
            ...successObservation,
            lifecycle: lifecycleFor(lambda, { waitUntil: "completed" }),
          }),
        },
        {
          runtime: "cloudflare-workers",
          capabilities: workers,
          execute: () => ({
            ...successObservation,
            lifecycle: lifecycleFor(workers, { waitUntil: "completed" }),
          }),
        },
      ],
    });

    expect(report.status).toBe("passed");
    expect(report.allowedLifecycleDifferences).toEqual([
      "abortSignal",
      "deadline",
      "flush",
      "streamingResponse",
      "waitUntil",
    ]);
  });

  it("blocks lifecycle mismatches when manifests declare equal support", async () => {
    const node = createRuntimeCapabilityManifest("node");
    const lambda = createRuntimeCapabilityManifest("lambda");
    await expect(
      runContractRuntimeDifferential({
        route,
        testCase: validCase,
        targets: [
          {
            runtime: "node",
            capabilities: node,
            execute: () => ({
              ...successObservation,
              lifecycle: lifecycleFor(node, { shutdown: "clean" }),
            }),
          },
          {
            runtime: "lambda",
            capabilities: lambda,
            execute: () => ({
              ...successObservation,
              lifecycle: lifecycleFor(lambda, { shutdown: "skipped" }),
            }),
          },
        ],
      }),
    ).rejects.toThrow("Undeclared lifecycle mismatch for 'shutdown'");
  });

  it("compares lifecycle outcomes within every runtime support group", async () => {
    const node = createRuntimeCapabilityManifest("node");
    const lambda = createRuntimeCapabilityManifest("lambda");
    const workers = createRuntimeCapabilityManifest("cloudflare-workers");
    await expect(
      runContractRuntimeDifferential({
        route,
        testCase: validCase,
        targets: [
          {
            runtime: "node",
            capabilities: node,
            execute: () => ({
              ...successObservation,
              lifecycle: lifecycleFor(node, { waitUntil: "unsupported" }),
            }),
          },
          {
            runtime: "lambda",
            capabilities: lambda,
            execute: () => ({
              ...successObservation,
              lifecycle: lifecycleFor(lambda, { waitUntil: "drained" }),
            }),
          },
          {
            runtime: "cloudflare-workers",
            capabilities: workers,
            execute: () => ({
              ...successObservation,
              lifecycle: lifecycleFor(workers, { waitUntil: "pending" }),
            }),
          },
        ],
      }),
    ).rejects.toThrow("between 'lambda' and 'cloudflare-workers'");
  });

  it("treats an equally absent stable header as runtime parity", async () => {
    const node = createRuntimeCapabilityManifest("node");
    const lambda = createRuntimeCapabilityManifest("lambda");
    const report = await runContractRuntimeDifferential({
      route,
      testCase: validCase,
      targets: [
        {
          runtime: "node",
          capabilities: node,
          execute: () => ({
            status: successObservation.status,
            body: successObservation.body,
            tracePropagation: successObservation.tracePropagation,
            lifecycle: lifecycleFor(node),
          }),
        },
        {
          runtime: "lambda",
          capabilities: lambda,
          execute: () => ({
            status: successObservation.status,
            body: successObservation.body,
            tracePropagation: successObservation.tracePropagation,
            lifecycle: lifecycleFor(lambda),
          }),
        },
      ],
    });

    expect(report.status).toBe("passed");
  });

  it("requires every runtime-sensitive lifecycle observation and verifies manifest support", async () => {
    const node = createRuntimeCapabilityManifest("node");
    const lambda = createRuntimeCapabilityManifest("lambda");
    const incomplete = lifecycleFor(lambda);
    delete (incomplete as Partial<typeof incomplete>).flush;

    await expect(
      runContractRuntimeDifferential({
        route,
        testCase: validCase,
        targets: [
          {
            runtime: "node",
            capabilities: node,
            execute: () => ({ ...successObservation, lifecycle: lifecycleFor(node) }),
          },
          {
            runtime: "lambda",
            capabilities: lambda,
            execute: () => ({ ...successObservation, lifecycle: incomplete }),
          },
        ],
      }),
    ).rejects.toThrow("Runtime 'lambda' is missing lifecycle observation 'flush'");

    const falselyUnsupported = lifecycleFor(lambda);
    falselyUnsupported.flush = {
      supported: false,
      outcome: { status: "unsupported", reason: "completed" },
    };
    await expect(
      runContractRuntimeDifferential({
        route,
        testCase: validCase,
        targets: [
          {
            runtime: "node",
            capabilities: node,
            execute: () => ({ ...successObservation, lifecycle: lifecycleFor(node) }),
          },
          {
            runtime: "lambda",
            capabilities: lambda,
            execute: () => ({ ...successObservation, lifecycle: falselyUnsupported }),
          },
        ],
      }),
    ).rejects.toThrow("reported lifecycle support 'flush' as false");
  });

  it("rejects failed outcomes for manifest-supported lifecycle capabilities", async () => {
    const node = createRuntimeCapabilityManifest("node");
    const lambda = createRuntimeCapabilityManifest("lambda");
    const broken = lifecycleFor(lambda);
    broken.flush = {
      supported: true,
      outcome: { status: "failed", error: new Error("flush") },
    };

    await expect(
      runContractRuntimeDifferential({
        route,
        testCase: validCase,
        targets: [
          {
            runtime: "node",
            capabilities: node,
            execute: () => ({ ...successObservation, lifecycle: lifecycleFor(node) }),
          },
          {
            runtime: "lambda",
            capabilities: lambda,
            execute: () => ({ ...successObservation, lifecycle: broken }),
          },
        ],
      }),
    ).rejects.toThrow("reported lifecycle 'flush' as failed");
  });

  it("preserves the runtime mismatch Problem when malformed evidence is not JSON data", async () => {
    const node = createRuntimeCapabilityManifest("node");
    const lambda = createRuntimeCapabilityManifest("lambda");
    const malformed = lifecycleFor(lambda);
    malformed.flush = {
      supported: true,
      outcome: new Map([["unexpected", "outcome"]]) as unknown as ContractLifecycleOutcome,
    };

    const problem = await runContractRuntimeDifferential({
      route,
      testCase: validCase,
      targets: [
        {
          runtime: "node",
          capabilities: node,
          execute: () => ({ ...successObservation, lifecycle: lifecycleFor(node) }),
        },
        {
          runtime: "lambda",
          capabilities: lambda,
          execute: () => ({ ...successObservation, lifecycle: malformed }),
        },
      ],
    }).catch((error: unknown) => error);

    expect(problem).toMatchObject({
      code: "testing/contract-runtime-mismatch",
      extensions: {
        capability: "flush",
        outcome: {
          evidenceFormat: "canonical-v1",
        },
      },
    });
  });

  it("rejects equal lifecycle outcomes when manifests declare opposite support", async () => {
    const node = createRuntimeCapabilityManifest("node");
    const lambda = createRuntimeCapabilityManifest("lambda");
    const nodeLifecycle = lifecycleFor(node);
    const lambdaLifecycle = lifecycleFor(lambda);
    nodeLifecycle.waitUntil = {
      supported: false,
      outcome: { status: "unsupported", reason: "same-observation" },
    };
    lambdaLifecycle.waitUntil = {
      supported: true,
      outcome: { status: "succeeded", value: "same-observation" },
    };

    await expect(
      runContractRuntimeDifferential({
        route,
        testCase: validCase,
        targets: [
          {
            runtime: "node",
            capabilities: node,
            execute: () => ({ ...successObservation, lifecycle: nodeLifecycle }),
          },
          {
            runtime: "lambda",
            capabilities: lambda,
            execute: () => ({ ...successObservation, lifecycle: lambdaLifecycle }),
          },
        ],
      }),
    ).rejects.toThrow("despite opposite manifest support");
  });

  it.each([
    [new Date("2026-01-01T00:00:00.000Z"), new Date("2026-01-02T00:00:00.000Z")],
    [new Map([["key", "left"]]), new Map([["key", "right"]])],
    [new Set(["left"]), new Set(["right"])],
    [errorObservation("left"), errorObservation("right")],
    [errorObservation("same"), errorObservation("same", true)],
    [/left/gi, /right/gi],
    [new URL("https://left.example/path"), new URL("https://right.example/path")],
    [Number.NaN, Number.POSITIVE_INFINITY],
    [
      (() => {
        const value: Record<string, unknown> = { side: "left" };
        value.self = value;
        return value;
      })(),
      (() => {
        const value: Record<string, unknown> = { side: "right" };
        value.self = value;
        return value;
      })(),
    ],
  ])("detects non-JSON runtime mismatches without lossy canonicalization", async (left, right) => {
    const node = createRuntimeCapabilityManifest("node");
    const lambda = createRuntimeCapabilityManifest("lambda");
    await expect(
      runContractRuntimeDifferential({
        route,
        testCase: validCase,
        targets: [
          {
            runtime: "node",
            capabilities: node,
            execute: () => ({
              ...successObservation,
              tracePropagation: left,
              lifecycle: lifecycleFor(node),
            }),
          },
          {
            runtime: "lambda",
            capabilities: lambda,
            execute: () => ({
              ...successObservation,
              tracePropagation: right,
              lifecycle: lifecycleFor(lambda),
            }),
          },
        ],
      }),
    ).rejects.toThrow("differs from 'node' for trace propagation");
  });

  it("fails clearly for unsupported canonical object tags", async () => {
    class UnsupportedObservation {}

    const node = createRuntimeCapabilityManifest("node");
    const lambda = createRuntimeCapabilityManifest("lambda");
    await expect(
      runContractRuntimeDifferential({
        route,
        testCase: validCase,
        targets: [
          {
            runtime: "node",
            capabilities: node,
            execute: () => ({
              ...successObservation,
              tracePropagation: new UnsupportedObservation(),
              lifecycle: lifecycleFor(node),
            }),
          },
          {
            runtime: "lambda",
            capabilities: lambda,
            execute: () => ({
              ...successObservation,
              lifecycle: lifecycleFor(lambda),
            }),
          },
        ],
      }),
    ).rejects.toThrow(
      "Canonical contract comparison does not support object tag '[object Object]'",
    );
  });

  it.each([
    { left: Symbol("same"), right: Symbol("same"), type: "symbol" },
    {
      left: function collision() {},
      right: function collision() {},
      type: "function",
    },
  ] as const)(
    "fails clearly for identity-bearing canonical $type values",
    async ({ left, right, type }) => {
      const node = createRuntimeCapabilityManifest("node");
      const lambda = createRuntimeCapabilityManifest("lambda");
      await expect(
        runContractRuntimeDifferential({
          route,
          testCase: validCase,
          targets: [
            {
              runtime: "node",
              capabilities: node,
              execute: () => ({
                ...successObservation,
                tracePropagation: left,
                lifecycle: lifecycleFor(node),
              }),
            },
            {
              runtime: "lambda",
              capabilities: lambda,
              execute: () => ({
                ...successObservation,
                tracePropagation: right,
                lifecycle: lifecycleFor(lambda),
              }),
            },
          ],
        }),
      ).rejects.toThrow(`Canonical contract comparison does not support ${type} values`);
    },
  );
});
