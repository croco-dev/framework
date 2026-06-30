import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const apiIndexPath = fileURLToPath(new URL("../src/content/docs/api/README.md", import.meta.url));
const apiDocsPath = (relativePath) =>
  fileURLToPath(new URL(`../src/content/docs/api/${relativePath}`, import.meta.url));
const policyExecutionPlanPath = fileURLToPath(
  new URL(
    "../src/content/docs/api/framework-context/src/functions/getPolicyExecutionPlan.md",
    import.meta.url,
  ),
);
const diagnosticCodeDefinitionsPath = apiDocsPath(
  "diagnostics-core/src/variables/CROCO_DIAGNOSTIC_CODE_DEFINITIONS.md",
);
const replacement = "API modules are available from the **API Reference** sidebar.";
const policyExecutionPlanLink =
  "[`PolicyExecutionPlan`](/api/framework-context/src/type-aliases/policyexecutionplan/)";
const policyExecutionPlanResult = `${policyExecutionPlanLink} \\| \`undefined\``;
const routeContractSpecLink =
  "[`RouteContractSpec`](/api/protocols-rest/src/type-aliases/routecontractspec/)";
const routePathParamNameLink =
  "[`RoutePathParamName`](/api/protocols-rest/src/type-aliases/routepathparamname/)";
const routePathParamsLink =
  "[`RoutePathParams`](/api/protocols-rest/src/type-aliases/routepathparams/)";
