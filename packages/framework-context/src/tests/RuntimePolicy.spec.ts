import { describe, expect, it } from "vitest";
import {
  assertPolicyRuntimeCapabilities,
  compilePolicyTable,
  createPolicyTarget,
  definePolicy,
  getPolicyExecutionPlan,
  PolicyCapabilityProblem,
  PolicyConflictProblem,
  PolicyDefinitionProblem,
  type PolicyDefinition,
} from "../index";

const capabilities = {
  env: true,
  filesystem: true,
  logger: true,
  nodeApi: true,
  requestLifecycle: true,
  trace: true,
  waitUntil: true,
  flush: true,
  shutdown: true,
};

describe("RuntimePolicy", () => {
  it("should compile route policies into an explicit execution plan", () => {
    const target = createPolicyTarget("route", "OrdersController", { operation: "create" });

    const table = compilePolicyTable([
      definePolicy(target, { kind: "retry", maxAttempts: 3, backoffMs: 25 }),
      definePolicy(target, { kind: "timeout", timeoutMs: 500, onTimeout: "abort" }),
      definePolicy(target, { kind: "tracing", spanName: "orders.create", recordErrors: true }),
    ]);

    const plan = getPolicyExecutionPlan(table, target, capabilities);

    expect(plan?.executionOrder).toEqual(["tracing", "timeout", "retry"]);
    expect(plan?.failurePropagation).toEqual([
      { kind: "tracing", failurePropagation: "observe-and-rethrow" },
      { kind: "timeout", failurePropagation: "terminal" },
      { kind: "retry", failurePropagation: "retryable-operation-error" },
    ]);
    expect(plan?.entries.map((entry) => entry.policy.kind)).toEqual([
      "tracing",
      "timeout",
      "retry",
    ]);
  });

  it("should compile service and event-handler policy targets", () => {
    const serviceTarget = createPolicyTarget("service", "BillingService", {
      operation: "checkout",
    });
    const eventTarget = createPolicyTarget("event-handler", "InvoiceCreatedHandler");

    const table = compilePolicyTable([
      definePolicy(serviceTarget, { kind: "timeout", timeoutMs: 1000 }),
      definePolicy(eventTarget, { kind: "retry", maxAttempts: 5 }),
    ]);

    expect(getPolicyExecutionPlan(table, serviceTarget, capabilities)?.target.kind).toBe("service");
    expect(getPolicyExecutionPlan(table, eventTarget, capabilities)?.target.kind).toBe(
      "event-handler",
    );
  });

  it("should fail conflicting policy declarations unless override is explicit", () => {
    const target = createPolicyTarget("route", "OrdersController", { operation: "create" });

    expect(() =>
      compilePolicyTable([
        definePolicy(target, { kind: "timeout", timeoutMs: 500 }),
        definePolicy(target, { kind: "timeout", timeoutMs: 1000 }),
      ]),
    ).toThrow(PolicyConflictProblem);
  });

  it("should replace a policy only when the later declaration opts into override", () => {
    const target = createPolicyTarget("route", "OrdersController", { operation: "create" });

    const table = compilePolicyTable([
      definePolicy(target, { kind: "timeout", timeoutMs: 500 }),
      definePolicy(target, { kind: "timeout", timeoutMs: 1000 }, { override: true }),
    ]);

    const timeoutEntry = getPolicyExecutionPlan(table, target, capabilities)?.entries.find(
      (entry) => entry.policy.kind === "timeout",
    );

    expect(timeoutEntry?.policy).toEqual({
      kind: "timeout",
      timeoutMs: 1000,
      scope: undefined,
      onTimeout: undefined,
    });
  });

  it("should reject invalid policy options before runtime execution", () => {
    const target = createPolicyTarget("service", "BillingService");

    expect(() =>
      compilePolicyTable([definePolicy(target, { kind: "retry", maxAttempts: 0 })]),
    ).toThrow(PolicyDefinitionProblem);
    expect(() =>
      compilePolicyTable([definePolicy(target, { kind: "timeout", timeoutMs: -1 })]),
    ).toThrow(PolicyDefinitionProblem);
    expect(() =>
      compilePolicyTable([definePolicy(target, { kind: "tracing", spanName: "" })]),
    ).toThrow(PolicyDefinitionProblem);
  });

  it("should reject unsupported policy kinds instead of ignoring them", () => {
    const target = createPolicyTarget("route", "OrdersController");
    const definition = {
      target,
      kind: "auth",
    } as unknown as PolicyDefinition;

    expect(() => compilePolicyTable([definition])).toThrow(PolicyDefinitionProblem);
  });

  it("should fail when a compiled policy requires an unavailable runtime capability", () => {
    const target = createPolicyTarget("route", "OrdersController", { operation: "create" });
    const table = compilePolicyTable([
      definePolicy(target, { kind: "tracing", spanName: "orders.create" }),
    ]);
    const plan = getPolicyExecutionPlan(table, target, capabilities);

    expect(plan).toBeDefined();
    if (!plan) {
      return;
    }

    expect(() => assertPolicyRuntimeCapabilities(plan, { ...capabilities, trace: false })).toThrow(
      PolicyCapabilityProblem,
    );
  });

  it("should enforce runtime capabilities through the primary plan resolver", () => {
    const target = createPolicyTarget("route", "OrdersController", { operation: "create" });
    const table = compilePolicyTable([
      definePolicy(target, { kind: "tracing", spanName: "orders.create" }),
    ]);

    expect(() => getPolicyExecutionPlan(table, target, { ...capabilities, trace: false })).toThrow(
      PolicyCapabilityProblem,
    );
  });
});
