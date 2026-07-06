import "reflect-metadata";
import { Container } from "@croco/framework-context";
import { Logger } from "@croco/framework-logger";
import { Problem, ProblemCategory, type ProblemDetails } from "@croco/problems-core";
import {
  assertContractGraphHasNoErrors,
  buildContractGraph,
  type ContractGraphRoute,
} from "@croco/protocols-core";
import {
  Body,
  Controller,
  defineRouteContract,
  defineRouteProblem,
  Header,
  HttpMethod,
  Param,
  Post,
  ProblemResponses,
  Query,
  RequestValidationProblem,
  routeProblemResponses,
} from "@croco/protocols-rest";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createApp, type CrocoApp, ErrorHandler, HealthCheckRegistry } from "../index";

const WidgetPathSchema = z.object({
  id: z.string().regex(/^widget_[a-z0-9]+$/),
});

const WidgetQuerySchema = z.object({
  mode: z.enum(["merge", "replace"]),
});

const WidgetHeadersSchema = z.object({
  "x-tenant-id": z.string().min(3),
});

const WidgetBodySchema = z.object({
  name: z.string().min(1),
  enabled: z.boolean(),
});

const WidgetResponseSchema = z.object({
  id: z.string(),
  mode: z.enum(["merge", "replace"]),
  tenantId: z.string(),
  name: z.string(),
  enabled: z.boolean(),
});

class WidgetNotFoundProblem extends Problem {
  readonly code = "contract-parity/widget-not-found";
  readonly category = ProblemCategory.NotFound;

  constructor(id: string) {
    super(
      "contract-parity/widget-not-found",
      ProblemCategory.NotFound,
      `Widget '${id}' was not found`,
    );
  }
}

const requestValidationProblem = defineRouteProblem(RequestValidationProblem, {
  code: "protocols-rest/request-validation-failed",
  category: ProblemCategory.ValidationError,
});

const widgetNotFoundProblem = defineRouteProblem(WidgetNotFoundProblem, {
  code: "contract-parity/widget-not-found",
  category: ProblemCategory.NotFound,
});

const updateWidgetRoute = defineRouteContract({
  id: "contract-parity.update-widget",
  method: HttpMethod.POST,
  path: "/contract-parity/widgets/:id",
  operationId: "updateContractParityWidget",
  params: WidgetPathSchema,
  query: WidgetQuerySchema,
  body: WidgetBodySchema,
  response: WidgetResponseSchema,
  problems: [requestValidationProblem, widgetNotFoundProblem],
});

type WidgetBody = z.infer<typeof WidgetBodySchema>;
type WidgetMode = z.infer<typeof WidgetQuerySchema>["mode"];
type WidgetResponse = z.infer<typeof WidgetResponseSchema>;

@Controller("/contract-parity")
class ContractParityController {
  @Post(updateWidgetRoute)
  @ProblemResponses(...routeProblemResponses(updateWidgetRoute))
  updateWidget(
    @Param(updateWidgetRoute, "id") id: string,
    @Query(updateWidgetRoute, "mode") mode: WidgetMode,
    @Header("x-tenant-id", WidgetHeadersSchema.shape["x-tenant-id"]) tenantId: string,
    @Body(updateWidgetRoute) body: WidgetBody,
  ): WidgetResponse {
    if (id === "widget_missing") {
      throw new WidgetNotFoundProblem(id);
    }

    return {
      id,
      mode,
      tenantId,
      name: body.name,
      enabled: body.enabled,
    };
  }
}

type ValidationProblemDetails = ProblemDetails & {
  readonly issues?: readonly {
    readonly path: string;
    readonly message: string;
  }[];
};