const routeQueryLink = "[`RouteQuery`](/api/protocols-rest/src/type-aliases/routequery/)";
const paramsNameConstraint = `${routePathParamNameLink}\\<\`TContract\`\\[\`"path"\`\\]\\> & keyof ${routePathParamsLink}\\<\`TContract\`\\> & \`string\``;
const queryNameConstraint = `keyof ${routeQueryLink}\\<\`TContract\`\\> & \`string\``;
const cliDiagnosticDefinitionsTable = [
  "## CLI Diagnostic Definitions",
  "",
  "TypeDoc compresses helper-created entries in the raw const signature. This table expands the CLI definitions so the stable code, legacy alias, title, and recovery action remain visible in the API reference.",
  "",
  "| Code | Legacy aliases / patterns | Title | Action |",
  "| --- | --- | --- | --- |",
  "| `CROCO_CLI_DOCTOR_001` | `doctor/workspace-not-found` | Croco workspace root is missing | Run `croco doctor` inside a Croco monorepo or pass `--cwd` to a directory under the workspace root. |",
  "| `CROCO_CLI_DOCTOR_002` | `doctor/workspace-packages-empty` | Workspace package globs found no packages | Fix the workspace package globs or run `croco doctor` from the repository root. |",
  "| `CROCO_CLI_DOCTOR_003` | `doctor/workspace-package-invalid` | Workspace package manifest is invalid | Fix the `package.json` so it contains valid JSON and a string package name. |",
  "| `CROCO_CLI_DOCTOR_004` | `doctor/repository-core-drizzle-boundary` | repository-core references Drizzle implementation details | Move Drizzle-specific types and implementation code to `@croco/tx-drizzle` or another adapter package. |",
  "| `CROCO_CLI_DOCTOR_005` | `doctor/lambda-telemetry-flush-missing` | Lambda telemetry entrypoint is missing forceFlush | Await telemetry readiness before handler work and call `telemetry.forceFlush()` in a finally block before returning. |",
  "| `CROCO_CLI_USAGE_DASHBOARD_001` | `usage-dashboard/tenant-required` | Usage dashboard request is missing tenant context | Pass `x-tenant-id` or `tenantId` before reading usage dashboard data. |",
  "| `CROCO_CLI_USAGE_DASHBOARD_002` | `usage-dashboard/tenant-not-found` | Usage dashboard tenant was not found | Use an existing tenant id or seed the tenant before opening the dashboard. |",
  "| `CROCO_CLI_USAGE_DASHBOARD_003` | `usage-dashboard/meter-not-found` | Usage dashboard meter was not found | Use a registered meter id or update the tenant meter registry before requesting the dashboard. |",
  "| `CROCO_CLI_USAGE_DASHBOARD_004` | `usage-dashboard/provider-unavailable` | Usage dashboard provider is unavailable | Wire the generated runtime dependencies and inspect the provider failure detail. |",
  "| `CROCO_CLI_OPS_001` | `cli/invalid-ops-target-url` | Ops command target URL is invalid | Pass a valid Croco app base URL to the ops command. |",
  "| `CROCO_CLI_OPS_002` | `cli/invalid-ops-timeout` | Ops command timeout is invalid | Pass a positive timeout in milliseconds. |",
  "| `CROCO_CLI_JOBS_001` | `cli/invalid-jobs-target-url` | Jobs command target URL is invalid | Pass a valid Croco app base URL to the jobs command. |",
  "| `CROCO_CLI_JOBS_002` | `cli/invalid-jobs-number` | Jobs command numeric option is invalid | Pass a non-negative integer for numeric job query options. |",
  "| `CROCO_CLI_JOBS_003` | `cli/missing-jobs-target-url` | Jobs command target URL is missing | Pass `--url` or set `CROCO_JOBS_URL` before running the jobs command. |",
  "| `CROCO_CLI_JOBS_004` | `cli/jobs-http-error` | Jobs endpoint returned an error | Inspect the endpoint response detail and retry after the app or requested job id is corrected. |",
  "| `CROCO_CLI_JOBS_005` | `cli/jobs-endpoint-not-found` | Jobs endpoint was not found | Check the app base URL and requested job id, then retry the jobs command. |",
  "| `CROCO_CLI_DI_CHECK_001` | `cli/di-manifest-invalid` | DI check manifest is invalid | Regenerate the manifest or pass a path to a valid JSON manifest. |",
  "| `CROCO_CLI_DI_CHECK_002` | `cli/di-manifest-failed` | DI check manifest failed without diagnostics | Regenerate the manifest with diagnostics or fix the producer that emitted the failed manifest. |",
  "| `CROCO_CLI_DI_CHECK_003` | `cli/di-diagnostic-unknown` | DI check diagnostic code is missing | Fix the manifest producer so every diagnostic carries a stable code. |",
  "| `CROCO_CLI_PROJECT_MAP_001` | `project-map/framework-manifest-*` | Project Map wrapped a framework manifest diagnostic | Inspect the diagnostic `sourceCode` and `legacyCode` fields, fix the source manifest issue, and regenerate the Project Map. |",
  "| `CROCO_CLI_PROJECT_MAP_002` | `project-map/contract-route-conflict` | Project Map route contract conflicts with framework manifest | Regenerate both route artifacts from the same source and commit the matching outputs. |",
  "| `CROCO_CLI_PROJECT_MAP_003` | `project-map/contract-graph-*` | Project Map wrapped a Contract Graph diagnostic | Inspect the diagnostic `sourceCode` and `legacyCode` fields, fix the route contract issue, and regenerate artifacts. |",
  "| `CROCO_CLI_PROJECT_MAP_004` | `project-map/runtime-target-missing` | Project Map runtime target is missing | Add `runtime.platform` or `target` to the runtime policy manifest. |",
  "| `CROCO_CLI_PROJECT_MAP_005` | `project-map/runtime-target-unsupported` | Project Map runtime target is unsupported | Use a supported runtime platform in the runtime policy manifest. |",
  "| `CROCO_CLI_PROJECT_MAP_006` | `project-map/runtime-capability-conflict` | Project Map runtime capability conflict | Change the runtime target or remove the unsupported capability requirement. |",
  "| `CROCO_CLI_PROJECT_MAP_007` | `project-map/package-manifest-conflict` | Project Map provider profile references an undeclared package | Declare the package dependency or remove it from the provider profile manifest. |",
  "| `CROCO_CLI_PROJECT_MAP_008` | `project-map/manifest-missing` | Project Map manifest is missing | Run `croco project map` with `--out` and commit the generated manifest. |",
  "| `CROCO_CLI_PROJECT_MAP_009` | `project-map/manifest-drift` | Project Map manifest is stale | Regenerate the Project Map manifest, review the diff, and commit it with the source change. |",
].join("\n");
const frontendReactDocs = [
  {
    path: apiDocsPath("frontend-react/src/classes/ProblemBoundary.md"),
    replacements: [
      [
        "### Constructor\n\n> **new ProblemBoundary**(`props`, `context`): `ProblemBoundary`",
        "### Constructor With Context\n\n> **new ProblemBoundary**(`props`, `context`): `ProblemBoundary`",
      ],
    ],
  },
  {
    path: apiDocsPath("frontend-react/src/functions/useEntitlements.md"),
    replacements: [
      [
        "## Call Signature\n\n> **useEntitlements**(): [`FrontendEntitlementState`](/api/frontend-react/src/type-aliases/frontendentitlementstate/)",
        "## Current Entitlements Signature\n\n> **useEntitlements**(): [`FrontendEntitlementState`](/api/frontend-react/src/type-aliases/frontendentitlementstate/)",
      ],
      [
        "## Call Signature\n\n> **useEntitlements**(`entitlements`, `options?`): [`FrontendAuthGateState`](/api/frontend-react/src/type-aliases/frontendauthgatestate/)",
        "## Gate Evaluation Signature\n\n> **useEntitlements**(`entitlements`, `options?`): [`FrontendAuthGateState`](/api/frontend-react/src/type-aliases/frontendauthgatestate/)",
      ],
    ],
  },
  {
    path: apiDocsPath("frontend-react/src/type-aliases/ProblemBoundaryFallback.md"),
    replacements: [
      [
        "> **ProblemBoundaryFallback** = `ReactNode` \\| (`state`) => `ReactNode`",
        "> **ProblemBoundaryFallback** = `ReactNode` \\| (`state`: [`ProblemBoundaryFallbackState`](/api/frontend-react/src/type-aliases/problemboundaryfallbackstate/)) => `ReactNode`",
      ],
    ],
  },
];
const routeContractDocs = [
  {
    path: apiDocsPath("protocols-rest/src/functions/Body.md"),
    replacements: [
      [
        "## Call Signature\n\n> **Body**\\<`TContract`\\>(`contract`): `ParameterDecorator`",
        "## Contract Overload\n\n> **Body**\\<`TContract`\\>(`contract`): `ParameterDecorator`",
      ],
      [
        "`TContract` *extends* [`RouteContractWithBody`](/api/protocols-rest/src/type-aliases/routecontractwithbody/)",
        `\`TContract\` *extends* ${routeContractSpecLink} & \`{ readonly body: z.ZodType }\``,
      ],
      [
        "## Call Signature\n\n> **Body**(`schema?`): `ParameterDecorator`",
        "## Schema Overload\n\n> **Body**(`schema?`): `ParameterDecorator`",
      ],
    ],
  },
  {
    path: apiDocsPath("protocols-rest/src/functions/Param.md"),
    replacements: [
      [
        "## Call Signature\n\n> **Param**\\<`TContract`, `Name`\\>(`contract`, `name`): `ParameterDecorator`",
        "## Contract Overload\n\n> **Param**\\<`TContract`, `Name`\\>(`contract`, `name`): `ParameterDecorator`",
      ],
      [
        "`TContract` *extends* [`RouteContractWithParams`](/api/protocols-rest/src/type-aliases/routecontractwithparams/)",
        `\`TContract\` *extends* ${routeContractSpecLink} & \`{ readonly params: AnyZodObject }\``,
      ],
      ["`Name` *extends* `string`", `\`Name\` *extends* ${paramsNameConstraint}`],
      [
        "## Call Signature\n\n> **Param**(`name`, `schema?`): `ParameterDecorator`",
        "## Schema Overload\n\n> **Param**(`name`, `schema?`): `ParameterDecorator`",
      ],
    ],
  },
  {
    path: apiDocsPath("protocols-rest/src/functions/Query.md"),
    replacements: [
      [
        "## Call Signature\n\n> **Query**\\<`TContract`, `Name`\\>(`contract`, `name`): `ParameterDecorator`",
        "## Contract Overload\n\n> **Query**\\<`TContract`, `Name`\\>(`contract`, `name`): `ParameterDecorator`",
      ],
      [
        "`TContract` *extends* [`RouteContractWithQuery`](/api/protocols-rest/src/type-aliases/routecontractwithquery/)",
        `\`TContract\` *extends* ${routeContractSpecLink} & \`{ readonly query: AnyZodObject }\``,
      ],
      ["`Name` *extends* `string`", `\`Name\` *extends* ${queryNameConstraint}`],
      [
        "## Call Signature\n\n> **Query**(`name`, `schema?`): `ParameterDecorator`",
        "## Schema Overload\n\n> **Query**(`name`, `schema?`): `ParameterDecorator`",
      ],
    ],
  },
  {
    path: apiDocsPath("protocols-rest/src/functions/ResponseSchema.md"),
    replacements: [
      [
        "## Call Signature\n\n> **ResponseSchema**\\<`TContract`\\>(`contract`): `MethodDecorator`\n",
        "## Contract Overload\n\n> **ResponseSchema**\\<`TContract`\\>(`contract`): `MethodDecorator`\n\n응답 스키마를 메서드에 바인딩합니다.\n",
      ],
      [
        "`TContract` *extends* [`RouteContractWithResponse`](/api/protocols-rest/src/type-aliases/routecontractwithresponse/)",
        `\`TContract\` *extends* ${routeContractSpecLink} & \`{ readonly response: z.ZodType }\``,
      ],
      [
        "## Call Signature\n\n> **ResponseSchema**(`schema`): `MethodDecorator`\n",
        "## Schema Overload\n\n> **ResponseSchema**(`schema`): `MethodDecorator`\n\n응답 스키마를 메서드에 바인딩합니다.\n",
      ],
    ],
  },
  {
    path: apiDocsPath("protocols-rest/src/functions/routeParamSchema.md"),
    replacements: [
      [
        "`TContract` *extends* [`RouteContractWithParams`](/api/protocols-rest/src/type-aliases/routecontractwithparams/)",
        `\`TContract\` *extends* ${routeContractSpecLink} & \`{ readonly params: AnyZodObject }\``,
      ],
      ["`Name` *extends* `string`", `\`Name\` *extends* ${paramsNameConstraint}`],
    ],
  },
  {
    path: apiDocsPath("protocols-rest/src/functions/routeQueryParamSchema.md"),
    replacements: [
      [
        "`TContract` *extends* [`RouteContractWithQuery`](/api/protocols-rest/src/type-aliases/routecontractwithquery/)",
        `\`TContract\` *extends* ${routeContractSpecLink} & \`{ readonly query: AnyZodObject }\``,
      ],
      ["`Name` *extends* `string`", `\`Name\` *extends* ${queryNameConstraint}`],
    ],
  },
  {
    path: apiDocsPath("protocols-rest/src/functions/isRouteContractSpec.md"),
    replacements: [
      [
        "> **isRouteContractSpec**(`value`): `value is AnyRouteContractSpec`\n",
        "> **isRouteContractSpec**(`value`): `value is RouteContractSpec`\n\nRoute contract decorator overloads use this guard to distinguish contract objects from direct schema arguments at runtime.\n",
      ],
      [
        "## Returns\n\n`value is AnyRouteContractSpec`\n",
        "## Returns\n\n`value is RouteContractSpec`\n\n## Example\n\n```ts\nif (isRouteContractSpec(value)) {\n  value.method;\n  value.path;\n}\n```\n",
      ],
    ],
  },
  {
    path: apiDocsPath("protocols-rest/src/type-aliases/RouteContractWithBody.md"),
    replacements: [
      [
        `> **RouteContractWithBody** = ${routeContractSpecLink} & \`object\``,
        `> **RouteContractWithBody** = ${routeContractSpecLink} & \`{ readonly body: z.ZodType }\``,
      ],
    ],
  },
  {
    path: apiDocsPath("protocols-rest/src/type-aliases/RouteContractWithParams.md"),
    replacements: [
      [
        `> **RouteContractWithParams** = ${routeContractSpecLink} & \`object\``,
        `> **RouteContractWithParams** = ${routeContractSpecLink} & \`{ readonly params: AnyZodObject }\``,
      ],
    ],
  },
  {
    path: apiDocsPath("protocols-rest/src/type-aliases/RouteContractWithQuery.md"),
    replacements: [
      [
        `> **RouteContractWithQuery** = ${routeContractSpecLink} & \`object\``,
        `> **RouteContractWithQuery** = ${routeContractSpecLink} & \`{ readonly query: AnyZodObject }\``,
      ],
    ],
  },
  {
    path: apiDocsPath("protocols-rest/src/type-aliases/RouteContractWithResponse.md"),
    replacements: [
      [
        `> **RouteContractWithResponse** = ${routeContractSpecLink} & \`object\``,
        `> **RouteContractWithResponse** = ${routeContractSpecLink} & \`{ readonly response: z.ZodType }\``,
      ],
    ],
  },
];

