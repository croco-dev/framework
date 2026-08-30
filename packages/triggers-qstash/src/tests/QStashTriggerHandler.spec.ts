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
  constructor(
    options: Omit<QStashTriggerHandlerOptions, "deliveryIdentityVerifier" | "executionTimeout">,
  ) {
    super({
      ...options,
      deliveryIdentityVerifier: vi.fn().mockResolvedValue(true),
      executionTimeout: 60_000,
    });
  }
}

class TestTriggerProblem extends Problem {
  constructor(retryable?: boolean, detail = "trigger failed") {
    super(
      "trigger/test-problem",
      ProblemCategory.Conflict,
      detail,
      retryable === undefined ? undefined : { extensions: { retryable } },
    );
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
      timeout: params.timeout,
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
      execution.startedAt = new Date();
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
    completeAttempt: vi.fn(async (token, result: unknown) => {
      const execution = find(token.executionId);
      if (execution.status !== "running" || execution.attempts !== token.attempt) {
        throw ExecutionProblems.attemptFenceConflict("Attempt lost ownership");
      }
      execution.status = "completed";
      execution.result = result;
      return { ...execution };
    }),
    failAttempt: vi.fn(async (token, error: ExecutionError) => {
      const execution = find(token.executionId);
      if (execution.status !== "running" || execution.attempts !== token.attempt) {
        throw ExecutionProblems.attemptFenceConflict("Attempt lost ownership");
      }
      execution.status =
        error.retryable && execution.attempts < execution.maxAttempts ? "retrying" : "failed";
      execution.error = error;
      return { ...execution };
    }),
    timeout: vi.fn(async (id: string) => {
      const execution = find(id);
      if (execution.status !== "running") {
        throw ExecutionProblems.invalidStateTransition("Execution is no longer running");
      }
      execution.status = "timed_out";
      execution.error = {
        message: "Execution timed out with an indeterminate outcome",
        indeterminate: true,
        retryable: false,
      };
      return { ...execution };
    }),
    reconcileTimedOut: vi.fn(),
    resolveIndeterminateTimeout: vi.fn(async (token) => {
      const execution = find(token.executionId);
      if (execution.status !== "timed_out" || execution.attempts !== token.attempt) {
        throw ExecutionProblems.attemptFenceConflict("Attempt lost ownership");
      }
      execution.error = { message: "Timeout resolved", indeterminate: false, retryable: true };
      return { ...execution };
    }),
    retry: vi.fn(async (id: string) => {
      const execution = find(id);
      execution.status = "retrying";
      return { ...execution };
    }),
    supportsAttemptFencing: vi.fn(() => true),
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

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "유효하지 않은 executionTimeout %s는 구성 단계에서 거부해야 한다",
    (executionTimeout) => {
      const receiver = { verify: vi.fn() } as unknown as Receiver;
      const { manager } = createIdempotentExecutionManager();

      let thrown: unknown;
      try {
        new QStashTriggerHandlerBase({
          receiver,
          deliveryIdentityVerifier: vi.fn(),
          executionManager: manager,
          executionTimeout,
        });
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(Problem);
      expect(thrown).toMatchObject({
        code: "triggers-qstash/invalid-execution-timeout",
        message: "QStash executionTimeout must be a positive safe integer",
      });
    },
  );

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
      executionTimeout: 60_000,
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
    const providerError = new Error("QStash unavailable");
    const onDeliveryIdentityVerificationFailure = vi
      .fn()
      .mockRejectedValue(new Error("telemetry unavailable"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const handler = new QStashTriggerHandlerBase({
      receiver,
      deliveryIdentityVerifier: vi.fn().mockRejectedValue(providerError),
      executionManager: manager,
      executionTimeout: 60_000,
      onDeliveryIdentityVerificationFailure,
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
      observerFailed: true,
      retryable: true,
    });
    expect(onDeliveryIdentityVerificationFailure).toHaveBeenCalledWith({
      error: providerError,
      messageId: "msg-outage",
    });
    expect(consoleError).toHaveBeenCalledWith(
      "QStash delivery identity verification observer failed",
      {
        error: expect.any(Error),
        messageId: "msg-outage",
      },
    );
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
    let releaseExecution = (): void => {
      throw new Error("Execution gate was not initialized");
    };
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
    let releaseFirstClaim = (): void => {
      throw new Error("Claim gate was not initialized");
    };
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
    expect(concurrentDuplicate).toMatchObject({
      success: false,
      statusCode: 503,
      body: {
        code: "triggers-qstash/execution-retry-pending",
        retryable: true,
        status: "running",
      },
    });
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

    const pendingRetry = await handler.handle(body, "valid-signature", {
      messageId: "msg-retry",
    });
    const recovered = await handler.handle(body, "valid-signature", { messageId: "msg-retry" });
    const replayed = await handler.handle(body, "valid-signature", { messageId: "msg-retry" });

    expect(pendingRetry).toMatchObject({
      success: false,
      executionId: "exec-1",
      statusCode: 503,
      body: {
        code: "triggers-qstash/execution-retry-pending",
        retryable: true,
        status: "retrying",
      },
    });
    expect(recovered).toMatchObject({
      success: true,
      executionId: "exec-1",
      body: { result: "recovered" },
    });
    expect(replayed).toMatchObject({
      success: true,
      executionId: "exec-1",
      body: { result: "recovered" },
    });
    expect(execute).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenCalledTimes(3);
    expect(create).toHaveBeenLastCalledWith(
      expect.objectContaining({ idempotencyKey: "qstash:msg-retry", maxAttempts: 2 }),
    );
  });

  it("Problem의 구조화된 retryable 신호로 같은 실행을 재시도해야 한다", async () => {
    const execute = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new TestTriggerProblem(true))
      .mockResolvedValueOnce("recovered");
    class RetryableProblemHandler {
      execute = execute;
    }

    triggerRegistry.register({
      type: "cron",
      expression: "* * * * *",
      methodName: "execute",
      target: RetryableProblemHandler.prototype,
      options: {},
    });

    const receiver = { verify: vi.fn().mockResolvedValue(true) } as unknown as Receiver;
    const { manager } = createIdempotentExecutionManager();
    const handler = new QStashTriggerHandler({
      receiver,
      executionManager: manager,
      maxAttempts: 2,
      serviceResolver: () => new RetryableProblemHandler(),
    });
    const body = JSON.stringify({
      scheduleId: "schedule-retryable-problem",
      className: "RetryableProblemHandler",
      methodName: "execute",
      cronExpression: "* * * * *",
      timestamp: "2026-08-13T00:00:00.000Z",
    });

    const pendingRetry = await handler.handle(body, "valid-signature", {
      messageId: "msg-retryable-problem",
    });
    const recovered = await handler.handle(body, "valid-signature", {
      messageId: "msg-retryable-problem",
    });

    expect(pendingRetry).toMatchObject({
      success: false,
      executionId: "exec-1",
      statusCode: 503,
      body: {
        code: "triggers-qstash/execution-retry-pending",
        retryable: true,
        status: "retrying",
      },
    });
    expect(recovered).toMatchObject({
      success: true,
      executionId: "exec-1",
      body: { result: "recovered" },
    });
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it.each([
    {
      error: Object.assign(new Error("upstream unavailable"), { retryable: true }),
      expected: true,
      signal: "top-level true",
    },
    {
      error: Object.assign(new Error("request timeout"), { retryable: false }),
      expected: false,
      signal: "top-level false before message fallback",
    },
    {
      error: Object.assign(new TestTriggerProblem(true), { retryable: false }),
      expected: false,
      signal: "top-level signal before Problem extension",
    },
    {
      error: new TestTriggerProblem(false, "request timeout"),
      expected: false,
      signal: "Problem extension false before message fallback",
    },
    {
      error: new TestTriggerProblem(undefined, "request timeout"),
      expected: false,
      signal: "Problem without a structured signal before message fallback",
    },
  ])("$signal 구조화 신호를 실행 실패 기록에 보존해야 한다", async ({ error, expected }) => {
    class StructuredFailureHandler {
      async execute(): Promise<never> {
        throw error;
      }
    }

    triggerRegistry.register({
      type: "cron",
      expression: "* * * * *",
      methodName: "execute",
      target: StructuredFailureHandler.prototype,
      options: {},
    });

    const receiver = { verify: vi.fn().mockResolvedValue(true) } as unknown as Receiver;
    const { manager } = createIdempotentExecutionManager();
    const attemptManager = manager as ExecutionManager & {
      failAttempt: ReturnType<typeof vi.fn>;
    };
    const handler = new QStashTriggerHandler({
      receiver,
      executionManager: manager,
      maxAttempts: 2,
      serviceResolver: () => new StructuredFailureHandler(),
    });

    await handler.handle(
      JSON.stringify({
        scheduleId: "schedule-structured-failure",
        className: "StructuredFailureHandler",
        methodName: "execute",
        cronExpression: "* * * * *",
        timestamp: "2026-08-13T00:00:00.000Z",
      }),
      "valid-signature",
      { messageId: "msg-structured-failure" },
    );

    expect(attemptManager.failAttempt).toHaveBeenCalledWith(
      { attempt: 1, executionId: "exec-1" },
      expect.objectContaining({ retryable: expected }),
    );
  });

  it("target 성공 뒤 completion 저장 실패는 attempt를 retrying으로 바꾸지 않아야 한다", async () => {
    const execute = vi.fn().mockResolvedValue("side-effect-complete");
    class CompletionFailureHandler {
      execute = execute;
    }

    triggerRegistry.register({
      type: "cron",
      expression: "* * * * *",
      methodName: "execute",
      target: CompletionFailureHandler.prototype,
      options: {},
    });

    const receiver = { verify: vi.fn().mockResolvedValue(true) } as unknown as Receiver;
    const { manager } = createIdempotentExecutionManager();
    const attemptManager = manager as ExecutionManager & {
      completeAttempt: ReturnType<typeof vi.fn>;
      failAttempt: ReturnType<typeof vi.fn>;
    };
    attemptManager.completeAttempt.mockRejectedValueOnce(new Error("completion store unavailable"));
    const handler = new QStashTriggerHandler({
      receiver,
      executionManager: manager,
      maxAttempts: 2,
      serviceResolver: () => new CompletionFailureHandler(),
    });
    const body = JSON.stringify({
      scheduleId: "schedule-completion-failure",
      className: "CompletionFailureHandler",
      methodName: "execute",
      cronExpression: "* * * * *",
      timestamp: "2026-08-13T00:00:00.000Z",
    });

    const first = await handler.handle(body, "valid-signature", {
      messageId: "msg-completion-failure",
    });
    const redelivery = await handler.handle(body, "valid-signature", {
      messageId: "msg-completion-failure",
    });

    expect(first).toMatchObject({ success: false, statusCode: 500 });
    expect(redelivery).toMatchObject({
      success: false,
      statusCode: 503,
      body: { status: "running", retryable: true },
    });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(manager.fail).not.toHaveBeenCalled();
    expect(attemptManager.failAttempt).not.toHaveBeenCalled();
  });

  it("idempotent timeout 정책은 버려진 running attempt를 fence한 뒤 같은 실행에서 복구해야 한다", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-13T00:00:00.000Z"));
    try {
      const execute = vi.fn().mockResolvedValue("recovered");
      class AbandonedHandler {
        execute = execute;
      }

      triggerRegistry.register({
        type: "cron",
        expression: "* * * * *",
        methodName: "execute",
        target: AbandonedHandler.prototype,
        options: {},
      });

      const receiver = { verify: vi.fn().mockResolvedValue(true) } as unknown as Receiver;
      const { manager, create } = createIdempotentExecutionManager();
      const abandoned = await manager.create({
        type: "cron",
        idempotencyKey: "qstash:msg-abandoned",
        maxAttempts: 2,
        timeout: 1_000,
      });
      await manager.start(abandoned.id);
      vi.setSystemTime(new Date("2026-08-13T00:00:01.001Z"));

      const handler = new QStashTriggerHandlerBase({
        receiver,
        deliveryIdentityVerifier: vi.fn().mockResolvedValue(true),
        executionManager: manager,
        executionTimeout: 1_000,
        maxAttempts: 2,
        serviceResolver: () => new AbandonedHandler(),
        timeoutRetryPolicy: "idempotent",
      });
      const body = JSON.stringify({
        scheduleId: "schedule-abandoned",
        className: "AbandonedHandler",
        methodName: "execute",
        cronExpression: "* * * * *",
        timestamp: "2026-08-13T00:00:00.000Z",
      });

      const result = await handler.handle(body, "valid-signature", {
        messageId: "msg-abandoned",
      });

      expect(result).toMatchObject({
        success: true,
        executionId: abandoned.id,
        statusCode: 200,
      });
      expect(execute).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledTimes(2);
      expect(manager.timeout).toHaveBeenCalledWith(abandoned.id);
      expect(manager.reconcileTimedOut).not.toHaveBeenCalled();
      await expect(manager.get(abandoned.id)).resolves.toMatchObject({
        attempts: 2,
        status: "completed",
      });
    } finally {
      vi.useRealTimers();
    }
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

  it("Lambda 핸들러는 QStash 헤더 이름의 대소문자를 정규화해야 한다", async () => {
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
      executionTimeout: 60_000,
      serviceResolver: () => targetInstance,
    });

    const body = JSON.stringify({
      scheduleId: "schedule-lower-header",
      className: "LowercaseHeaderHandler",
      methodName: "execute",
      cronExpression: "* * * * *",
      timestamp: new Date().toISOString(),
    });
    const response = await lambdaHandler({
      body,
      headers: {
        "upstash-signature": "valid-signature",
        "upstash-message-id": "msg-lower-header",
      },
    });
    const standardCaseResponse = await lambdaHandler({
      body,
      headers: {
        "upstash-signature": "valid-signature",
        "Upstash-Message-Id": "msg-lower-header",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(standardCaseResponse).toEqual(response);

    const parsed = JSON.parse(response.body) as {
      executionId: string;
      result: string;
    };

    expect(parsed.executionId).toBe("exec-lower-header");
    expect(parsed.result).toBe("ok");
    expect(receiver.verify).toHaveBeenCalledTimes(2);
  });
});
