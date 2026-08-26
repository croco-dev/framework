import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { RuntimeCapabilityManifest, RuntimeCapabilityName } from "@croco/framework-context";
import {
  Problem,
  ProblemCategory,
  ProblemSerializer,
  validateExtensions,
} from "@croco/problems-core";
import {
  getZodObjectShape,
  isZodArraySchema,
  type ContractGraphRoute,
} from "@croco/protocols-core";
import * as fc from "fast-check";
import { z } from "zod";

export const CONTRACT_TEST_PROFILES = {
  pr: { numRuns: 32, seed: 1489 },
  nightly: { numRuns: 512, seed: 1489 },
  manual: { numRuns: 2_048, seed: 1489 },
} as const;

export type ContractTestProfile = keyof typeof CONTRACT_TEST_PROFILES;

/**
 * Generation intentionally supports only deterministic, transport-safe Zod v3 constructs.
 * Refinements, transforms, records, maps, sets, promises, lazy schemas, `any`, and `unknown`
 * must be represented by explicit caller-owned arbitraries instead of guessed by this package.
 */
export const CONTRACT_TEST_SUPPORTED_ZOD_TYPES = [
  "ZodString (min/max only)",
  "ZodNumber (min/max/int only)",
  "ZodBoolean",
  "ZodLiteral",
  "ZodEnum",
  "ZodNativeEnum",
  "ZodObject",
  "ZodArray",
  "ZodTuple",
  "ZodUnion",
  "ZodDiscriminatedUnion",
  "ZodOptional",
  "ZodNullable",
  "ZodDefault",
] as const;

export const CONTRACT_RUNTIME_LIFECYCLE_CAPABILITIES = [
  "streamingResponse",
  "deadline",
  "abortSignal",
  "waitUntil",
  "flush",
  "shutdown",
] as const satisfies readonly RuntimeCapabilityName[];

export type ContractRuntimeLifecycleCapability =
  (typeof CONTRACT_RUNTIME_LIFECYCLE_CAPABILITIES)[number];

export type ContractLifecycleObservation = {
  readonly supported: boolean;
  readonly outcome: ContractLifecycleOutcome;
};

export type ContractLifecycleOutcome =
  | { readonly status: "succeeded"; readonly value: unknown }
  | { readonly status: "unsupported"; readonly reason?: unknown }
  | { readonly status: "failed"; readonly error: unknown };

export type ContractRequestInput = {
  readonly body?: unknown;
  readonly headers?: unknown;
  readonly path?: unknown;
  readonly query?: unknown;
  /** Runner-owned transport headers excluded from route header-schema validation. */
  readonly transportHeaders?: Readonly<Record<string, string>>;
};

type ContractSchemaInputKey = "body" | "headers" | "path" | "query";

export type ContractGeneratedCase = {
  readonly input: ContractRequestInput;
  readonly kind: "valid" | "invalid";
  readonly canarySecret: string;
};

export type ContractExecutionObservation = {
  readonly status: number;
  readonly body: unknown;
  readonly headers?: Readonly<Record<string, string>>;
  readonly logs?: readonly unknown[];
  readonly spans?: readonly unknown[];
  readonly serialized?: readonly unknown[];
  readonly tracePropagation?: unknown;
  readonly lifecycle?: Partial<
    Readonly<Record<ContractRuntimeLifecycleCapability, ContractLifecycleObservation>>
  >;
};

export type ContractExecutor = (
  testCase: ContractGeneratedCase,
) => ContractExecutionObservation | Promise<ContractExecutionObservation>;

export type ContractFailureArtifact = {
  readonly schemaVersion: "croco.contract-test-failure.v1";
  readonly routeId: string;
  readonly runtime: string;
  readonly seed: number;
  readonly counterexamplePath: string;
  readonly minimalInput: ContractGeneratedCase;
  readonly replayCommand: string;
  readonly error: { readonly code: string; readonly message: string };
};

export interface ContractFailureSink {
  persist(artifact: ContractFailureArtifact): void | Promise<void>;
}

/** Replay selection: `path` is accepted only together with the seed that produced it. */
export type ContractReplayOptions =
  | { readonly seed?: number; readonly path?: never }
  | { readonly seed: number; readonly path: string };

export type RunContractFuzzOptions = {
  readonly route: ContractGraphRoute;
  readonly runtime: string;
  readonly execute: ContractExecutor;
  readonly profile?: ContractTestProfile;
  readonly numRuns?: number;
  readonly arbitrary?: fc.Arbitrary<ContractGeneratedCase>;
  readonly failureSink?: ContractFailureSink;
  readonly failureDirectory?: string;
  readonly replayCommand?: string;
} & ContractReplayOptions;

export type ContractFuzzReport = {
  readonly status: "passed";
  readonly profile: ContractTestProfile;
  readonly numRuns: number;
  readonly seed: number;
  readonly runtime: string;
  readonly routeId: string;
};

export type ContractRuntimeTarget = {
  readonly runtime: "node" | "lambda" | "cloudflare-workers";
  readonly capabilities: RuntimeCapabilityManifest;
  readonly execute: ContractExecutor;
};

export type ContractRuntimeDifferentialOptions = {
  readonly route: ContractGraphRoute;
  readonly testCase: ContractGeneratedCase;
  readonly targets: readonly ContractRuntimeTarget[];
  readonly stableHeaders?: readonly string[];
};

export type ContractRuntimeDifferentialReport = {
  readonly status: "passed";
  readonly observations: Readonly<Record<string, ContractExecutionObservation>>;
  readonly allowedLifecycleDifferences: readonly RuntimeCapabilityName[];
};

/** Concrete Problem raised for invalid contract-testing configuration. */
export class ContractTestingProblem extends Problem {
  constructor(code: string, detail: string, extensions?: Record<string, unknown>) {
    super(
      code,
      ProblemCategory.ValidationError,
      detail,
      extensions === undefined ? {} : { extensions },
    );
  }
}

/** Concrete Problem raised when automatic generation cannot represent a schema. */
export class UnsupportedContractGenerationProblem extends Problem {
  constructor(path: string, shape: string) {
    super(
      "testing/contract-generation-unsupported",
      ProblemCategory.ValidationError,
      `Contract generation does not support ${shape} at '${path}'.`,
      { extensions: { path, shape, supported: CONTRACT_TEST_SUPPORTED_ZOD_TYPES } },
    );
  }
}

