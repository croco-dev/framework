import "reflect-metadata";
import { Container, type Guard, type RequestPipelineGraph } from "@croco/framework-context";
import { Logger } from "@croco/framework-logger";
import { Problem, ProblemFactory } from "@croco/problems-core";
import {
  type CallHandler,
  Controller,
  type ExceptionFilter,
  type ExecutionContext,
  Get,
  type HttpExceptionFilterResponse,
  type Interceptor,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from "@croco/protocols-rest";
import {
  createSlidingWindowPolicy,
  RateLimiter,
  SlidingWindowInMemoryStore,
} from "@croco/ratelimit-core";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type CrocoApp, createApp } from "../libs/CrocoApp";
import { ErrorHandler } from "../libs/ErrorHandler";
import { HealthCheckRegistry } from "../libs/HealthCheckRegistry";
import { rateLimitHttpMiddleware } from "../libs/middleware/RateLimitMiddleware";
import type { MiddlewareFunction } from "../libs/types";

type RuntimeEvent =
  | "middleware:before"
  | "middleware:after"
  | "guard"
  | "interceptor:before"
  | "interceptor:after"
  | "handler:success"
  | "handler:problem"
  | "handler:error"
  | "filter:problem"
  | "filter:error";

type HandlerRuntimeEvent = Extract<
  RuntimeEvent,
  "handler:success" | "handler:problem" | "handler:error"
>;
type NonHandlerRuntimeEvent = Exclude<RuntimeEvent, HandlerRuntimeEvent>;

type PipelineScenario = {
  readonly path: "/problem" | "/error";
  readonly status: number;
  readonly body: Record<string, unknown>;
  readonly events: readonly RuntimeEvent[];
  readonly nodeIds: readonly string[];
};

const BASE_PATH = "/pipeline-conformance";
const SUCCESS_HANDLER_ID = "handler:PipelineConformanceController.success";
const PROBLEM_HANDLER_ID = "handler:PipelineConformanceController.problem";
const ERROR_HANDLER_ID = "handler:PipelineConformanceController.error";
const TELEMETRY_BEFORE_ID = "middleware:0:before";
const TELEMETRY_AFTER_ID = "middleware:0:after";
const MIDDLEWARE_BEFORE_ID = "middleware:1:before";
const MIDDLEWARE_AFTER_ID = "middleware:1:after";
const GUARD_ID = "guard:0";
const INTERCEPTOR_BEFORE_ID = "interceptor:0:before";
const INTERCEPTOR_AFTER_ID = "interceptor:0:after";
const FILTER_ID = "filter:0";
const TELEMETRY_NODE_IDS = new Set([TELEMETRY_BEFORE_ID, TELEMETRY_AFTER_ID]);
const RUNTIME_EVENT_NODE_ID_BY_EVENT: Record<NonHandlerRuntimeEvent, string> = {
  "middleware:before": MIDDLEWARE_BEFORE_ID,
  "middleware:after": MIDDLEWARE_AFTER_ID,
  guard: GUARD_ID,
  "interceptor:before": INTERCEPTOR_BEFORE_ID,
  "interceptor:after": INTERCEPTOR_AFTER_ID,
  "filter:problem": FILTER_ID,
  "filter:error": FILTER_ID,
};

let runtimeEvents: RuntimeEvent[] = [];

const pipelineConformanceMiddleware: MiddlewareFunction = async (_ctx, next) => {
  runtimeEvents.push("middleware:before");

  try {
    return await next();
  } finally {
    runtimeEvents.push("middleware:after");
  }
};

class PipelineConformanceGuard implements Guard<ExecutionContext> {
  canActivate(context: ExecutionContext): boolean {
    runtimeEvents.push("guard");

    return context.getRequest().headers.get("x-pipeline-allow") === "true";
  }
}

class PipelineConformanceInterceptor implements Interceptor<ExecutionContext> {
  async intercept(_context: ExecutionContext, next: CallHandler): Promise<unknown> {
    runtimeEvents.push("interceptor:before");

    try {
      return await next.handle();
    } finally {
      runtimeEvents.push("interceptor:after");
    }
  }
}