describe("REST contract-to-runtime parity", () => {
  let app: CrocoApp;
  let route: ContractGraphRoute;

  beforeEach(() => {
    Container.reset();

    const logger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    } as unknown as Logger;
    Container.set(Logger, logger);
    Container.set(ErrorHandler, new ErrorHandler(logger));
    Container.set(HealthCheckRegistry, new HealthCheckRegistry());

    const graph = buildContractGraph([ContractParityController], {
      strictProblemResponses: true,
      strictSchemas: true,
    });
    assertContractGraphHasNoErrors(graph);

    const graphRoute = graph.routes.find(
      (candidate) => candidate.routeId === "ContractParityController.updateWidget",
    );
    if (!graphRoute) {
      throw new Error("ContractParityController.updateWidget was not present in ContractGraph.");
    }

    route = graphRoute;
    app = createApp({
      controllers: [ContractParityController],
      securityValidation: "off",
    });
  });

  it("keeps accepted contract metadata aligned with the fixture route", () => {
    expect(route).toMatchObject({
      routeId: "ContractParityController.updateWidget",
      operationId: "updateContractParityWidget",
      httpMethod: "POST",
      path: "/contract-parity/widgets/:id",
      routeContract: {
        id: "contract-parity.update-widget",
        method: "POST",
        path: "/contract-parity/widgets/:id",
      },
    });
    expect(route.inputSchemas.path).toBe(WidgetPathSchema);
    expect(route.inputSchemas.query).toBe(WidgetQuerySchema);
    expectRouteSchemaParse(route, "headers", route.inputSchemas.headers, {
      "x-tenant-id": "tenant-a",
    });
    expect(route.inputSchemas.body).toBe(WidgetBodySchema);
    expect(route.outputSchema).toBe(WidgetResponseSchema);
    expect(route.problemResponses?.map((response) => response.code).sort()).toEqual([
      "contract-parity/widget-not-found",
      "protocols-rest/request-validation-failed",
    ]);
    expect(route.routeContract?.problemResponses.map((response) => response.code).sort()).toEqual([
      "contract-parity/widget-not-found",
      "protocols-rest/request-validation-failed",
    ]);
  });

  it("matches success responses to the route response contract at runtime", async () => {
    const response = await app.fetch(
      createUpdateRequest({
        id: "widget_123",
        mode: "replace",
        tenantId: "tenant-a",
        body: { name: "Contract widget", enabled: true },
      }),
    );

    const body = await expectJsonResponse(response, route, 200);
    expectRouteSchemaParse(route, "response", route.outputSchema, body);
    expect(body).toEqual({
      id: "widget_123",
      mode: "replace",
      tenantId: "tenant-a",
      name: "Contract widget",
      enabled: true,
    });
  });

  it.each([
    {
      name: "path parameter",
      request: createUpdateRequest({
        id: "invalid",
        mode: "replace",
        tenantId: "tenant-a",
        body: { name: "Contract widget", enabled: true },
      }),
      schemaLocation: "path" as const,
      schemaInput: { id: "invalid" },
      issuePath: "params.value",
    },
    {
      name: "query parameter",
      request: createUpdateRequest({
        id: "widget_123",
        mode: "delete",
        tenantId: "tenant-a",
        body: { name: "Contract widget", enabled: true },
      }),
      schemaLocation: "query" as const,
      schemaInput: { mode: "delete" },
      issuePath: "query.value",
    },
    {
      name: "header parameter",
      request: createUpdateRequest({
        id: "widget_123",
        mode: "replace",
        tenantId: "x",
        body: { name: "Contract widget", enabled: true },
      }),
      schemaLocation: "headers" as const,
      schemaInput: { "x-tenant-id": "x" },
      issuePath: "headers.value",
    },
    {
      name: "body payload",
      request: createUpdateRequest({
        id: "widget_123",
        mode: "replace",
        tenantId: "tenant-a",
        body: { name: "", enabled: true },
      }),
      schemaLocation: "body" as const,
      schemaInput: { name: "", enabled: true },
      issuePath: "body.name",
    },
  ])(
    "matches $name validation failures to declared request metadata",
    async ({ request, schemaLocation, schemaInput, issuePath }) => {
      expectRouteSchemaFailure(
        route,
        schemaLocation,
        route.inputSchemas[schemaLocation],
        schemaInput,
      );

      const response = await app.fetch(request);
      const problem = await expectProblemResponse(response, route, {
        status: 422,
        code: "protocols-rest/request-validation-failed",
      });

      expectProblemIssuePath(route, problem, issuePath);
    },
  );

  it("matches declared domain Problem responses at runtime", async () => {
    const response = await app.fetch(
      createUpdateRequest({
        id: "widget_missing",
        mode: "replace",
        tenantId: "tenant-a",
        body: { name: "Contract widget", enabled: true },
      }),
    );

    await expectProblemResponse(response, route, {
      status: 404,
      code: "contract-parity/widget-not-found",
    });
  });
});