/** Concrete Problem raised when an observed route contract invariant is violated. */
export class ContractInvariantProblem extends Problem {
  constructor(detail: string, extensions?: Record<string, unknown>) {
    super(
      "testing/contract-invariant-failed",
      ProblemCategory.ValidationError,
      detail,
      extensions === undefined ? {} : { extensions: projectContractProblemExtensions(extensions) },
    );
  }
}

/** Concrete Problem raised when runtime observations disagree with their contracts. */
export class ContractRuntimeMismatchProblem extends Problem {
  constructor(detail: string, extensions?: Record<string, unknown>) {
    super(
      "testing/contract-runtime-mismatch",
      ProblemCategory.ValidationError,
      detail,
      extensions === undefined ? {} : { extensions: projectContractProblemExtensions(extensions) },
    );
  }
}

const MAX_PROBLEM_EVIDENCE_NODES = 10_000;
const RESERVED_PROBLEM_EXTENSION_KEYS = new Set([
  "type",
  "title",
  "status",
  "detail",
  "instance",
  "code",
]);

function projectContractProblemExtensions(
  extensions: Record<string, unknown>,
): Record<string, unknown> {
  try {
    const keys = Reflect.ownKeys(extensions);
    if (keys.length > MAX_PROBLEM_EVIDENCE_NODES - 1) {
      return unsupportedProblemExtensions("size-limit");
    }
    if (keys.some((key) => typeof key !== "string")) {
      return unsupportedProblemExtensions("symbol-key");
    }
    if (keys.some((key) => RESERVED_PROBLEM_EXTENSION_KEYS.has(key as string))) {
      return unsupportedProblemExtensions("reserved-key");
    }

    const projected: Record<string, unknown> = {};
    for (const key of keys as string[]) {
      const descriptor = Object.getOwnPropertyDescriptor(extensions, key);
      const projection =
        descriptor && descriptor.enumerable && "value" in descriptor
          ? projectContractProblemEvidence(descriptor.value)
          : { evidenceFormat: "unsupported-v1", valueType: "accessor" };
      Object.defineProperty(projected, key, {
        configurable: true,
        enumerable: true,
        value: projection,
        writable: true,
      });
    }
    try {
      return validateExtensions(projected);
    } catch {
      return unsupportedProblemExtensions("size-limit");
    }
  } catch {
    return unsupportedProblemExtensions("inspection-failed");
  }
}

function projectContractProblemEvidence(value: unknown): unknown {
  try {
    return validateExtensions({ value })["value"];
  } catch {
    try {
      return { evidenceFormat: "canonical-v1", value: stableSerialize(value) };
    } catch {
      return { evidenceFormat: "unsupported-v1", valueType: typeof value };
    }
  }
}

function unsupportedProblemExtensions(reason: string): Record<string, unknown> {
  return {
    unsupportedEvidence: {
      evidenceFormat: "unsupported-extensions-v1",
      reason,
    },
  };
}

class ContractExecutionProblem extends Problem {
  constructor(detail: string) {
    super("testing/contract-execution-failed", ProblemCategory.InternalServerError, detail);
  }
}

export function createContractCaseArbitrary(
  route: ContractGraphRoute,
): fc.Arbitrary<ContractGeneratedCase> {
  const entries = inputSchemaEntries(route);
  const validInput = createInputArbitrary(entries);
  const invalidInput = createInvalidInputArbitrary(entries, validInput);
  const canary = fc.uuid().map((value) => `croco-canary-${value}`);

  return fc
    .oneof(
      fc.tuple(validInput, canary).map(([input, canarySecret]) => ({
        input,
        kind: "valid" as const,
        canarySecret,
      })),
      fc.tuple(invalidInput, canary).map(([input, canarySecret]) => ({
        input,
        kind: "invalid" as const,
        canarySecret,
      })),
    )
    .map((testCase) => injectCanaryHeader(route, testCase));
}

export async function runContractFuzz(
  options: RunContractFuzzOptions,
): Promise<ContractFuzzReport> {
  const profile = options.profile ?? "pr";
  const profileConfiguration = CONTRACT_TEST_PROFILES[profile];
  const replay = resolveReplayConfiguration(options);
  const seed = replay.seed ?? options.seed ?? profileConfiguration.seed;
  const numRuns = options.numRuns ?? profileConfiguration.numRuns;
  if (!Number.isSafeInteger(numRuns) || numRuns <= 0) {
    throw new ContractInvariantProblem("Contract fuzz numRuns must be a positive safe integer.", {
      numRuns,
    });
  }
  if (numRuns > profileConfiguration.numRuns) {
    throw new ContractInvariantProblem(
      `Contract fuzz numRuns ${numRuns} exceeds profile '${profile}' maximum ${profileConfiguration.numRuns}.`,
      { numRuns, profile, maximum: profileConfiguration.numRuns },
    );
  }
  const path = replay.path ?? options.path;
  let observedFailure: unknown;

  const parameters: fc.Parameters<[ContractGeneratedCase]> = {
    seed,
    numRuns,
    endOnFailure: false,
    ...(path === undefined ? {} : { path }),
  };
  const result = await fc.check(
    fc.asyncProperty(
      options.arbitrary ?? createContractCaseArbitrary(options.route),
      async (testCase) => {
        try {
          assertGeneratedCaseClassification(options.route, testCase);
          const observation = await options.execute(testCase);
          assertContractObservation(options.route, testCase, observation);
          return true;
        } catch (error) {
          observedFailure = error;
          return false;
        }
      },
    ),
    parameters,
  );

  if (result.failed) {
    const minimalInput = result.counterexample?.[0];
    if (!minimalInput) {
      throw new ContractInvariantProblem("fast-check failed without a counterexample.");
    }
    assertJsonSafeLossless(minimalInput, "minimal counterexample");
    let minimalFailure: unknown;
    try {
      assertGeneratedCaseClassification(options.route, minimalInput);
      assertContractObservation(options.route, minimalInput, await options.execute(minimalInput));
    } catch (error) {
      minimalFailure = error;
    }
    if (!minimalFailure) {
      throw new ContractInvariantProblem(
        "The shrunk counterexample no longer reproduces the contract failure.",
        {
          initialFailure:
            observedFailure instanceof Error ? observedFailure.message : String(observedFailure),
        },
      );
    }
    const artifact = createFailureArtifact(
      options.route,
      options.runtime,
      result.seed,
      result.counterexamplePath ?? "",
      minimalInput,
      minimalFailure,
      options.replayCommand,
    );
    await (options.failureSink ?? createFileContractFailureSink(options.failureDirectory)).persist(
      artifact,
    );
    throw new ContractInvariantProblem(artifact.error.message, { artifact });
  }

  return {
    status: "passed",
    profile,
    numRuns,
    seed: result.seed,
    runtime: options.runtime,
    routeId: options.route.routeId,
  };
}