class PipelineConformanceFilter implements ExceptionFilter<unknown, ExecutionContext> {
  catch(exception: unknown): HttpExceptionFilterResponse {
    if (exception instanceof Problem) {
      runtimeEvents.push("filter:problem");

      return {
        status: exception.status,
        headers: { "Content-Type": "application/json" },
        body: {
          kind: "problem",
          code: exception.code,
          status: exception.status,
        },
      };
    }

    runtimeEvents.push("filter:error");

    return {
      status: 500,
      headers: { "Content-Type": "application/json" },
      body: {
        kind: "error",
        name: exception instanceof Error ? exception.name : typeof exception,
      },
    };
  }
}

@Controller(BASE_PATH)
class PipelineConformanceController {
  @Get("/success")
  @UseFilters(PipelineConformanceFilter)
  @UseInterceptors(PipelineConformanceInterceptor)
  @UseGuards(PipelineConformanceGuard)
  success(): Record<string, boolean> {
    runtimeEvents.push("handler:success");

    return { ok: true };
  }

  @Get("/problem")
  @UseFilters(PipelineConformanceFilter)
  @UseInterceptors(PipelineConformanceInterceptor)
  @UseGuards(PipelineConformanceGuard)
  problem(): never {
    runtimeEvents.push("handler:problem");

    throw ProblemFactory.badRequest("PIPELINE_CONFORMANCE_PROBLEM", "pipeline problem fixture");
  }

  @Get("/error")
  @UseFilters(PipelineConformanceFilter)
  @UseInterceptors(PipelineConformanceInterceptor)
  @UseGuards(PipelineConformanceGuard)
  error(): never {
    runtimeEvents.push("handler:error");

    throw new Error("pipeline generic error fixture");
  }
}

function createPipelineConformanceApp(): CrocoApp {
  return createApp({
    controllers: [PipelineConformanceController],
    middlewares: [pipelineConformanceMiddleware],
    securityValidation: "off",
  });
}

function requestFor(path: string, allow = true): Request {
  return new Request(`http://localhost${BASE_PATH}${path}`, {
    headers: allow ? { "x-pipeline-allow": "true" } : {},
  });
}

function findGraph(app: CrocoApp, target: string): RequestPipelineGraph {
  const graph = app.describeRequestPipelineGraphs().find((entry) => entry.target === target);

  if (!graph) {
    throw new Error(`Missing pipeline graph for ${target}`);
  }

  return graph;
}

function isHandlerRuntimeEvent(event: RuntimeEvent): event is HandlerRuntimeEvent {
  return event === "handler:success" || event === "handler:problem" || event === "handler:error";
}

function graphNodeIdsForEvents(events: readonly RuntimeEvent[], handlerId: string): string[] {
  return events.map((event) =>
    isHandlerRuntimeEvent(event) ? handlerId : RUNTIME_EVENT_NODE_ID_BY_EVENT[event],
  );
}

function expectGraphOrderToMatchRuntime(
  graph: RequestPipelineGraph,
  path: "success" | "error",
  expectedNodeIds: readonly string[],
): void {
  const graphOrder = path === "success" ? graph.successOrder : graph.errorOrder;
  const expectedGraphOrder = [TELEMETRY_BEFORE_ID, ...expectedNodeIds, TELEMETRY_AFTER_ID];

  expect(graphOrder).toEqual(expectedGraphOrder);
  expect(graphOrder.filter((nodeId) => !TELEMETRY_NODE_IDS.has(nodeId))).toEqual(expectedNodeIds);
}

function expectGuardShortCircuitGraphOrder(
  graph: RequestPipelineGraph,
  expectedReachedNodeIds: readonly string[],
): void {
  const expectedFullErrorOrder = [
    TELEMETRY_BEFORE_ID,
    MIDDLEWARE_BEFORE_ID,
    GUARD_ID,
    INTERCEPTOR_BEFORE_ID,
    SUCCESS_HANDLER_ID,
    INTERCEPTOR_AFTER_ID,
    FILTER_ID,
    MIDDLEWARE_AFTER_ID,
    TELEMETRY_AFTER_ID,
  ];
  const skippedByGuardFailure = new Set([
    INTERCEPTOR_BEFORE_ID,
    SUCCESS_HANDLER_ID,
    INTERCEPTOR_AFTER_ID,
  ]);

  expect(graph.errorOrder).toEqual(expectedFullErrorOrder);
  expect(
    graph.errorOrder.filter(
      (nodeId) => !TELEMETRY_NODE_IDS.has(nodeId) && !skippedByGuardFailure.has(nodeId),
    ),
  ).toEqual(expectedReachedNodeIds);
}