function createUpdateRequest(options: {
  readonly id: string;
  readonly mode: string;
  readonly tenantId: string;
  readonly body: unknown;
}): Request {
  return new Request(
    `http://localhost/contract-parity/widgets/${options.id}?mode=${options.mode}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tenant-id": options.tenantId,
      },
      body: JSON.stringify(options.body),
    },
  );
}

async function expectJsonResponse(
  response: Response,
  route: ContractGraphRoute,
  expectedStatus: number,
): Promise<unknown> {
  if (response.status !== expectedStatus) {
    throw new Error(
      `[${route.routeId}] expected HTTP ${expectedStatus}, received ${response.status}: ${await response.text()}`,
    );
  }

  return response.json();
}

async function expectProblemResponse(
  response: Response,
  route: ContractGraphRoute,
  expected: {
    readonly status: number;
    readonly code: string;
  },
): Promise<ValidationProblemDetails> {
  const problem = (await expectJsonResponse(
    response,
    route,
    expected.status,
  )) as ValidationProblemDetails;
  const declared = route.problemResponses?.find((candidate) => candidate.code === expected.code);

  if (!declared) {
    throw new Error(
      `[${route.routeId}] runtime Problem '${expected.code}' is not declared in route metadata.`,
    );
  }

  if (declared.status !== expected.status) {
    throw new Error(
      `[${route.routeId}] declared Problem '${expected.code}' status ${declared.status} does not match expected runtime status ${expected.status}.`,
    );
  }

  if (problem.code !== expected.code) {
    throw new Error(
      `[${route.routeId}] expected runtime Problem code '${expected.code}', received '${problem.code}'.`,
    );
  }

  if (problem.status !== expected.status) {
    throw new Error(
      `[${route.routeId}] expected runtime Problem status ${expected.status}, received ${problem.status}.`,
    );
  }

  return problem;
}

function expectRouteSchemaParse(
  route: ContractGraphRoute,
  location: string,
  schema: z.ZodType | null,
  value: unknown,
): void {
  if (!schema) {
    throw new Error(`[${route.routeId}] missing ${location} schema metadata.`);
  }

  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(
      `[${route.routeId}] runtime ${location} value did not match contract metadata: ${result.error.message}`,
    );
  }
}

function expectRouteSchemaFailure(
  route: ContractGraphRoute,
  location: string,
  schema: z.ZodType | null,
  value: unknown,
): void {
  if (!schema) {
    throw new Error(`[${route.routeId}] missing ${location} schema metadata.`);
  }

  const result = schema.safeParse(value);
  if (result.success) {
    throw new Error(
      `[${route.routeId}] test fixture for ${location} did not violate the accepted contract metadata.`,
    );
  }
}

function readValidationIssuePaths(problem: ValidationProblemDetails): string[] {
  return Array.isArray(problem.issues) ? problem.issues.map((issue) => issue.path) : [];
}

function expectProblemIssuePath(
  route: ContractGraphRoute,
  problem: ValidationProblemDetails,
  expectedPath: string,
): void {
  const issuePaths = readValidationIssuePaths(problem);
  if (!issuePaths.includes(expectedPath)) {
    throw new Error(
      `[${route.routeId}] expected runtime validation issue '${expectedPath}', received [${issuePaths.join(", ")}].`,
    );
  }
}