export function assertContractObservation(
  route: ContractGraphRoute,
  testCase: ContractGeneratedCase,
  observation: ContractExecutionObservation,
): "success" | "problem" {
  assertCanaryAbsent(testCase.canarySecret, observation);

  if (observation.status >= 200 && observation.status < 300) {
    if (testCase.kind === "invalid") {
      throw new ContractInvariantProblem(
        `Schema-invalid input for route '${route.routeId}' returned a successful response.`,
      );
    }
    const successStatus = route.successStatus ?? 200;
    if (observation.status !== successStatus) {
      throw new ContractInvariantProblem(
        `Route '${route.routeId}' returned undocumented success status ${observation.status}; its output-schema contract declares status ${successStatus}.`,
      );
    }
    const parsed = route.outputSchema?.safeParse(observation.body);
    if (!route.outputSchema || !parsed?.success) {
      throw new ContractInvariantProblem(
        `Route '${route.routeId}' returned status ${observation.status} with a body outside its success schema.`,
      );
    }
    return "success";
  }

  let problem: ReturnType<typeof ProblemSerializer.fromJson>;
  try {
    problem = ProblemSerializer.fromJson(observation.body);
  } catch (error) {
    const malformed500 = testCase.kind === "invalid" && observation.status === 500;
    throw new ContractInvariantProblem(
      malformed500
        ? `Malformed input for route '${route.routeId}' became an undocumented raw 500.`
        : `Route '${route.routeId}' returned an invalid Problem response with status ${observation.status}.`,
      { parseError: error instanceof Error ? error.message : String(error) },
    );
  }
  if (problem.status !== observation.status) {
    throw new ContractInvariantProblem(
      `Problem '${problem.code}' declares status ${problem.status}, but the response used ${observation.status}.`,
    );
  }
  const declared = route.problemResponses?.some(
    ({ code, status }) => code === problem.code && status === observation.status,
  );
  if (!declared) {
    throw new ContractInvariantProblem(
      `Route '${route.routeId}' returned undocumented Problem '${problem.code}' with status ${observation.status}.`,
    );
  }
  return "problem";
}

export async function runContractRuntimeDifferential(
  options: ContractRuntimeDifferentialOptions,
): Promise<ContractRuntimeDifferentialReport> {
  if (options.targets.length < 2) {
    throw new ContractRuntimeMismatchProblem(
      "Runtime differential testing requires at least two targets.",
    );
  }
  const runtimeNames = new Set<string>();
  for (const target of options.targets) {
    if (runtimeNames.has(target.runtime)) {
      throw new ContractRuntimeMismatchProblem(
        `Runtime differential target '${target.runtime}' is declared more than once.`,
      );
    }
    runtimeNames.add(target.runtime);
  }
  const observations: Record<string, ContractExecutionObservation> = {};
  const kinds: Record<string, "success" | "problem"> = {};
  const lifecycleOutcomes: Record<
    string,
    Readonly<Record<ContractRuntimeLifecycleCapability, ContractLifecycleOutcome>>
  > = {};
  for (const target of options.targets) {
    if (target.capabilities.platform !== target.runtime) {
      throw new ContractRuntimeMismatchProblem(
        `Runtime target '${target.runtime}' supplied capability manifest for '${target.capabilities.platform}'.`,
      );
    }
    const observation = await target.execute(options.testCase);
    lifecycleOutcomes[target.runtime] = normalizeLifecycleOutcomes(target, observation);
    if (observation.tracePropagation === undefined) {
      throw new ContractRuntimeMismatchProblem(
        `Runtime '${target.runtime}' is missing its trace propagation observation.`,
      );
    }
    observations[target.runtime] = observation;
    kinds[target.runtime] = assertContractObservation(options.route, options.testCase, observation);
  }

  const baseline = options.targets[0];
  if (!baseline) {
    throw new ContractRuntimeMismatchProblem(
      "Runtime differential testing has no baseline target.",
    );
  }
  const baselineObservation = observations[baseline.runtime];
  if (!baselineObservation) {
    throw new ContractRuntimeMismatchProblem(
      "Runtime differential baseline did not produce an observation.",
    );
  }
  const allowed = new Set<RuntimeCapabilityName>();
  for (const target of options.targets.slice(1)) {
    const observation = observations[target.runtime];
    if (!observation) {
      throw new ContractRuntimeMismatchProblem(
        `Runtime '${target.runtime}' did not produce an observation.`,
      );
    }
    assertEqual(
      "status",
      baseline.runtime,
      target.runtime,
      baselineObservation.status,
      observation.status,
    );
    assertEqual(
      "response schema",
      baseline.runtime,
      target.runtime,
      kinds[baseline.runtime],
      kinds[target.runtime],
    );
    if (kinds[baseline.runtime] === "problem" && kinds[target.runtime] === "problem") {
      assertEqual(
        "Problem code",
        baseline.runtime,
        target.runtime,
        problemCode(baselineObservation.body),
        problemCode(observation.body),
      );
    }
    for (const header of new Set(["content-type", ...(options.stableHeaders ?? [])])) {
      const baselineHeader = readHeader(baselineObservation.headers, header);
      const targetHeader = readHeader(observation.headers, header);
      assertEqual(
        `stable header '${header}'`,
        baseline.runtime,
        target.runtime,
        baselineHeader,
        targetHeader,
      );
    }
    assertEqual(
      "trace propagation",
      baseline.runtime,
      target.runtime,
      baselineObservation.tracePropagation,
      observation.tracePropagation,
    );
  }
  for (let leftIndex = 0; leftIndex < options.targets.length; leftIndex += 1) {
    const left = options.targets[leftIndex];
    if (!left) {
      throw new ContractRuntimeMismatchProblem(
        `Runtime differential target at index ${leftIndex} is missing.`,
      );
    }
    const leftObservation = observations[left.runtime];
    if (!leftObservation) {
      throw new ContractRuntimeMismatchProblem(
        `Runtime '${left.runtime}' did not produce an observation.`,
      );
    }
    for (let rightIndex = leftIndex + 1; rightIndex < options.targets.length; rightIndex += 1) {
      const right = options.targets[rightIndex];
      if (!right) {
        throw new ContractRuntimeMismatchProblem(
          `Runtime differential target at index ${rightIndex} is missing.`,
        );
      }
      const rightObservation = observations[right.runtime];
      if (!rightObservation) {
        throw new ContractRuntimeMismatchProblem(
          `Runtime '${right.runtime}' did not produce an observation.`,
        );
      }
      const leftLifecycle = lifecycleOutcomes[left.runtime];
      const rightLifecycle = lifecycleOutcomes[right.runtime];
      if (!leftLifecycle || !rightLifecycle) {
        throw new ContractRuntimeMismatchProblem(
          "Runtime lifecycle normalization did not produce a complete differential corpus.",
        );
      }
      compareLifecycle(
        left,
        right,
        leftObservation,
        rightObservation,
        leftLifecycle,
        rightLifecycle,
        allowed,
      );
    }
  }

  return { status: "passed", observations, allowedLifecycleDifferences: [...allowed].sort() };
}