describe("HTTP request pipeline conformance", () => {
  beforeEach(() => {
    Container.reset();
    runtimeEvents = [];

    const logger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      fatal: () => {},
      child: () => logger,
    } as unknown as Logger;

    Container.set(Logger, logger);
    Container.set(ErrorHandler, new ErrorHandler(logger));
    Container.set(HealthCheckRegistry, new HealthCheckRegistry());
  });

  it("keeps success-path runtime execution in graph order", async () => {
    const app = createPipelineConformanceApp();
    const graph = findGraph(app, "GET /pipeline-conformance/success");
    const response = await app.fetch(requestFor("/success"));
    const expectedEvents: RuntimeEvent[] = [
      "middleware:before",
      "guard",
      "interceptor:before",
      "handler:success",
      "interceptor:after",
      "middleware:after",
    ];
    const expectedNodeIds = [
      MIDDLEWARE_BEFORE_ID,
      GUARD_ID,
      INTERCEPTOR_BEFORE_ID,
      SUCCESS_HANDLER_ID,
      INTERCEPTOR_AFTER_ID,
      MIDDLEWARE_AFTER_ID,
    ];

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(runtimeEvents).toEqual(expectedEvents);
    expect(graphNodeIdsForEvents(runtimeEvents, SUCCESS_HANDLER_ID)).toEqual(expectedNodeIds);
    expectGraphOrderToMatchRuntime(graph, "success", expectedNodeIds);
    expect(graph.nodes.find((node) => node.id === MIDDLEWARE_BEFORE_ID)?.label).toBe(
      "pipelineConformanceMiddleware.before",
    );
    expect(graph.nodes.find((node) => node.id === SUCCESS_HANDLER_ID)?.label).toBe(
      "PipelineConformanceController.success",
    );
  });

  it("keeps guard failure runtime execution in graph order and short-circuits downstream steps", async () => {
    const app = createPipelineConformanceApp();
    const graph = findGraph(app, "GET /pipeline-conformance/success");
    const response = await app.fetch(requestFor("/success", false));
    const expectedEvents: RuntimeEvent[] = [
      "middleware:before",
      "guard",
      "filter:problem",
      "middleware:after",
    ];
    const expectedNodeIds = [MIDDLEWARE_BEFORE_ID, GUARD_ID, FILTER_ID, MIDDLEWARE_AFTER_ID];

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      kind: "problem",
      code: "ACCESS_DENIED",
      status: 403,
    });
    expect(runtimeEvents).toEqual(expectedEvents);
    expect(runtimeEvents).not.toContain("interceptor:before");
    expect(runtimeEvents).not.toContain("interceptor:after");
    expect(runtimeEvents).not.toContain("handler:success");
    expect(graphNodeIdsForEvents(runtimeEvents, SUCCESS_HANDLER_ID)).toEqual(expectedNodeIds);
    expectGuardShortCircuitGraphOrder(graph, expectedNodeIds);
  });

  it.each<PipelineScenario>([
    {
      path: "/problem",
      status: 400,
      body: {
        kind: "problem",
        code: "PIPELINE_CONFORMANCE_PROBLEM",
        status: 400,
      },
      events: [
        "middleware:before",
        "guard",
        "interceptor:before",
        "handler:problem",
        "interceptor:after",
        "filter:problem",
        "middleware:after",
      ],
      nodeIds: [
        MIDDLEWARE_BEFORE_ID,
        GUARD_ID,
        INTERCEPTOR_BEFORE_ID,
        PROBLEM_HANDLER_ID,
        INTERCEPTOR_AFTER_ID,
        FILTER_ID,
        MIDDLEWARE_AFTER_ID,
      ],
    },
    {
      path: "/error",
      status: 500,
      body: {
        kind: "error",
        name: "Error",
      },
      events: [
        "middleware:before",
        "guard",
        "interceptor:before",
        "handler:error",
        "interceptor:after",
        "filter:error",
        "middleware:after",
      ],
      nodeIds: [
        MIDDLEWARE_BEFORE_ID,
        GUARD_ID,
        INTERCEPTOR_BEFORE_ID,
        ERROR_HANDLER_ID,
        INTERCEPTOR_AFTER_ID,
        FILTER_ID,
        MIDDLEWARE_AFTER_ID,
      ],
    },
  ])(
    "keeps $path failure runtime execution in graph order and verifies filter handling",
    async ({ path, status, body, events, nodeIds }) => {
      const app = createPipelineConformanceApp();
      const graph = findGraph(app, `GET /pipeline-conformance${path}`);
      const handlerId = path === "/problem" ? PROBLEM_HANDLER_ID : ERROR_HANDLER_ID;
      const response = await app.fetch(requestFor(path));

      expect(response.status).toBe(status);
      expect(await response.json()).toEqual(body);
      expect(runtimeEvents).toEqual(events);
      expect(graphNodeIdsForEvents(runtimeEvents, handlerId)).toEqual(nodeIds);
      expectGraphOrderToMatchRuntime(graph, "error", nodeIds);
      expect(graph.nodes.find((node) => node.id === FILTER_ID)?.failurePropagation).toBe(
        "handle-error",
      );
    },
  );

  describe("native Response completion", () => {
    @Controller("/native-response")
    class NativeResponseController {
      @Get("/unavailable")
      unavailable(): Response {
        return new Response("unavailable", { status: 503 });
      }

      @Get("/unauthorized")
      unauthorized(): Response {
        return new Response("unauthorized", { status: 401 });
      }
    }

    function createNativeResponseApp(middlewares: MiddlewareFunction[] = []): CrocoApp {
      return createApp({
        controllers: [NativeResponseController],
        middlewares,
        securityValidation: "off",
      });
    }

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("records the returned 503 in HTTP telemetry and marks the server span as ERROR", async () => {
      const span = trace.wrapSpanContext({
        traceId: "11111111111111111111111111111111",
        spanId: "2222222222222222",
        traceFlags: 1,
      });
      const setAttribute = vi.spyOn(span, "setAttribute");
      const setStatus = vi.spyOn(span, "setStatus");
      const tracer = trace.getTracer("croco-http", "0.0.1");
      vi.spyOn(tracer, "startSpan").mockReturnValue(span);
      vi.spyOn(trace, "getTracer").mockReturnValue(tracer);
      const app = createNativeResponseApp([() => new Response("unavailable", { status: 503 })]);

      const response = await app.fetch(new Request("http://localhost/native-response/unavailable"));

      expect(response.status).toBe(503);
      expect(await response.text()).toBe("unavailable");
      expect(setAttribute).toHaveBeenCalledWith("http.status_code", 503);
      expect(setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.ERROR });
    });

    it.each([
      { option: "skipSuccessfulRequests", secondStatus: 429 },
      { option: "skipFailedRequests", secondStatus: 401 },
    ] as const)(
      "accounts for returned 401 responses with $option",
      async ({ option, secondStatus }) => {
        const app = createNativeResponseApp([
          rateLimitHttpMiddleware({
            rateLimiter: new RateLimiter(new SlidingWindowInMemoryStore(), () => "native-response"),
            policy: createSlidingWindowPolicy("native-response", 1, 60000),
            [option]: true,
          }),
          () => new Response("unauthorized", { status: 401 }),
        ]);

        const first = await app.fetch(new Request("http://localhost/native-response/unauthorized"));
        const second = await app.fetch(
          new Request("http://localhost/native-response/unauthorized"),
        );

        expect(first.status).toBe(401);
        expect(await first.text()).toBe("unauthorized");
        expect(second.status).toBe(secondStatus);
      },
    );

    it("synchronizes each replacement before outer middleware resumes and preserves its body", async () => {
      const observed: Array<{ middleware: string; status: number }> = [];
      const outer: MiddlewareFunction = async (ctx, next) => {
        await next();
        observed.push({ middleware: "outer", status: ctx.res.status });
      };
      const middle: MiddlewareFunction = async (ctx, next) => {
        await next();
        observed.push({ middleware: "middle", status: ctx.res.status });
        return new Response("second replacement", { status: 502 });
      };
      const inner: MiddlewareFunction = async (ctx, next) => {
        await next();
        observed.push({ middleware: "inner", status: ctx.res.status });
        return new Response("first replacement", { status: 401 });
      };
      const app = createNativeResponseApp([outer, middle, inner]);

      const response = await app.fetch(new Request("http://localhost/native-response/unavailable"));

      expect(observed).toEqual([
        { middleware: "inner", status: 503 },
        { middleware: "middle", status: 401 },
        { middleware: "outer", status: 502 },
      ]);
      expect(response.status).toBe(502);
      expect(await response.text()).toBe("second replacement");
    });
  });
});