export async function sanitizeTypeDocIndex() {
  await sanitizeApiIndex();
  await sanitizeDiagnosticCodeDefinitions();
  await sanitizePolicyExecutionPlan();
  await sanitizeRestRouteContractDocs();
  await sanitizeFrontendReactDocs();
}

async function sanitizeApiIndex() {
  const content = await readFile(apiIndexPath, "utf8");
  const sanitized = content.replace(
    /## Modules\n\n(?:- \[[^\n]+\]\([^\n]+\/readme\/\)\n?)+/u,
    replacement,
  );

  if (sanitized !== content) {
    await writeFile(apiIndexPath, sanitized.endsWith("\n") ? sanitized : `${sanitized}\n`);
  }
}

async function sanitizePolicyExecutionPlan() {
  const content = await readFile(policyExecutionPlanPath, "utf8");
  const sanitized = content
    .replace(
      `> **getPolicyExecutionPlan**(\`table\`, \`target\`, \`capabilities\`): ${policyExecutionPlanLink}\n`,
      `> **getPolicyExecutionPlan**(\`table\`, \`target\`, \`capabilities\`): ${policyExecutionPlanResult}\n`,
    )
    .replace(
      `## Returns\n\n${policyExecutionPlanLink}\n`,
      `## Returns\n\n${policyExecutionPlanResult}\n`,
    );

  if (sanitized !== content) {
    await writeFile(
      policyExecutionPlanPath,
      sanitized.endsWith("\n") ? sanitized : `${sanitized}\n`,
    );
  }
}