export function createFileContractFailureSink(
  directory = ".croco/contract-failures",
): ContractFailureSink {
  return {
    async persist(artifact) {
      await mkdir(directory, { recursive: true });
      const filename = `${sanitize(artifact.routeId)}-${sanitize(artifact.runtime)}-${artifact.seed}.json`;
      await writeFile(join(directory, filename), `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
    },
  };
}

function createFailureArtifact(
  route: ContractGraphRoute,
  runtime: string,
  seed: number,
  counterexamplePath: string,
  minimalInput: ContractGeneratedCase,
  error: unknown,
  replayCommand = "pnpm test",
): ContractFailureArtifact {
  const message = error instanceof Error ? error.message : String(error);
  const problemCode =
    error instanceof Problem ? error.code : new ContractExecutionProblem(message).code;
  return {
    schemaVersion: "croco.contract-test-failure.v1",
    routeId: route.routeId,
    runtime,
    seed,
    counterexamplePath,
    minimalInput,
    replayCommand: `CROCO_CONTRACT_ROUTE=${shellQuote(route.routeId)} CROCO_CONTRACT_SEED=${seed} CROCO_CONTRACT_PATH=${shellQuote(counterexamplePath)} CROCO_CONTRACT_RUNTIME=${shellQuote(runtime)} ${replayCommand}`,
    error: { code: problemCode, message },
  };
}

function inputSchemaEntries(
  route: ContractGraphRoute,
): readonly [ContractSchemaInputKey, z.ZodType][] {
  return (["body", "path", "query", "headers"] as const).flatMap((key) => {
    const schema = route.inputSchemas[key];
    return schema ? [[key, schema] as const] : [];
  });
}

function createInputArbitrary(
  entries: readonly [ContractSchemaInputKey, z.ZodType][],
): fc.Arbitrary<ContractRequestInput> {
  const arbitraries = Object.fromEntries(
    entries.map(([key, schema]) => [key, arbitraryForSchema(schema, `input.${key}`)]),
  ) as Record<string, fc.Arbitrary<unknown>>;
  return fc.record(arbitraries) as fc.Arbitrary<ContractRequestInput>;
}

function createInvalidInputArbitrary(
  entries: readonly [ContractSchemaInputKey, z.ZodType][],
  validInput: fc.Arbitrary<ContractRequestInput>,
): fc.Arbitrary<ContractRequestInput> {
  if (entries.length === 0) {
    throw new UnsupportedContractGenerationProblem("input", "a route without input schemas");
  }
  const mutations = entries.flatMap(([key, schema]) => {
    const invalidGroup = invalidInputGroupValueArbitrary(key, schema);
    return invalidGroup
      ? [fc.tuple(validInput, invalidGroup).map(([input, value]) => ({ ...input, [key]: value }))]
      : [];
  });
  if (mutations.length === 0) {
    throw new UnsupportedContractGenerationProblem(
      "input",
      "schemas accepting every transport-representable invalid sentinel",
    );
  }
  return fc.oneof(...mutations);
}

function invalidInputGroupValueArbitrary(
  key: ContractSchemaInputKey,
  schema: z.ZodType,
): fc.Arbitrary<unknown> | undefined {
  if (key === "body") return invalidValueForSchema(schema);
  const typeName = (schema._def as { readonly typeName?: z.ZodFirstPartyTypeKind }).typeName;
  if (typeName !== z.ZodFirstPartyTypeKind.ZodObject) {
    throw new UnsupportedContractGenerationProblem(
      `input.${key}`,
      "a non-object transport input schema",
    );
  }
  const fields = Object.entries(getZodObjectShape(schema)) as [string, z.ZodType][];
  if (fields.length === 0) {
    throw new UnsupportedContractGenerationProblem(
      `input.${key}`,
      "an object transport input schema without fields",
    );
  }
  const invalidFields = fields.flatMap(([field, fieldSchema]) => {
    const invalidField = invalidTransportValueForSchema(key, fieldSchema);
    return invalidField
      ? [
          fc
            .tuple(arbitraryForSchema(schema, `input.${key}`), invalidField)
            .map(([value, invalidValue]) => ({
              ...(value as Record<string, unknown>),
              [field]: invalidValue,
            })),
        ]
      : [];
  });
  return invalidFields.length > 0 ? fc.oneof(...invalidFields) : undefined;
}

function injectCanaryHeader(
  route: ContractGraphRoute,
  testCase: ContractGeneratedCase,
): ContractGeneratedCase {
  const currentHeaders = testCase.input.headers;
  const headers =
    typeof currentHeaders === "object" && currentHeaders !== null && !Array.isArray(currentHeaders)
      ? (currentHeaders as Record<string, unknown>)
      : currentHeaders === undefined
        ? {}
        : { "x-croco-original-headers": currentHeaders };
  const mergedHeaders = { ...headers, "x-croco-fuzz-canary": testCase.canarySecret };
  const mergedInput = { ...testCase.input, headers: mergedHeaders };
  assertGeneratedCaseClassification(route, testCase);
  const expectedValidity = testCase.kind === "valid";
  const preserveClassification = isContractInputValid(route, mergedInput) === expectedValidity;
  return {
    ...testCase,
    input: {
      ...testCase.input,
      ...(preserveClassification ? { headers: mergedHeaders } : {}),
      transportHeaders: { "x-croco-fuzz-canary": testCase.canarySecret },
    },
  };
}

function assertGeneratedCaseClassification(
  route: ContractGraphRoute,
  testCase: ContractGeneratedCase,
): void {
  const expectedValidity = testCase.kind === "valid";
  if (isContractInputValid(route, testCase.input) !== expectedValidity) {
    throw new ContractInvariantProblem(
      `Generated ${testCase.kind} case for route '${route.routeId}' has the opposite schema classification.`,
    );
  }
}

function isContractInputValid(route: ContractGraphRoute, input: ContractRequestInput): boolean {
  return inputSchemaEntries(route).every(([key, schema]) => schema.safeParse(input[key]).success);
}

function arbitraryForSchema(schema: z.ZodType, path: string): fc.Arbitrary<unknown> {
  const definition = schema._def as { typeName?: string; [key: string]: unknown };
  switch (definition.typeName) {
    case z.ZodFirstPartyTypeKind.ZodString:
      return stringArbitrary(schema as z.ZodString, path);
    case z.ZodFirstPartyTypeKind.ZodNumber:
      return numberArbitrary(schema as z.ZodNumber, path);
    case z.ZodFirstPartyTypeKind.ZodBoolean:
      return fc.boolean();
    case z.ZodFirstPartyTypeKind.ZodLiteral:
      return fc.constant(readJsonLiteral(schema as z.ZodLiteral<unknown>, path));
    case z.ZodFirstPartyTypeKind.ZodEnum:
      return fc.constantFrom(...(schema as z.ZodEnum<[string, ...string[]]>)._def.values);
    case z.ZodFirstPartyTypeKind.ZodNativeEnum: {
      const values = [
        ...new Set(Object.values((schema as z.ZodNativeEnum<z.EnumLike>)._def.values)),
      ].filter(
        (value): value is string | number =>
          (typeof value === "string" || typeof value === "number") &&
          schema.safeParse(value).success,
      );
      if (values.length === 0) {
        throw new UnsupportedContractGenerationProblem(path, "an empty ZodNativeEnum");
      }
      return fc.constantFrom(...values);
    }
    case z.ZodFirstPartyTypeKind.ZodObject: {
      const shape = (schema as z.AnyZodObject).shape as Record<string, z.ZodType>;
      const requiredKeys = Object.entries(shape)
        .filter(([, child]) => !child.isOptional())
        .map(([key]) => key);
      return fc.record(
        Object.fromEntries(
          Object.entries(shape).map(([key, child]) => [
            key,
            arbitraryForSchema(child, `${path}.${key}`),
          ]),
        ),
        { requiredKeys, noNullPrototype: true },
      );
    }
    case z.ZodFirstPartyTypeKind.ZodArray: {
      const array = schema as z.ZodArray<z.ZodType>;
      const minimum = array._def.minLength?.value ?? 0;
      const maximum = array._def.maxLength?.value ?? Math.max(minimum, 5);
      if (minimum > maximum) {
        throw new UnsupportedContractGenerationProblem(
          path,
          `an impossible ZodArray length range (${minimum}..${maximum})`,
        );
      }
      return fc.array(arbitraryForSchema(array.element, `${path}[]`), {
        minLength: minimum,
        maxLength: maximum,
      });
    }
    case z.ZodFirstPartyTypeKind.ZodTuple:
      return fc.tuple(
        ...((schema as z.ZodTuple<[z.ZodType, ...z.ZodType[]]>)._def.items.map((item, index) =>
          arbitraryForSchema(item, `${path}[${index}]`),
        ) as [fc.Arbitrary<unknown>, ...fc.Arbitrary<unknown>[]]),
      );
    case z.ZodFirstPartyTypeKind.ZodUnion:
    case z.ZodFirstPartyTypeKind.ZodDiscriminatedUnion: {
      const options = Array.from((definition["options"] as Iterable<z.ZodType>) ?? []);
      if (options.length === 0) {
        throw new UnsupportedContractGenerationProblem(path, "a union without options");
      }
      return fc.oneof(
        ...options.map((option, index) => arbitraryForSchema(option, `${path}|${index}`)),
      );
    }
    case z.ZodFirstPartyTypeKind.ZodOptional:
      return arbitraryForSchema((schema as z.ZodOptional<z.ZodType>).unwrap(), path);
    case z.ZodFirstPartyTypeKind.ZodNullable:
      return fc.option(arbitraryForSchema((schema as z.ZodNullable<z.ZodType>).unwrap(), path), {
        nil: null,
      });
    case z.ZodFirstPartyTypeKind.ZodDefault:
      return arbitraryForSchema((schema as z.ZodDefault<z.ZodType>)._def.innerType, path);
    default:
      throw new UnsupportedContractGenerationProblem(
        path,
        definition.typeName ?? schema.constructor.name,
      );
  }
}

function stringArbitrary(schema: z.ZodString, path: string): fc.Arbitrary<string> {
  let minLength = 0;
  let explicitMaxLength: number | undefined;
  for (const check of schema._def.checks) {
    if (check.kind === "min") minLength = Math.max(minLength, check.value);
    else if (check.kind === "max") {
      explicitMaxLength = Math.min(explicitMaxLength ?? check.value, check.value);
    } else throw new UnsupportedContractGenerationProblem(path, `ZodString.${check.kind}`);
  }
  const maxLength = explicitMaxLength ?? Math.max(minLength, 32);
  if (minLength > maxLength) {
    throw new UnsupportedContractGenerationProblem(
      path,
      `an impossible ZodString length range (${minLength}..${maxLength})`,
    );
  }
  return fc.string({ minLength, maxLength }).filter((value) => schema.safeParse(value).success);
}

function numberArbitrary(schema: z.ZodNumber, path: string): fc.Arbitrary<number> {
  let explicitMinimum: number | undefined;
  let explicitMaximum: number | undefined;
  let integer = false;
  for (const check of schema._def.checks) {
    if (check.kind === "min" && check.inclusive) {
      explicitMinimum = Math.max(explicitMinimum ?? check.value, check.value);
    } else if (check.kind === "max" && check.inclusive) {
      explicitMaximum = Math.min(explicitMaximum ?? check.value, check.value);
    } else if (check.kind === "min") {
      throw new UnsupportedContractGenerationProblem(path, "ZodNumber.gt");
    } else if (check.kind === "max") {
      throw new UnsupportedContractGenerationProblem(path, "ZodNumber.lt");
    } else if (check.kind === "int") integer = true;
    else throw new UnsupportedContractGenerationProblem(path, `ZodNumber.${check.kind}`);
  }
  const minimum = explicitMinimum ?? Math.min(explicitMaximum ?? 0, -1_000);
  const maximum = explicitMaximum ?? Math.max(explicitMinimum ?? 0, 1_000);
  const generatedMinimum = integer ? Math.ceil(minimum) : minimum;
  const generatedMaximum = integer ? Math.floor(maximum) : maximum;
  if (generatedMinimum > generatedMaximum) {
    throw new UnsupportedContractGenerationProblem(
      path,
      `an impossible ZodNumber range (${minimum}..${maximum})`,
    );
  }
  const arbitrary = integer
    ? fc.integer({ min: generatedMinimum, max: generatedMaximum })
    : fc.double({
        min: generatedMinimum,
        max: generatedMaximum,
        noNaN: true,
        noDefaultInfinity: true,
      });
  return arbitrary.filter((value) => !Object.is(value, -0) && schema.safeParse(value).success);
}

function invalidValueForSchema(schema: z.ZodType): fc.Arbitrary<unknown> {
  return fc
    .jsonValue({ maxDepth: 2 })
    .filter((candidate) => isJsonSafeLossless(candidate) && !schema.safeParse(candidate).success);
}

function invalidTransportValueForSchema(
  key: Exclude<ContractSchemaInputKey, "body">,
  schema: z.ZodType,
): fc.Arbitrary<unknown> | undefined {
  const sentinels: readonly unknown[] = [
    "",
    "__croco_invalid__",
    0,
    false,
    null,
    [],
    ["__croco_invalid__"],
  ];
  const invalidSentinels = sentinels.filter(
    (candidate) =>
      !schema.safeParse(candidate).success &&
      !schema.safeParse(normalizeTransportValue(key, schema, candidate)).success,
  );
  return invalidSentinels.length > 0 ? fc.constantFrom(...invalidSentinels) : undefined;
}

function encodeTransportValue(
  key: Exclude<ContractSchemaInputKey, "body">,
  value: unknown,
): unknown {
  if (key !== "query") return String(value);
  if (value === null || value === undefined) return undefined;
  if (!Array.isArray(value)) return String(value);
  const encoded = value
    .filter((entry) => entry !== null && entry !== undefined)
    .map((entry) => String(entry));
  if (encoded.length === 0) return undefined;
  return encoded.length === 1 ? encoded[0] : encoded;
}

function normalizeTransportValue(
  key: Exclude<ContractSchemaInputKey, "body">,
  schema: z.ZodType,
  value: unknown,
): unknown {
  const encoded = encodeTransportValue(key, value);
  if (typeof encoded !== "string" || !isZodArraySchema(schema)) return encoded;
  if (key === "query") return [encoded];
  if (key === "headers") return encoded.split(",").map((item) => item.trim());
  return encoded;
}

function assertCanaryAbsent(secret: string, observation: ContractExecutionObservation): void {
  const surfaces = {
    response: observation.body,
    headers: observation.headers,
    logs: observation.logs,
    spans: observation.spans,
    serialized: observation.serialized,
  };
  for (const [surface, value] of Object.entries(surfaces)) {
    if (containsSecret(value, secret)) {
      throw new ContractInvariantProblem(
        `Canary secret was reflected in ${surface} observations.`,
        { surface },
      );
    }
  }
}

function containsSecret(value: unknown, secret: string, seen = new Set<object>()): boolean {
  if (typeof value === "string") return value.includes(secret);
  if (typeof value === "symbol") return value.description?.includes(secret) ?? false;
  if ((typeof value !== "object" || value === null) && typeof value !== "function") return false;
  if (seen.has(value)) return false;
  seen.add(value);

  if (value instanceof RegExp && value.source.includes(secret)) return true;
  if (value instanceof URL && value.href.includes(secret)) return true;
  if (value instanceof Map) {
    for (const [key, entry] of value) {
      if (containsSecret(key, secret, seen) || containsSecret(entry, secret, seen)) return true;
    }
  }
  if (value instanceof Set) {
    for (const entry of value) {
      if (containsSecret(entry, secret, seen)) return true;
    }
  }

  for (const key of Reflect.ownKeys(value)) {
    if (
      (typeof key === "string" && key.includes(secret)) ||
      (typeof key === "symbol" && (key.description?.includes(secret) ?? false))
    ) {
      return true;
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor && "value" in descriptor && containsSecret(descriptor.value, secret, seen)) {
      return true;
    }
  }
  return false;
}

function isProblemBody(
  value: unknown,
): value is { readonly code: string; readonly status: number } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof Reflect.get(value, "code") === "string" &&
    typeof Reflect.get(value, "status") === "number"
  );
}

function problemCode(value: unknown): string | undefined {
  return isProblemBody(value) ? value.code : undefined;
}

function compareLifecycle(
  baseline: ContractRuntimeTarget,
  target: ContractRuntimeTarget,
  baselineObservation: ContractExecutionObservation,
  observation: ContractExecutionObservation,
  baselineLifecycle: Readonly<Record<ContractRuntimeLifecycleCapability, ContractLifecycleOutcome>>,
  lifecycle: Readonly<Record<ContractRuntimeLifecycleCapability, ContractLifecycleOutcome>>,
  allowed: Set<RuntimeCapabilityName>,
): void {
  for (const capability of CONTRACT_RUNTIME_LIFECYCLE_CAPABILITIES) {
    const left = baselineObservation.lifecycle?.[capability];
    const right = observation.lifecycle?.[capability];
    if (!left || !right) {
      throw new ContractRuntimeMismatchProblem(
        `Runtime lifecycle observation for '${capability}' is missing from the differential corpus.`,
      );
    }
    const supportDiffers =
      baseline.capabilities.capabilities[capability] !==
      target.capabilities.capabilities[capability];
    if (
      supportDiffers &&
      stableSerialize(lifecycleOutcomeEvidence(baselineLifecycle[capability])) ===
        stableSerialize(lifecycleOutcomeEvidence(lifecycle[capability]))
    ) {
      throw new ContractRuntimeMismatchProblem(
        `Lifecycle '${capability}' reported an equal outcome between '${baseline.runtime}' and '${target.runtime}' despite opposite manifest support.`,
        {
          capability,
          baselineOutcome: stableSerialize(left),
          actualOutcome: stableSerialize(right),
        },
      );
    }
    if (stableSerialize(baselineLifecycle[capability]) === stableSerialize(lifecycle[capability])) {
      continue;
    }
    if (supportDiffers) {
      allowed.add(capability);
      continue;
    }
    throw new ContractRuntimeMismatchProblem(
      `Undeclared lifecycle mismatch for '${capability}' between '${baseline.runtime}' and '${target.runtime}'.`,
      {
        capability,
        baselineOutcome: stableSerialize(left),
        actualOutcome: stableSerialize(right),
      },
    );
  }
}

function lifecycleOutcomeEvidence(outcome: ContractLifecycleOutcome): unknown {
  if (outcome.status === "succeeded") return outcome.value;
  if (outcome.status === "failed") return outcome.error;
  return outcome.reason;
}

function normalizeLifecycleOutcomes(
  target: ContractRuntimeTarget,
  observation: ContractExecutionObservation,
): Readonly<Record<ContractRuntimeLifecycleCapability, ContractLifecycleOutcome>> {
  const normalized = {} as Record<ContractRuntimeLifecycleCapability, ContractLifecycleOutcome>;
  for (const capability of CONTRACT_RUNTIME_LIFECYCLE_CAPABILITIES) {
    const lifecycle = observation.lifecycle?.[capability];
    if (!lifecycle) {
      throw new ContractRuntimeMismatchProblem(
        `Runtime '${target.runtime}' is missing lifecycle observation '${capability}'.`,
      );
    }
    const declaredSupport = target.capabilities.capabilities[capability];
    if (lifecycle.supported !== declaredSupport) {
      throw new ContractRuntimeMismatchProblem(
        `Runtime '${target.runtime}' reported lifecycle support '${capability}' as ${lifecycle.supported}, but its capability manifest declares ${declaredSupport}.`,
        { capability, declaredSupport, reportedSupport: lifecycle.supported },
      );
    }
    normalized[capability] = normalizeLifecycleOutcome(
      target.runtime,
      capability,
      declaredSupport,
      lifecycle.outcome,
    );
  }
  return normalized;
}

function normalizeLifecycleOutcome(
  runtime: string,
  capability: ContractRuntimeLifecycleCapability,
  supported: boolean,
  outcome: unknown,
): ContractLifecycleOutcome {
  if (!isNormalizedLifecycleOutcome(outcome)) {
    throw new ContractRuntimeMismatchProblem(
      `Runtime '${runtime}' reported a malformed lifecycle outcome for '${capability}'.`,
      { capability, outcome },
    );
  }
  if (outcome.status === "failed") {
    throw new ContractRuntimeMismatchProblem(
      `Runtime '${runtime}' reported lifecycle '${capability}' as failed.`,
      { capability, outcome: stableSerialize(outcome) },
    );
  }
  if (supported !== (outcome.status === "succeeded")) {
    throw new ContractRuntimeMismatchProblem(
      `Runtime '${runtime}' reported lifecycle outcome '${capability}' as '${outcome.status}', but its capability manifest declares support as ${supported}.`,
      { capability, outcome, supported },
    );
  }
  return outcome;
}

function isNormalizedLifecycleOutcome(value: unknown): value is ContractLifecycleOutcome {
  if (typeof value !== "object" || value === null) return false;
  const status = Reflect.get(value, "status");
  if (status === "succeeded") {
    return Object.prototype.hasOwnProperty.call(value, "value");
  }
  if (status === "failed") return Object.prototype.hasOwnProperty.call(value, "error");
  return status === "unsupported";
}

function assertEqual(
  label: string,
  baseline: string,
  runtime: string,
  left: unknown,
  right: unknown,
): void {
  const baselineCanonical = stableSerialize(left);
  const actualCanonical = stableSerialize(right);
  if (baselineCanonical !== actualCanonical) {
    throw new ContractRuntimeMismatchProblem(
      `Runtime '${runtime}' differs from '${baseline}' for ${label}.`,
      { baselineCanonical, actualCanonical, label },
    );
  }
}

function readHeader(
  headers: Readonly<Record<string, string>> | undefined,
  name: string,
): string | undefined {
  const normalized = name.toLowerCase();
  return Object.entries(headers ?? {}).find(([key]) => key.toLowerCase() === normalized)?.[1];
}

function stableSerialize(value: unknown): string {
  return serializeCanonical(value, { seen: new WeakMap<object, number>(), nextReference: 0 });
}

type CanonicalSerializationContext = {
  readonly seen: WeakMap<object, number>;
  nextReference: number;
};

function serializeCanonical(value: unknown, context: CanonicalSerializationContext): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return `string:${JSON.stringify(value)}`;
  if (typeof value === "boolean") return `boolean:${value}`;
  if (typeof value === "number") {
    if (Number.isNaN(value)) return "number:NaN";
    if (value === Number.POSITIVE_INFINITY) return "number:+Infinity";
    if (value === Number.NEGATIVE_INFINITY) return "number:-Infinity";
    if (Object.is(value, -0)) return "number:-0";
    return `number:${value}`;
  }
  if (typeof value === "bigint") return `bigint:${value}`;
  if (typeof value === "symbol" || typeof value === "function") {
    throw new ContractInvariantProblem(
      `Canonical contract comparison does not support ${typeof value} values.`,
      { valueType: typeof value },
    );
  }

  const existingReference = context.seen.get(value);
  if (existingReference !== undefined) return `reference:${existingReference}`;
  const reference = context.nextReference;
  context.nextReference += 1;
  context.seen.set(value, reference);

  if (value instanceof Date) {
    const timestamp = value.getTime();
    return `date:${reference}:${Number.isNaN(timestamp) ? "invalid" : value.toISOString()}`;
  }
  if (value instanceof RegExp) {
    return `regexp:${reference}:${JSON.stringify(value.source)}:${value.flags}:${value.lastIndex}`;
  }
  if (value instanceof URL) {
    return `url:${reference}:${JSON.stringify(value.href)}`;
  }
  if (value instanceof Error) {
    const inheritedName = Object.prototype.hasOwnProperty.call(value, "name")
      ? ""
      : `:name:${JSON.stringify(value.name)}`;
    return `error:${reference}${inheritedName}:${serializeOwnProperties(value, context, true)}`;
  }
  if (value instanceof Map) {
    return `map:${reference}:[${[...value.entries()]
      .map(
        ([key, entryValue]) =>
          `[${serializeCanonical(key, context)},${serializeCanonical(entryValue, context)}]`,
      )
      .join(",")}]`;
  }
  if (value instanceof Set) {
    return `set:${reference}:[${[...value]
      .map((entry) => serializeCanonical(entry, context))
      .join(",")}]`;
  }
  if (Array.isArray(value)) {
    return `array:${reference}:[${value
      .map((entry) => serializeCanonical(entry, context))
      .join(",")}]`;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    const tag = Object.prototype.toString.call(value);
    throw new ContractInvariantProblem(
      `Canonical contract comparison does not support object tag '${tag}'.`,
      { tag },
    );
  }
  return `object:${reference}:${serializeOwnProperties(value, context)}`;
}

function serializeOwnProperties(
  value: object,
  context: CanonicalSerializationContext,
  allowLazyErrorStack = false,
): string {
  return `{${Reflect.ownKeys(value)
    .sort((left, right) => String(left).localeCompare(String(right)))
    .map((key) => {
      if (typeof key === "symbol") {
        throw new ContractInvariantProblem(
          "Canonical contract comparison does not support symbol property keys.",
        );
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      const encodedKey = `string:${JSON.stringify(key)}`;
      if (!descriptor) return `${encodedKey}:missing`;
      if (!("value" in descriptor)) {
        if (allowLazyErrorStack && key === "stack") {
          return `${encodedKey}:accessor:${descriptor.enumerable}:${descriptor.configurable}:${Boolean(descriptor.get)}:${Boolean(descriptor.set)}:${serializeCanonical(Reflect.get(value, key), context)}`;
        }
        throw new ContractInvariantProblem(
          `Canonical contract comparison does not support accessor property '${key}'.`,
          { property: key },
        );
      }
      return `${encodedKey}:data:${descriptor.enumerable}:${descriptor.configurable}:${descriptor.writable}:${serializeCanonical(descriptor.value, context)}`;
    })
    .join(",")}}`;
}

function sanitize(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function readJsonLiteral(
  schema: z.ZodLiteral<unknown>,
  path: string,
): string | number | boolean | null {
  const value = schema._def.value;
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value) && !Object.is(value, -0))
  ) {
    return value;
  }
  throw new UnsupportedContractGenerationProblem(path, "a non-JSON ZodLiteral");
}

function shellQuote(value: string): string {
  return `'${value.split("'").join(`'"'"'`)}'`;
}

function resolveReplayConfiguration(options: RunContractFuzzOptions): {
  readonly seed?: number;
  readonly path?: string;
} {
  const route = process.env["CROCO_CONTRACT_ROUTE"];
  const runtime = process.env["CROCO_CONTRACT_RUNTIME"];
  if (route !== options.route.routeId || runtime !== options.runtime) return {};

  const seedValue = process.env["CROCO_CONTRACT_SEED"];
  const path = process.env["CROCO_CONTRACT_PATH"];
  if (!seedValue || !/^-?\d+$/.test(seedValue)) {
    throw new ContractInvariantProblem("CROCO_CONTRACT_SEED must be a base-10 integer.");
  }
  const seed = Number(seedValue);
  if (!Number.isSafeInteger(seed)) {
    throw new ContractInvariantProblem("CROCO_CONTRACT_SEED must be a safe integer.");
  }
  if (!path || !/^\d+(?::\d+)*$/.test(path)) {
    throw new ContractInvariantProblem(
      "CROCO_CONTRACT_PATH must be a fast-check counterexample path.",
    );
  }
  return { seed, path };
}

function assertJsonSafeLossless(value: unknown, label: string): void {
  if (!isJsonSafeLossless(value)) {
    throw new ContractInvariantProblem(`${label} is not losslessly JSON serializable.`);
  }
}

function isJsonSafeLossless(value: unknown, ancestors = new Set<object>()): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value) && !Object.is(value, -0);
  if (typeof value !== "object") return false;
  if (ancestors.has(value)) return false;
  ancestors.add(value);
  if (Array.isArray(value)) {
    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== value.length + 1 ||
      keys.some((key) =>
        typeof key === "symbol" ? true : key !== "length" && !/^(0|[1-9]\d*)$/.test(key),
      )
    ) {
      return false;
    }
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        !descriptor ||
        !descriptor.enumerable ||
        !("value" in descriptor) ||
        !isJsonSafeLossless(descriptor.value, ancestors)
      ) {
        return false;
      }
    }
    ancestors.delete(value);
    return true;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === "symbol") return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      !descriptor ||
      !descriptor.enumerable ||
      !("value" in descriptor) ||
      !isJsonSafeLossless(descriptor.value, ancestors)
    ) {
      return false;
    }
  }
  ancestors.delete(value);
  return true;
}
