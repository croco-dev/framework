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
