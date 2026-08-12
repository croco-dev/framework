import { ExecutionProblems } from "@croco/execution-core";
import type {
  CreateExecutionParams,
  Execution,
  ExecutionError,
  ExecutionManager,
} from "@croco/execution-core";
import { Container, MetadataStorage } from "@croco/framework-context";
import { Problem, ProblemCategory } from "@croco/problems-core";
import type { CronTriggerMetadata } from "@croco/triggers-core";
import { triggerRegistry } from "@croco/triggers-core";
import { QstashError } from "@upstash/qstash";
import type { Client, Receiver } from "@upstash/qstash";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createQStashApiDeliveryIdentityVerifier,
  QStashTriggerHandler as QStashTriggerHandlerBase,
  type QStashTriggerHandlerOptions,
} from "../libs/QStashTriggerHandler";

class QStashTriggerHandler extends QStashTriggerHandlerBase {
  constructor(options: Omit<QStashTriggerHandlerOptions, "deliveryIdentityVerifier">) {
    super({ ...options, deliveryIdentityVerifier: vi.fn().mockResolvedValue(true) });
  }
}

class TestTriggerProblem extends Problem {
  constructor() {
    super("trigger/test-problem", ProblemCategory.Conflict, "trigger failed");
  }
}

function createIdempotentExecutionManager(): {
  readonly manager: ExecutionManager;
  readonly create: ReturnType<typeof vi.fn>;
} {
  const executions = new Map<string, Execution>();

  const create = vi.fn(async (params: CreateExecutionParams): Promise<Execution> => {
    const key = params.idempotencyKey ?? `unkeyed:${executions.size}`;
    const existing = executions.get(key);
    if (existing) return { ...existing };

    const execution: Execution = {
      id: `exec-${executions.size + 1}`,
      type: params.type,
      status: "pending",
      payload: params.payload,
      attempts: 0,
      maxAttempts: params.maxAttempts ?? 1,
      createdAt: new Date(),
      idempotencyKey: params.idempotencyKey,
      metadata: params.metadata,
    };
    executions.set(key, execution);
    return { ...execution };
  });

  const find = (id: string): Execution => {
    const execution = [...executions.values()].find((candidate) => candidate.id === id);
    if (!execution) throw ExecutionProblems.notFound(`Execution '${id}' not found`);
    return execution;
  };

  const manager = {
    create,
    get: vi.fn(async (id: string) => ({ ...find(id) })),
    start: vi.fn(async (id: string) => {
      const execution = find(id);
      if (execution.status !== "pending" && execution.status !== "retrying") {
        throw ExecutionProblems.invalidStateTransition("Execution is already claimed");
      }
      execution.status = "running";
      execution.attempts += 1;
      return { ...execution };
    }),
    complete: vi.fn(async (id: string, result: unknown) => {
      const execution = find(id);
      execution.status = "completed";
      execution.result = result;
      return { ...execution };
    }),
    fail: vi.fn(async (id: string, error: ExecutionError) => {
      const execution = find(id);
      execution.status =
        error.retryable && execution.attempts < execution.maxAttempts ? "retrying" : "failed";
      execution.error = error;
      return { ...execution };
    }),
  } as unknown as ExecutionManager;

  return { create, manager };
}

