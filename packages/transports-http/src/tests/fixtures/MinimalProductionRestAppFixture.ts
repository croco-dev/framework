import "reflect-metadata";
import { Container, Inject, type ILogger, LOGGER_TOKEN } from "@croco/framework-context";
import { Problem, ProblemCategory } from "@croco/problems-core";
import {
  createSlidingWindowPolicy,
  RateLimiter,
  RateLimitKeyBuilder,
  SlidingWindowInMemoryStore,
} from "@croco/ratelimit-core";
import {
  Body,
  Controller,
  Get,
  Header,
  HttpMethod,
  Param,
  Post,
  ProblemResponses,
  Query,
  RequestValidationProblem,
  ResponseSchema,
  defineRouteContract,
  defineRouteProblem,
  routeProblemResponses,
  type Constructor as RestControllerConstructor,
  type RouteBody,
  type RouteMethodReturn,
  type RouteParam,
  type RouteQueryParam,
} from "@croco/protocols-rest";
import { z } from "zod";
import {
  bodyLimitMiddleware,
  corsMiddleware,
  createApp,
  createRuntimeAwareRateLimitClientIdentityPolicy,
  type CrocoApp,
  ErrorHandler,
  HealthCheckRegistry,
  type LambdaContext,
  type LambdaEvent,
  type MiddlewareFunction,
  rateLimitHttpMiddleware,
  securityHeadersMiddleware,
} from "../../index";

export const GOLDEN_PATH_ORIGIN = "https://golden.example.test";
export const GOLDEN_PATH_TENANT_HEADER = "x-tenant-id";

const goldenItemParamsSchema = z.object({
  id: z.string().min(1),
});

const goldenItemQuerySchema = z.object({
  includeAudit: z.enum(["true", "false"]).optional(),
});

const goldenItemResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  tenantId: z.string(),
  status: z.enum(["available"]),
  includeAudit: z.boolean(),
  servedBy: z.literal("minimal-production-rest-app"),
});

const createGoldenItemBodySchema = z.object({
  name: z.string().min(1),
  quantity: z.number().int().positive(),
});

const createGoldenItemResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  quantity: z.number().int().positive(),
  tenantId: z.string(),
  status: z.literal("created"),
});

export type GoldenItemResponse = z.infer<typeof goldenItemResponseSchema>;
export type CreateGoldenItemResponse = z.infer<typeof createGoldenItemResponseSchema>;

export class GoldenPathItemUnavailableProblem extends Problem {
  readonly code = "golden-path/item-unavailable";
  readonly category = ProblemCategory.Conflict;

  constructor(itemId: string) {
    super(
      "golden-path/item-unavailable",
      ProblemCategory.Conflict,
      `Inventory item '${itemId}' is unavailable.`,
      {
        type: "https://croco.dev/problems/golden-path/item-unavailable",
        extensions: {
          itemId,
          recovery: "Choose another inventory item.",
        },
      },
    );
  }
}

const goldenItemUnavailableProblem = defineRouteProblem(GoldenPathItemUnavailableProblem, {
  code: "golden-path/item-unavailable",
  category: ProblemCategory.Conflict,
  description: "The requested inventory item exists but is unavailable.",
  type: "https://croco.dev/problems/golden-path/item-unavailable",
});

const goldenRequestValidationProblem = defineRouteProblem(RequestValidationProblem, {
  code: "protocols-rest/request-validation-failed",
  category: ProblemCategory.ValidationError,
  description: "The request body, path, query, or headers failed validation.",
});

export const getGoldenItemContract = defineRouteContract({
  id: "golden-path.get-item",
  operationId: "goldenPathGetItem",
  method: HttpMethod.GET,
  path: "/golden/items/:id",
  params: goldenItemParamsSchema,
  query: goldenItemQuerySchema,
  response: goldenItemResponseSchema,
  problems: [goldenItemUnavailableProblem, goldenRequestValidationProblem],
});

export const createGoldenItemContract = defineRouteContract({
  id: "golden-path.create-item",
  operationId: "goldenPathCreateItem",
  method: HttpMethod.POST,
  path: "/golden/items",
  body: createGoldenItemBodySchema,
  response: createGoldenItemResponseSchema,
  problems: [goldenRequestValidationProblem],
});

export class GoldenPathInventoryService {
  getItem(
    id: RouteParam<typeof getGoldenItemContract, "id">,
    tenantId: string,
    includeAudit: RouteQueryParam<typeof getGoldenItemContract, "includeAudit">,
  ): GoldenItemResponse {
    if (id === "unavailable") {
      throw new GoldenPathItemUnavailableProblem(id);
    }

    return {
      id,
      name: id === "seed-1" ? "Seed Inventory Item" : `Inventory ${id}`,
      tenantId,
      status: "available",
      includeAudit: includeAudit === "true",
      servedBy: "minimal-production-rest-app",
    };
  }

  createItem(
    body: RouteBody<typeof createGoldenItemContract>,
    tenantId: string,
  ): CreateGoldenItemResponse {
    return {
      id: `created-${slugify(body.name)}-${body.quantity}`,
      name: body.name,
      quantity: body.quantity,
      tenantId,
      status: "created",
    };
  }
}

