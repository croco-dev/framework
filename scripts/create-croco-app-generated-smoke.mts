import { spawnSync } from "node:child_process";
import {
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  readGeneratedTemplateSecretAllowlistsFromMetadata,
  scanGeneratedTemplateSecretText,
} from "../packages/create-croco-app/src/secret-placeholder-policy.ts";
import { SUPPORTED_CREATE_CROCO_APP_CHOICES } from "../packages/create-croco-app/src/supported-options.ts";
import { VERSIONS } from "../packages/create-croco-app/src/consts.ts";
import {
  classifySmokeCommandFailure,
  classifySmokeFailure,
  collectSmokeFailureArtifactFiles,
  copyGeneratedSmokeArtifacts,
  createSmokeRecoverySummary,
  extractSmokeCommandDiagnosticCodes,
  type GeneratedSmokeArtifact,
  type SmokeCaseArtifactBundle,
  type SmokeCaseRecoverySummary,
  type SmokeFailureClassification,
  toPosixPath,
} from "./create-croco-app-generated-smoke-report.mts";
import {
  createGeneratedSmokeMatrixAggregateReport,
  createGeneratedSmokeMatrixTierReport,
  renderGeneratedSmokeMatrixReport,
  REST_SPA_CONTRACT_SMOKE_CASE_NAME,
  selectGeneratedSmokeMatrixCases,
  withGeneratedSmokeMatrixMetadata,
  type AdvisorySmokeMetadata,
  type SmokeMatrixCaseFailureEvidence,
  type SmokeMatrixFailure,
  type SmokeMatrixTier,
} from "./create-croco-app-generated-smoke-matrix.mts";
import {
  createGeneratedSmokeJourneyReport,
  writeCanonicalGeneratedSmokeJourneyBundle,
} from "./create-croco-app-generated-smoke-journey-report.mts";
import {
  createWorkspacePackageIndex,
  type DependencyField,
  type ExternalCrocoRangeException,
  type PackageJson,
  resolveLocalCrocoPackagesForGeneratedProject,
  rewriteExternalCrocoRanges,
  type WorkspacePackage,
  writePnpmWorkspaceOverrides,
} from "./create-croco-app-generated-smoke-support.mts";

const DEFAULT_TENANT_MODEL = "org";
const GENERATED_NODE_VERSION = VERSIONS.node;
const GENERATED_NODE_ENGINE_RANGE = `>=${GENERATED_NODE_VERSION}`;
const GRAPHQL_CONTRACT_CHECK_LABEL = "GraphQL contract check";
const GRAPHQL_CONTRACT_SNAPSHOT_LABEL = "GraphQL contract snapshot";
const GRAPHQL_CONTRACT_SNAPSHOT_PATH = "graphql-contract.snapshot.json";
const GRAPHQL_STANDALONE_CONTRACT_PACKAGE_PATH = ["apps", "graphql-api"] as const;
const GRAPHQL_NEXTJS_CONTRACT_PACKAGE_PATH = ["apps", "web"] as const;
const GRAPHQL_RESOLVER_METADATA_DRIFT_CODES = [
  "graphql-resolver-guards-changed",
  "graphql-resolver-roles-changed",
  "graphql-resolver-interceptors-changed",
  "graphql-resolver-di-scope-changed",
  "graphql-resolver-problems-changed",
] as const;

type GraphQLContractSnapshotJson = {
  readonly snapshotVersion: "croco.graphql-contract.snapshot.v2";
  readonly sdl: string;
  readonly operationCount: number;
  readonly resolverCount: number;
  readonly operations: readonly GraphQLContractOperationJson[];
  readonly resolvers: readonly GraphQLContractResolverJson[];
  readonly diagnostics: readonly unknown[];
};

type GraphQLContractOperationJson = {
  readonly kind: "query" | "mutation" | "subscription";
  readonly name: string;
  readonly type: string;
  readonly args: readonly unknown[];
};

type GraphQLContractResolverJson = {
  readonly resolverName: string;
  readonly diScope: string | null;
  readonly methods: readonly GraphQLContractResolverMethodJson[];
};

type GraphQLContractResolverMethodJson = {
  readonly methodName: string;
  readonly guards: readonly string[];
  readonly interceptors: readonly string[];
  readonly roles: readonly string[];
  readonly problems: readonly GraphQLContractProblemJson[];
};

type GraphQLContractProblemJson = {
  readonly code: string;
  readonly category: string;
  readonly status: number;
};

type SmokeValidation = {
  readonly label: string;
  readonly readOnly?: boolean;
  readonly recovery?: string;
  readonly packagePath?: readonly string[];
  readonly args?: readonly string[];
  readonly paths?: readonly string[];
  readonly json?: {
    readonly path: string;
    readonly matches: Record<string, unknown>;
    readonly arrayMinLengths?: Readonly<Record<string, number>>;
  };
  readonly presentationProfile?: {
    readonly appPath: string;
    readonly runtimeProfileName: string;
  };
  readonly artifacts?: readonly string[];
  readonly env?: Readonly<Record<string, string>>;
  readonly expectFailure?: {
    readonly outputIncludes: readonly string[];
  };
};

type SmokeStepStatus = "pending" | "passed" | "failed";

type SmokeStepResult = {
  readonly label: string;
  readonly command?: string;
  readonly packagePath?: readonly string[];
  readonly paths?: readonly string[];
  readonly jsonPath?: string;
  artifacts: readonly GeneratedSmokeArtifact[];
  readonly expectFailure?: boolean;
  status: SmokeStepStatus;
  diagnosticCodes: readonly string[];
  error?: string;
};

type SmokeCase = {
  readonly name: string;
  readonly tier: SmokeMatrixTier;
  readonly advisory?: AdvisorySmokeMetadata;
  readonly args: readonly string[];
  readonly runtimeTarget: string;
  readonly matrixTargets: readonly string[];
  readonly validations: readonly SmokeValidation[];
};

type SmokeCaseResult = {
  readonly name: string;
  readonly tier: SmokeMatrixTier;
  readonly advisory?: AdvisorySmokeMetadata;
  readonly preset: string;
  readonly runtimeTarget: string;
  readonly matrixTargets: readonly string[];
  readonly args: readonly string[];
  readonly recovery: SmokeCaseRecoverySummary;
  status: SmokeStepStatus;
  steps: SmokeStepResult[];
  error?: string;
  artifactBundle?: SmokeCaseArtifactBundle;
  failureClassification?: SmokeFailureClassification;
};

type SmokeGateResult = {
  readonly label: string;
  readonly command: string;
  readonly tier: SmokeMatrixTier;
  status: SmokeStepStatus;
  error?: string;
};

type GeneratedSmokeReport = {
  readonly schemaVersion: "croco.generated-app-smoke/v2";
  readonly generatedAt: string;
  readonly filteredRun: boolean;
  readonly requestedCaseNames: readonly string[];
  readonly selectedTier?: SmokeMatrixTier;
  readonly release: {
    readonly blockingTier: "spine-blocking";
    status: SmokeStepStatus;
  };
  readonly tiers: readonly {
    readonly tier: SmokeMatrixTier;
    status: SmokeStepStatus;
  }[];
  status: SmokeStepStatus;
  failure?: string;
  failureTier?: SmokeMatrixTier;
  readonly matrix: {
    readonly coverage: ReturnType<typeof readSmokeCoverage>;
    readonly templateTargets: readonly TemplateMatrixTarget[];
    readonly templateExclusions: readonly TemplateMatrixExclusion[];
  };
  gates: SmokeGateResult[];
  cases: SmokeCaseResult[];
};

type TemplateMatrixTarget = {
  readonly template: string;
  readonly cases: readonly string[];
};

type TemplateMatrixExclusion = {
  readonly template: string;
  readonly reason: string;
};

type CommandRunResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly status: number | null;
  readonly signal: string | null;
  readonly outputTruncated: boolean;
  readonly diagnosticCodes: readonly string[];
};

type SmokeCommandOutputObserver = (label: string, result: CommandRunResult) => void;

class CommandExecutionError extends Error {
  readonly commandResult: CommandRunResult;

  constructor(message: string, commandResult: CommandRunResult, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.commandResult = commandResult;
  }
}

type RuntimeCapabilitySmokePlatform = "node" | "lambda" | "cloudflare-workers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, "..");
const cliPath = join(rootDir, "packages", "create-croco-app", "dist", "index.js");
const generatedAppTemplatesDir = join(rootDir, "packages", "create-croco-app", "templates");
const generatedSmokeReportDir = resolve(
  process.env.CROCO_GENERATED_SMOKE_REPORT_DIR ?? join(rootDir, "ci-reports", "generated-apps"),
);
const turboPath = join(rootDir, "node_modules", "turbo", "bin", "turbo");
const corepackCommand = process.platform === "win32" ? "corepack.cmd" : "corepack";
let smokeRoot: string | undefined;
const commandTimeoutMs = 600_000;
const commandCaptureMaxBytes = 64 * 1024 * 1024;
const commandCaptureHeadBytes = 1024 * 1024;
const smokeCaseOutputBuffers = new Map<
  string,
  { stdout: string[]; stderr: string[]; outputTruncated: boolean }