describe("QStashTriggerHandler", () => {
  const delivery = { messageId: "msg-test" };

  beforeEach(() => {
    Container.reset();
    MetadataStorage.clear();
    vi.restoreAllMocks();
  });

  it("서명 검증 뒤 QStash message identity가 없으면 실행하지 않아야 한다", async () => {
    const receiver = { verify: vi.fn().mockResolvedValue(true) } as unknown as Receiver;
    const { manager, create } = createIdempotentExecutionManager();
    const handler = new QStashTriggerHandler({ receiver, executionManager: manager });

    const result = await handler.handle("{}", "valid-signature", { messageId: "" });

    expect(result.statusCode).toBe(400);
    expect(result.body).toEqual({
      error: "Missing QStash delivery identity",
      code: "triggers-qstash/missing-delivery-identity",
      category: ProblemCategory.BadRequest,
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("서명된 body와 delivery identity의 provider binding이 실패하면 실행하지 않아야 한다", async () => {
    const receiver = { verify: vi.fn().mockResolvedValue(true) } as unknown as Receiver;
    const { manager, create } = createIdempotentExecutionManager();
    const handler = new QStashTriggerHandlerBase({
      receiver,
      deliveryIdentityVerifier: vi.fn().mockResolvedValue(false),
      executionManager: manager,
    });
    const body = JSON.stringify({
      scheduleId: "schedule-invalid-identity",
      className: "InvalidIdentityHandler",
      methodName: "execute",
      cronExpression: "* * * * *",
      timestamp: "2026-08-13T00:00:00.000Z",
    });

    const result = await handler.handle(body, "valid-signature", { messageId: "msg-replayed" });

    expect(result.statusCode).toBe(401);
    expect(result.body).toEqual({
      error: "Invalid QStash delivery identity",
      code: "triggers-qstash/invalid-delivery-identity",
      category: ProblemCategory.Unauthorized,
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("delivery identity provider 장애는 retryable 500으로 보존해야 한다", async () => {
    const receiver = { verify: vi.fn().mockResolvedValue(true) } as unknown as Receiver;
    const { manager, create } = createIdempotentExecutionManager();
    const handler = new QStashTriggerHandlerBase({
      receiver,
      deliveryIdentityVerifier: vi.fn().mockRejectedValue(new Error("QStash unavailable")),
      executionManager: manager,
    });
    const body = JSON.stringify({
      scheduleId: "schedule-verifier-outage",
      className: "VerifierOutageHandler",
      methodName: "execute",
      cronExpression: "* * * * *",
      timestamp: "2026-08-13T00:00:00.000Z",
    });

    const result = await handler.handle(body, "valid-signature", { messageId: "msg-outage" });

    expect(result.statusCode).toBe(500);
    expect(result.body).toEqual({
      error: "QStash delivery identity verification failed",
      code: "triggers-qstash/delivery-identity-verification-failed",
      category: ProblemCategory.InternalServerError,
      retryable: true,
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("QStash API verifier는 message identity를 서명된 body와 schedule에 함께 결합해야 한다", async () => {
    const body = JSON.stringify({ scheduleId: "schedule-bound" });
    const get = vi.fn().mockResolvedValue({
      messageId: "msg-bound",
      body,
      scheduleId: "schedule-bound",
    });
    const verifier = createQStashApiDeliveryIdentityVerifier({
      messages: { get },
    } as unknown as Client);
    const payload = {
      scheduleId: "schedule-bound",
      methodName: "execute",
      cronExpression: "* * * * *",
      timestamp: "2026-08-13T00:00:00.000Z",
    };

    await expect(verifier({ body, messageId: "msg-bound", payload })).resolves.toBe(true);
    get.mockResolvedValueOnce({
      messageId: "msg-other",
      body,
      scheduleId: "schedule-bound",
    });
    await expect(verifier({ body, messageId: "msg-bound", payload })).resolves.toBe(false);
    await expect(verifier({ body: `${body} `, messageId: "msg-bound", payload })).resolves.toBe(
      false,
    );
    await expect(
      verifier({ body, messageId: "msg-bound", payload: { ...payload, scheduleId: "other" } }),
    ).resolves.toBe(false);
    get.mockRejectedValueOnce(new QstashError("not found", 404));
    await expect(verifier({ body, messageId: "msg-bound", payload })).resolves.toBe(false);
    get.mockRejectedValueOnce(new QstashError("unavailable", 503));
    await expect(verifier({ body, messageId: "msg-bound", payload })).rejects.toThrow(
      "unavailable",
    );
  });

  it("BUG-16 핸들러 클래스가 DI로 올바르게 해결되어야 한다", async () => {
    class Bug16Handler {
      async execute(): Promise<string> {
        return "handled";
      }
    }

    const triggerMetadata: CronTriggerMetadata = {
      type: "cron",
      expression: "* * * * *",
      methodName: "execute",
      target: Bug16Handler.prototype,
      options: {},
    };
    triggerRegistry.register(triggerMetadata);

    const targetInstance = new Bug16Handler();
    Container.set(Bug16Handler, targetInstance);

    const receiver = {
      verify: vi.fn().mockResolvedValue(undefined),
    } as unknown as Receiver;

    const executionManager = {
      create: vi.fn().mockResolvedValue({ id: "exec-bug-16" }),
      start: vi.fn().mockResolvedValue({}),
      complete: vi.fn().mockResolvedValue({}),
      fail: vi.fn().mockResolvedValue({}),
      cancel: vi.fn().mockResolvedValue({}),
      retry: vi.fn().mockResolvedValue({}),
      updateProgress: vi.fn().mockResolvedValue({}),
      checkpoint: vi.fn().mockResolvedValue({}),
      timeout: vi.fn().mockResolvedValue({}),
    } as unknown as ExecutionManager;

    const getSpy = vi.spyOn(Container, "get");

    const handler = new QStashTriggerHandler({
      receiver,
      executionManager,
    });

    const result = await handler.handle(
      JSON.stringify({
        scheduleId: "schedule-bug-16",
        className: "Bug16Handler",
        methodName: "execute",
        cronExpression: "* * * * *",
        timestamp: new Date().toISOString(),
      }),
      "valid-signature",
      delivery,
    );

    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(getSpy).toHaveBeenCalledWith(Bug16Handler);
    expect(getSpy).not.toHaveBeenCalledWith("Bug16Handler");
  });

  it("className 없이도 scheduleId와 methodName으로 타깃을 해석해야 한다", async () => {
    class NameFreeHandler {
      async execute(): Promise<string> {
        return "name-free";
      }
    }

    const triggerMetadata: CronTriggerMetadata = {
      type: "cron",
      expression: "* * * * *",
      methodName: "execute",
      target: NameFreeHandler.prototype,
      options: {},
    };
    triggerRegistry.register(triggerMetadata);

    const targetInstance = new NameFreeHandler();
    Container.set(NameFreeHandler, targetInstance);

    const receiver = {
      verify: vi.fn().mockResolvedValue(undefined),
    } as unknown as Receiver;

    const executionManager = {
      create: vi.fn().mockResolvedValue({ id: "exec-name-free" }),
      start: vi.fn().mockResolvedValue({}),
      complete: vi.fn().mockResolvedValue({}),
      fail: vi.fn().mockResolvedValue({}),
      cancel: vi.fn().mockResolvedValue({}),
      retry: vi.fn().mockResolvedValue({}),
      updateProgress: vi.fn().mockResolvedValue({}),
      checkpoint: vi.fn().mockResolvedValue({}),
      timeout: vi.fn().mockResolvedValue({}),
    } as unknown as ExecutionManager;

    const getSpy = vi.spyOn(Container, "get");

    const handler = new QStashTriggerHandler({
      receiver,
      executionManager,
    });

    const result = await handler.handle(
      JSON.stringify({
        scheduleId: "croco-trigger:execute:execute",
        triggerName: "execute",
        methodName: "execute",
        cronExpression: "* * * * *",
        timestamp: new Date().toISOString(),
      }),
      "valid-signature",
      delivery,
    );

    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(getSpy).toHaveBeenCalledWith(NameFreeHandler);
  });

  it("명시적 cron name으로도 scheduleId와 methodName만으로 타깃을 해석해야 한다", async () => {
    class NamedHandler {
      async execute(): Promise<string> {
        return "named";
      }
    }

    const triggerMetadata: CronTriggerMetadata = {
      type: "cron",
      expression: "* * * * *",
      methodName: "execute",
      target: NamedHandler.prototype,
      options: {
        name: "named-execute",
      },
    };
    triggerRegistry.register(triggerMetadata);

    const targetInstance = new NamedHandler();
    Container.set(NamedHandler, targetInstance);

    const receiver = {
      verify: vi.fn().mockResolvedValue(undefined),
    } as unknown as Receiver;

    const executionManager = {
      create: vi.fn().mockResolvedValue({ id: "exec-named" }),
      start: vi.fn().mockResolvedValue({}),
      complete: vi.fn().mockResolvedValue({}),
      fail: vi.fn().mockResolvedValue({}),
      cancel: vi.fn().mockResolvedValue({}),
      retry: vi.fn().mockResolvedValue({}),
      updateProgress: vi.fn().mockResolvedValue({}),
      checkpoint: vi.fn().mockResolvedValue({}),
      timeout: vi.fn().mockResolvedValue({}),
    } as unknown as ExecutionManager;

    const getSpy = vi.spyOn(Container, "get");

    const handler = new QStashTriggerHandler({
      receiver,
      executionManager,
    });

    const result = await handler.handle(
      JSON.stringify({
        scheduleId: "croco-trigger:named-execute:execute",
        triggerName: "named-execute",
        methodName: "execute",
        cronExpression: "* * * * *",
        timestamp: new Date().toISOString(),
      }),
      "valid-signature",
      delivery,
    );

    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(getSpy).toHaveBeenCalledWith(NamedHandler);
  });

  it("scheduleId suffix가 같아도 전체 식별자가 다르면 잘못된 핸들러로 매칭하면 안 된다", async () => {
    class WrongNamedHandler {
      async execute(): Promise<string> {
        return "wrong";
      }
    }

    class ExactNamedHandler {
      async execute(): Promise<string> {
        return "exact";
      }
    }

    triggerRegistry.register({
      type: "cron",
      expression: "* * * * *",
      methodName: "execute",
      target: WrongNamedHandler.prototype,
      options: {
        name: "named-execute",
      },
    });

    triggerRegistry.register({
      type: "cron",
      expression: "* * * * *",
      methodName: "execute",
      target: ExactNamedHandler.prototype,
      options: {
        name: "named-execute",
      },
    });

    const targetInstance = new ExactNamedHandler();
    Container.set(ExactNamedHandler, targetInstance);

    const receiver = {
      verify: vi.fn().mockResolvedValue(undefined),
    } as unknown as Receiver;

    const executionManager = {
      create: vi.fn().mockResolvedValue({ id: "exec-exact-match" }),
      start: vi.fn().mockResolvedValue({}),
      complete: vi.fn().mockResolvedValue({}),
      fail: vi.fn().mockResolvedValue({}),
      cancel: vi.fn().mockResolvedValue({}),
      retry: vi.fn().mockResolvedValue({}),
      updateProgress: vi.fn().mockResolvedValue({}),
      checkpoint: vi.fn().mockResolvedValue({}),
      timeout: vi.fn().mockResolvedValue({}),
    } as unknown as ExecutionManager;

    const getSpy = vi.spyOn(Container, "get");

    const handler = new QStashTriggerHandler({
      receiver,
      executionManager,
    });

    const result = await handler.handle(
      JSON.stringify({
        scheduleId: "croco-trigger:ExactNamedHandler:named-execute:execute",
        triggerName: "named-execute",
        methodName: "execute",
        cronExpression: "* * * * *",
        timestamp: new Date().toISOString(),
      }),
      "valid-signature",
      delivery,
    );

    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(getSpy).toHaveBeenCalledWith(ExactNamedHandler);
    expect(getSpy).not.toHaveBeenCalledWith(WrongNamedHandler);
  });

  it("커스텀 schedule prefix에서도 class/name/method 식별자로 정확한 핸들러를 매칭해야 한다", async () => {
    class WrongCustomPrefixHandler {
      async execute(): Promise<string> {
        return "wrong";
      }
    }

    class ExactCustomPrefixHandler {
      async execute(): Promise<string> {
        return "exact";
      }
    }

    triggerRegistry.register({
      type: "cron",
      expression: "* * * * *",
      methodName: "execute",
      target: WrongCustomPrefixHandler.prototype,
      options: {
        name: "named-execute",
      },
    });

    triggerRegistry.register({
      type: "cron",
      expression: "* * * * *",
      methodName: "execute",
      target: ExactCustomPrefixHandler.prototype,
      options: {
        name: "named-execute",
      },
    });

    const targetInstance = new ExactCustomPrefixHandler();
    Container.set(ExactCustomPrefixHandler, targetInstance);

    const receiver = {
      verify: vi.fn().mockResolvedValue(undefined),
    } as unknown as Receiver;

    const executionManager = {
      create: vi.fn().mockResolvedValue({ id: "exec-custom-prefix" }),
      start: vi.fn().mockResolvedValue({}),
      complete: vi.fn().mockResolvedValue({}),
      fail: vi.fn().mockResolvedValue({}),
      cancel: vi.fn().mockResolvedValue({}),
      retry: vi.fn().mockResolvedValue({}),
      updateProgress: vi.fn().mockResolvedValue({}),
      checkpoint: vi.fn().mockResolvedValue({}),
      timeout: vi.fn().mockResolvedValue({}),
    } as unknown as ExecutionManager;

    const getSpy = vi.spyOn(Container, "get");

    const handler = new QStashTriggerHandler({
      receiver,
      executionManager,
    });

    const result = await handler.handle(
      JSON.stringify({
        scheduleId: "tenant-a:ExactCustomPrefixHandler:named-execute:execute",
        triggerName: "named-execute",
        methodName: "execute",
        cronExpression: "* * * * *",
        timestamp: new Date().toISOString(),
      }),
      "valid-signature",
      delivery,
    );

    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(getSpy).toHaveBeenCalledWith(ExactCustomPrefixHandler);
    expect(getSpy).not.toHaveBeenCalledWith(WrongCustomPrefixHandler);
  });

  it("DI 해석 오류가 발생하면 500으로 반환해야 한다", async () => {
    class ResolverFailureHandler {
      async execute(): Promise<string> {
        return "handled";
      }
    }

    triggerRegistry.register({
      type: "cron",
      expression: "* * * * *",
      methodName: "execute",
      target: ResolverFailureHandler.prototype,
      options: {},
    });

    const receiver = {
      verify: vi.fn().mockResolvedValue(undefined),
    } as unknown as Receiver;

    const executionManager = {
      create: vi.fn(),
      start: vi.fn(),
      complete: vi.fn(),
      fail: vi.fn(),
      cancel: vi.fn(),
      retry: vi.fn(),
      updateProgress: vi.fn(),
      checkpoint: vi.fn(),
      timeout: vi.fn(),
    } as unknown as ExecutionManager;

    const handler = new QStashTriggerHandler({
      receiver,
      executionManager,
      serviceResolver: () => {
        throw new Error("DI resolution failed");
      },
    });

    const result = await handler.handle(
      JSON.stringify({
        scheduleId: "schedule-di-error",
        className: "ResolverFailureHandler",
        methodName: "execute",
        cronExpression: "* * * * *",
        timestamp: new Date().toISOString(),
      }),
      "valid-signature",
      delivery,
    );

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(500);
    expect(result.body).toEqual({
      error: "Execution failed",
      code: "triggers-qstash/execution-failed",
      category: ProblemCategory.InternalServerError,
    });
    expect(executionManager.create).not.toHaveBeenCalled();
  });

  it("Problem 예외는 안전한 code/category와 statusCode를 유지해야 한다", async () => {
    class ProblemHandler {
      async execute(): Promise<string> {
        throw new TestTriggerProblem();
      }
    }

    triggerRegistry.register({
      type: "cron",
      expression: "* * * * *",
      methodName: "execute",
      target: ProblemHandler.prototype,
      options: {},
    });

    const receiver = {
      verify: vi.fn().mockResolvedValue(undefined),
    } as unknown as Receiver;

    const executionManager = {
      create: vi.fn().mockResolvedValue({ id: "exec-problem" }),
      start: vi.fn().mockResolvedValue({}),
      complete: vi.fn().mockResolvedValue({}),
      fail: vi.fn().mockResolvedValue({}),
      cancel: vi.fn().mockResolvedValue({}),
      retry: vi.fn().mockResolvedValue({}),
      updateProgress: vi.fn().mockResolvedValue({}),
      checkpoint: vi.fn().mockResolvedValue({}),
      timeout: vi.fn().mockResolvedValue({}),
    } as unknown as ExecutionManager;

    const handler = new QStashTriggerHandler({
      receiver,
      executionManager,
      serviceResolver: () => new ProblemHandler(),
    });

    const result = await handler.handle(
      JSON.stringify({
        scheduleId: "schedule-problem",
        className: "ProblemHandler",
        methodName: "execute",
        cronExpression: "* * * * *",
        timestamp: new Date().toISOString(),
      }),
      "valid-signature",
      delivery,
    );

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(409);
    expect(result.body).toEqual({
      error: "Execution failed",
      code: "trigger/test-problem",
      category: ProblemCategory.Conflict,
    });
  });

  it("기본 serviceResolver는 DI 해석 실패를 숨기지 않고 500으로 반환해야 한다", async () => {
    class DefaultResolverFailureHandler {
      async execute(): Promise<string> {
        return "handled";
      }
    }

    triggerRegistry.register({
      type: "cron",
      expression: "* * * * *",
      methodName: "execute",
      target: DefaultResolverFailureHandler.prototype,
      options: {},
    });

    const receiver = {
      verify: vi.fn().mockResolvedValue(undefined),
    } as unknown as Receiver;

    const executionManager = {
      create: vi.fn(),
      start: vi.fn(),
      complete: vi.fn(),
      fail: vi.fn(),
      cancel: vi.fn(),
      retry: vi.fn(),
      updateProgress: vi.fn(),
      checkpoint: vi.fn(),
      timeout: vi.fn(),
    } as unknown as ExecutionManager;

    vi.spyOn(Container, "get").mockImplementation(() => {
      throw new Error("Container resolution failed");
    });

    const handler = new QStashTriggerHandler({
      receiver,
      executionManager,
    });

    const result = await handler.handle(
      JSON.stringify({
        scheduleId: "croco-trigger:execute:execute",
        triggerName: "execute",
        className: "DefaultResolverFailureHandler",
        methodName: "execute",
        cronExpression: "* * * * *",
        timestamp: new Date().toISOString(),
      }),
      "valid-signature",
      delivery,
    );

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(500);
    expect(result.body).toEqual({
      error: "Execution failed",
      code: "triggers-qstash/service-resolution-failed",
      category: ProblemCategory.InternalServerError,
    });
    expect(executionManager.create).not.toHaveBeenCalled();
  });

  it("동시 중복 delivery는 하나의 실행 ID와 한 번의 cron 호출을 공유해야 한다", async () => {
    let releaseExecution!: () => void;
    const executionGate = new Promise<void>((resolve) => {
      releaseExecution = resolve;
    });
    const execute = vi.fn(async () => {
      await executionGate;
      return "done";
    });
    class DeduplicatedHandler {
      execute = execute;
    }

    triggerRegistry.register({
      type: "cron",
      expression: "* * * * *",
      methodName: "execute",
      target: DeduplicatedHandler.prototype,
      options: {},
    });

    const receiver = { verify: vi.fn().mockResolvedValue(true) } as unknown as Receiver;
    const { manager, create } = createIdempotentExecutionManager();
    const startExecution = vi.mocked(manager.start).getMockImplementation();
    if (!startExecution) throw new Error("Expected a start implementation");
    let releaseFirstClaim!: () => void;
    const firstClaimGate = new Promise<void>((resolve) => {
      releaseFirstClaim = resolve;
    });
    let claimCount = 0;
    vi.mocked(manager.start).mockImplementation(async (executionId) => {
      claimCount += 1;
      if (claimCount === 1) {
        await firstClaimGate;
      } else {
        releaseFirstClaim();
      }
      return startExecution(executionId);
    });
    const handler = new QStashTriggerHandler({
      receiver,
      executionManager: manager,
      serviceResolver: () => new DeduplicatedHandler(),
    });
    const body = JSON.stringify({
      scheduleId: "schedule-deduplicated",
      className: "DeduplicatedHandler",
      methodName: "execute",
      cronExpression: "* * * * *",
      timestamp: "2026-08-13T00:00:00.000Z",
    });

    const firstDelivery = handler.handle(body, "valid-signature", {
      messageId: "msg-occurrence-1",
    });
    await vi.waitFor(() => expect(manager.start).toHaveBeenCalledTimes(1));

    const authoritativeDelivery = handler.handle(body, "valid-signature", {
      messageId: "msg-occurrence-1",
    });
    const concurrentDuplicate = await firstDelivery;
    expect(concurrentDuplicate.statusCode).toBe(202);
    expect(concurrentDuplicate.executionId).toBe("exec-1");
    await vi.waitFor(() => expect(execute).toHaveBeenCalledTimes(1));

    releaseExecution();
    const firstResult = await authoritativeDelivery;
    const completedDuplicate = await handler.handle(body, "valid-signature", {
      messageId: "msg-occurrence-1",
    });

    expect(firstResult.executionId).toBe("exec-1");
    expect(completedDuplicate).toMatchObject({
      success: true,
      executionId: "exec-1",
      statusCode: 200,
      body: { executionId: "exec-1", result: "done" },
    });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(3);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: "qstash:msg-occurrence-1" }),
    );
  });

  it("재시도 가능한 실패는 새 실행을 만들지 않고 같은 실행의 retrying 상태를 재개해야 한다", async () => {
    const execute = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("request timeout"))
      .mockResolvedValueOnce("recovered");
    class RetryHandler {
      execute = execute;
    }

    triggerRegistry.register({
      type: "cron",
      expression: "* * * * *",
      methodName: "execute",
      target: RetryHandler.prototype,
      options: {},
    });

    const receiver = { verify: vi.fn().mockResolvedValue(true) } as unknown as Receiver;
    const { manager, create } = createIdempotentExecutionManager();
    const handler = new QStashTriggerHandler({
      receiver,
      executionManager: manager,
      maxAttempts: 2,
      serviceResolver: () => new RetryHandler(),
    });
    const body = JSON.stringify({
      scheduleId: "schedule-retry",
      className: "RetryHandler",
      methodName: "execute",
      cronExpression: "* * * * *",
      timestamp: "2026-08-13T00:00:00.000Z",
    });

    const recovered = await handler.handle(body, "valid-signature", { messageId: "msg-retry" });
    const retried = await handler.handle(body, "valid-signature", { messageId: "msg-retry" });

    expect(recovered).toMatchObject({
      success: true,
      executionId: "exec-1",
      body: { result: "recovered" },
    });
    expect(retried).toMatchObject({
      success: true,
      executionId: "exec-1",
      body: { result: "recovered" },
    });
    expect(execute).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenLastCalledWith(
      expect.objectContaining({ idempotencyKey: "qstash:msg-retry", maxAttempts: 2 }),
    );
  });

  it("서로 다른 QStash message identity는 별도 schedule occurrence로 실행해야 한다", async () => {
    const execute = vi.fn().mockResolvedValue("done");
    class DistinctOccurrenceHandler {
      execute = execute;
    }

    triggerRegistry.register({
      type: "cron",
      expression: "* * * * *",
      methodName: "execute",
      target: DistinctOccurrenceHandler.prototype,
      options: {},
    });

    const receiver = { verify: vi.fn().mockResolvedValue(true) } as unknown as Receiver;
    const { manager } = createIdempotentExecutionManager();
    const handler = new QStashTriggerHandler({
      receiver,
      executionManager: manager,
      serviceResolver: () => new DistinctOccurrenceHandler(),
    });
    const body = JSON.stringify({
      scheduleId: "schedule-distinct",
      className: "DistinctOccurrenceHandler",
      methodName: "execute",
      cronExpression: "* * * * *",
      timestamp: "2026-08-13T00:00:00.000Z",
    });

    const first = await handler.handle(body, "valid-signature", { messageId: "msg-first" });
    const second = await handler.handle(body, "valid-signature", { messageId: "msg-second" });

    expect(first.executionId).toBe("exec-1");
    expect(second.executionId).toBe("exec-2");
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("Lambda 핸들러는 소문자 서명 헤더를 지원해야 한다", async () => {
    class LowercaseHeaderHandler {
      async execute(): Promise<string> {
        return "ok";
      }
    }

    triggerRegistry.register({
      type: "cron",
      expression: "* * * * *",
      methodName: "execute",
      target: LowercaseHeaderHandler.prototype,
      options: {},
    });

    const receiver = {
      verify: vi.fn().mockResolvedValue(undefined),
    } as unknown as Receiver;

    const executionManager = {
      create: vi.fn().mockResolvedValue({ id: "exec-lower-header" }),
      start: vi.fn().mockResolvedValue({}),
      complete: vi.fn().mockResolvedValue({}),
      fail: vi.fn().mockResolvedValue({}),
      cancel: vi.fn().mockResolvedValue({}),
      retry: vi.fn().mockResolvedValue({}),
      updateProgress: vi.fn().mockResolvedValue({}),
      checkpoint: vi.fn().mockResolvedValue({}),
      timeout: vi.fn().mockResolvedValue({}),
    } as unknown as ExecutionManager;

    const targetInstance = new LowercaseHeaderHandler();
    const lambdaHandler = QStashTriggerHandler.createLambdaHandler({
      receiver,
      deliveryIdentityVerifier: vi.fn().mockResolvedValue(true),
      executionManager,
      serviceResolver: () => targetInstance,
    });

    const response = await lambdaHandler({
      body: JSON.stringify({
        scheduleId: "schedule-lower-header",
        className: "LowercaseHeaderHandler",
        methodName: "execute",
        cronExpression: "* * * * *",
        timestamp: new Date().toISOString(),
      }),
      headers: {
        "upstash-signature": "valid-signature",
        "upstash-message-id": "msg-lower-header",
      },
    });

    expect(response.statusCode).toBe(200);

    const parsed = JSON.parse(response.body) as {
      executionId: string;
      result: string;
    };

    expect(parsed.executionId).toBe("exec-lower-header");
    expect(parsed.result).toBe("ok");
    expect(receiver.verify).toHaveBeenCalled();
  });
});