async function sanitizeDiagnosticCodeDefinitions() {
  const content = await readFile(diagnosticCodeDefinitionsPath, "utf8");
  const signaturePattern = /\n> `const` \*\*CROCO\\?_DIAGNOSTIC\\?_CODE\\?_DEFINITIONS\*\*:/u;
  const contentWithoutTable = content.replace(
    /\n## CLI Diagnostic Definitions\n\n[\s\S]*?(?=\n> `const` \*\*CROCO\\?_DIAGNOSTIC\\?_CODE\\?_DEFINITIONS\*\*:)/u,
    "\n",
  );
  const sanitized = contentWithoutTable.replace(
    signaturePattern,
    (signatureMarker) => `\n${cliDiagnosticDefinitionsTable}\n\n${signatureMarker.slice(1)}`,
  );

  if (sanitized !== content) {
    await writeFile(
      diagnosticCodeDefinitionsPath,
      sanitized.endsWith("\n") ? sanitized : `${sanitized}\n`,
    );
  }
}

async function sanitizeRestRouteContractDocs() {
  await Promise.all(
    routeContractDocs.map(({ path, replacements }) => sanitizeMarkdown(path, replacements)),
  );
}

async function sanitizeFrontendReactDocs() {
  await Promise.all(
    frontendReactDocs.map(({ path, replacements }) => sanitizeMarkdown(path, replacements)),
  );
}

async function sanitizeMarkdown(path, replacements) {
  const content = await readFile(path, "utf8");
  const sanitized = replacements.reduce(
    (current, [search, replacement]) => current.replaceAll(search, replacement),
    content,
  );

  if (sanitized !== content) {
    await writeFile(path, sanitized.endsWith("\n") ? sanitized : `${sanitized}\n`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await sanitizeTypeDocIndex();
}