>();
const sourceFileExtensions = new Set([
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
]);
const securityValidationScanFileExtensions = new Set([
  ...sourceFileExtensions,
  ".json",
  ".toml",
  ".yaml",
  ".yml",
]);
const securityValidationScanFileNames = new Set([
  ".env",
  ".env.example",
  ".env.local",
  ".env.development",
  ".env.production",
]);
const securityValidationScanIgnoredDirectories = new Set([
  ".git",
  ".output",
  ".turbo",
  ".wrangler",
  "coverage",
  "dist",
  "node_modules",
]);
const unsafeSecurityValidationPatterns = [
  /securityValidation\s*:\s*["']off["']/,
  /unsafeSkipSecurityValidation\s*:\s*true/,
  /\bCROCO_HTTP_SECURITY_VALIDATION\s*=\s*["']?off\b/,
  /\bprocess\.env\.CROCO_HTTP_SECURITY_VALIDATION\b/,
];
const loadViteConfigScript = [
  'import { join } from "node:path";',
  'import { loadConfigFromFile } from "vite";',
  'const result = await loadConfigFromFile({ command: "build", mode: "production" }, join(process.cwd(), "vite.config.ts"));',
  'if (!result) throw new Error("vite.config.ts did not load");',
].join(" ");
const apiWorkerFetchSmokeScript = [
  "void (async () => {",
  'const workerModule = await import("../api-worker/src/index.ts");',
  "let worker = workerModule.default;",
  'while (worker && typeof worker === "object" && "default" in worker && !("fetch" in worker)) worker = worker.default;',
  "const fetchHandler = typeof worker === 'function' ? worker : worker && typeof worker.fetch === 'function' " +
    "? worker.fetch.bind(worker) : undefined;",
  'if (typeof fetchHandler !== "function") throw new Error("API worker default export must be a fetch handler or Worker object");',
  "const executionContext = { waitUntil: () => {}, passThroughOnException: () => {} };",
  'const response = await fetchHandler(new Request("http://localhost/health", { headers: { origin: "http://localhost:5173", "cf-connecting-ip": "203.0.113.10" } }), { WEB_ORIGIN: "http://localhost:5173" }, executionContext);',
  "const body = await response.json();",
  "if (response.status !== 200) throw new Error(`Expected /health status 200, received ${response.status}`);",
  'if (body.status !== "ok") throw new Error(`Expected /health body status ok, received ${JSON.stringify(body)}`);',
  "})();",
].join(" ");
const graphqlProtectedRouteSmokeBaseScriptLines = [
  "void (async () => {",
  'await import("reflect-metadata");',
  'const { graphql } = await import("graphql");',
  "const previousGraphqlAuthToken = process.env.GRAPHQL_AUTH_TOKEN;",
  "const previousTelemetryEnabled = process.env.TELEMETRY_ENABLED;",
  'process.env.GRAPHQL_AUTH_TOKEN = "generated-smoke-token";',
  'process.env.TELEMETRY_ENABLED = "false";',
  "try {",
  'let schemaModule = await import("./src/schema.ts");',
  'while (schemaModule && typeof schemaModule === "object" && "default" in schemaModule && !("createSchema" in schemaModule)) {',
  "  schemaModule = schemaModule.default;",
  "}",
  'const schemaModuleKeys = schemaModule && typeof schemaModule === "object" ? Object.keys(schemaModule).join(",") : typeof schemaModule;',
  'const createSchema = schemaModule && typeof schemaModule === "object" ? schemaModule.createSchema : undefined;',
  'const createGraphQLContext = schemaModule && typeof schemaModule === "object" ? schemaModule.createGraphQLContext : undefined;',
  'if (typeof createSchema !== "function") {',
  "  throw new Error(`GraphQL schema module must export createSchema; keys=${schemaModuleKeys}`);",
  "}",
  'if (typeof createGraphQLContext !== "function") {',
  "  throw new Error(`GraphQL schema module must export createGraphQLContext; keys=${schemaModuleKeys}`);",
  "}",
  "const schema = await createSchema();",
  'const query = "{ protectedHealth }";',
  'const expectedAuthFailureCode = "protocols-graphql/auth-missing-header";',
  "const denied = await graphql({ schema, source: query, contextValue: createGraphQLContext() });",
  'if (!denied.errors?.length) throw new Error("Expected protectedHealth to reject missing credentials");',
  "const deniedAuthCode = denied.errors[0]?.extensions?.code ?? denied.errors[0]?.originalError?.code;",
  'if (deniedAuthCode !== expectedAuthFailureCode) throw new Error(`Expected protectedHealth to reject with ${expectedAuthFailureCode}, received ${deniedAuthCode}: ${denied.errors.map((error) => error.message).join("; ")}`);',
  "const allowed = await graphql({",
  "  schema,",
  "  source: query,",
  '  contextValue: createGraphQLContext({ authorization: "Bearer generated-smoke-token" }),',
  "});",
  'if (allowed.errors?.length) throw new Error(`Expected protectedHealth to allow valid credentials: ${allowed.errors.map((error) => error.message).join("; ")}`);',
  'if (allowed.data?.protectedHealth !== "authenticated") throw new Error(`Unexpected protectedHealth response: ${JSON.stringify(allowed.data)}`);',
];
const graphqlProtectedRouteSmokeCleanupScriptLines = [
  "} finally {",
  "  if (previousGraphqlAuthToken === undefined) {",
  "    delete process.env.GRAPHQL_AUTH_TOKEN;",
  "  } else {",
  "    process.env.GRAPHQL_AUTH_TOKEN = previousGraphqlAuthToken;",
  "  }",
  "  if (previousTelemetryEnabled === undefined) {",
  "    delete process.env.TELEMETRY_ENABLED;",
  "  } else {",
  "    process.env.TELEMETRY_ENABLED = previousTelemetryEnabled;",
  "  }",
  "}",
  "})();",
];
const graphqlStandaloneProtectedRouteSmokeScript = [
  ...graphqlProtectedRouteSmokeBaseScriptLines,
  ...graphqlProtectedRouteSmokeCleanupScriptLines,
].join(" ");
const graphqlLambdaProtectedRouteSmokeScript = [
  ...graphqlProtectedRouteSmokeBaseScriptLines,
  'let handlerModule = await import("./src/handler.ts");',
  'while (handlerModule && typeof handlerModule === "object" && "default" in handlerModule && !("handler" in handlerModule)) {',
  "  handlerModule = handlerModule.default;",
  "}",
  'const handlerModuleKeys = handlerModule && typeof handlerModule === "object" ? Object.keys(handlerModule).join(",") : typeof handlerModule;',
  'const handler = handlerModule && typeof handlerModule === "object" ? handlerModule.handler : undefined;',
  'if (typeof handler !== "function") throw new Error(`GraphQL Lambda handler module must export handler; keys=${handlerModuleKeys}`);',
  "function createLambdaEvent(headers) {",
  "  return {",
  '    version: "2.0",',
  '    routeKey: "POST /graphql",',
  '    rawPath: "/graphql",',
  '    rawQueryString: "",',
  "    headers,",
  "    requestContext: {",
  '      accountId: "smoke",',
  '      apiId: "smoke",',
  '      domainName: "localhost",',
  '      domainPrefix: "localhost",',
  '      http: { method: "POST", path: "/graphql", protocol: "HTTP/1.1", sourceIp: "127.0.0.1", userAgent: "smoke" },',
  '      requestId: "smoke-request",',
  '      routeKey: "POST /graphql",',
  '      stage: "$default",',
  '      time: "01/Jan/1970:00:00:00 +0000",',
  "      timeEpoch: 0,",
  "    },",
  "    body: JSON.stringify({ query }),",
  "    isBase64Encoded: false,",
  "  };",
  "}",
  "const lambdaContext = {",
  "  callbackWaitsForEmptyEventLoop: false,",
  '  functionName: "graphql-api-smoke",',
  '  functionVersion: "$LATEST",',
  '  invokedFunctionArn: "arn:aws:lambda:local:000000000000:function:graphql-api-smoke",',
  '  memoryLimitInMB: "128",',
  '  awsRequestId: "smoke-request",',
  '  logGroupName: "/aws/lambda/graphql-api-smoke",',
  '  logStreamName: "smoke",',
  "  getRemainingTimeInMillis: () => 30_000,",
  "  done: () => undefined,",
  "  fail: (error) => { throw error; },",
  "  succeed: () => undefined,",
  "};",
  "function parseLambdaResult(result) {",
  '  if (!result || typeof result !== "object") throw new Error(`Unexpected Lambda result: ${String(result)}`);',
  '  const body = typeof result.body === "string" ? JSON.parse(result.body) : result.body;',
  "  return { statusCode: result.statusCode ?? 200, body };",
  "}",
  'const lambdaDenied = parseLambdaResult(await handler(createLambdaEvent({ "content-type": "application/json" }), lambdaContext, () => undefined));',
  "if (lambdaDenied.statusCode !== 200) throw new Error(`Expected Lambda protectedHealth denial to use GraphQL error status 200, received ${lambdaDenied.statusCode}`);",
  "if (!lambdaDenied.body?.errors?.length) throw new Error(`Expected Lambda protectedHealth to reject missing credentials: ${JSON.stringify(lambdaDenied.body)}`);",
  "const lambdaDeniedAuthCode = lambdaDenied.body.errors[0]?.extensions?.code;",
  "if (lambdaDeniedAuthCode !== expectedAuthFailureCode) throw new Error(`Expected Lambda protectedHealth to reject with ${expectedAuthFailureCode}, received ${lambdaDeniedAuthCode}: ${JSON.stringify(lambdaDenied.body)}`);",
  'const lambdaAllowed = parseLambdaResult(await handler(createLambdaEvent({ "content-type": "application/json", authorization: "Bearer generated-smoke-token" }), lambdaContext, () => undefined));',
  "if (lambdaAllowed.statusCode !== 200) throw new Error(`Expected Lambda protectedHealth status 200, received ${lambdaAllowed.statusCode}`);",
  'if (lambdaAllowed.body?.errors?.length) throw new Error(`Expected Lambda protectedHealth to allow valid credentials: ${lambdaAllowed.body.errors.map((error) => error.message).join("; ")}`);',
  'if (lambdaAllowed.body?.data?.protectedHealth !== "authenticated") throw new Error(`Unexpected Lambda protectedHealth response: ${JSON.stringify(lambdaAllowed.body)}`);',
  ...graphqlProtectedRouteSmokeCleanupScriptLines,
].join(" ");
const generatedSmokeExternalCrocoRangeExceptions = {} satisfies Record<
  string,
  ExternalCrocoRangeException
>;
const runtimeCapabilitySmokePlatforms = [
  "node",
  "lambda",
  "cloudflare-workers",
] as const satisfies readonly RuntimeCapabilitySmokePlatform[];
const runtimeCapabilitySmokeSupport = {
  node: {
    env: true,
    filesystem: true,
    logger: true,
    nodeApi: true,
    requestLifecycle: true,
    trace: true,
    waitUntil: false,
    flush: false,
    streamingResponse: true,
    deadline: false,
    abortSignal: true,
    shutdown: false,
  },
  lambda: {
    env: true,
    filesystem: true,
    logger: true,
    nodeApi: true,
    requestLifecycle: true,
    trace: true,
    waitUntil: true,
    flush: true,
    streamingResponse: false,
    deadline: true,
    abortSignal: false,
    shutdown: false,
  },
  "cloudflare-workers": {
    env: true,
    filesystem: false,
    logger: true,
    nodeApi: false,
    requestLifecycle: true,
    trace: true,
    waitUntil: true,
    flush: false,
    streamingResponse: true,
    deadline: false,
    abortSignal: true,
    shutdown: false,
  },
} as const satisfies Record<RuntimeCapabilitySmokePlatform, Record<string, boolean>>;
const smokeCaseDefinitions: readonly Omit<SmokeCase, "tier" | "advisory">[] = [
  {
    name: "blank-basic",
    args: ["--preset", "blank", "--scope", "@smoke", "--no-install", "--no-git"],
    runtimeTarget: "node",
    matrixTargets: ["blank"],
    validations: [{ label: "typecheck", args: ["typecheck"] }],
  },
  {
    name: "goal-saas-api",
    args: ["--goal", "saas-api", "--scope", "@smoke", "--no-install", "--no-git"],
    runtimeTarget: "node",
    matrixTargets: ["saas"],
    validations: [
      {
        label: "manifest",
        json: {
          path: "croco.app.json",
          matches: {
            schemaVersion: 1,
            goal: "saas-api",
            preset: "saas",
            runtimeTarget: "node",
            providers: [
              "in-memory-tenant",
              "in-memory-auth",
              "in-memory-billing",
              "in-memory-metering",
              "in-memory-events",
            ],
          },
        },
      },
      runtimeCapabilityManifestValidation("node"),
      { label: "contract snapshot", args: ["contract:snapshot"] },
      {
        label: "contract codegen",
        args: ["codegen"],
        paths: ["croco.project-map.json", "openapi.json", "libs/shared/provider-rpc/src/saas.ts"],
      },
      {
        label: "contract verification",
        readOnly: true,
        recovery: "pnpm codegen",
        args: ["contract:verify"],
      },
      { label: "doctor", args: ["doctor"] },
      { label: "typecheck", args: ["typecheck"] },
      { label: "build", args: ["build"] },
      { label: "test", args: ["test"] },
      { label: "demo flow", args: ["demo:smoke"] },
      {
        label: "failure drill smoke",
        args: ["failure-drill:smoke"],
        paths: [
          "ci-reports/failure-drills/operational.json",
          "ci-reports/failure-drills/operational.md",
        ],
        json: {
          path: "ci-reports/failure-drills/operational.json",
          matches: {
            schemaVersion: "croco.operational-failure-drills/v1",
            status: "passed",
            scenarioIds: [
              "provider-environment-missing",
              "telemetry-exporter-unavailable",
              "di-provider-missing",
              "di-scope-mismatch",
              "route-validation-failure",
              "rate-limit-exhausted",
              "auth-verifier-unavailable",
              "webhook-signature-invalid",
            ],
            outcomeKinds: [
              "diagnostic",
              "problem",
              "problem",
              "problem",
              "problem",
              "problem",
              "problem",
              "problem",
            ],
          },
        },
      },
    ],
  },
  {
    name: "graphql-standalone-api",
    args: [
      "--preset",
      "ddd-api",
      "--scope",
      "@smoke",
      "--api",
      "graphql",
      "--api-hosting",
      "standalone",
      "--db",
      "postgres,mongodb,redis",
      "--no-install",
      "--no-git",
    ],
    runtimeTarget: "node",
    matrixTargets: ["base-ddd"],
    validations: [
      {
        label: GRAPHQL_CONTRACT_CHECK_LABEL,
        packagePath: GRAPHQL_STANDALONE_CONTRACT_PACKAGE_PATH,
        args: ["contract:check"],
      },
      {
        label: GRAPHQL_CONTRACT_SNAPSHOT_LABEL,
        packagePath: GRAPHQL_STANDALONE_CONTRACT_PACKAGE_PATH,
        args: ["contract:snapshot"],
        paths: [GRAPHQL_CONTRACT_SNAPSHOT_PATH],
      },
      { label: "typecheck", args: ["typecheck"] },
      {
        label: "protected GraphQL route smoke",
        packagePath: ["apps", "graphql-api"],
        args: ["exec", "tsx", "--eval", graphqlStandaloneProtectedRouteSmokeScript],
      },
      { label: "build", args: ["build"] },
    ],
  },
  {
    name: "graphql-lambda-api",
    args: [
      "--preset",
      "ddd-api",
      "--scope",
      "@smoke",
      "--api",
      "graphql",
      "--api-hosting",
      "standalone",
      "--backend-deploy",
      "lambda",
      "--db",
      "postgres,mongodb,redis",
      "--no-install",
      "--no-git",
    ],
    runtimeTarget: "lambda",
    matrixTargets: ["base-ddd"],
    validations: [
      {
        label: GRAPHQL_CONTRACT_CHECK_LABEL,
        packagePath: GRAPHQL_STANDALONE_CONTRACT_PACKAGE_PATH,
        args: ["contract:check"],
      },
      {
        label: GRAPHQL_CONTRACT_SNAPSHOT_LABEL,
        packagePath: GRAPHQL_STANDALONE_CONTRACT_PACKAGE_PATH,
        args: ["contract:snapshot"],
        paths: [GRAPHQL_CONTRACT_SNAPSHOT_PATH],
      },
      { label: "typecheck", args: ["typecheck"] },
      {
        label: "protected GraphQL route smoke",
        packagePath: ["apps", "graphql-api"],
        args: ["exec", "tsx", "--eval", graphqlLambdaProtectedRouteSmokeScript],
      },
      { label: "build", args: ["build"] },
    ],
  },
  {
    name: "trpc-nextjs-vercel-fullstack",
    args: [
      "--preset",
      "ddd-fullstack",
      "--scope",
      "@smoke",
      "--api",
      "trpc",
      "--api-hosting",
      "nextjs",
      "--web-apps",
      "web",
      "--frontend-deploy",
      "vercel",
      "--no-install",
      "--no-git",
    ],
    runtimeTarget: "node+browser",
    matrixTargets: ["base-ddd"],
    validations: [{ label: "build", args: ["build"] }],
  },
  {
    name: "graphql-nextjs-opennext",
    args: [
      "--preset",
      "ddd-fullstack",
      "--scope",
      "@smoke",
      "--api",
      "graphql",
      "--api-hosting",
      "nextjs",
      "--web-apps",
      "web",
      "--frontend-deploy",
      "opennext",
      "--no-install",
      "--no-git",
    ],
    runtimeTarget: "opennext",
    matrixTargets: ["base-ddd"],
    validations: [
      {
        label: GRAPHQL_CONTRACT_CHECK_LABEL,
        packagePath: GRAPHQL_NEXTJS_CONTRACT_PACKAGE_PATH,
        args: ["contract:check"],
      },
      {
        label: GRAPHQL_CONTRACT_SNAPSHOT_LABEL,
        packagePath: GRAPHQL_NEXTJS_CONTRACT_PACKAGE_PATH,
        args: ["contract:snapshot"],
        paths: [GRAPHQL_CONTRACT_SNAPSHOT_PATH],
      },
      { label: "typecheck", packagePath: ["apps", "web"], args: ["typecheck"] },
      {
        label: "OpenNext deployment files",
        packagePath: ["apps", "web"],
        paths: ["open-next.config.ts", "wrangler.toml"],
      },
    ],
  },
  {
    name: "trpc-nextjs-docker-frontend",
    args: [
      "--preset",
      "ddd-fullstack",
      "--scope",
      "@smoke",
      "--api",
      "trpc",
      "--api-hosting",
      "nextjs",
      "--web-apps",
      "web",
      "--frontend-deploy",
      "docker",
      "--no-install",
      "--no-git",
    ],
    runtimeTarget: "container+browser",
    matrixTargets: ["base-ddd"],
    validations: [{ label: "frontend Dockerfile", paths: ["web/Dockerfile"] }],
  },
  {
    name: "graphql-vite-spa-docker",
    args: [
      "--preset",
      "ddd-fullstack",
      "--scope",
      "@smoke",
      "--api",
      "graphql",
      "--api-hosting",
      "standalone",
      "--web-apps",
      "web",
      "--backend-deploy",
      "docker",
      "--frontend-deploy",
      "vite-spa",
      "--ui",
      "none",
      "--no-install",
      "--no-git",
    ],
    runtimeTarget: "container+browser",
    matrixTargets: ["base-ddd"],
    validations: [
      {
        label: GRAPHQL_CONTRACT_CHECK_LABEL,
        packagePath: GRAPHQL_STANDALONE_CONTRACT_PACKAGE_PATH,
        args: ["contract:check"],
      },
      {
        label: GRAPHQL_CONTRACT_SNAPSHOT_LABEL,
        packagePath: GRAPHQL_STANDALONE_CONTRACT_PACKAGE_PATH,
        args: ["contract:snapshot"],
        paths: [GRAPHQL_CONTRACT_SNAPSHOT_PATH],
      },
      {
        label: "apps/web vite config load",
        packagePath: ["apps", "web"],
        args: ["exec", "node", "--input-type=module", "--eval", loadViteConfigScript],
      },
      {
        label: "apps/web browser build output",
        packagePath: ["apps", "web"],
        args: ["build"],
        paths: ["dist/index.html", "src/vite-env.d.ts"],
      },
      { label: "vite SPA Dockerfile", paths: ["web/Dockerfile.vite-spa"] },
    ],
  },
  {
    name: "graphql-vite-spa-astryx",
    args: [
      "--preset",
      "ddd-fullstack",
      "--scope",
      "@smoke",
      "--api",
      "graphql",
      "--api-hosting",
      "standalone",
      "--web-apps",
      "web",
      "--frontend-deploy",
      "vite-spa",
      "--ui",
      "astryx",
      "--no-install",
      "--no-git",
    ],
    runtimeTarget: "browser",
    matrixTargets: ["base-ddd"],
    validations: [
      {
        label: GRAPHQL_CONTRACT_CHECK_LABEL,
        packagePath: GRAPHQL_STANDALONE_CONTRACT_PACKAGE_PATH,
        args: ["contract:check"],
      },
      {
        label: GRAPHQL_CONTRACT_SNAPSHOT_LABEL,
        packagePath: GRAPHQL_STANDALONE_CONTRACT_PACKAGE_PATH,
        args: ["contract:snapshot"],
        paths: [GRAPHQL_CONTRACT_SNAPSHOT_PATH],
      },
      {
        label: "Astryx presentation profile metadata",
        presentationProfile: {
          appPath: "apps/web/croco.presentation-profile.json",
          runtimeProfileName: "browser-vite-spa-astryx",
        },
      },
      { label: "Astryx Vite SPA typecheck", packagePath: ["apps", "web"], args: ["typecheck"] },
      {
        label: "Astryx Vite SPA browser build",
        packagePath: ["apps", "web"],
        args: ["build"],
        paths: ["dist/index.html"],
      },
      {
        label: "Astryx Croco-aware render smoke",
        packagePath: ["apps", "web"],
        args: ["presentation:smoke"],
      },
    ],
  },
  {
    name: "meta-vite-web",
    args: [
      "--preset",
      "ddd-fullstack",
      "--scope",
      "@smoke",
      "--api",
      "graphql",
      "--api-hosting",
      "standalone",
      "--web-apps",
      "web",
      "--frontend-deploy",
      "cloudflare-meta-vite",
      "--no-install",
      "--no-git",
    ],
    runtimeTarget: "cloudflare-workers+browser",
    matrixTargets: ["base-ddd"],
    validations: [
      {
        label: GRAPHQL_CONTRACT_CHECK_LABEL,
        packagePath: GRAPHQL_STANDALONE_CONTRACT_PACKAGE_PATH,
        args: ["contract:check"],
      },
      {
        label: GRAPHQL_CONTRACT_SNAPSHOT_LABEL,
        packagePath: GRAPHQL_STANDALONE_CONTRACT_PACKAGE_PATH,
        args: ["contract:snapshot"],
        paths: [GRAPHQL_CONTRACT_SNAPSHOT_PATH],
      },
      {
        label: "apps/web vite config load",
        packagePath: ["apps", "web"],
        args: ["exec", "node", "--input-type=module", "--eval", loadViteConfigScript],
      },
      {
        label: "apps/web meta-vite build output",
        packagePath: ["apps", "web"],
        args: ["build"],
        paths: ["dist/client", "dist/client/manifest.json"],
      },
      {
        label: "apps/web presentation smoke",
        packagePath: ["apps", "web"],
        args: ["presentation:smoke"],
      },
    ],
  },
  {
    name: "meta-vite-fullstack-workers",
    args: [
      "--preset",
      "ddd-vike-fullstack",
      "--scope",
      "@smoke",
      "--api-hosting",
      "standalone",
      "--frontend-deploy",
      "cloudflare-meta-vite",
      "--no-install",
      "--no-git",
    ],
    runtimeTarget: "cloudflare-workers",
    matrixTargets: ["base-ddd"],
    validations: [
      {
        label: "api-worker typecheck",
        packagePath: ["api-worker"],
        args: ["typecheck"],
      },
      {
        label: "api-worker wrangler build",
        packagePath: ["api-worker"],
        args: ["build"],
      },
      {
        label: "api-worker secure fetch smoke",
        packagePath: ["ssr-worker"],
        args: ["exec", "tsx", "--eval", apiWorkerFetchSmokeScript],
      },
      {
        label: "ssr-worker vite config load",
        packagePath: ["ssr-worker"],
        args: ["exec", "node", "--input-type=module", "--eval", loadViteConfigScript],
      },
      {
        label: "ssr-worker meta-vite build output",
        packagePath: ["ssr-worker"],
        args: ["build"],
        paths: ["dist/client", "dist/client/manifest.json"],
      },
      {
        label: "ssr-worker presentation smoke",
        packagePath: ["ssr-worker"],
        args: ["presentation:smoke"],
      },
    ],
  },
  {
    name: "production-app-starter",
    args: ["--preset", "production-app", "--scope", "@smoke", "--no-install", "--no-git"],
    runtimeTarget: "node+browser",
    matrixTargets: ["spa-be-split"],
    validations: [
      { label: "dev smoke", args: ["dev:smoke"] },
      { label: "lint", args: ["lint"] },
      {
        label: "browser testing contract",
        paths: [
          "apps/console-web/vitest.config.ts",
          "apps/console-web/public/mockServiceWorker.js",
          "apps/console-web/src/tests/ProblemNotice.spec.tsx",
          "apps/console-web/src/test/browser.ts",
          "apps/console-web/src/test/server.ts",
          "playwright.config.ts",
          "tests/journeys/create-user.spec.ts",
          "tests/journeys/problem-rendering.spec.ts",
          ".github/workflows/browser-tests.yml",
        ],
      },
      { label: "Chromium install", args: ["test:browser:install"] },
      { label: "test", args: ["test"] },
      { label: "typecheck", args: ["typecheck"] },
      { label: "build", args: ["build"] },
      {
        label: "browser journeys",
        args: ["test:journey"],
      },
      {
        label: "Contract snapshot",
        args: ["contract:snapshot"],
        paths: ["contract-graph.snapshot.json"],
        artifacts: ["contract-graph.snapshot.json"],
      },
      {
        label: "Contract coverage",
        args: ["contract:coverage"],
        paths: ["contract-graph.coverage.json"],
        artifacts: ["contract-graph.coverage.json"],
      },
      { label: "Contract diff", args: ["contract:diff"] },
      { label: "OpenAPI contract", args: ["contract:openapi"], artifacts: ["openapi.json"] },
      {
        label: "RPC client",
        args: ["contract:client"],
        paths: ["libs/shared/provider-rpc/src/user.ts"],
        artifacts: ["libs/shared/provider-rpc/src/user.ts"],
      },
      {
        label: "Project Map generation",
        args: ["project-map:write"],
        paths: ["croco.project-map.json"],
      },
      {
        label: "DI graph generation",
        args: ["di:graph"],
        paths: [".croco/build/di-graph.manifest.json"],
      },
      {
        label: "DI graph verify",
        readOnly: true,
        recovery: "pnpm di:graph && pnpm project-map:write",
        args: ["di:verify"],
        paths: [".croco/build/di-graph.manifest.json"],
        artifacts: [".croco/build/di-graph.manifest.json"],
        json: {
          path: ".croco/build/di-graph.manifest.json",
          matches: {
            version: "croco.di-graph.manifest.v1",
            status: "ready",
            roots: ["UserController"],
          },
          arrayMinLengths: { providers: 1 },
        },
      },
    ],
  },
  {
    name: "admin-console-starter",
    args: ["--preset", "admin-console", "--scope", "@smoke", "--no-install", "--no-git"],
    runtimeTarget: "node+browser",
    matrixTargets: ["admin-console", "spa-be-split"],
    validations: [
      { label: "admin smoke", args: ["admin:smoke"] },
      { label: "lint", args: ["lint"] },
      {
        label: "browser testing contract",
        paths: [
          "apps/console-web/vitest.config.ts",
          "apps/console-web/public/mockServiceWorker.js",
          "apps/console-web/src/tests/ProblemNotice.spec.tsx",
          "apps/console-web/src/test/browser.ts",
          "apps/console-web/src/test/server.ts",
          "playwright.config.ts",
          "tests/journeys/create-user.spec.ts",
          "tests/journeys/problem-rendering.spec.ts",
          ".github/workflows/browser-tests.yml",
        ],
      },
      { label: "Chromium install", args: ["test:browser:install"] },
      { label: "test", args: ["test"] },
      { label: "typecheck", args: ["typecheck"] },
      { label: "build", args: ["build"] },
      {
        label: "browser journeys",
        args: ["test:journey"],
      },
      {
        label: "Contract snapshot",
        args: ["contract:snapshot"],
        paths: ["contract-graph.snapshot.json"],
      },
      {
        label: "Contract codegen",
        args: ["codegen"],
        paths: ["croco.project-map.json", "openapi.json", "libs/shared/provider-rpc/src/admin.ts"],
      },
      {
        label: "Contract verify",
        readOnly: true,
        recovery: "pnpm codegen",
        args: ["contract:verify"],
      },
      {
        label: "Admin RPC client",
        args: ["contract:client"],
        paths: ["libs/shared/provider-rpc/src/admin.ts"],
      },
      {
        label: "DI graph generation",
        args: ["di:graph"],
        paths: [".croco/build/di-graph.manifest.json"],
      },
      {
        label: "DI graph verify",
        readOnly: true,
        recovery: "pnpm di:graph && pnpm project-map:write",
        args: ["di:verify"],
        paths: [".croco/build/di-graph.manifest.json"],
        json: {
          path: ".croco/build/di-graph.manifest.json",
          matches: {
            version: "croco.di-graph.manifest.v1",
            status: "ready",
            roots: ["AdminController", "UserController"],
          },
          arrayMinLengths: { providers: 2 },
        },
      },
    ],
  },
  {
    name: "saas-golden-path",
    args: [
      "--preset",
      "saas",
      "--scope",
      "@smoke",
      "--saas-profile",
      "saas-node-postgres",
      "--tenant-model",
      "rls-backed",
      "--no-install",
      "--no-git",
    ],
    runtimeTarget: "node",
    matrixTargets: ["saas"],
    validations: [
      {
        label: "provider profile manifest",
        readOnly: true,
        recovery: "Regenerate the application from its create-croco-app preset",
        args: ["profile:check"],
        paths: [
          "croco-saas-profile.manifest.json",
          "croco-tenant-model.manifest.json",
          "croco-tenant-model.schema.json",
          ".env.example",
          "docs/provider-profile.md",
          "docs/tenant-model-playbook.md",
          "docs/secrets-checklist.md",
          "apps/api-server/src/generatedSaasProviderProfile.ts",
          "apps/api-server/src/generatedTenantModel.ts",
        ],
      },
      {
        label: "real-provider missing env diagnostic",
        args: ["profile:smoke:real"],
        env: {
          SAAS_PROVIDER_PROFILE: "saas-node-postgres",
          DATABASE_URL: "",
          BETTER_AUTH_SECRET: "",
          BETTER_AUTH_URL: "",
          POLAR_ACCESS_TOKEN: "",
          POLAR_WEBHOOK_SECRET: "",
          POLAR_PRODUCT_ID_TEAM: "",
          UPSTASH_QSTASH_TOKEN: "",
          UPSTASH_QSTASH_CURRENT_SIGNING_KEY: "",
          UPSTASH_QSTASH_NEXT_SIGNING_KEY: "",
          CLOUDINARY_URL: "",
        },
        expectFailure: {
          outputIncludes: [
            "CROCO_SAAS_PROFILE_ENV_MISSING",
            "DATABASE_URL",
            "POLAR_ACCESS_TOKEN",
            "CLOUDINARY_URL",
          ],
        },
      },
      {
        label: "usage dashboard generator",
        args: ["exec", "croco", "generate", "usage-dashboard", "--no-page"],
        paths: [
          "apps/api-server/src/controllers/UsageDashboardController.ts",
          "apps/api-server/src/usage-dashboard/UsageDashboardService.ts",
        ],
      },
      { label: "typecheck", args: ["typecheck"] },
      { label: "build", args: ["build"] },
      { label: "test", args: ["test"] },
      {
        label: "Contract snapshot",
        args: ["contract:snapshot"],
        paths: ["contract-graph.snapshot.json"],
      },
      {
        label: "Contract codegen",
        args: ["codegen"],
        paths: ["croco.project-map.json", "openapi.json", "libs/shared/provider-rpc/src/saas.ts"],
      },
      {
        label: "Contract verify",
        readOnly: true,
        recovery: "pnpm codegen",
        args: ["contract:verify"],
      },
      {
        label: "DI graph generation",
        args: ["di:graph"],
        paths: [".croco/build/di-graph.manifest.json"],
      },
      {
        label: "DI graph verify",
        readOnly: true,
        recovery: "pnpm di:graph && pnpm project-map:write",
        args: ["di:verify"],
        paths: [".croco/build/di-graph.manifest.json"],
        json: {
          path: ".croco/build/di-graph.manifest.json",
          matches: {
            version: "croco.di-graph.manifest.v1",
            status: "ready",
            roots: [
              "JobsController",
              "OperationsController",
              "SaasController",
              "UsageDashboardController",
            ],
          },
          arrayMinLengths: { providers: 4 },
        },
      },
      { label: "demo seed", args: ["demo:seed"] },
      { label: "demo flow", args: ["demo:smoke"] },
      {
        label: "failure drill smoke",
        args: ["failure-drill:smoke"],
        paths: [
          "ci-reports/failure-drills/operational.json",
          "ci-reports/failure-drills/operational.md",
        ],
        json: {
          path: "ci-reports/failure-drills/operational.json",
          matches: {
            schemaVersion: "croco.operational-failure-drills/v1",
            status: "passed",
            scenarioIds: [
              "provider-environment-missing",
              "telemetry-exporter-unavailable",
              "di-provider-missing",
              "di-scope-mismatch",
              "route-validation-failure",
              "rate-limit-exhausted",
              "auth-verifier-unavailable",
              "webhook-signature-invalid",
            ],
            outcomeKinds: [
              "diagnostic",
              "problem",
              "problem",
              "problem",
              "problem",
              "problem",
              "problem",
              "problem",
            ],
          },
        },
        artifacts: [
          "ci-reports/failure-drills/operational.json",
          "ci-reports/failure-drills/operational.md",
        ],
      },
      {
        label: "scenario output",
        args: ["demo:scenario"],
        paths: [
          "ci-reports/saas-golden-path/scenario.json",
          "ci-reports/saas-golden-path/scenario.md",
        ],
        json: {
          path: "ci-reports/saas-golden-path/scenario.json",
          matches: {
            schemaVersion: "croco.saas-golden-path.scenario/v1",
            generatedAt: "deterministic",
            tenantId: "tenant_acme",
            billingSubscriptionStatus: "active",
            dashboardTenantId: "tenant_acme",
            dashboardPlanId: "team",
            aiQuotaFailureCode: "llm-metering/quota-exceeded",
            operationsHealthStatus: "up",
            jobsStatus: "completed",
            lifecycleDuplicateRunStatus: "skipped",
          },
        },
        artifacts: [
          "ci-reports/saas-golden-path/scenario.json",
          "ci-reports/saas-golden-path/scenario.md",
        ],
      },
    ],
  },
  {
    name: "saas-cloudflare-profile",
    args: [
      "--preset",
      "saas",
      "--scope",
      "@smoke",
      "--saas-profile",
      "saas-cloudflare",
      "--tenant-model",
      "workspace",
      "--no-install",
      "--no-git",
    ],
    runtimeTarget: "cloudflare-workers",
    matrixTargets: ["saas"],
    validations: [
      {
        label: "provider profile manifest",
        readOnly: true,
        recovery: "Regenerate the application from its create-croco-app preset",
        args: ["profile:check"],
        paths: [
          "croco-saas-profile.manifest.json",
          "croco-tenant-model.manifest.json",
          "croco-tenant-model.schema.json",
          ".env.example",
          "docs/provider-profile.md",
          "docs/tenant-model-playbook.md",
          "docs/secrets-checklist.md",
          "apps/api-server/src/generatedSaasProviderProfile.ts",
          "apps/api-server/src/generatedTenantModel.ts",
        ],
      },
      runtimeCapabilityManifestValidation("cloudflare-workers"),
      { label: "typecheck", args: ["typecheck"] },
      { label: "build", args: ["build"] },
      { label: "test", args: ["test"] },
      { label: "demo flow", args: ["demo:smoke"] },
    ],
  },
  {
    name: "saas-lambda-profile",
    args: [
      "--preset",
      "saas",
      "--scope",
      "@smoke",
      "--saas-profile",
      "saas-lambda",
      "--tenant-model",
      "shared-schema",
      "--no-install",
      "--no-git",
    ],
    runtimeTarget: "lambda",
    matrixTargets: ["saas"],
    validations: [
      {
        label: "provider profile manifest",
        readOnly: true,
        recovery: "Regenerate the application from its create-croco-app preset",
        args: ["profile:check"],
        paths: [
          "croco-saas-profile.manifest.json",
          "croco-tenant-model.manifest.json",
          "croco-tenant-model.schema.json",
          ".env.example",
          "docs/provider-profile.md",
          "docs/tenant-model-playbook.md",
          "docs/secrets-checklist.md",
          "apps/api-server/src/generatedSaasProviderProfile.ts",
          "apps/api-server/src/generatedTenantModel.ts",
        ],
      },
      runtimeCapabilityManifestValidation("lambda"),
      { label: "typecheck", args: ["typecheck"] },
      { label: "build", args: ["build"] },
      { label: "test", args: ["test"] },
      { label: "demo flow", args: ["demo:smoke"] },
    ],
  },
  {
    name: "ai-saas-golden-path",
    args: [
      "--preset",
      "ai-saas",
      "--scope",
      "@smoke",
      "--tenant-model",
      "single",
      "--no-install",
      "--no-git",
    ],
    runtimeTarget: "node",
    matrixTargets: ["ai-saas", "saas"],
    validations: [
      { label: "typecheck", args: ["typecheck"] },
      { label: "build", args: ["build"] },
      { label: "test", args: ["test"] },
      {
        label: "Contract snapshot",
        args: ["contract:snapshot"],
        paths: ["contract-graph.snapshot.json"],
      },
      {
        label: "Contract codegen",
        args: ["codegen"],
        paths: ["croco.project-map.json", "openapi.json", "libs/shared/provider-rpc/src/ai.ts"],
      },
      {
        label: "Contract verify",
        readOnly: true,
        recovery: "pnpm codegen",
        args: ["contract:verify"],
      },
      {
        label: "DI graph generation",
        args: ["di:graph"],
        paths: [".croco/build/di-graph.manifest.json"],
      },
      {
        label: "DI graph verify",
        readOnly: true,
        recovery: "pnpm di:graph && pnpm project-map:write",
        args: ["di:verify"],
        paths: [".croco/build/di-graph.manifest.json"],
        json: {
          path: ".croco/build/di-graph.manifest.json",
          matches: {
            version: "croco.di-graph.manifest.v1",
            status: "ready",
            roots: ["AiController", "JobsController", "OperationsController", "SaasController"],
          },
          arrayMinLengths: { providers: 4 },
        },
      },
      { label: "AI demo flow", args: ["ai:smoke"] },
      { label: "full demo flow", args: ["demo:smoke"] },
      { label: "failure drill smoke", args: ["failure-drill:smoke"] },
    ],
  },
];

const restSpaContractSmokeCase = {
  name: REST_SPA_CONTRACT_SMOKE_CASE_NAME,
  tier: "spine-blocking",
  args: [],
  runtimeTarget: "node",
  matrixTargets: ["spa-be-split"],
  validations: [],
} as const satisfies SmokeCase;
const selectableSmokeCases = withGeneratedSmokeMatrixMetadata([
  ...smokeCaseDefinitions,
  restSpaContractSmokeCase,
]);
const spineSmokeCaseNames = selectableSmokeCases
  .filter(({ tier }) => tier === "spine-blocking")
  .map(({ name }) => name);
const smokeCases = selectableSmokeCases.filter(
  (smokeCase) => smokeCase.name !== REST_SPA_CONTRACT_SMOKE_CASE_NAME,
);

if (isMainModule()) {
  let smokeReport: GeneratedSmokeReport | undefined;
  const activeSmokeRoot = getSmokeRoot();

  try {
    const smokeSelection = selectGeneratedSmokeMatrixCases(selectableSmokeCases, {
      args: process.argv.slice(2),
      env: process.env,
    });
    const selectedSmokeCases = smokeSelection.cases.filter(
      (smokeCase) => smokeCase.name !== REST_SPA_CONTRACT_SMOKE_CASE_NAME,
    );
    const shouldRunRestSpaContracts = smokeSelection.cases.some(
      (smokeCase) => smokeCase.name === REST_SPA_CONTRACT_SMOKE_CASE_NAME,
    );
    const isFilteredRun = smokeSelection.filteredRun;

    assertGeneratedVerificationValidationsAreReadOnly(
      smokeSelection.cases.flatMap(({ validations }) => validations),
    );

    assertGraphQLSmokeContractCoverage(selectedSmokeCases);

    if (isFilteredRun) {
      console.log(
        `create-croco-app-generated-smoke: selected cases ${smokeSelection.cases.map(({ name }) => name).join(", ")}`,
      );
    } else {
      assertSmokeCoverage(smokeCases);
      assertTemplateMatrixAccountability(smokeCases);
      printSmokeCoverageSummary(smokeCases);
    }

    smokeReport = createGeneratedSmokeReport(
      smokeSelection.cases,
      isFilteredRun,
      smokeSelection.selectedTier,
      smokeSelection.requestedCaseNames,
    );
    writeGeneratedSmokeReport(smokeReport);

    runGateCommand(
      smokeReport,
      "create-croco-app CLI bootstrap",
      process.execPath,
      [turboPath, "build", "--filter=create-croco-app...", "--force"],
      rootDir,
      "spine-blocking",
    );
    assertExists(cliPath, "create-croco-app dist CLI is missing after build");

    if (smokeSelection.selectedTier !== "spine-blocking") {
      runGeneratedAppContractGates(smokeReport);
      runContinuingGateCommand(
        smokeReport,
        "workspace package build",
        process.execPath,
        [
          turboPath,
          "build",
          "--filter=@croco/auth-better-auth...",
          "--filter=@croco/auth-clerk...",
          "--filter=@croco/auth-drizzle...",
          "--filter=@croco/billing-polar...",
          "--filter=@croco/cli...",
          "--filter=@croco/events-core...",
          "--filter=@croco/events-inmemory...",
          "--filter=create-croco-app...",
          "--filter=@croco/framework-context...",
          "--filter=@croco/frontend-cloudflare...",
          "--filter=@croco/frontend-problems...",
          "--filter=@croco/frontend-react...",
          "--filter=@croco/frontend-vite...",
          "--filter=@croco/llm-core...",
          "--filter=@croco/llm-metering...",
          "--filter=@croco/meta-vite...",
          "--filter=@croco/lifecycle-core...",
          "--filter=@croco/metering-drizzle...",
          "--filter=@croco/metering-upstash...",
          "--filter=@croco/openapi-spec...",
          "--filter=@croco/problems-core...",
          "--filter=@croco/preset-cloudflare...",
          "--filter=@croco/preset-lambda...",
          "--filter=@croco/repository-core...",
          "--filter=@croco/retry-core...",
          "--filter=@croco/rpc-codegen...",
          "--filter=@croco/storage-cloudinary...",
          "--filter=@croco/storage-r2...",
          "--filter=@croco/tasks-qstash...",
          "--filter=@croco/telemetry-api...",
          "--filter=@croco/telemetry-sdk-node...",
          "--filter=@croco/tenant-core...",
          "--filter=@croco/transports-http...",
          "--filter=@croco/triggers-qstash...",
          "--filter=@croco/tx-drizzle...",
          "--force",
        ],
        rootDir,
        "ecosystem-advisory",
      );
    }

    const workspacePackageIndex = createWorkspacePackageIndex(rootDir);
    const packedWorkspacePackages = new Map<string, string>();
    const builtWorkspacePackageNames = new Set<string>();
    const smokeCaseFailures: Error[] = [];

    for (const smokeCase of selectedSmokeCases) {
      const projectDir = join(activeSmokeRoot, smokeCase.name);
      const caseResult = getSmokeCaseResult(smokeReport, smokeCase.name);

      try {
        runSmokeCaseCommand(
          smokeReport,
          caseResult,
          projectDir,
          "generate",
          "node",
          [cliPath, projectDir, ...smokeCase.args],
          rootDir,
        );
        const generatedSmokeRangeOverrides = getGeneratedSmokeRangeOverrides(
          projectDir,
          join(activeSmokeRoot, "generated-package-packs"),
          workspacePackageIndex,
          packedWorkspacePackages,
          builtWorkspacePackageNames,
          (label, result) => appendSmokeCaseOutput(caseResult, label, result),
        );
        rewriteExternalCrocoRanges(
          projectDir,
          generatedSmokeRangeOverrides,
          generatedSmokeExternalCrocoRangeExceptions,
        );
        assertGeneratedReadme(projectDir, smokeCase);
        assertGeneratedNodeRuntimeContract(projectDir, smokeCase);
        assertNoGeneratedSecurityValidationOptOut(projectDir, smokeCase);
        assertNoGeneratedCredentialLookingValues(projectDir, smokeCase);
        writePnpmWorkspaceOverrides(projectDir, generatedSmokeRangeOverrides);
        runSmokeCaseCommand(
          smokeReport,
          caseResult,
          projectDir,
          "install",
          corepackCommand,
          ["pnpm", "install"],
          projectDir,
        );
        const lockfilePath = join(projectDir, "pnpm-lock.yaml");
        assertExists(lockfilePath, `${smokeCase.name} did not create a pnpm lockfile`);
        assertPnpmLockfileUsesLocalTarballOverrides(
          lockfilePath,
          smokeCase.name,
          generatedSmokeRangeOverrides,
        );
        assertExists(
          join(projectDir, "node_modules"),
          `${smokeCase.name} did not install dependencies with pnpm`,
        );
        for (const validation of smokeCase.validations) {
          runValidation(projectDir, smokeCase, validation, smokeReport, caseResult);
        }
        runGraphQLContractDriftCanaries(projectDir, smokeCase, smokeReport, caseResult);
        caseResult.status = "passed";
        writeGeneratedSmokeReport(smokeReport);
      } catch (error) {
        recordUnhandledSmokeCaseFailure(smokeReport, caseResult, projectDir, error);
        smokeCaseFailures.push(error instanceof Error ? error : new Error(toErrorMessage(error)));
        writeGeneratedSmokeReport(smokeReport);
        console.error(
          `create-croco-app-generated-smoke: ${smokeCase.name} failed: ${toErrorMessage(error)}`,
        );
      }
    }

    if (shouldRunRestSpaContracts) {
      try {
        runSpaBeSplitContractSmoke(
          workspacePackageIndex,
          packedWorkspacePackages,
          builtWorkspacePackageNames,
          smokeReport,
          getSmokeCaseResult(smokeReport, REST_SPA_CONTRACT_SMOKE_CASE_NAME),
        );
      } catch (error) {
        smokeCaseFailures.push(error instanceof Error ? error : new Error(toErrorMessage(error)));
        console.error(
          `create-croco-app-generated-smoke: ${REST_SPA_CONTRACT_SMOKE_CASE_NAME} failed: ${toErrorMessage(error)}`,
        );
      }
    }

    const failedGates = smokeReport.gates.filter((gate) => gate.status === "failed");
    if (smokeCaseFailures.length > 0 || failedGates.length > 0) {
      throw new Error(
        `Generated app smoke completed with ${smokeCaseFailures.length} case failure(s) and ${failedGates.length} gate failure(s)`,
      );
    }

    smokeReport.status = "passed";
    writeGeneratedSmokeReport(smokeReport);
    console.log("create-croco-app-generated-smoke: all generated app smoke cases passed");
  } catch (error) {
    if (smokeReport) {
      smokeReport.status = "failed";
      smokeReport.failure = toErrorMessage(error);
      smokeReport.failureTier ??= smokeReport.selectedTier ?? "spine-blocking";
      writeGeneratedSmokeReport(smokeReport);
    }
    throw error;
  } finally {
    rmSync(activeSmokeRoot, { force: true, recursive: true });
    smokeRoot = undefined;
  }
}

function isMainModule(): boolean {
  const entrypoint = process.argv[1];
  return entrypoint !== undefined && import.meta.url === pathToFileURL(entrypoint).href;
}

function getSmokeRoot(): string {
  smokeRoot ??= mkdtempSync(join(tmpdir(), "croco-generated-app-smoke-"));
  return smokeRoot;
}

function runGeneratedAppContractGates(report: GeneratedSmokeReport): void {
  runGate("strict contract typecheck", ["strict-contract-typecheck"], report);
  runGate("static misuse check", ["static-misuse:check"], report);
  runGate(
    "generated template oxlint",
    ["exec", "oxlint", "packages/create-croco-app/templates"],
    report,
  );
  runGate("generated secret placeholder policy", ["generated-secret-placeholders:check"], report);
}

function runGate(label: string, args: readonly string[], report: GeneratedSmokeReport): void {
  runContinuingGateCommand(
    report,
    label,
    corepackCommand,
    ["pnpm", ...args],
    rootDir,
    "ecosystem-advisory",
  );
}

function createGeneratedSmokeReport(
  cases: readonly SmokeCase[],
  isFilteredRun: boolean,
  selectedTier: SmokeMatrixTier | undefined,
  requestedCaseNames: readonly string[],
): GeneratedSmokeReport {
  const tiers = ["spine-blocking", "ecosystem-advisory"] as const;
  return {
    schemaVersion: "croco.generated-app-smoke/v2",
    generatedAt: new Date().toISOString(),
    filteredRun: isFilteredRun,
    requestedCaseNames,
    selectedTier,
    status: "pending",
    release: { blockingTier: "spine-blocking", status: "pending" },
    tiers: tiers.map((tier) => ({ tier, status: "pending" })),
    matrix: {
      coverage: readSmokeCoverage(cases),
      templateTargets: readTemplateMatrixTargets(cases),
      templateExclusions: readTemplateMatrixExclusions(),
    },
    gates: [],
    cases: cases.map((smokeCase) => ({
      name: smokeCase.name,
      tier: smokeCase.tier,
      advisory: smokeCase.advisory,
      preset: readSmokeCasePreset(smokeCase),
      runtimeTarget: smokeCase.runtimeTarget,
      matrixTargets: smokeCase.matrixTargets,
      args: smokeCase.args,
      recovery: createSmokeRecoverySummary(smokeCase.name),
      status: "pending",
      steps: [],
    })),
  };
}

function writeGeneratedSmokeReport(report: GeneratedSmokeReport): void {
  mkdirSync(generatedSmokeReportDir, { recursive: true });
  refreshGeneratedSmokeReportStatus(report);

  const tiersToWrite = report.selectedTier
    ? [report.selectedTier]
    : (["spine-blocking", "ecosystem-advisory"] as const);
  for (const tier of tiersToWrite) {
    const tierReport = createGeneratedSmokeMatrixTierReport(
      tier,
      report.cases
        .filter((smokeCase) => smokeCase.tier === tier)
        .map((smokeCase) => ({
          name: smokeCase.name,
          status: smokeCase.status,
          failureEvidence: createSmokeMatrixCaseFailureEvidence(smokeCase),
        })),
      {
        filteredRun: report.filteredRun,
        previousReport: readGeneratedSmokeMatrixReport(
          join(generatedSmokeReportDir, `${tier}-matrix.json`),
        ),
        generatedAt: report.generatedAt,
        failure: createGeneratedSmokeMatrixFailure(tier, report.failure, report.failureTier),
      },
    );
    writeFileSync(
      join(generatedSmokeReportDir, `${tier}-matrix.json`),
      `${JSON.stringify(tierReport, null, 2)}\n`,
    );
    writeFileSync(
      join(generatedSmokeReportDir, `${tier}-matrix.md`),
      renderGeneratedSmokeMatrixReport(tierReport),
    );
  }

  const aggregate = createGeneratedSmokeMatrixAggregateReport(
    {
      "spine-blocking": readGeneratedSmokeMatrixReport(
        join(generatedSmokeReportDir, "spine-blocking-matrix.json"),
      ),
      "ecosystem-advisory": readGeneratedSmokeMatrixReport(
        join(generatedSmokeReportDir, "ecosystem-advisory-matrix.json"),
      ),
    },
    report.generatedAt,
  );
  writeFileSync(
    join(generatedSmokeReportDir, "matrix.json"),
    `${JSON.stringify(aggregate, null, 2)}\n`,
  );
  writeFileSync(
    join(generatedSmokeReportDir, "matrix.md"),
    renderGeneratedSmokeMatrixReport(aggregate),
  );

  writeCanonicalGeneratedSmokeJourneyBundle({
    selection: {
      selectedCaseNames: report.cases.map(({ name }) => name),
      spineCaseNames: spineSmokeCaseNames,
      selectedTier: report.selectedTier,
      requestedCaseNames: report.requestedCaseNames,
    },
    outputDir: join(generatedSmokeReportDir, "spine-blocking-journeys"),
    createReport: () =>
      createGeneratedSmokeJourneyReport(
        report,
        selectableSmokeCases.map(({ name }) => name),
        undefined,
        toPosixPath(relative(rootDir, generatedSmokeReportDir)),
      ),
    sourceRootDir: generatedSmokeReportDir,
  });
}

function readGeneratedSmokeMatrixReport(path: string): unknown {
  if (!existsSync(path)) {
    return undefined;
  }

  try {
    return JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch {
    return undefined;
  }
}

function createGeneratedSmokeMatrixFailure(
  tier: SmokeMatrixTier,
  message: string | undefined,
  failureTier: SmokeMatrixTier | undefined,
): SmokeMatrixFailure | undefined {
  if (!message || failureTier !== tier) {
    return undefined;
  }

  if (tier === "spine-blocking") {
    return {
      message,
      owner: "create-croco-app release spine owner",
      recoveryAction:
        "pnpm create-croco-app:smoke -- --tier spine-blocking; repair the reported bootstrap or spine smoke failure.",
    };
  }

  return {
    message,
    owner: "create-croco-app ecosystem smoke owner",
    recoveryAction:
      "pnpm create-croco-app:smoke -- --tier ecosystem-advisory; repair the reported advisory gate or smoke failure.",
  };
}

function createSmokeMatrixCaseFailureEvidence(
  smokeCase: SmokeCaseResult,
): SmokeMatrixCaseFailureEvidence | undefined {
  if (!smokeCase.error || !smokeCase.failureClassification) {
    return undefined;
  }

  return {
    error: smokeCase.error,
    diagnosticCodes: [
      ...new Set(
        smokeCase.steps
          .filter((step) => step.status === "failed")
          .flatMap((step) => step.diagnosticCodes),
      ),
    ].sort(),
    recovery: smokeCase.recovery,
    classification: smokeCase.failureClassification,
    artifactBundle: smokeCase.artifactBundle,
  };
}

function refreshGeneratedSmokeReportStatus(report: GeneratedSmokeReport): void {
  for (const tier of report.tiers) {
    const statuses = report.cases
      .filter((smokeCase) => smokeCase.tier === tier.tier)
      .map(({ status }) => status);
    tier.status = summarizeSmokeStatuses(statuses);
  }
  report.release.status =
    report.tiers.find(({ tier }) => tier === "spine-blocking")?.status ?? "pending";
  report.status = summarizeSmokeStatuses([
    ...report.tiers.map(({ status }) => status),
    ...report.gates.map(({ status }) => status),
  ]);
}

function summarizeSmokeStatuses(statuses: readonly SmokeStepStatus[]): SmokeStepStatus {
  if (statuses.some((status) => status === "failed")) {
    return "failed";
  }
  if (statuses.length === 0 || statuses.some((status) => status === "pending")) {
    return "pending";
  }
  return "passed";
}

function readTemplateMatrixTargets(cases: readonly SmokeCase[]): readonly TemplateMatrixTarget[] {
  const targetCases = new Map<string, string[]>();

  for (const smokeCase of cases) {
    for (const target of smokeCase.matrixTargets) {
      const caseNames = targetCases.get(target) ?? [];
      caseNames.push(smokeCase.name);
      targetCases.set(target, caseNames);
    }
  }

  return [...targetCases.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([template, caseNames]) => ({
      template,
      cases: caseNames.sort((left, right) => left.localeCompare(right)),
    }));
}

function readTemplateMatrixExclusions(): readonly TemplateMatrixExclusion[] {
  return [];
}

function assertTemplateMatrixAccountability(cases: readonly SmokeCase[]): void {
  const coveredTemplates = new Set(cases.flatMap(({ matrixTargets }) => matrixTargets));
  const topLevelTemplateDirectories = readdirSync(generatedAppTemplatesDir, {
    withFileTypes: true,
  })
    .filter((entry) => entry.isDirectory() && entry.name !== "addons")
    .map((entry) => entry.name)
    .sort();

  const missingTemplates = topLevelTemplateDirectories.filter(
    (template) => !coveredTemplates.has(template),
  );
  if (missingTemplates.length > 0) {
    throw new Error(
      `create-croco-app generated smoke matrix is missing template accountability entries: ${missingTemplates.join(", ")}`,
    );
  }

  const knownTemplates = new Set(topLevelTemplateDirectories);
  const unknownTargets = [...coveredTemplates].filter((template) => !knownTemplates.has(template));
  if (unknownTargets.length > 0) {
    throw new Error(
      `create-croco-app generated smoke matrix references unknown template directories: ${unknownTargets.join(", ")}`,
    );
  }
}

function assertGraphQLSmokeContractCoverage(cases: readonly SmokeCase[]): void {
  const missingCoverage: string[] = [];

  for (const smokeCase of cases) {
    const packagePath = readGraphQLContractPackagePath(smokeCase);
    if (!packagePath) continue;

    const checkIndex = smokeCase.validations.findIndex((validation) =>
      isPackageValidation(validation, packagePath, GRAPHQL_CONTRACT_CHECK_LABEL, [
        "contract:check",
      ]),
    );
    const snapshotIndex = smokeCase.validations.findIndex(
      (validation) =>
        isPackageValidation(validation, packagePath, GRAPHQL_CONTRACT_SNAPSHOT_LABEL, [
          "contract:snapshot",
        ]) && validation.paths?.includes(GRAPHQL_CONTRACT_SNAPSHOT_PATH),
    );

    if (checkIndex === -1 || snapshotIndex === -1 || checkIndex > snapshotIndex) {
      missingCoverage.push(
        `${smokeCase.name} (${packagePath.join("/")} requires ${GRAPHQL_CONTRACT_CHECK_LABEL} before ${GRAPHQL_CONTRACT_SNAPSHOT_LABEL})`,
      );
    }
  }

  if (missingCoverage.length > 0) {
    throw new Error(
      `create-croco-app generated GraphQL smoke cases are missing contract coverage: ${missingCoverage.join(", ")}`,
    );
  }
}

function isPackageValidation(
  validation: SmokeValidation,
  packagePath: readonly string[],
  label: string,
  args: readonly string[],
): boolean {
  return (
    validation.label === label &&
    samePath(validation.packagePath, packagePath) &&
    sameArgs(validation.args, args)
  );
}

function samePath(left: readonly string[] | undefined, right: readonly string[]): boolean {
  return Boolean(
    left && left.length === right.length && left.every((part, index) => part === right[index]),
  );
}

function sameArgs(left: readonly string[] | undefined, right: readonly string[]): boolean {
  return Boolean(
    left && left.length === right.length && left.every((part, index) => part === right[index]),
  );
}

function getSmokeCaseResult(report: GeneratedSmokeReport, caseName: string): SmokeCaseResult {
  const result = report.cases.find(({ name }) => name === caseName);
  if (!result) {
    throw new Error(`Missing generated smoke report entry for ${caseName}`);
  }
  return result;
}

function runGateCommand(
  report: GeneratedSmokeReport,
  label: string,
  command: string,
  args: readonly string[],
  cwd: string,
  tier: SmokeMatrixTier,
): void {
  const result: SmokeGateResult = {
    label,
    command: formatCommand(command, args, cwd),
    tier,
    status: "pending",
  };
  report.gates.push(result);
  writeGeneratedSmokeReport(report);

  try {
    run(command, args, cwd);
    result.status = "passed";
    writeGeneratedSmokeReport(report);
  } catch (error) {
    result.status = "failed";
    result.error = toErrorMessage(error);
    report.status = "failed";
    report.failure = result.error;
    report.failureTier ??= tier;
    writeGeneratedSmokeReport(report);
    throw error;
  }
}

function runContinuingGateCommand(
  report: GeneratedSmokeReport,
  label: string,
  command: string,
  args: readonly string[],
  cwd: string,
  tier: SmokeMatrixTier,
): void {
  try {
    runGateCommand(report, label, command, args, cwd, tier);
    console.log(`create-croco-app-generated-smoke: ${label} passed`);
  } catch (error) {
    console.error(`create-croco-app-generated-smoke: ${label} failed: ${toErrorMessage(error)}`);
  }
}

function runSmokeCaseCommand(
  report: GeneratedSmokeReport,
  caseResult: SmokeCaseResult,
  projectDir: string,
  label: string,
  command: string,
  args: readonly string[],
  cwd: string,
  env?: Readonly<Record<string, string>>,
): void {
  const step = createSmokeStep(label, {
    command: formatCommand(command, args, cwd),
  });
  caseResult.steps.push(step);
  writeGeneratedSmokeReport(report);

  try {
    appendSmokeCaseOutput(caseResult, label, run(command, args, cwd, env));
    step.status = "passed";
    writeGeneratedSmokeReport(report);
  } catch (error) {
    const commandResult = getCommandResultFromError(error);
    if (commandResult) {
      appendSmokeCaseOutput(caseResult, label, commandResult);
    }
    recordSmokeCaseFailure(report, caseResult, step, error, projectDir);
    throw createSmokeFailureError(caseResult, step, error);
  }
}

function runExpectedSmokeCaseCommand(
  report: GeneratedSmokeReport,
  caseResult: SmokeCaseResult,
  projectDir: string,
  label: string,
  command: string,
  args: readonly string[],
  cwd: string,
  expectedOutput: readonly string[],
): void {
  const step = createSmokeStep(label, {
    command: formatCommand(command, args, cwd),
    expectFailure: true,
  });
  caseResult.steps.push(step);
  writeGeneratedSmokeReport(report);

  try {
    const commandResult = runExpectFailure(command, args, cwd, expectedOutput);
    appendSmokeCaseOutput(caseResult, label, commandResult);
    step.diagnosticCodes = commandResult.diagnosticCodes;
    step.status = "passed";
    writeGeneratedSmokeReport(report);
  } catch (error) {
    const commandResult = getCommandResultFromError(error);
    if (commandResult) {
      appendSmokeCaseOutput(caseResult, label, commandResult);
    }
    recordSmokeCaseFailure(report, caseResult, step, error, projectDir);
    throw createSmokeFailureError(caseResult, step, error);
  }
}

function createSmokeStep(
  label: string,
  options: {
    readonly command?: string;
    readonly packagePath?: readonly string[];
    readonly paths?: readonly string[];
    readonly jsonPath?: string;
    readonly expectFailure?: boolean;
  } = {},
): SmokeStepResult {
  return {
    label,
    command: options.command,
    packagePath: options.packagePath,
    paths: options.paths,
    jsonPath: options.jsonPath,
    artifacts: [],
    expectFailure: options.expectFailure,
    status: "pending",
    diagnosticCodes: [],
  };
}

function recordSmokeCaseFailure(
  report: GeneratedSmokeReport,
  caseResult: SmokeCaseResult,
  step: SmokeStepResult,
  error: unknown,
  projectDir: string,
): void {
  step.status = "failed";
  step.error = toErrorMessage(error);
  const commandResult = getCommandResultFromError(error);
  step.diagnosticCodes = commandResult
    ? extractSmokeCommandDiagnosticCodes({
        message: step.error,
        stdout: commandResult.stdout,
        stderr: commandResult.stderr,
        signal: commandResult.signal,
      })
    : extractDiagnosticCodes(step.error);
  caseResult.status = "failed";
  caseResult.error = step.error;
  report.status = "failed";
  report.failure = createSmokeFailureMessage(caseResult, step, error);
  report.failureTier ??= caseResult.tier;
  caseResult.artifactBundle = persistSmokeCaseFailureArtifacts(caseResult, projectDir);
  caseResult.failureClassification = commandResult
    ? classifySmokeCommandFailure({
        message: step.error,
        stdout: commandResult.stdout,
        stderr: commandResult.stderr,
        signal: commandResult.signal,
      })
    : classifySmokeFailure({ message: step.error });
  writeGeneratedSmokeReport(report);
}

function appendSmokeCaseOutput(
  caseResult: SmokeCaseResult,
  label: string,
  result: CommandRunResult,
): void {
  const output = smokeCaseOutputBuffers.get(caseResult.name) ?? {
    stdout: [],
    stderr: [],
    outputTruncated: false,
  };
  const prefix = `[${label}]\n`;
  let remainingBytes = commandCaptureMaxBytes - getSmokeCaseOutputSize(output);
  const stdoutTruncated = result.stdout
    ? appendCappedSmokeCaseOutput(output.stdout, `${prefix}${result.stdout}`, remainingBytes)
    : false;
  remainingBytes = commandCaptureMaxBytes - getSmokeCaseOutputSize(output);
  const stderrTruncated = result.stderr
    ? appendCappedSmokeCaseOutput(output.stderr, `${prefix}${result.stderr}`, remainingBytes)
    : false;
  output.outputTruncated ||= result.outputTruncated || stdoutTruncated || stderrTruncated;
  smokeCaseOutputBuffers.set(caseResult.name, output);
}

function getSmokeCaseOutputSize(output: {
  readonly stdout: readonly string[];
  readonly stderr: readonly string[];
}): number {
  return [...output.stdout, ...output.stderr].reduce(
    (size, value) => size + Buffer.byteLength(value),
    0,
  );
}

function appendCappedSmokeCaseOutput(output: string[], value: string, maxBytes: number): boolean {
  if (value.length === 0) {
    return false;
  }

  const cappedValue = takeUtf8Prefix(value, Math.max(maxBytes, 0));
  if (cappedValue.value.length > 0) {
    output.push(cappedValue.value);
  }
  return cappedValue.truncated;
}

function takeUtf8Prefix(value: string, maxBytes: number): { value: string; truncated: boolean } {
  if (Buffer.byteLength(value) <= maxBytes) {
    return { value, truncated: false };
  }

  let bytes = 0;
  let end = 0;
  for (const character of value) {
    const characterBytes = Buffer.byteLength(character);
    if (bytes + characterBytes > maxBytes) {
      break;
    }
    bytes += characterBytes;
    end += character.length;
  }
  return { value: value.slice(0, end), truncated: true };
}

function persistSmokeCaseFailureArtifacts(
  caseResult: SmokeCaseResult,
  projectDir: string,
): SmokeCaseArtifactBundle {
  const artifactDir = join(generatedSmokeReportDir, "cases", caseResult.name);
  const filesDir = join(artifactDir, "files");
  const output = smokeCaseOutputBuffers.get(caseResult.name) ?? {
    stdout: [],
    stderr: [],
    outputTruncated: false,
  };
  rmSync(artifactDir, { force: true, recursive: true });
  mkdirSync(filesDir, { recursive: true });
  const stdoutPath = join(artifactDir, "stdout.log");
  const stderrPath = join(artifactDir, "stderr.log");
  writeFileSync(stdoutPath, output.stdout.join(""));
  writeFileSync(stderrPath, output.stderr.join(""));

  const files = existsSync(projectDir)
    ? collectSmokeFailureArtifactFiles(projectDir, caseResult.name).map((sourcePath) => {
        const relativePath = relative(projectDir, sourcePath);
        const targetPath = join(filesDir, relativePath);
        mkdirSync(dirname(targetPath), { recursive: true });
        copyFileSync(sourcePath, targetPath);
        return toReportArtifactPath(targetPath);
      })
    : [];

  return {
    path: toReportArtifactPath(artifactDir),
    stdoutPath: toReportArtifactPath(stdoutPath),
    stderrPath: toReportArtifactPath(stderrPath),
    files,
    outputTruncated: output.outputTruncated,
  };
}

function toReportArtifactPath(path: string): string {
  const relativePath = relative(rootDir, path);
  return relativePath.startsWith("..") ? toPosixPath(path) : toPosixPath(relativePath);
}

function createSmokeFailureError(
  caseResult: SmokeCaseResult,
  step: SmokeStepResult,
  error: unknown,
): Error {
  return new Error(createSmokeFailureMessage(caseResult, step, error), {
    cause: error,
  });
}

function recordUnhandledSmokeCaseFailure(
  report: GeneratedSmokeReport,
  caseResult: SmokeCaseResult,
  projectDir: string,
  error: unknown,
): void {
  if (caseResult.status === "failed") {
    return;
  }

  const commandResult = getCommandResultFromError(error);
  if (commandResult) {
    appendSmokeCaseOutput(caseResult, "case setup or assertion", commandResult);
  }
  const step = createSmokeStep("case setup or assertion");
  caseResult.steps.push(step);
  recordSmokeCaseFailure(report, caseResult, step, error, projectDir);
}

function createSmokeFailureMessage(
  caseResult: SmokeCaseResult,
  step: SmokeStepResult,
  error: unknown,
): string {
  const diagnosticCodes =
    step.diagnosticCodes.length > 0 ? step.diagnosticCodes.join(", ") : "none";
  return [
    `Generated app smoke failed for ${caseResult.name}.`,
    `preset=${caseResult.preset}`,
    `runtimeTarget=${caseResult.runtimeTarget}`,
    `step=${step.label}`,
    `command=${step.command ?? "n/a"}`,
    `diagnosticCodes=${diagnosticCodes}`,
    `error=${toErrorMessage(error)}`,
  ].join(" ");
}

function formatCommand(command: string, args: readonly string[], cwd: string): string {
  const relativeCwd = cwd.startsWith(rootDir) ? cwd.slice(rootDir.length + 1) || "." : cwd;
  return `(cd ${relativeCwd} && ${[command, ...args].join(" ")})`;
}

function readSmokeCasePreset(smokeCase: SmokeCase): string {
  if (smokeCase.name === REST_SPA_CONTRACT_SMOKE_CASE_NAME) {
    return "contract:spa-be-split";
  }

  const preset = readFlagValue(smokeCase.args, "--preset");
  if (preset) {
    return preset;
  }

  const goal = readFlagValue(smokeCase.args, "--goal");
  return goal ? `goal:${goal}` : "unknown";
}

function runtimeCapabilityManifestValidation(
  platform: RuntimeCapabilitySmokePlatform,
): SmokeValidation {
  return {
    label: "runtime capability manifest",
    json: {
      path: "croco-runtime-capability.manifest.json",
      matches: {
        version: "croco.runtime-capability.manifest.v1",
        platform,
        capabilities: runtimeCapabilitySmokeSupport[platform],
        diagnostics: [],
      },
    },
  };
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function extractDiagnosticCodes(output: string): readonly string[] {
  return [
    ...new Set(output.match(/\b(?:CROCO_[A-Z0-9_]+|[a-z0-9-]+\/[a-z0-9-]+)\b/g) ?? []),
  ].sort();
}

function assertExists(path: string, message: string): void {
  if (!existsSync(path)) {
    throw new Error(message);
  }
}

function assertMissing(path: string, message: string): void {
  if (existsSync(path)) {
    throw new Error(message);
  }
}

function assertGeneratedReadme(projectDir: string, smokeCase: SmokeCase): void {
  const readmePath = join(projectDir, "README.md");
  assertExists(readmePath, `${smokeCase.name} did not generate README.md`);

  const readme = readFileSync(readmePath, "utf8");
  if (readme.includes("{{") || readme.includes("}}")) {
    throw new Error(`${smokeCase.name} generated README.md with unresolved template placeholders`);
  }

  console.log(`create-croco-app-generated-smoke: ${smokeCase.name} README.md exists`);
}

function assertGeneratedNodeRuntimeContract(projectDir: string, smokeCase: SmokeCase): void {
  const packageJson = JSON.parse(readFileSync(join(projectDir, "package.json"), "utf8")) as {
    engines?: { node?: unknown };
  };
  const nvmrc = readFileSync(join(projectDir, ".nvmrc"), "utf8");
  const readme = readFileSync(join(projectDir, "README.md"), "utf8");

  if (packageJson.engines?.node !== GENERATED_NODE_ENGINE_RANGE) {
    throw new Error(
      `${smokeCase.name} generated package.json engines.node=${String(packageJson.engines?.node)}; expected ${GENERATED_NODE_ENGINE_RANGE}`,
    );
  }
  if (nvmrc !== `${GENERATED_NODE_VERSION}\n`) {
    throw new Error(
      `${smokeCase.name} generated .nvmrc=${JSON.stringify(nvmrc)}; expected ${GENERATED_NODE_VERSION}`,
    );
  }
  if (!readme.includes(`Node.js ${GENERATED_NODE_ENGINE_RANGE}`) || !readme.includes("nvm use")) {
    throw new Error(
      `${smokeCase.name} generated README.md is missing Node version recovery guidance`,
    );
  }
  if (
    smokeCase.runtimeTarget.includes("browser") ||
    smokeCase.runtimeTarget.includes("cloudflare-workers")
  ) {
    if (!readme.includes("does not change the deployment runtime")) {
      throw new Error(
        `${smokeCase.name} generated README.md falsely conflates Node build tooling with its ${smokeCase.runtimeTarget} deployment runtime`,
      );
    }
  }

  console.log(
    `create-croco-app-generated-smoke: ${smokeCase.name} Node runtime contract matches ${GENERATED_NODE_ENGINE_RANGE}`,
  );
}

function assertNoGeneratedSecurityValidationOptOut(projectDir: string, smokeCase: SmokeCase): void {
  const unsafeFiles = collectGeneratedSecurityValidationScanFiles(projectDir)
    .filter((filePath) =>
      unsafeSecurityValidationPatterns.some((pattern) =>
        pattern.test(readFileSync(filePath, "utf8")),
      ),
    )
    .map((filePath) => relative(projectDir, filePath));

  if (unsafeFiles.length > 0) {
    throw new Error(
      `${smokeCase.name} generated files disable HTTP security validation: ${unsafeFiles.join(", ")}`,
    );
  }

  console.log(
    `create-croco-app-generated-smoke: ${smokeCase.name} keeps HTTP security validation enabled`,
  );
}

function assertNoGeneratedCredentialLookingValues(projectDir: string, smokeCase: SmokeCase): void {
  const metadata = readGeneratedSmokeAllowlistMetadata(
    join(rootDir, "scripts", "security-allowlist-metadata.json"),
    smokeCase.name,
  );
  const allowlistRead = readGeneratedTemplateSecretAllowlistsFromMetadata(
    metadata,
    new Date().toISOString().slice(0, 10),
  );

  if (allowlistRead.violations.length > 0) {
    throw new Error(
      [
        `${smokeCase.name} generated secret allowlist metadata is invalid`,
        ...allowlistRead.violations.map(
          (violation) => `- ${violation.message} Recovery: ${violation.recovery}`,
        ),
      ].join("\n"),
    );
  }

  const findings = collectGeneratedSecurityValidationScanFiles(projectDir).flatMap((filePath) =>
    scanGeneratedTemplateSecretText(
      relative(projectDir, filePath).replace(/\\/g, "/"),
      readFileSync(filePath, "utf8"),
      allowlistRead.allowlists,
    ),
  );

  if (findings.length > 0) {
    throw new Error(
      [
        `${smokeCase.name} generated files contain credential-shaped values`,
        ...findings.map(
          (finding) =>
            `- ${finding.filePath}:${finding.line} ${finding.patternId} ${finding.match}`,
        ),
      ].join("\n"),
    );
  }

  console.log(
    `create-croco-app-generated-smoke: ${smokeCase.name} generated secret placeholders are safe`,
  );
}

export function readGeneratedSmokeAllowlistMetadata(
  metadataPath: string,
  smokeCaseName: string,
): unknown {
  try {
    return JSON.parse(readFileSync(metadataPath, "utf8")) as unknown;
  } catch (error) {
    throw new Error(
      `${smokeCaseName} generated secret allowlist metadata is invalid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function collectGeneratedSecurityValidationScanFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      return securityValidationScanIgnoredDirectories.has(entry.name)
        ? []
        : collectGeneratedSecurityValidationScanFiles(entryPath);
    }

    return securityValidationScanFileExtensions.has(extname(entry.name)) ||
      securityValidationScanFileNames.has(entry.name)
      ? [entryPath]
      : [];
  });
}

function runValidation(
  projectDir: string,
  smokeCase: SmokeCase,
  validation: SmokeValidation,
  report: GeneratedSmokeReport,
  caseResult: SmokeCaseResult,
): void {
  const validationDir = validation.packagePath
    ? join(projectDir, ...validation.packagePath)
    : projectDir;
  const step = createSmokeStep(validation.label, {
    command: validation.args
      ? formatCommand(
          corepackCommand,
          ["pnpm", "--dir", validationDir, ...validation.args],
          rootDir,
        )
      : undefined,
    packagePath: validation.packagePath,
    paths: validation.paths,
    jsonPath: validation.json?.path,
    expectFailure: validation.expectFailure !== undefined,
  });
  caseResult.steps.push(step);
  writeGeneratedSmokeReport(report);

  try {
    if (validation.args) {
      if (validation.expectFailure) {
        const commandResult = runExpectFailure(
          corepackCommand,
          ["pnpm", "--dir", validationDir, ...validation.args],
          rootDir,
          validation.expectFailure.outputIncludes,
          validation.env,
        );
        appendSmokeCaseOutput(caseResult, validation.label, commandResult);
        step.diagnosticCodes = commandResult.diagnosticCodes;
      } else {
        if (validation.readOnly) ensureGeneratedVerificationBaseline(validationDir);
        appendSmokeCaseOutput(
          caseResult,
          validation.label,
          validation.readOnly
            ? run(
                process.execPath,
                [
                  "--experimental-strip-types",
                  join(rootDir, "scripts", "tracked-file-mutation-guard.mts"),
                  "--recovery",
                  validation.recovery ?? `Run the explicit writer for ${validation.label}`,
                  "--",
                  corepackCommand,
                  "pnpm",
                  "--dir",
                  validationDir,
                  ...validation.args,
                ],
                validationDir,
                validation.env,
              )
            : run(
                corepackCommand,
                ["pnpm", "--dir", validationDir, ...validation.args],
                rootDir,
                validation.env,
              ),
        );
      }
    }

    for (const relativePath of validation.paths ?? []) {
      assertExists(
        join(validationDir, relativePath),
        `${smokeCase.name} ${validation.label} did not create ${relativePath}`,
      );
    }

    if (validation.json) {
      assertJsonMatches(
        join(validationDir, validation.json.path),
        validation.json.matches,
        `${smokeCase.name} ${validation.label}`,
        validation.json.arrayMinLengths,
      );
    }

    if (validation.presentationProfile) {
      assertGeneratedPresentationProfileMatchesCatalog(
        projectDir,
        validation.presentationProfile.appPath,
        validation.presentationProfile.runtimeProfileName,
        smokeCase.name,
      );
    }

    if (validation.artifacts) {
      step.artifacts = copyGeneratedSmokeArtifacts({
        generatedSmokeReportDir,
        smokeCaseName: smokeCase.name,
        validationDir,
        artifactPaths: validation.artifacts,
      });
    }

    if (
      !validation.args &&
      !validation.paths &&
      !validation.json &&
      !validation.presentationProfile &&
      !validation.artifacts
    ) {
      throw new Error(`${smokeCase.name} ${validation.label} has no validation action`);
    }

    step.status = "passed";
    writeGeneratedSmokeReport(report);
  } catch (error) {
    const commandResult = getCommandResultFromError(error);
    if (commandResult) {
      appendSmokeCaseOutput(caseResult, validation.label, commandResult);
    }
    recordSmokeCaseFailure(report, caseResult, step, error, projectDir);
    throw createSmokeFailureError(caseResult, step, error);
  }

  console.log(`create-croco-app-generated-smoke: ${smokeCase.name} ${validation.label} passed`);
}

export function assertGeneratedVerificationValidationsAreReadOnly(
  validations: readonly Pick<SmokeValidation, "args" | "readOnly" | "recovery">[],
): void {
  const violations = validations.filter((validation) => {
    const name = validation.args?.[0];
    return (
      name !== undefined &&
      (name === "contract:verify" || !name.startsWith("contract:")) &&
      /:(?:check|verify)$/.test(name) &&
      (!validation.readOnly || !validation.recovery)
    );
  });
  if (violations.length === 0) return;
  throw new Error(
    `Generated verification validations must be guarded with recovery guidance: ${violations
      .map(({ args }) => args?.[0])
      .join(", ")}`,
  );
}

function ensureGeneratedVerificationBaseline(validationDir: string): void {
  if (existsSync(join(validationDir, ".git"))) return;
  run("git", ["init", "--quiet"], validationDir);
  run("git", ["config", "user.email", "generated-smoke@croco.local"], validationDir);
  run("git", ["config", "user.name", "Croco Generated Smoke"], validationDir);
  run("git", ["add", "-A", "--", ".", ":(exclude)**/node_modules/**"], validationDir);
  run("git", ["commit", "--quiet", "-m", "generated verification baseline"], validationDir);
}

function runGraphQLContractDriftCanaries(
  projectDir: string,
  smokeCase: SmokeCase,
  report: GeneratedSmokeReport,
  caseResult: SmokeCaseResult,
): void {
  const packagePath = readGraphQLContractPackagePath(smokeCase);
  if (!packagePath) {
    return;
  }

  const packageDir = join(projectDir, ...packagePath);
  const snapshotPath = join(packageDir, GRAPHQL_CONTRACT_SNAPSHOT_PATH);
  const step = createSmokeStep("GraphQL contract drift canaries", {
    command: formatCommand(
      corepackCommand,
      ["pnpm", "--dir", packageDir, "contract:check"],
      rootDir,
    ),
    packagePath,
    paths: [GRAPHQL_CONTRACT_SNAPSHOT_PATH],
    expectFailure: true,
  });
  caseResult.steps.push(step);
  writeGeneratedSmokeReport(report);

  try {
    assertExists(
      snapshotPath,
      `${smokeCase.name} GraphQL drift canaries require ${GRAPHQL_CONTRACT_SNAPSHOT_PATH}`,
    );
    const originalSnapshot = readFileSync(snapshotPath, "utf8");
    const commandResults: CommandRunResult[] = [];
    for (const canary of [
      {
        mutate: withStaleGraphQLOperationBaseline,
        expectedDiagnosticCodes: ["graphql-operation-removed"],
      },
      {
        mutate: withChangedGraphQLFieldTypeBaseline,
        expectedDiagnosticCodes: ["graphql-schema-breaking-change"],
      },
      {
        mutate: withGraphQLResolverMetadataDriftBaseline,
        expectedDiagnosticCodes: GRAPHQL_RESOLVER_METADATA_DRIFT_CODES,
      },
    ]) {
      const result = runGraphQLSnapshotCanary(
        packageDir,
        snapshotPath,
        originalSnapshot,
        canary.mutate,
        canary.expectedDiagnosticCodes,
      );
      appendSmokeCaseOutput(caseResult, step.label, result);
      commandResults.push(result);
    }
    step.diagnosticCodes = [
      ...new Set(commandResults.flatMap(({ diagnosticCodes }) => diagnosticCodes)),
    ].sort();
    step.status = "passed";
    writeGeneratedSmokeReport(report);
  } catch (error) {
    const commandResult = getCommandResultFromError(error);
    if (commandResult) {
      appendSmokeCaseOutput(caseResult, step.label, commandResult);
    }
    recordSmokeCaseFailure(report, caseResult, step, error, projectDir);
    throw createSmokeFailureError(caseResult, step, error);
  }

  console.log(`create-croco-app-generated-smoke: ${smokeCase.name} GraphQL drift canaries passed`);
}

function runGraphQLSnapshotCanary(
  packageDir: string,
  snapshotPath: string,
  originalSnapshot: string,
  mutate: (snapshot: GraphQLContractSnapshotJson) => GraphQLContractSnapshotJson,
  expectedDiagnosticCodes: readonly string[],
): CommandRunResult {
  const snapshot = parseGraphQLContractSnapshot(originalSnapshot, snapshotPath);
  writeFileSync(snapshotPath, stringifyGraphQLContractSnapshotJson(mutate(snapshot)));

  try {
    const commandResult = runExpectFailure(
      corepackCommand,
      ["pnpm", "--dir", packageDir, "contract:check"],
      rootDir,
      expectedDiagnosticCodes,
    );
    return {
      ...commandResult,
      diagnosticCodes: [...new Set([...commandResult.diagnosticCodes, ...expectedDiagnosticCodes])],
    };
  } finally {
    writeFileSync(snapshotPath, originalSnapshot);
  }
}

function parseGraphQLContractSnapshot(
  content: string,
  snapshotPath: string,
): GraphQLContractSnapshotJson {
  const snapshot = JSON.parse(content) as unknown;

  if (!isGraphQLContractSnapshotJson(snapshot)) {
    throw new Error(`${snapshotPath} is not a Croco GraphQL contract snapshot.`);
  }

  return snapshot;
}

function isGraphQLContractSnapshotJson(value: unknown): value is GraphQLContractSnapshotJson {
  if (!isRecord(value)) {
    return false;
  }
  const snapshot = value as {
    readonly snapshotVersion?: unknown;
    readonly sdl?: unknown;
    readonly operations?: unknown;
    readonly resolvers?: unknown;
    readonly diagnostics?: unknown;
  };

  return (
    snapshot.snapshotVersion === "croco.graphql-contract.snapshot.v2" &&
    typeof snapshot.sdl === "string" &&
    Array.isArray(snapshot.operations) &&
    Array.isArray(snapshot.resolvers) &&
    Array.isArray(snapshot.diagnostics)
  );
}

function stringifyGraphQLContractSnapshotJson(snapshot: GraphQLContractSnapshotJson): string {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

function withStaleGraphQLOperationBaseline(
  snapshot: GraphQLContractSnapshotJson,
): GraphQLContractSnapshotJson {
  const staleOperation: GraphQLContractOperationJson = {
    kind: "query",
    name: "removedHealth",
    type: "String!",
    args: [],
  };

  return {
    ...snapshot,
    operationCount: snapshot.operations.length + 1,
    operations: [...snapshot.operations, staleOperation].sort(compareGraphQLOperations),
  };
}

function withChangedGraphQLFieldTypeBaseline(
  snapshot: GraphQLContractSnapshotJson,
): GraphQLContractSnapshotJson {
  return {
    ...snapshot,
    sdl: snapshot.sdl.replace("health: String!", "health: Int!"),
    operations: snapshot.operations.map((operation) =>
      operation.kind === "query" && operation.name === "health"
        ? { ...operation, type: "Int!" }
        : operation,
    ),
  };
}

function withGraphQLResolverMetadataDriftBaseline(
  snapshot: GraphQLContractSnapshotJson,
): GraphQLContractSnapshotJson {
  const [resolver] = snapshot.resolvers;
  const [method] = resolver?.methods ?? [];
  if (!resolver || !method) {
    throw new Error("GraphQL resolver metadata canary requires at least one resolver method.");
  }

  return {
    ...snapshot,
    resolvers: [
      {
        ...resolver,
        diScope: "request",
        methods: [
          {
            ...method,
            guards: ["CanaryGuard"],
            interceptors: ["CanaryInterceptor"],
            roles: ["admin"],
            problems: [
              {
                code: "GRAPHQL_HEALTH_UNAVAILABLE",
                category: "InternalServerError",
                status: 500,
              },
            ],
          },
          ...resolver.methods.slice(1),
        ],
      },
      ...snapshot.resolvers.slice(1),
    ],
  };
}

function compareGraphQLOperations(
  left: GraphQLContractOperationJson,
  right: GraphQLContractOperationJson,
): number {
  return `${left.kind}:${left.name}`.localeCompare(`${right.kind}:${right.name}`);
}

function assertSmokeCoverage(cases: readonly SmokeCase[]): void {
  const coverage = readSmokeCoverage(cases);

  assertCovers("presets", SUPPORTED_CREATE_CROCO_APP_CHOICES.presets, coverage.presets);
  assertCovers("apis", SUPPORTED_CREATE_CROCO_APP_CHOICES.apis, coverage.apis);
  assertCovers("api-hosting", SUPPORTED_CREATE_CROCO_APP_CHOICES.apiHosting, coverage.apiHosting);
  assertCovers(
    "backend-deploy",
    SUPPORTED_CREATE_CROCO_APP_CHOICES.backendDeploys,
    coverage.backendDeploys,
  );
  assertCovers(
    "frontend-deploy",
    SUPPORTED_CREATE_CROCO_APP_CHOICES.frontendDeploys,
    coverage.frontendDeploys,
  );
  assertCovers("ui", SUPPORTED_CREATE_CROCO_APP_CHOICES.uiProfiles, coverage.uiProfiles);
  assertCovers("db", SUPPORTED_CREATE_CROCO_APP_CHOICES.databases, coverage.databases);
  assertCovers(
    "saas-profile",
    SUPPORTED_CREATE_CROCO_APP_CHOICES.saasProviderProfiles,
    coverage.saasProviderProfiles,
  );
  assertCovers(
    "tenant-model",
    SUPPORTED_CREATE_CROCO_APP_CHOICES.tenantModels,
    coverage.tenantModels,
  );
  assertCovers(
    "runtime capability manifest",
    runtimeCapabilitySmokePlatforms,
    coverage.runtimeCapabilityManifests,
  );
}

function printSmokeCoverageSummary(cases: readonly SmokeCase[]): void {
  const coverage = readSmokeCoverage(cases);
  const templateTargets = readTemplateMatrixTargets(cases);
  const templateExclusions = readTemplateMatrixExclusions();

  console.log(
    `create-croco-app-generated-smoke: matrix cases ${cases.map(({ name }) => name).join(", ")}`,
  );
  console.log(
    `create-croco-app-generated-smoke: matrix covers presets=${coverage.presets.join(", ")}; apis=${coverage.apis.join(", ")}; api-hosting=${coverage.apiHosting.join(", ")}; backend-deploy=${coverage.backendDeploys.join(", ")}; frontend-deploy=${coverage.frontendDeploys.join(", ")}; ui=${coverage.uiProfiles.join(", ")}; db=${coverage.databases.join(", ")}; saas-profile=${coverage.saasProviderProfiles.join(", ")}; tenant-model=${coverage.tenantModels.join(", ")}`,
  );
  console.log(
    `create-croco-app-generated-smoke: runtime capability manifests ${coverage.runtimeCapabilityManifests.join(", ")}`,
  );
  console.log(
    `create-croco-app-generated-smoke: template targets ${templateTargets.map(({ template }) => template).join(", ")}`,
  );
  console.log(
    `create-croco-app-generated-smoke: template exclusions ${templateExclusions.map(({ template }) => template).join(", ")}`,
  );
}

function readSmokeCoverage(cases: readonly SmokeCase[]): {
  readonly presets: readonly string[];
  readonly apis: readonly string[];
  readonly apiHosting: readonly string[];
  readonly backendDeploys: readonly string[];
  readonly frontendDeploys: readonly string[];
  readonly uiProfiles: readonly string[];
  readonly databases: readonly string[];
  readonly saasProviderProfiles: readonly string[];
  readonly tenantModels: readonly string[];
  readonly runtimeCapabilityManifests: readonly RuntimeCapabilitySmokePlatform[];
} {
  return {
    presets: readCoveredValues(cases, "--preset", SUPPORTED_CREATE_CROCO_APP_CHOICES.presets),
    apis: readCoveredValues(cases, "--api", SUPPORTED_CREATE_CROCO_APP_CHOICES.apis),
    apiHosting: readCoveredValues(
      cases,
      "--api-hosting",
      SUPPORTED_CREATE_CROCO_APP_CHOICES.apiHosting,
    ),
    backendDeploys: readCoveredValues(
      cases,
      "--backend-deploy",
      SUPPORTED_CREATE_CROCO_APP_CHOICES.backendDeploys,
    ),
    frontendDeploys: readCoveredValues(
      cases,
      "--frontend-deploy",
      SUPPORTED_CREATE_CROCO_APP_CHOICES.frontendDeploys,
    ),
    uiProfiles: readCoveredValues(cases, "--ui", SUPPORTED_CREATE_CROCO_APP_CHOICES.uiProfiles),
    databases: readCoveredValues(cases, "--db", SUPPORTED_CREATE_CROCO_APP_CHOICES.databases, {
      splitCommaValues: true,
    }),
    saasProviderProfiles: readCoveredValues(
      cases,
      "--saas-profile",
      SUPPORTED_CREATE_CROCO_APP_CHOICES.saasProviderProfiles,
    ),
    tenantModels: readCoveredTenantModels(cases),
    runtimeCapabilityManifests: readRuntimeCapabilityManifestCoverage(cases),
  };
}

function readCoveredTenantModels(cases: readonly SmokeCase[]): readonly string[] {
  const coveredTenantModels = new Set(
    readCoveredValues(cases, "--tenant-model", SUPPORTED_CREATE_CROCO_APP_CHOICES.tenantModels),
  );

  for (const smokeCase of cases) {
    const preset = readFlagValue(smokeCase.args, "--preset");
    const goal = readFlagValue(smokeCase.args, "--goal");
    const hasTenantModel = readFlagValue(smokeCase.args, "--tenant-model") !== undefined;

    if (!hasTenantModel && (preset === "saas" || preset === "ai-saas" || goal === "saas-api")) {
      coveredTenantModels.add(DEFAULT_TENANT_MODEL);
    }
  }

  return SUPPORTED_CREATE_CROCO_APP_CHOICES.tenantModels.filter((tenantModel) =>
    coveredTenantModels.has(tenantModel),
  );
}

function readRuntimeCapabilityManifestCoverage(
  cases: readonly SmokeCase[],
): readonly RuntimeCapabilitySmokePlatform[] {
  const coveredPlatforms = new Set<RuntimeCapabilitySmokePlatform>();

  for (const smokeCase of cases) {
    for (const validation of smokeCase.validations) {
      const platform = validation.json?.matches.platform;
      if (isRuntimeCapabilitySmokePlatform(platform)) {
        coveredPlatforms.add(platform);
      }
    }
  }

  return runtimeCapabilitySmokePlatforms.filter((platform) => coveredPlatforms.has(platform));
}

function isRuntimeCapabilitySmokePlatform(value: unknown): value is RuntimeCapabilitySmokePlatform {
  return runtimeCapabilitySmokePlatforms.includes(value as RuntimeCapabilitySmokePlatform);
}

function readGraphQLContractPackagePath(smokeCase: SmokeCase): readonly string[] | undefined {
  if (readFlagValue(smokeCase.args, "--api") !== "graphql") {
    return undefined;
  }

  return readFlagValue(smokeCase.args, "--api-hosting") === "nextjs"
    ? GRAPHQL_NEXTJS_CONTRACT_PACKAGE_PATH
    : GRAPHQL_STANDALONE_CONTRACT_PACKAGE_PATH;
}

function readFlagValue(args: readonly string[], flag: string): string | undefined {
  const flagIndex = args.indexOf(flag);
  if (flagIndex === -1) return undefined;

  const value = args[flagIndex + 1];
  return value && !value.startsWith("--") ? value : undefined;
}

function readCoveredValues(
  cases: readonly SmokeCase[],
  flag: string,
  supportedValues: readonly string[],
  options: { readonly splitCommaValues?: boolean } = {},
): readonly string[] {
  const coveredValues = new Set<string>();

  for (const smokeCase of cases) {
    for (let index = 0; index < smokeCase.args.length; index += 1) {
      if (smokeCase.args[index] !== flag) continue;

      const value = smokeCase.args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${smokeCase.name} is missing a value after ${flag}`);
      }

      const values = options.splitCommaValues
        ? value
            .split(",")
            .map((part) => part.trim())
            .filter(Boolean)
        : [value];

      for (const coveredValue of values) {
        coveredValues.add(coveredValue);
      }
    }
  }

  const unsupportedValues = [...coveredValues].filter(
    (coveredValue) => !supportedValues.includes(coveredValue),
  );
  if (unsupportedValues.length > 0) {
    throw new Error(
      `${flag} smoke coverage includes unsupported values: ${unsupportedValues.join(", ")}`,
    );
  }

  return supportedValues.filter((supportedValue) => coveredValues.has(supportedValue));
}

function assertCovers(
  label: string,
  supportedValues: readonly string[],
  coveredValues: readonly string[],
): void {
  const missingValues = supportedValues.filter(
    (supportedValue) => !coveredValues.includes(supportedValue),
  );

  if (missingValues.length > 0) {
    throw new Error(
      `create-croco-app generated smoke matrix is missing ${label}: ${missingValues.join(", ")}`,
    );
  }
}

function runSpaBeSplitContractSmoke(
  workspacePackageIndex: ReadonlyMap<string, WorkspacePackage>,
  packedWorkspacePackages: Map<string, string>,
  builtWorkspacePackageNames: Set<string>,
  report: GeneratedSmokeReport,
  caseResult: SmokeCaseResult,
): void {
  const contractSmokeRoot = getSmokeRoot();
  const projectDir = join(contractSmokeRoot, "rest-spa-contracts");
  const templateDir = join(rootDir, "packages", "create-croco-app", "templates", "spa-be-split");

  try {
    renderTemplate(templateDir, projectDir, {
      projectName: "rest-spa-contracts",
      scope: "@smoke",
    });
    removeDependency(
      join(projectDir, "apps", "api-server", "package.json"),
      "devDependencies",
      "@croco/testing",
    );
    const contractSmokeRangeOverrides = getGeneratedSmokeRangeOverrides(
      projectDir,
      join(contractSmokeRoot, "contract-package-packs"),
      workspacePackageIndex,
      packedWorkspacePackages,
      builtWorkspacePackageNames,
      (label, result) => appendSmokeCaseOutput(caseResult, label, result),
    );
    rewriteExternalCrocoRanges(
      projectDir,
      contractSmokeRangeOverrides,
      generatedSmokeExternalCrocoRangeExceptions,
    );
    writePnpmWorkspaceOverrides(projectDir, contractSmokeRangeOverrides);

    runSmokeCaseCommand(
      report,
      caseResult,
      projectDir,
      "install",
      corepackCommand,
      ["pnpm", "install"],
      projectDir,
    );
    assertPnpmLockfileUsesLocalTarballOverrides(
      join(projectDir, "pnpm-lock.yaml"),
      REST_SPA_CONTRACT_SMOKE_CASE_NAME,
      contractSmokeRangeOverrides,
    );
    runSmokeCaseCommand(
      report,
      caseResult,
      projectDir,
      "contract check",
      corepackCommand,
      ["pnpm", "contract:check"],
      projectDir,
    );
    runSmokeCaseCommand(
      report,
      caseResult,
      projectDir,
      "contract snapshot",
      corepackCommand,
      ["pnpm", "contract:snapshot"],
      projectDir,
    );
    assertExists(
      join(projectDir, "contract-graph.snapshot.json"),
      "REST SPA contract smoke did not create contract-graph.snapshot.json",
    );
    runSmokeCaseCommand(
      report,
      caseResult,
      projectDir,
      "contract codegen",
      corepackCommand,
      ["pnpm", "codegen"],
      projectDir,
    );
    ensureGeneratedVerificationBaseline(projectDir);
    runSmokeCaseCommand(
      report,
      caseResult,
      projectDir,
      "contract verify",
      process.execPath,
      [
        "--experimental-strip-types",
        join(rootDir, "scripts", "tracked-file-mutation-guard.mts"),
        "--recovery",
        "pnpm codegen",
        "--",
        "corepack",
        "pnpm",
        "contract:verify",
      ],
      projectDir,
    );
    assertExists(
      join(projectDir, "openapi.json"),
      "REST SPA contract smoke did not create openapi.json",
    );

    const generatedClientPath = join(
      projectDir,
      "libs",
      "shared",
      "provider-rpc",
      "src",
      "user.ts",
    );
    assertExists(
      generatedClientPath,
      "REST SPA contract smoke did not create provider-rpc user client",
    );
    assertFileContains(
      generatedClientPath,
      "export function useList<TData = ListOutput>(options?: ListQueryOptions<TData>)",
    );
    assertFileContains(
      generatedClientPath,
      "export type CreateInput = { email: string; name: string; };",
    );
    const problemDeclarationCanary = removeRestSpaListProblemDeclaration(projectDir);
    runExpectedSmokeCaseCommand(
      report,
      caseResult,
      projectDir,
      "strict Problem declaration canary",
      corepackCommand,
      [
        "pnpm",
        "exec",
        "croco-rpc-codegen",
        "--controllers",
        "apps/api-server/src/{controllers/**/*.ts,users.ts,problems.ts}",
        "--check",
        "--fail-on-diagnostics",
      ],
      projectDir,
      [
        "contract-route-missing-problem-response-contract",
        "Strict Problem contract mode could not find declared route failures.",
        "Contract graph check failed with 1 diagnostic(s).",
      ],
    );
    writeFileSync(problemDeclarationCanary.path, problemDeclarationCanary.original);
    removeRestSpaListResponseSchema(projectDir);
    runExpectedSmokeCaseCommand(
      report,
      caseResult,
      projectDir,
      "strict OpenAPI schema canary",
      corepackCommand,
      [
        "pnpm",
        "exec",
        "croco-openapi-spec",
        "--controllers",
        "apps/api-server/src/{controllers/**/*.ts,users.ts,problems.ts}",
        "--out",
        "strict-openapi-canary.json",
        "--fail-on-diagnostics",
        "--manifest-bundle",
        ".croco/manifest",
      ],
      projectDir,
      [
        "contract-route-missing-response-schema",
        "Strict schema mode requires a success response schema before RPC/OpenAPI generation.",
        "fix them before generating OpenAPI",
      ],
    );
    assertMissing(
      join(projectDir, "strict-openapi-canary.json"),
      "REST SPA strict OpenAPI canary wrote an artifact despite ContractGraph errors",
    );
    runExpectedSmokeCaseCommand(
      report,
      caseResult,
      projectDir,
      "strict RPC schema canary",
      corepackCommand,
      [
        "pnpm",
        "exec",
        "croco-rpc-codegen",
        "--controllers",
        "apps/api-server/src/{controllers/**/*.ts,users.ts,problems.ts}",
        "--out",
        ".strict-rpc-canary",
        "--react-query",
        "--problem-runtime",
        "frontend-problems",
        "--fail-on-diagnostics",
        "--manifest-bundle",
        ".croco/manifest",
      ],
      projectDir,
      [
        "contract-route-missing-response-schema",
        "Strict schema mode requires a success response schema before RPC/OpenAPI generation.",
        "fix them before generating clients",
      ],
    );
    assertMissing(
      join(projectDir, ".strict-rpc-canary"),
      "REST SPA strict RPC canary wrote artifacts despite ContractGraph errors",
    );
    caseResult.status = "passed";
    writeGeneratedSmokeReport(report);
    console.log("create-croco-app-generated-smoke: rest-spa-contracts contract commands passed");
  } catch (error) {
    recordUnhandledSmokeCaseFailure(report, caseResult, projectDir, error);
    throw error;
  }
}

function removeRestSpaListProblemDeclaration(projectDir: string): {
  readonly path: string;
  readonly original: string;
} {
  const schemaPath = join(projectDir, "apps", "api-server", "src", "controllers", "userSchemas.ts");
  const original = readFileSync(schemaPath, "utf8");
  const updated = original.replace("  problems: [],\n", "");

  if (updated === original) {
    throw new Error("REST SPA strict Problem smoke could not remove the list Problem declaration");
  }

  writeFileSync(schemaPath, updated);

  return { path: schemaPath, original };
}

function removeRestSpaListResponseSchema(projectDir: string): void {
  const schemaPath = join(projectDir, "apps", "api-server", "src", "controllers", "userSchemas.ts");
  const original = readFileSync(schemaPath, "utf8");
  const updated = original.replace("  response: z.array(userSchema),\n", "");

  if (updated === original) {
    throw new Error("REST SPA strict schema smoke could not remove the list response schema");
  }

  writeFileSync(schemaPath, updated);
}

function getGeneratedSmokeRangeOverrides(
  projectDir: string,
  packDir: string,
  workspacePackageIndex: ReadonlyMap<string, WorkspacePackage>,
  packedWorkspacePackages: Map<string, string>,
  builtWorkspacePackageNames: Set<string>,
  onCommandResult?: SmokeCommandOutputObserver,
): Record<string, string> {
  const workspacePackages = resolveLocalCrocoPackagesForGeneratedProject(
    projectDir,
    workspacePackageIndex,
    generatedSmokeExternalCrocoRangeExceptions,
  );

  buildWorkspacePackages(
    workspacePackages.map(({ name }) => name),
    builtWorkspacePackageNames,
    onCommandResult,
  );

  return Object.fromEntries(
    workspacePackages.map((workspacePackage) => [
      workspacePackage.name,
      `file:${packWorkspacePackage(workspacePackage, packDir, packedWorkspacePackages, onCommandResult)}`,
    ]),
  );
}

function buildWorkspacePackages(
  packageNames: readonly string[],
  builtWorkspacePackageNames: Set<string>,
  onCommandResult?: SmokeCommandOutputObserver,
): void {
  const packageNamesToBuild = [...new Set(packageNames)]
    .filter((packageName) => !builtWorkspacePackageNames.has(packageName))
    .sort();

  if (packageNamesToBuild.length === 0) {
    return;
  }

  const commandResult = run(
    process.execPath,
    [turboPath, ...turboBuildArguments(packageNamesToBuild)],
    rootDir,
  );
  onCommandResult?.("build local dependencies", commandResult);

  for (const packageName of packageNamesToBuild) {
    builtWorkspacePackageNames.add(packageName);
  }
}

export function turboBuildArguments(
  packageNames: readonly string[],
  platform: NodeJS.Platform = process.platform,
): string[] {
  return [
    "build",
    // TypeScript 6 declaration bundling is substantially more memory-intensive on the hosted Windows runner.
    // Bound parallelism there so a large generated-app dependency graph cannot terminate Turbo without diagnostics.
    ...(platform === "win32" ? ["--concurrency=4"] : []),
    ...packageNames.map((packageName) => `--filter=${packageName}...`),
  ];
}

function packWorkspacePackage(
  workspacePackage: WorkspacePackage,
  packDir: string,
  packedWorkspacePackages: Map<string, string>,
  onCommandResult?: SmokeCommandOutputObserver,
): string {
  const cachedTarballPath = packedWorkspacePackages.get(workspacePackage.name);
  if (cachedTarballPath) {
    return cachedTarballPath;
  }

  mkdirSync(packDir, { recursive: true });
  const commandResult = run(
    corepackCommand,
    ["pnpm", "--filter", workspacePackage.name, "pack", "--pack-destination", packDir],
    rootDir,
  );
  onCommandResult?.(`pack local dependency ${workspacePackage.name}`, commandResult);

  const tarballPath = join(
    packDir,
    `${workspacePackage.name.replace(/^@/, "").replace("/", "-")}-${workspacePackage.version}.tgz`,
  );
  packedWorkspacePackages.set(workspacePackage.name, tarballPath);

  return tarballPath;
}

function assertPnpmLockfileUsesLocalTarballOverrides(
  lockfilePath: string,
  label: string,
  rangeOverrides: Record<string, string>,
): void {
  const lockfile = readFileSync(lockfilePath, "utf8");
  const missingLocalTarballPackages = Object.entries(rangeOverrides)
    .filter(([, range]) => !lockfile.includes(range))
    .map(([packageName]) => packageName);

  if (missingLocalTarballPackages.length > 0) {
    throw new Error(
      `${label} pnpm lockfile is missing local tarball references for ${missingLocalTarballPackages.join(", ")}`,
    );
  }
}

function renderTemplate(sourceDir: string, targetDir: string, vars: Record<string, string>): void {
  mkdirSync(targetDir, { recursive: true });

  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = join(sourceDir, entry.name);
    const targetName = entry.name.endsWith(".hbs") ? entry.name.slice(0, -4) : entry.name;
    const targetPath = join(targetDir, targetName);

    if (entry.isDirectory()) {
      renderTemplate(sourcePath, targetPath, vars);
      continue;
    }

    if (isTextFile(sourcePath)) {
      const rendered = renderText(readFileSync(sourcePath, "utf8"), vars);
      writeFileSync(targetPath, rendered);
      continue;
    }

    copyFileSync(sourcePath, targetPath);
  }
}

function isTextFile(path: string): boolean {
  return !readFileSync(path).includes(0);
}

function renderText(content: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (rendered, [key, value]) => rendered.split(`{{${key}}}`).join(value),
    content,
  );
}

