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
import { beforeEach, describe, expect, it } from "vitest";
import { type CrocoApp, createApp } from "../libs/CrocoApp";
import { ErrorHandler } from "../libs/ErrorHandler";
import { HealthCheckRegistry } from "../libs/HealthCheckRegistry";
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
});
