import {
  type CreateExecutionParams,
  type Execution,
  type ExecutionManager,
  ExecutionManagerImpl,
  type ExecutionLogEntry,
  type ExecutionLogStore,
  ExecutionProblems,
  ExecutionStore,
  type ListExecutionsOptions,
} from "@croco/execution-core";
import { Component, Container, MetadataStorage } from "@croco/framework-context";
import { Problem, ProblemCategory } from "@croco/problems-core";
import { Task, TaskRegistry } from "@croco/tasks-core";
import { Cron, OnWebhook } from "@croco/triggers-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Workflow } from "../libs/decorators/Workflow";
import { WorkflowRegistry } from "../libs/WorkflowRegistry";
import { WorkflowRunner } from "../libs/WorkflowRunner";

class TestWorkflowProblem extends Problem {
  constructor(detail: string) {
    super("workflow-core/test-problem", ProblemCategory.InternalServerError, detail);
  }
}

class InMemoryExecutionStore extends ExecutionStore implements ExecutionLogStore {
  private readonly executions = new Map<string, Execution>();
  private idCounter = 0;

  async create(params: CreateExecutionParams): Promise<Execution> {
    if (params.idempotencyKey) {
      const existing = await this.findByIdempotencyKey(params.idempotencyKey);
      if (existing) {
        return existing;
      }
    }

    const execution: Execution = {
      id: `exec-${++this.idCounter}`,
      type: params.type,
      status: "pending",
      payload: params.payload,
      maxAttempts: params.maxAttempts ?? 1,
      timeout: params.timeout,
      scheduledFor: params.scheduledFor,
      idempotencyKey: params.idempotencyKey,
      replayOf: params.replayOf,
      logs: params.logs,
      parentId: params.parentId,
      metadata: params.metadata,
      attempts: 0,
      createdAt: new Date(),
    };

    this.executions.set(execution.id, execution);
    return execution;
  }

  async findById(id: string): Promise<Execution | null> {
    return this.executions.get(id) ?? null;
  }

  async findByIdempotencyKey(key: string): Promise<Execution | null> {
    for (const execution of this.executions.values()) {
      if (execution.idempotencyKey === key) {
        return execution;
      }
    }
    return null;
  }

  async update(id: string, data: Partial<Execution>): Promise<Execution> {
    const existing = this.executions.get(id);
    if (!existing) {
      throw ExecutionProblems.notFound(`Execution with id '${id}' not found`);
    }

    const updated = { ...existing, ...data };
    this.executions.set(id, updated);
    return updated;
  }

  async appendLog(id: string, entry: ExecutionLogEntry): Promise<Execution> {
    const existing = this.executions.get(id);
    if (!existing) {
      throw ExecutionProblems.notFound(`Execution with id '${id}' not found`);
    }

    return this.update(id, {
      logs: [...(existing.logs ?? []), entry],
    });
  }

  async list(options: ListExecutionsOptions = {}): Promise<Execution[]> {
    let executions = Array.from(this.executions.values());

    if (options.status) {
      executions = executions.filter((execution) => execution.status === options.status);
    }

    if (options.type) {
      executions = executions.filter((execution) => execution.type === options.type);
    }

    if (options.parentId !== undefined) {
      executions = executions.filter((execution) => execution.parentId === options.parentId);
    }

    if (options.replayOf !== undefined) {
      executions = executions.filter((execution) => execution.replayOf === options.replayOf);
    }

    const offset = options.offset ?? 0;
    return executions.slice(offset, options.limit ? offset + options.limit : undefined);
  }

  async delete(id: string): Promise<void> {
    this.executions.delete(id);
  }
}

function getSubscriptionId(payload: unknown): string {
  if (typeof payload !== "object" || payload === null || !("subscriptionId" in payload)) {
    throw new TestWorkflowProblem("subscriptionId is required");
  }

  return String(payload.subscriptionId);
}