@Controller("/golden")
export class GoldenPathRestController {
  constructor(
    @Inject(() => GoldenPathInventoryService)
    private readonly inventory: GoldenPathInventoryService,
  ) {}

  @Get(getGoldenItemContract)
  @ResponseSchema(getGoldenItemContract)
  @ProblemResponses(...routeProblemResponses(getGoldenItemContract))
  getItem(
    @Param(getGoldenItemContract, "id") id: RouteParam<typeof getGoldenItemContract, "id">,
    @Query(getGoldenItemContract, "includeAudit")
    includeAudit: RouteQueryParam<typeof getGoldenItemContract, "includeAudit">,
    @Header(GOLDEN_PATH_TENANT_HEADER, z.string().min(1)) tenantId: string,
  ): RouteMethodReturn<typeof getGoldenItemContract> {
    return this.inventory.getItem(id, tenantId, includeAudit);
  }

  @Post(createGoldenItemContract)
  @ResponseSchema(createGoldenItemContract)
  @ProblemResponses(...routeProblemResponses(createGoldenItemContract))
  createItem(
    @Body(createGoldenItemContract) body: RouteBody<typeof createGoldenItemContract>,
    @Header(GOLDEN_PATH_TENANT_HEADER, z.string().min(1)) tenantId: string,
  ): RouteMethodReturn<typeof createGoldenItemContract> {
    return this.inventory.createItem(body, tenantId);
  }
}

export const GOLDEN_PATH_REST_CONTROLLERS = [
  GoldenPathRestController as unknown as RestControllerConstructor,
];

export function registerMinimalProductionRestAppProviders(): void {
  const logger: ILogger = {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    debug: () => undefined,
    child: () => logger,
  };

  Container.set(LOGGER_TOKEN, logger);
  Container.set(ErrorHandler, new ErrorHandler(logger));
  Container.set(HealthCheckRegistry, new HealthCheckRegistry());
  Container.register(GoldenPathInventoryService, "singleton");
  Container.register(GoldenPathRestController, "singleton");
  Container.registerLazy(
    GoldenPathRestController,
    () => new GoldenPathRestController(Container.get(GoldenPathInventoryService)),
  );
}

export function createMinimalProductionRestApp(): CrocoApp {
  registerMinimalProductionRestAppProviders();

  return createApp({
    controllers: GOLDEN_PATH_REST_CONTROLLERS,
    middlewares: [
      securityHeadersMiddleware(),
      corsMiddleware({
        origins: [GOLDEN_PATH_ORIGIN],
        allowedHeaders: ["content-type", GOLDEN_PATH_TENANT_HEADER],
      }),
      bodyLimitMiddleware({ limit: 1024 }),
      rateLimitHttpMiddleware({
        rateLimiter: new RateLimiter(
          new SlidingWindowInMemoryStore(),
          new RateLimitKeyBuilder(["ip"]),
          { failOpen: false },
        ),
        policy: createSlidingWindowPolicy("golden-path", 100, 60000),
        clientIdentity: createRuntimeAwareRateLimitClientIdentityPolicy(),
      }),
      goldenPathEvidenceMiddleware,
    ],
    diValidation: "enforce",
    securityValidation: "enforce",
  });
}

export function createMinimalProductionLambdaEvent(
  method: "GET" | "POST",
  path: string,
  options: {
    readonly body?: unknown;
    readonly headers?: Record<string, string>;
    readonly rawQueryString?: string;
  } = {},
): LambdaEvent {
  const headers = {
    host: "lambda.golden.example.test",
    ...options.headers,
  };

  return {
    version: "2.0",
    routeKey: "$default",
    rawPath: path,
    rawQueryString: options.rawQueryString ?? "",
    headers,
    requestContext: {
      accountId: "123456789012",
      apiId: "api-golden",
      domainName: "lambda.golden.example.test",
      domainPrefix: "lambda",
      http: {
        method,
        path,
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "vitest",
      },
      requestId: "gateway-golden-req",
      routeKey: "$default",
      stage: "$default",
      time: "06/Jul/2026:12:00:00 +0000",
      timeEpoch: 1783339200000,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    isBase64Encoded: false,
  };
}

export function createMinimalProductionLambdaContext(): LambdaContext {
  return {
    callbackWaitsForEmptyEventLoop: false,
    functionName: "golden-path",
    functionVersion: "$LATEST",
    invokedFunctionArn: "arn:aws:lambda:ap-northeast-2:123456789012:function:golden-path",
    logGroupName: "/aws/lambda/golden-path",
    logStreamName: "2026/07/06/[$LATEST]abcdef",
    memoryLimitInMB: "128",
    awsRequestId: "lambda-golden-req",
    done: () => undefined,
    fail: () => undefined,
    getRemainingTimeInMillis: () => 5000,
    succeed: () => undefined,
  };
}

const goldenPathEvidenceMiddleware: MiddlewareFunction = async (ctx, next) => {
  await next();
  ctx.res.headers["x-golden-path-middleware"] = "observed";
  ctx.raw.header("x-golden-path-middleware", "observed");
};

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