function removeDependency(path: string, field: DependencyField, packageName: string): void {
  const packageJson = JSON.parse(readFileSync(path, "utf8")) as PackageJson;
  const dependencies = packageJson[field];

  if (!isDependencyMap(dependencies) || !(packageName in dependencies)) {
    return;
  }

  delete dependencies[packageName];
  writeFileSync(path, `${JSON.stringify(packageJson, null, 2)}\n`);
}

function isDependencyMap(value: unknown): value is Record<string, string> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every((dependencyRange) => typeof dependencyRange === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertFileContains(path: string, expected: string): void {
  const content = readFileSync(path, "utf8");

  if (!content.includes(expected)) {
    throw new Error(`${path} did not include expected text: ${expected}`);
  }
}

function assertJsonMatches(
  path: string,
  expected: Record<string, unknown>,
  label: string,
  arrayMinLengths: Readonly<Record<string, number>> = {},
): void {
  assertExists(path, `${label} did not create ${path}`);
  const actual = JSON.parse(readFileSync(path, "utf8")) as unknown;

  if (!isRecord(actual)) {
    throw new Error(`${label} JSON ${path} is not an object`);
  }

  for (const [key, expectedValue] of Object.entries(expected)) {
    const actualValue = actual[key];

    if (JSON.stringify(actualValue) !== JSON.stringify(expectedValue)) {
      throw new Error(
        `${label} JSON ${path} expected ${key}=${JSON.stringify(expectedValue)} but got ${JSON.stringify(actualValue)}`,
      );
    }
  }

  for (const [key, minLength] of Object.entries(arrayMinLengths)) {
    const actualValue = actual[key];
    if (!Array.isArray(actualValue) || actualValue.length < minLength) {
      throw new Error(
        `${label} JSON ${path} expected ${key} to contain at least ${minLength} item(s) but got ${JSON.stringify(actualValue)}`,
      );
    }
  }
}

export function assertGeneratedPresentationProfileMatchesCatalog(
  projectDir: string,
  appProfilePath: string,
  runtimeProfileName: string,
  smokeCaseName: string,
  catalogPath = join(rootDir, "packages", "presentation-preset", "runtime-profiles.json"),
): void {
  const catalog = readJsonObject(catalogPath, "presentation runtime profile catalog");
  if (!Array.isArray(catalog.profiles)) {
    throw new Error(`Presentation runtime profile catalog ${catalogPath} has no profiles array`);
  }

  const runtimeProfile = catalog.profiles.find(
    (profile): profile is Record<string, unknown> =>
      isRecord(profile) && profile.name === runtimeProfileName,
  );
  if (!runtimeProfile) {
    throw new Error(
      `Presentation runtime profile catalog ${catalogPath} does not define ${runtimeProfileName}`,
    );
  }
  if (runtimeProfile.generatedAppSmokeCase !== smokeCaseName) {
    throw new Error(
      `Presentation runtime profile ${runtimeProfileName} references ${String(runtimeProfile.generatedAppSmokeCase)} instead of ${smokeCaseName}`,
    );
  }
  if (!isRecord(runtimeProfile.ui)) {
    throw new Error(`Presentation runtime profile ${runtimeProfileName} has no UI metadata`);
  }
  if (runtimeProfile.ui.generatedAppSmokeCase !== smokeCaseName) {
    throw new Error(
      `Presentation runtime profile ${runtimeProfileName} UI metadata references ${String(runtimeProfile.ui.generatedAppSmokeCase)} instead of ${smokeCaseName}`,
    );
  }

  const generatedAppProfilePath = join(projectDir, appProfilePath);
  const generatedAppProfile = readJsonObject(
    generatedAppProfilePath,
    `${smokeCaseName} generated app presentation profile`,
  );
  const webApp = basename(dirname(generatedAppProfilePath));
  const expectedProfile = {
    webApp,
    runtimeProfile: runtimeProfileName,
    ui: runtimeProfile.ui,
  };
  if (JSON.stringify(generatedAppProfile) !== JSON.stringify(expectedProfile)) {
    throw new Error(
      `${smokeCaseName} generated presentation profile does not match ${runtimeProfileName} in ${catalogPath}`,
    );
  }

  const manifestPath = join(projectDir, "croco-presentation-profile.manifest.json");
  const manifest = readJsonObject(manifestPath, `${smokeCaseName} presentation profile manifest`);
  if (
    manifest.schemaVersion !== "croco.generated-presentation-profile/v1" ||
    JSON.stringify(manifest.profiles) !== JSON.stringify([expectedProfile])
  ) {
    throw new Error(
      `${smokeCaseName} presentation profile manifest does not match the canonical generated profile`,
    );
  }
}

function readJsonObject(path: string, label: string): Record<string, unknown> {
  assertExists(path, `${label} did not create ${path}`);
  const value = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (!isRecord(value)) {
    throw new Error(`${label} JSON ${path} is not an object`);
  }

  return value;
}

function run(
  command: string,
  args: readonly string[],
  cwd: string,
  env?: Readonly<Record<string, string>>,
): CommandRunResult {
  const { result, commandResult } = executeCommand(command, args, cwd, env);

  if (result.error) {
    replayCommandOutput(commandResult);
    throw new CommandExecutionError(
      createCommandExecutionErrorMessage(command, args, result.error),
      commandResult,
      result.error,
    );
  }

  if (result.status !== 0) {
    replayCommandOutput(commandResult);
    throw new CommandExecutionError(
      `${command} ${args.join(" ")} failed with ${formatCommandExit(commandResult)}`,
      commandResult,
    );
  }

  return commandResult;
}

function runExpectFailure(
  command: string,
  args: readonly string[],
  cwd: string,
  expectedOutput: readonly string[],
  env?: Readonly<Record<string, string>>,
): CommandRunResult {
  const { result, commandResult } = executeCommand(command, args, cwd, env);
  const output = `${commandResult.stdout}${commandResult.stderr}`;

  if (result.error) {
    replayCommandOutput(commandResult);
    throw new CommandExecutionError(
      createCommandExecutionErrorMessage(command, args, result.error),
      commandResult,
      result.error,
    );
  }

  if (result.status === 0) {
    replayCommandOutput(commandResult);
    throw new CommandExecutionError(
      `${command} ${args.join(" ")} was expected to fail but exited 0`,
      commandResult,
    );
  }

  for (const expectedText of expectedOutput) {
    if (!output.includes(expectedText)) {
      replayCommandOutput(commandResult);
      throw new CommandExecutionError(
        `${command} ${args.join(" ")} failed without expected output: ${expectedText}`,
        commandResult,
      );
    }
  }

  return commandResult;
}

function executeCommand(
  command: string,
  args: readonly string[],
  cwd: string,
  env?: Readonly<Record<string, string>>,
): {
  readonly result: ReturnType<typeof spawnSync>;
  readonly commandResult: CommandRunResult;
} {
  const outputDir = mkdtempSync(join(tmpdir(), "croco-generated-smoke-command-"));
  const stdoutPath = join(outputDir, "stdout.log");
  const stderrPath = join(outputDir, "stderr.log");
  const stdoutFileDescriptor = openSync(stdoutPath, "w");
  const stderrFileDescriptor = openSync(stderrPath, "w");

  const result = (() => {
    try {
      return spawnSync(command, [...args], {
        cwd,
        env: env ? { ...process.env, ...env } : undefined,
        shell: requiresCommandShell(command),
        stdio: ["ignore", stdoutFileDescriptor, stderrFileDescriptor],
        timeout: commandTimeoutMs,
      });
    } finally {
      closeSync(stdoutFileDescriptor);
      closeSync(stderrFileDescriptor);
    }
  })();

  try {
    const stdout = readCappedCommandOutput(stdoutPath);
    const stderr = readCappedCommandOutput(stderrPath);

    return {
      result,
      commandResult: toCommandRunResult(result, stdout, stderr),
    };
  } finally {
    rmSync(outputDir, { force: true, recursive: true });
  }
}

export function requiresCommandShell(
  command: string,
  platform: NodeJS.Platform = process.platform,
): boolean {
  return platform === "win32" && command.toLowerCase().endsWith(".cmd");
}

function readCappedCommandOutput(path: string): {
  readonly value: string;
  readonly truncated: boolean;
} {
  const size = statSync(path).size;
  const fileDescriptor = openSync(path, "r");

  try {
    if (size <= commandCaptureMaxBytes) {
      return {
        value: readCommandOutputSegment(fileDescriptor, size, 0),
        truncated: false,
      };
    }

    const headLength = Math.min(commandCaptureHeadBytes, commandCaptureMaxBytes);
    const tailLength = commandCaptureMaxBytes - headLength;
    return {
      value: [
        readCommandOutputSegment(fileDescriptor, headLength, 0),
        `[croco generated smoke output truncated; showing the first ${headLength} bytes and final ${tailLength} bytes]`,
        readCommandOutputSegment(fileDescriptor, tailLength, size - tailLength),
      ].join("\n"),
      truncated: true,
    };
  } finally {
    closeSync(fileDescriptor);
  }
}

export function readCommandOutputSegment(
  fileDescriptor: number,
  length: number,
  position: number,
): string {
  const buffer = Buffer.alloc(length);
  const decoder = new TextDecoder("utf-8");
  let bytesRead = 0;
  let value = "";

  while (bytesRead < length) {
    const readLength = readSync(
      fileDescriptor,
      buffer,
      bytesRead,
      length - bytesRead,
      position + bytesRead,
    );
    if (readLength === 0) {
      break;
    }
    value += decoder.decode(buffer.subarray(bytesRead, bytesRead + readLength), { stream: true });
    bytesRead += readLength;
  }

  return `${value}${decoder.decode()}`;
}

function toCommandRunResult(
  result: ReturnType<typeof spawnSync>,
  stdout: { readonly value: string; readonly truncated: boolean },
  stderr: { readonly value: string; readonly truncated: boolean },
): CommandRunResult {
  const output = [stdout.value, stderr.value].join("\n");

  return {
    stdout: stdout.value,
    stderr: stderr.value,
    status: result.status,
    signal: result.signal,
    outputTruncated: stdout.truncated || stderr.truncated,
    diagnosticCodes: extractDiagnosticCodes(output),
  };
}

function replayCommandOutput(result: CommandRunResult): void {
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
}

function createCommandExecutionErrorMessage(
  command: string,
  args: readonly string[],
  error: Error,
): string {
  return `${command} ${args.join(" ")} failed to start: ${error.message}`;
}

function formatCommandExit(result: CommandRunResult): string {
  return result.signal ? `signal ${result.signal}` : `exit code ${result.status}`;
}

function getCommandResultFromError(error: unknown): CommandRunResult | undefined {
  return error instanceof CommandExecutionError ? error.commandResult : undefined;
}