async function waitForWorkflowExecution(manager: ExecutionManagerImpl): Promise<Execution> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const [execution] = await manager.list({ type: "workflow" });
    if (execution) {
      return execution;
    }

    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  throw new TestWorkflowProblem("workflow execution was not started");
}

describe("workflow-core", () => {
  let store!: InMemoryExecutionStore;
  let manager!: ExecutionManagerImpl;

  beforeEach(() => {
    Container.reset();
    MetadataStorage.clear();
    TaskRegistry.getInstance().reset();
    store = new InMemoryExecutionStore();
    manager = new ExecutionManagerImpl(store);
  });

  it("collects workflow definitions with cron and webhook trigger metadata", () => {
    @Component()
    class BillingTasks {
      @Task({ name: "billing.refresh" })
      refresh(): void {}
    }

    @Component()
    class BillingWorkflows {
      @Cron("0 * * * *", { name: "hourly-billing-sync" })
      @Workflow({
        name: "billing-sync",
        steps: ["billing.refresh"],
        maxAttempts: 2,
        timeout: 30_000,
      })
      scheduledSync(): void {}

      @OnWebhook("/webhooks/billing", "POST", { auth: true })
      @Workflow({
        name: "billing-webhook",
        steps: ["billing.refresh"],
      })
      billingWebhook(): void {}
    }

    @Component()
    class StaticBillingWorkflows {
      @Workflow({
        steps: ["billing.refresh"],
      })
      static staticSync(): void {}
    }

    Container.set(BillingTasks, new BillingTasks());
    Container.set(BillingWorkflows, new BillingWorkflows());
    const registry = WorkflowRegistry.fromMetadata();

    const scheduled = registry.get("billing-sync");
    const webhook = registry.get("billing-webhook");

    expect(scheduled?.triggers).toEqual([
      expect.objectContaining({ type: "cron", expression: "0 * * * *" }),
    ]);
    expect(webhook?.triggers).toEqual([
      expect.objectContaining({ type: "webhook", path: "/webhooks/billing", method: "POST" }),
    ]);
    expect(scheduled?.steps).toEqual([{ name: "billing.refresh", task: "billing.refresh" }]);
    expect(registry.get("StaticBillingWorkflows.staticSync")).toEqual(
      expect.objectContaining({
        name: "StaticBillingWorkflows.staticSync",
      }),
    );
  });

  it("runs a scheduled workflow as a parent execution with child task executions", async () => {
    @Component()
    class BillingTasks {
      @Task({ name: "billing.fetch-subscription", maxAttempts: 2, timeout: 10_000 })
      fetchSubscription(payload: unknown): { subscriptionId: string; plan: string } {
        return { subscriptionId: getSubscriptionId(payload), plan: "pro" };
      }

      @Task({ name: "billing.sync-entitlements" })
      syncEntitlements(payload: unknown): { synced: string } {
        return { synced: getSubscriptionId(payload) };
      }
    }

    @Component()
    class BillingWorkflows {
      @Cron("*/15 * * * *", { name: "billing-sync" })
      @Workflow({
        name: "billing-sync",
        steps: [
          "billing.fetch-subscription",
          {
            name: "sync-entitlements",
            task: "billing.sync-entitlements",
            input: ({ previousResults }) => previousResults[0]?.result,
          },
        ],
        maxAttempts: 2,
        timeout: 60_000,
      })
      scheduledSync(): void {}
    }

    Container.set(BillingTasks, new BillingTasks());
    Container.set(BillingWorkflows, new BillingWorkflows());
    const runner = new WorkflowRunner(manager, WorkflowRegistry.fromMetadata());

    const result = await runner.execute("billing-sync", { subscriptionId: "sub_123" });
    const workflowExecution = await manager.get(result.executionId);
    const childExecutions = await manager.list({ parentId: result.executionId });

    expect(result.reused).toBe(false);
    expect(workflowExecution).toEqual(
      expect.objectContaining({
        type: "workflow",
        status: "completed",
        maxAttempts: 2,
        timeout: 60_000,
        metadata: expect.objectContaining({
          workflowName: "billing-sync",
          workflowSteps: ["billing.fetch-subscription", "sync-entitlements"],
          workflowTriggers: ["cron"],
        }),
      }),
    );
    expect(workflowExecution.logs?.map((entry) => entry.message)).toEqual([
      "Workflow execution started",
      "Workflow step started",
      "Workflow step completed",
      "Workflow step started",
      "Workflow step completed",
      "Workflow execution completed",
    ]);
    expect(childExecutions).toEqual([
      expect.objectContaining({
        type: "billing.fetch-subscription",
        parentId: result.executionId,
        status: "completed",
        maxAttempts: 2,
        timeout: 10_000,
      }),
      expect.objectContaining({
        type: "billing.sync-entitlements",
        parentId: result.executionId,
        status: "completed",
        metadata: expect.objectContaining({
          workflowName: "billing-sync",
          workflowExecutionId: result.executionId,
          workflowStep: "sync-entitlements",
        }),
      }),
    ]);
  });

  it("deduplicates idempotent webhook workflows without re-running child tasks", async () => {
    const handledSubscriptions: string[] = [];

    @Component()
    class WebhookTasks {
      @Task({ name: "billing.handle-webhook" })
      handleWebhook(payload: unknown): { handled: string } {
        const subscriptionId = getSubscriptionId(payload);
        handledSubscriptions.push(subscriptionId);
        return { handled: subscriptionId };
      }
    }

    @Component()
    class WebhookWorkflows {
      @OnWebhook("/webhooks/billing", "POST", { auth: true })
      @Workflow({
        name: "billing-webhook",
        steps: ["billing.handle-webhook"],
        idempotencyKey: ({ payload }) => `billing-webhook:${getSubscriptionId(payload)}`,
      })
      webhook(): void {}
    }

    Container.set(WebhookTasks, new WebhookTasks());
    Container.set(WebhookWorkflows, new WebhookWorkflows());
    const runner = new WorkflowRunner(manager, WorkflowRegistry.fromMetadata());

    const first = await runner.execute("billing-webhook", { subscriptionId: "sub_123" });
    const second = await runner.execute("billing-webhook", { subscriptionId: "sub_123" });
    const allExecutions = await manager.list();

    expect(first.reused).toBe(false);
    expect(second.reused).toBe(true);
    expect(second.executionId).toBe(first.executionId);
    expect(handledSubscriptions).toEqual(["sub_123"]);
    expect(allExecutions).toHaveLength(2);
  });

  it("does not re-enter an idempotent workflow while its existing execution is pending", async () => {
    @Component()
    class WebhookTasks {
      @Task({ name: "billing.pending-webhook" })
      handleWebhook(): void {}
    }

    @Component()
    class WebhookWorkflows {
      @OnWebhook("/webhooks/billing", "POST", { auth: true })
      @Workflow({
        name: "billing-pending-webhook",
        steps: ["billing.pending-webhook"],
        idempotencyKey: ({ payload }) => `billing-webhook:${getSubscriptionId(payload)}`,
      })
      webhook(): void {}
    }

    Container.set(WebhookTasks, new WebhookTasks());
    Container.set(WebhookWorkflows, new WebhookWorkflows());

    const existingExecution: Execution = {
      id: "workflow-existing",
      type: "workflow",
      status: "pending",
      payload: { subscriptionId: "sub_123" },
      attempts: 0,
      maxAttempts: 1,
      createdAt: new Date(),
      idempotencyKey: "billing-webhook:sub_123",
      metadata: {
        workflowName: "billing-pending-webhook",
        workflowInvocationId: "existing-invocation",
      },
    };
    const executionManager = {
      create: vi.fn().mockResolvedValue(existingExecution),
      start: vi.fn(),
      complete: vi.fn(),
      fail: vi.fn(),
      cancel: vi.fn(),
      retry: vi.fn(),
      updateProgress: vi.fn(),
      checkpoint: vi.fn(),
      timeout: vi.fn(),
    } as unknown as ExecutionManager;
    const runner = new WorkflowRunner(executionManager, WorkflowRegistry.fromMetadata());

    const result = await runner.execute("billing-pending-webhook", {
      subscriptionId: "sub_123",
    });

    expect(result).toEqual(
      expect.objectContaining({
        executionId: "workflow-existing",
        reused: true,
        steps: [],
      }),
    );
    expect(executionManager.start).not.toHaveBeenCalled();
  });

  it("does not duplicate child tasks for a running idempotent workflow", async () => {
    let releaseTask!: () => void;
    const taskGate = new Promise<void>((resolve) => {
      releaseTask = resolve;
    });
    const handledSubscriptions: string[] = [];

    @Component()
    class WebhookTasks {
      @Task({ name: "billing.slow-webhook" })
      async handleWebhook(payload: unknown): Promise<{ handled: string }> {
        const subscriptionId = getSubscriptionId(payload);
        handledSubscriptions.push(subscriptionId);
        await taskGate;
        return { handled: subscriptionId };
      }
    }

    @Component()
    class WebhookWorkflows {
      @OnWebhook("/webhooks/billing", "POST", { auth: true })
      @Workflow({
        name: "billing-slow-webhook",
        steps: ["billing.slow-webhook"],
        idempotencyKey: ({ payload }) => `billing-webhook:${getSubscriptionId(payload)}`,
      })
      webhook(): void {}
    }

    Container.set(WebhookTasks, new WebhookTasks());
    Container.set(WebhookWorkflows, new WebhookWorkflows());
    const runner = new WorkflowRunner(manager, WorkflowRegistry.fromMetadata());

    const first = runner.execute("billing-slow-webhook", { subscriptionId: "sub_123" });
    const started = await waitForWorkflowExecution(manager);
    const second = await runner.execute("billing-slow-webhook", { subscriptionId: "sub_123" });

    releaseTask();
    const firstResult = await first;
    const allExecutions = await manager.list();

    expect(started.status).toBe("running");
    expect(second).toEqual(
      expect.objectContaining({
        executionId: firstResult.executionId,
        reused: true,
        steps: [],
      }),
    );
    expect(handledSubscriptions).toEqual(["sub_123"]);
    expect(allExecutions).toHaveLength(2);
  });

  it("marks failed workflow executions and allows explicit replay creation", async () => {
    @Component()
    class FailingTasks {
      @Task({ name: "billing.fail" })
      fail(): never {
        throw new TestWorkflowProblem("billing provider unavailable");
      }
    }

    @Component()
    class FailingWorkflows {
      @Workflow({
        name: "billing-failure",
        steps: ["billing.fail"],
      })
      run(): void {}
    }

    Container.set(FailingTasks, new FailingTasks());
    Container.set(FailingWorkflows, new FailingWorkflows());
    const runner = new WorkflowRunner(manager, WorkflowRegistry.fromMetadata());

    await expect(runner.execute("billing-failure", {})).rejects.toThrow(
      "billing provider unavailable",
    );

    const [failedWorkflow] = await manager.list({ type: "workflow" });
    const replay = await runner.replay(failedWorkflow.id, {
      reason: "operator retry after provider recovery",
    });

    expect(failedWorkflow).toEqual(
      expect.objectContaining({
        status: "failed",
        error: expect.objectContaining({ message: "billing provider unavailable" }),
      }),
    );
    expect(failedWorkflow.logs?.at(-1)).toEqual(
      expect.objectContaining({
        level: "error",
        message: "Workflow execution failed",
      }),
    );
    expect(replay).toEqual(
      expect.objectContaining({
        type: "workflow",
        status: "pending",
        replayOf: failedWorkflow.id,
        metadata: expect.objectContaining({
          workflowName: "billing-failure",
          replayOf: failedWorkflow.id,
          replayReason: "operator retry after provider recovery",
        }),
      }),
    );
  });
});
