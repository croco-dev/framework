import { describe, expect, it } from "vitest";
import {
  PipelineGraphProblem,
  compilePolicyTable,
  compileRequestPipelineGraph,
  createPolicyTarget,
  definePolicy,
  requestPipelineNodesFromPolicyPlan,
  type RequestPipelineNode,
} from "../index";

describe("RequestPipelineGraph", () => {
  it("should compile a deterministic request pipeline graph with phases and policy nodes", () => {
    const target = createPolicyTarget("route", "OrdersController", { operation: "create" });
    const policyTable = compilePolicyTable([
      definePolicy(target, { kind: "retry", maxAttempts: 3 }),
      definePolicy(target, { kind: "timeout", timeoutMs: 500 }),
      definePolicy(target, { kind: "tracing", spanName: "orders.create" }),
    ]);
    const policyPlan = policyTable.plans[0];

    const graph = compileRequestPipelineGraph(
      [
        node("middleware:security:before", "middleware", "before", 10, "short-circuit"),
        node("guard:auth", "guard", "before", 100, "terminal"),
        node("interceptor:envelope:before", "interceptor", "before", 300, "observe-and-rethrow"),
        node("handler:OrdersController.create", "handler", "handler", 10, "terminal"),
        node("interceptor:envelope:after", "interceptor", "after", 100, "observe-and-rethrow"),
        node("middleware:security:after", "middleware", "after", 200, "short-circuit"),
        node("filter:http-exception", "filter", "error", 10, "handle-error"),
      ],
      {
        target: "GET /orders",
        policyPlan,
      },
    );

    expect(graph.successOrder).toEqual([
      "middleware:security:before",
      "guard:auth",
      "policy:tracing",
      "policy:timeout",
      "policy:retry",
      "interceptor:envelope:before",
      "handler:OrdersController.create",
      "interceptor:envelope:after",
      "middleware:security:after",
    ]);
    expect(graph.executionOrder).toEqual(graph.successOrder);
    expect(graph.errorOrder).toEqual([
      "middleware:security:before",
      "guard:auth",
      "policy:tracing",
      "policy:timeout",
      "policy:retry",
      "interceptor:envelope:before",
      "handler:OrdersController.create",
      "interceptor:envelope:after",
      "filter:http-exception",
      "middleware:security:after",
    ]);
    expect(graph.phaseOrder).toEqual({
      before: [
        "middleware:security:before",
        "guard:auth",
        "policy:tracing",
        "policy:timeout",
        "policy:retry",
        "interceptor:envelope:before",
      ],
      handler: ["handler:OrdersController.create"],
      after: ["interceptor:envelope:after", "middleware:security:after"],
      error: ["filter:http-exception"],
    });
    expect(graph.nodes.find((entry) => entry.id === "policy:retry")?.failurePropagation).toBe(
      "retryable-operation-error",
    );
    expect(graph.debugDump).toContain("request-pipeline GET /orders");
    expect(graph.debugDump).toContain("before:");
    expect(graph.debugDump).toContain("success-order:");
    expect(graph.debugDump).toContain("error-order:");
    expect(graph.debugDump).toContain("filter filter:http-exception (handle-error)");
  });

  it("should expose policy execution plans as pipeline nodes", () => {
    const target = createPolicyTarget("route", "OrdersController", { operation: "create" });
    const [plan] = compilePolicyTable([
      definePolicy(target, { kind: "tracing", spanName: "orders.create" }),
      definePolicy(target, { kind: "timeout", timeoutMs: 500 }),
    ]).plans;

    const policyNodes = requestPipelineNodesFromPolicyPlan(plan, {
      idPrefix: "route-policy",
      orderOffset: 500,
    });

    expect(policyNodes.map((entry) => entry.id)).toEqual([
      "route-policy:tracing",
      "route-policy:timeout",
    ]);
    expect(policyNodes.map((entry) => entry.failurePropagation)).toEqual([
      "observe-and-rethrow",
      "terminal",
    ]);
    expect(policyNodes.map((entry) => entry.order)).toEqual([510, 520]);
  });

  it("should reject duplicate node ids", () => {
    expect(() =>
      compileRequestPipelineGraph([
        node("handler:orders.create", "handler", "handler", 10, "terminal"),
        node("handler:orders.create", "handler", "handler", 20, "terminal"),
      ]),
    ).toThrow(PipelineGraphProblem);
  });

  it("should reject dependency order conflicts", () => {
    expect(() =>
      compileRequestPipelineGraph([
        {
          ...node("guard:auth", "guard", "before", 10, "terminal"),
          dependsOn: ["handler:orders.create"],
        },
        node("handler:orders.create", "handler", "handler", 10, "terminal"),
      ]),
    ).toThrow("phase/order places 'handler:orders.create' after 'guard:auth'");
  });

  it("should use kind and id tie breakers for same phase and order nodes", () => {
    const graph = compileRequestPipelineGraph([
      node("guard:z", "guard", "before", 10, "terminal"),
      node("middleware:z", "middleware", "before", 10, "short-circuit"),
      node("guard:a", "guard", "before", 10, "terminal"),
      node("handler:orders.create", "handler", "handler", 10, "terminal"),
    ]);

    expect(graph.successOrder).toEqual([
      "middleware:z",
      "guard:a",
      "guard:z",
      "handler:orders.create",
    ]);
    expect(graph.edges).toContainEqual({
      from: "middleware:z",
      to: "guard:a",
      reason: "success-order",
    });
  });

  it("should reject dependency cycles", () => {
    expect(() =>
      compileRequestPipelineGraph([
        {
          ...node("guard:a", "guard", "before", 10, "terminal"),
          dependsOn: ["guard:b"],
        },
        {
          ...node("guard:b", "guard", "before", 10, "terminal"),
          dependsOn: ["guard:a"],
        },
        node("handler:orders.create", "handler", "handler", 10, "terminal"),
      ]),
    ).toThrow("Pipeline graph contains a cycle: guard:a -> guard:b");
  });

  it("should allow handlerless graphs when requireHandler is false", () => {
    const graph = compileRequestPipelineGraph([], { requireHandler: false });

    expect(graph.nodes).toEqual([]);
    expect(graph.successOrder).toEqual([]);
    expect(graph.phaseOrder.handler).toEqual([]);
  });

  it("should require exactly one handler when requireHandler is omitted", () => {
    expect(() => compileRequestPipelineGraph([])).toThrow(PipelineGraphProblem);
    expect(() => compileRequestPipelineGraph([])).toThrow(
      "Request pipeline graph must declare exactly one handler node, found 0.",
    );
  });
});

function node(
  id: string,
  kind: RequestPipelineNode["kind"],
  phase: RequestPipelineNode["phase"],
  order: number,
  failurePropagation: RequestPipelineNode["failurePropagation"],
): RequestPipelineNode {
  return {
    id,
    kind,
    phase,
    order,
    failurePropagation,
  };
}
