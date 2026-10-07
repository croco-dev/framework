import {
  NotificationChannel,
  NotificationDeliveryFailedProblem,
  NotificationPreferenceDeniedProblem,
  NotificationService,
  SendNotificationTask,
  type NotificationDispatchPreparation,
  type NotificationDispatchPreparationOptions,
  type NotificationPayload,
  type NotificationProvider,
  type NotificationSendContractOptions,
} from "@croco/notifications-core";
import { Container } from "@croco/framework-context";
import { Problem, ProblemCategory } from "@croco/problems-core";
import { TaskRegistry, TaskRunner, type TaskMetadata } from "@croco/tasks-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  defineMessage,
  EngagementCommandInvalidProblem,
  EngagementDispatchFailedProblem,
  EngagementDeliveryEventProcessor,
  EngagementPersistenceProblem,
  EngagementRecordedDispatchFailureProblem,
  EngagementRenderFailedProblem,
  EngagementService,
  EngagementSuppressionEvaluationProblem,
  InMemoryEngagementStore,
  InMemoryMessageRendererResolver,
  InMemoryRecipientDirectory,
  MessageDataInvalidProblem,
  MessageRendererRegistry,
  RecipientDirectoryLookupProblem,
  RecipientDirectoryScopeMismatchProblem,
  RecipientNotFoundProblem,
  RegistryEngagementMessageRenderer,
  Renders,
  StoredEngagementPolicyEvaluator,
  StoreBackedRecipientDirectory,
  createEngagementIdempotencyKey,
  createEngagementDispatchId,
  type EngagementNotificationDispatcher,
  type EngagementSendCommand,
  type EngagementSuppressionEvaluator,
  type MessageContext,
  type MessageRenderer,
  type RecipientDirectory,
  type ResolvedRecipient,
} from "../index";

class RetryabilityCauseProblem extends Problem {
  constructor(retryable?: boolean) {
    super("test/provider-failed", ProblemCategory.InternalServerError, "provider failed", {
      extensions: retryable === undefined ? {} : { retryable },
    });
  }
}

describe("engagement failure wrapper retryability", () => {
  const ref = { tenantId: "tenant-1", userId: "user-1" };
  const causes = [
    { name: "plain Error", cause: new Error("unclassified"), expected: true, dispatch: true },
    {
      name: "unclassified Problem",
      cause: new RetryabilityCauseProblem(),
      expected: true,
      dispatch: false,
    },
    {
      name: "Problem extension true",
      cause: new RetryabilityCauseProblem(true),
      expected: true,
      dispatch: true,
    },
    {
      name: "Problem extension false",
      cause: new RetryabilityCauseProblem(false),
      expected: false,
      dispatch: false,
    },
    {
      name: "Error extension true",
      cause: Object.assign(new Error("provider"), { extensions: { retryable: true } }),
      expected: true,
      dispatch: true,
    },
    {
      name: "Error extension false",
      cause: Object.assign(new Error("provider"), { extensions: { retryable: false } }),
      expected: false,
      dispatch: false,
    },
    {
      name: "top-level true overrides extension false",
      cause: Object.assign(new RetryabilityCauseProblem(false), { retryable: true }),
      expected: true,
      dispatch: true,
    },
    {
      name: "top-level false overrides extension true",
      cause: Object.assign(new RetryabilityCauseProblem(true), { retryable: false }),
      expected: false,
      dispatch: false,
    },
  ];

  it.each(causes)("preserves directory cause classification: $name", ({ cause, expected }) => {
    const problem = new RecipientDirectoryLookupProblem(ref, cause);
    expect(problem.cause).toBe(cause);
    expect(problem.extensions?.retryable).toBe(expected);
  });

  it.each(causes)("preserves suppression cause classification: $name", ({ cause, expected }) => {
    const problem = new EngagementSuppressionEvaluationProblem("message", ref, "email", cause);
    expect(problem.cause).toBe(cause);
    expect(problem.extensions?.retryable).toBe(expected);
  });

  it.each(causes)("preserves dispatch cause classification: $name", ({ cause, dispatch }) => {
    const problem = new EngagementDispatchFailedProblem("message", ref, "email", [], cause);
    expect(problem.cause).toBe(cause);
    expect(problem.extensions?.retryable).toBe(dispatch);
  });

  it.each(causes)("keeps renderer failures terminal: $name", ({ cause }) => {
    const problem = new EngagementRenderFailedProblem("message", ref, "email", cause);
    expect(problem.cause).toBe(cause);
    expect(problem.extensions?.retryable).toBe(false);
  });
});

const TrialEnding = defineMessage({
  id: "billing.trial-ending",
  topic: "billing",
  data: z.object({ tenantName: z.string(), secret: z.string() }).strict(),
  channels: ["email", "push"],
});

@Renders(TrialEnding)
class TrialEndingRenderer implements MessageRenderer<typeof TrialEnding> {
  email({ data }: MessageContext<typeof TrialEnding, "email">) {
    return {
      subject: `${data.tenantName} trial`,
      html: `<p>${data.tenantName}</p>`,
      text: data.tenantName,
      replyTo: "billing@example.com",
      headers: { "X-Engagement-Topic": "billing" },
    };
  }

  push({ data }: MessageContext<typeof TrialEnding, "push">) {
    return { title: "Trial ending", body: data.tenantName, deepLink: "/billing" };
  }
}

const recipient: ResolvedRecipient = {
  recipient: { tenantId: "tenant-1", userId: "user-1" },
  email: { id: "email-primary", address: "user@example.com" },
  push: [
    { id: "push-phone", tokenReference: "push-token-phone" },
    { id: "push-tablet", tokenReference: "push-token-tablet" },
  ],
  locale: "en-US",
  timezone: "Asia/Seoul",
};

function createRenderer(renderer: MessageRenderer<typeof TrialEnding> = new TrialEndingRenderer()) {
  const registry = new MessageRendererRegistry();
  registry.registerMessage(TrialEnding);
  registry.registerRenderer(renderer.constructor as typeof TrialEndingRenderer);
  registry.bootstrap();
  const resolver = new InMemoryMessageRendererResolver();
  resolver.register(TrialEnding, renderer);
  return new RegistryEngagementMessageRenderer(registry, resolver);
}

function createDispatchPreparation(
  channel: NotificationChannel,
  options: NotificationDispatchPreparationOptions,
  dispatch: (
    channel: NotificationChannel,
    payload: NotificationPayload,
    options: NotificationSendContractOptions,
  ) => Promise<{ executionId: string }>,
): NotificationDispatchPreparation {
  return {
    dispatch: async (payload, dispatchOptions) =>
      dispatch(channel, payload, {
        idempotencyKey: dispatchOptions.idempotencyKey,
        preferenceContext: options.preferenceContext,
      }),
  };
}

function createDispatcher() {
  let sequence = 0;
  const executionIds = new Map<string, string>();
  const dispatch = vi.fn(
    async (
      _channel: NotificationChannel,
      _payload: NotificationPayload,
      options: NotificationSendContractOptions,
    ) => {
      const executionId =
        executionIds.get(options.idempotencyKey) ?? `execution-${String(++sequence)}`;
      executionIds.set(options.idempotencyKey, executionId);
      return { executionId };
    },
  );
  const prepareDispatch = vi.fn<EngagementNotificationDispatcher["prepareDispatch"]>(
    (channel, options) => createDispatchPreparation(channel, options, dispatch),
  );
  return {
    dispatch,
    prepareDispatch,
    service: { prepareDispatch } satisfies EngagementNotificationDispatcher,
  };
}

type TestExecution = {
  id: string;
  type: string;
  payload: unknown;
  status: "pending" | "running" | "completed" | "failed";
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  startedAt?: Date;
  result?: unknown;
  idempotencyKey?: string;
  error?: { message: string; code?: string; retryable: boolean };
};

class TestExecutionMissingProblem extends Problem {
  constructor(id: string) {
    super(
      "engagement-core/test-execution-missing",
      ProblemCategory.NotFound,
      `Execution ${id} was not created`,
      { extensions: { retryable: false } },
    );
  }
}

function createIdempotentExecutionManager() {
  const executions = new Map<string, TestExecution>();
  const executionIds = new Map<string, string>();
  let sequence = 0;

  return {
    create: vi.fn(
      async (params: {
        type: string;
        payload: unknown;
        maxAttempts?: number;
        idempotencyKey?: string;
      }) => {
        const existingId =
          params.idempotencyKey === undefined ? undefined : executionIds.get(params.idempotencyKey);
        if (existingId !== undefined) {
          const existing = executions.get(existingId);
          if (existing !== undefined) return existing;
        }

        const id = `execution-${String(++sequence)}`;
        const created: TestExecution = {
          id,
          type: params.type,
          payload: params.payload,
          status: "pending",
          attempts: 0,
          maxAttempts: params.maxAttempts ?? 1,
          createdAt: new Date(),
          ...(params.idempotencyKey === undefined ? {} : { idempotencyKey: params.idempotencyKey }),
        };
        executions.set(id, created);
        if (params.idempotencyKey !== undefined) {
          executionIds.set(params.idempotencyKey, id);
        }
        return created;
      },
    ),
    start: vi.fn(async (id: string) => {
      const execution = executions.get(id);
      if (execution === undefined) throw new TestExecutionMissingProblem(id);
      const running: TestExecution = {
        ...execution,
        status: "running",
        attempts: execution.attempts + 1,
        startedAt: new Date(),
      };
      executions.set(id, running);
      return running;
    }),
    complete: vi.fn(async (id: string, result: unknown) => {
      const execution = executions.get(id);
      if (execution === undefined) throw new TestExecutionMissingProblem(id);
      const completed: TestExecution = { ...execution, status: "completed", result };
      executions.set(id, completed);
      return completed;
    }),
    fail: vi.fn(
      async (id: string, error: { message: string; code?: string; retryable: boolean }) => {
        const execution = executions.get(id);
        if (execution === undefined) throw new TestExecutionMissingProblem(id);
        const failed: TestExecution = { ...execution, status: "failed", error };
        executions.set(id, failed);
        return failed;
      },
    ),
  };
}

describe("EngagementService", () => {
  let directory!: InMemoryRecipientDirectory;

  beforeEach(() => {
    Container.reset();
    directory = new InMemoryRecipientDirectory([recipient]);
  });

  it("queues the first reachable channel without accepting provider-facing options", async () => {
    const dispatcher = createDispatcher();
    const engagement = new EngagementService(directory, createRenderer(), dispatcher.service);

    const result = await engagement.send(TrialEnding, {
      recipient: recipient.recipient,
      data: { tenantName: "Croco", secret: "payload-secret" },
      key: "subscription-1",
    });

    expect(result).toEqual({
      status: "queued",
      executionIds: ["execution-1"],
      channelResults: [
        { channel: "email", status: "queued", executionIds: ["execution-1"] },
        { channel: "push", status: "skipped", reason: "policy" },
      ],
    });
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      NotificationChannel.EMAIL,
      expect.objectContaining({
        to: "user@example.com",
        subject: "Croco trial",
        content: "<p>Croco</p>",
        text: "Croco",
        replyTo: "billing@example.com",
        headers: { "X-Engagement-Topic": "billing" },
        locale: "en-US",
        metadata: {
          messageId: "billing.trial-ending",
          topic: "billing",
          timezone: "Asia/Seoul",
        },
      }),
      expect.objectContaining({
        preferenceContext: {
          tenantId: "tenant-1",
          userId: "user-1",
          channel: NotificationChannel.EMAIL,
          topic: "billing",
        },
      }),
    );
    expect(dispatcher.dispatch.mock.calls[0]?.[2]).not.toHaveProperty(
      "unsafeSkipPreferenceEvaluation",
    );
  });

  it("parses transformed command input exactly once before rendering", async () => {
    let transformations = 0;
    const TransformedMessage = defineMessage({
      id: "billing.transformed",
      topic: "billing",
      data: z
        .object({
          tenantName: z.string().transform((value) => {
            transformations += 1;
            return value.length;
          }),
        })
        .strict(),
      channels: ["email"],
    });

    @Renders(TransformedMessage)
    class TransformedRenderer implements MessageRenderer<typeof TransformedMessage> {
      email({ data }: MessageContext<typeof TransformedMessage, "email">) {
        return {
          subject: String(data.tenantName),
          html: `<p>${String(data.tenantName)}</p>`,
          text: String(data.tenantName),
        };
      }
    }

    const registry = new MessageRendererRegistry();
    registry.registerMessage(TransformedMessage);
    registry.registerRenderer(TransformedRenderer);
    registry.bootstrap();
    const resolver = new InMemoryMessageRendererResolver();
    resolver.register(TransformedMessage, new TransformedRenderer());
    const dispatcher = createDispatcher();
    const engagement = new EngagementService(
      directory,
      new RegistryEngagementMessageRenderer(registry, resolver),
      dispatcher.service,
    );

    await expect(
      engagement.send(TransformedMessage, {
        recipient: recipient.recipient,
        data: { tenantName: "Croco" },
        key: "transformed-1",
      }),
    ).resolves.toMatchObject({ status: "queued" });

    expect(transformations).toBe(1);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      NotificationChannel.EMAIL,
      expect.objectContaining({ subject: "5", content: "<p>5</p>", text: "5" }),
      expect.anything(),
    );
  });

  it("redacts exceptions thrown while parsing message data", async () => {
    const ThrowingMessage = defineMessage({
      id: "billing.throwing-transform",
      topic: "billing",
      data: z.object({
        secret: z.string().transform((value): never => {
          throw new Error(`transform failed for ${value}`);
        }),
      }),
      channels: ["email"],
    });

    @Renders(ThrowingMessage)
    class ThrowingMessageRenderer implements MessageRenderer<typeof ThrowingMessage> {
      email() {
        return { subject: "unused", html: "unused", text: "unused" };
      }
    }

    const registry = new MessageRendererRegistry();
    registry.registerMessage(ThrowingMessage);
    registry.registerRenderer(ThrowingMessageRenderer);
    registry.bootstrap();
    const resolver = new InMemoryMessageRendererResolver();
    resolver.register(ThrowingMessage, new ThrowingMessageRenderer());
    const dispatcher = createDispatcher();
    const engagement = new EngagementService(
      directory,
      new RegistryEngagementMessageRenderer(registry, resolver),
      dispatcher.service,
    );

    const problem = await engagement
      .send(ThrowingMessage, {
        recipient: recipient.recipient,
        data: { secret: "payload-secret" },
        key: "throwing-transform-1",
      })
      .catch((error: unknown) => error);

    expect(problem).toBeInstanceOf(MessageDataInvalidProblem);
    const serialized = JSON.stringify((problem as MessageDataInvalidProblem).toJSON());
    expect(serialized).not.toContain("payload-secret");
    expect(serialized).not.toContain("transform failed");
    expect(dispatcher.prepareDispatch).not.toHaveBeenCalled();
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });

  it("queues every active endpoint under the explicit all-reachable policy", async () => {
    const dispatcher = createDispatcher();
    const engagement = new EngagementService(directory, createRenderer(), dispatcher.service);

    const result = await engagement.send(TrialEnding, {
      recipient: recipient.recipient,
      data: { tenantName: "Croco", secret: "payload-secret" },
      key: "subscription-1",
      policy: "all-reachable",
    });

    expect(result).toEqual({
      status: "queued",
      executionIds: ["execution-1", "execution-2", "execution-3"],
      channelResults: [
        { channel: "email", status: "queued", executionIds: ["execution-1"] },
        {
          channel: "push",
          status: "queued",
          executionIds: ["execution-2", "execution-3"],
        },
      ],
    });
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(3);
  });

  it("rejects unsupported runtime delivery policies before dispatch", async () => {
    const dispatcher = createDispatcher();
    const engagement = new EngagementService(directory, createRenderer(), dispatcher.service);
    const command = {
      recipient: recipient.recipient,
      data: { tenantName: "Croco", secret: "payload-secret" },
      key: "subscription-1",
      policy: "typo",
    } as unknown as EngagementSendCommand<typeof TrialEnding>;

    await expect(engagement.send(TrialEnding, command)).rejects.toBeInstanceOf(
      EngagementCommandInvalidProblem,
    );
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });

  it.each([
    { label: "missing command", command: undefined },
    { label: "non-object command", command: "invalid" },
    { label: "missing recipient", command: { key: "subscription-1" } },
    { label: "non-object recipient", command: { recipient: 1, key: "subscription-1" } },
    {
      label: "non-string tenantId",
      command: { recipient: { tenantId: 1, userId: "user-1" }, key: "subscription-1" },
    },
    {
      label: "non-string userId",
      command: { recipient: { tenantId: "tenant-1", userId: 1 }, key: "subscription-1" },
    },
    {
      label: "non-string key",
      command: { recipient: recipient.recipient, key: 1 },
    },
  ])("rejects malformed runtime command shapes: $label", async ({ command }) => {
    const dispatcher = createDispatcher();
    const engagement = new EngagementService(directory, createRenderer(), dispatcher.service);

    await expect(
      engagement.send(TrialEnding, command as unknown as EngagementSendCommand<typeof TrialEnding>),
    ).rejects.toBeInstanceOf(EngagementCommandInvalidProblem);
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });

  it.each([
    { label: "missing data", data: undefined },
    { label: "wrong field type", data: { tenantName: 1, secret: "payload-secret" } },
    {
      label: "extra field",
      data: { tenantName: "Croco", secret: "payload-secret", endpoint: "raw@example.com" },
    },
  ])("preserves message validation Problems for runtime-invalid data: $label", async ({ data }) => {
    const dispatcher = createDispatcher();
    const engagement = new EngagementService(directory, createRenderer(), dispatcher.service);
    const command = {
      recipient: recipient.recipient,
      data,
      key: "subscription-1",
    } as unknown as EngagementSendCommand<typeof TrialEnding>;

    await expect(engagement.send(TrialEnding, command)).rejects.toBeInstanceOf(
      MessageDataInvalidProblem,
    );
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });

  it("validates message data before resolving delivery endpoints", async () => {
    const noEndpoints = new InMemoryRecipientDirectory([
      { recipient: recipient.recipient, push: [] },
    ]);
    const dispatcher = createDispatcher();
    const engagement = new EngagementService(noEndpoints, createRenderer(), dispatcher.service);

    await expect(
      engagement.send(TrialEnding, {
        recipient: recipient.recipient,
        data: {},
        key: "subscription-1",
      } as unknown as EngagementSendCommand<typeof TrialEnding>),
    ).rejects.toBeInstanceOf(MessageDataInvalidProblem);
    expect(dispatcher.prepareDispatch).not.toHaveBeenCalled();
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });

  it("validates message data before notification preference evaluation", async () => {
    const dispatcher = createDispatcher();
    dispatcher.prepareDispatch.mockImplementation((_channel, options) => {
      throw new NotificationPreferenceDeniedProblem({
        context: options.preferenceContext,
        reason: "user-opted-out",
        evaluationKey: "preference-denied",
      });
    });
    const engagement = new EngagementService(directory, createRenderer(), dispatcher.service);

    await expect(
      engagement.send(TrialEnding, {
        recipient: recipient.recipient,
        data: {},
        key: "subscription-1",
      } as unknown as EngagementSendCommand<typeof TrialEnding>),
    ).rejects.toBeInstanceOf(MessageDataInvalidProblem);
    expect(dispatcher.prepareDispatch).not.toHaveBeenCalled();
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });

  it("throws a stable Problem when the recipient is absent", async () => {
    const dispatcher = createDispatcher();
    const engagement = new EngagementService(directory, createRenderer(), dispatcher.service);

    await expect(
      engagement.send(TrialEnding, {
        recipient: { tenantId: "tenant-1", userId: "missing" },
        data: { tenantName: "Croco", secret: "payload-secret" },
        key: "subscription-1",
      }),
    ).rejects.toBeInstanceOf(RecipientNotFoundProblem);
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });

  it("distinguishes lookup failure from a missing recipient", async () => {
    const failingDirectory: RecipientDirectory = {
      async resolve() {
        throw new Error("database unavailable");
      },
    };
    const dispatcher = createDispatcher();
    const engagement = new EngagementService(
      failingDirectory,
      createRenderer(),
      dispatcher.service,
    );

    await expect(
      engagement.send(TrialEnding, {
        recipient: recipient.recipient,
        data: { tenantName: "Croco", secret: "payload-secret" },
        key: "subscription-1",
      }),
    ).rejects.toBeInstanceOf(RecipientDirectoryLookupProblem);
  });

  it("rejects directory results that escape the requested tenant scope", async () => {
    const scopedDirectory: RecipientDirectory = {
      async resolve() {
        return {
          recipient: { tenantId: "tenant-2", userId: "user-1" },
          push: [],
        };
      },
    };
    const dispatcher = createDispatcher();
    const engagement = new EngagementService(scopedDirectory, createRenderer(), dispatcher.service);

    await expect(
      engagement.send(TrialEnding, {
        recipient: recipient.recipient,
        data: { tenantName: "Croco", secret: "payload-secret" },
        key: "subscription-1",
      }),
    ).rejects.toBeInstanceOf(RecipientDirectoryScopeMismatchProblem);
  });

  it("returns no-endpoint without rendering or dispatching", async () => {
    const noEndpoints = new InMemoryRecipientDirectory([
      { recipient: recipient.recipient, push: [] },
    ]);
    const dispatcher = createDispatcher();
    const render = createRenderer();
    const renderSpy = vi.spyOn(render, "render");
    const engagement = new EngagementService(noEndpoints, render, dispatcher.service);

    await expect(
      engagement.send(TrialEnding, {
        recipient: recipient.recipient,
        data: { tenantName: "Croco", secret: "payload-secret" },
        key: "subscription-1",
      }),
    ).resolves.toEqual({
      status: "suppressed",
      reason: "no-endpoint",
      channelResults: [
        { channel: "email", status: "unavailable", reason: "no-endpoint" },
        { channel: "push", status: "unavailable", reason: "no-endpoint" },
      ],
    });
    expect(renderSpy).not.toHaveBeenCalled();
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });

  it("records durable no-endpoint outcomes for every unavailable channel", async () => {
    const noEndpoints = new InMemoryRecipientDirectory([
      { recipient: recipient.recipient, push: [] },
    ]);
    const dispatcher = createDispatcher();
    const store = new InMemoryEngagementStore();
    const engagement = new EngagementService(
      noEndpoints,
      createRenderer(),
      dispatcher.service,
      undefined,
      store,
    );

    await engagement.send(TrialEnding, {
      recipient: recipient.recipient,
      data: { tenantName: "Croco", secret: "payload-secret" },
      key: "no-endpoint-1",
    });

    await expect(
      store.findByIdentity({
        tenantId: "tenant-1",
        messageId: TrialEnding.id,
        recipientId: "user-1",
        channel: "email",
        semanticKey: "no-endpoint-1",
      }),
    ).resolves.toMatchObject({ outcome: { kind: "unavailable", reason: "no-endpoint" } });
    await expect(
      store.findByIdentity({
        tenantId: "tenant-1",
        messageId: TrialEnding.id,
        recipientId: "user-1",
        channel: "push",
        semanticKey: "no-endpoint-1",
      }),
    ).resolves.toMatchObject({ outcome: { kind: "unavailable", reason: "no-endpoint" } });
  });

  it("replays a durable logical dispatch without contacting the provider again", async () => {
    const dispatcher = createDispatcher();
    const store = new InMemoryEngagementStore();
    const engagement = new EngagementService(
      directory,
      createRenderer(),
      dispatcher.service,
      undefined,
      store,
    );
    const command = {
      recipient: recipient.recipient,
      data: { tenantName: "Croco", secret: "payload-secret" },
      key: "durable-replay-1",
    } as const;

    const first = await engagement.send(TrialEnding, command);
    const replay = await engagement.send(TrialEnding, command);

    expect(replay).toEqual(first);
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
  });

  it("replays a completed send without resolving the recipient again", async () => {
    const dispatcher = createDispatcher();
    const store = new InMemoryEngagementStore();
    const command = {
      recipient: recipient.recipient,
      data: { tenantName: "Croco", secret: "payload-secret" },
      key: "durable-directory-independent-replay-1",
    } as const;
    const first = await new EngagementService(
      directory,
      createRenderer(),
      dispatcher.service,
      undefined,
      store,
    ).send(TrialEnding, command);
    const unavailableDirectory: RecipientDirectory = {
      async resolve() {
        throw new Error("directory unavailable");
      },
    };

    const replay = await new EngagementService(
      unavailableDirectory,
      createRenderer(),
      dispatcher.service,
      undefined,
      store.reopen(),
    ).send(TrialEnding, command);

    expect(replay).toEqual(first);
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
  });

  it("replays a durable failed dispatch without contacting the provider again", async () => {
    const dispatcher = createDispatcher();
    dispatcher.dispatch.mockRejectedValue(new NotificationDeliveryFailedProblem("fake-provider"));
    const store = new InMemoryEngagementStore();
    const engagement = new EngagementService(
      directory,
      createRenderer(),
      dispatcher.service,
      undefined,
      store,
    );
    const command = {
      recipient: recipient.recipient,
      data: { tenantName: "Croco", secret: "payload-secret" },
      key: "durable-failure-1",
    } as const;

    await expect(engagement.send(TrialEnding, command)).rejects.toBeInstanceOf(
      EngagementDispatchFailedProblem,
    );
    const replayed = await engagement.send(TrialEnding, command).catch((error: unknown) => error);

    expect(replayed).toBeInstanceOf(EngagementDispatchFailedProblem);
    expect((replayed as EngagementDispatchFailedProblem).cause).toBeInstanceOf(
      EngagementRecordedDispatchFailureProblem,
    );
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      name: "Error with top-level true",
      cause: Object.assign(new Error("provider"), { retryable: true }),
      retryable: true,
    },
    {
      name: "Error with top-level false",
      cause: Object.assign(new Error("provider"), { retryable: false }),
      retryable: false,
    },
    {
      name: "Problem top-level true overrides extension false",
      cause: Object.assign(new RetryabilityCauseProblem(false), { retryable: true }),
      retryable: true,
    },
    {
      name: "Problem top-level false overrides extension true",
      cause: Object.assign(new RetryabilityCauseProblem(true), { retryable: false }),
      retryable: false,
    },
    { name: "unclassified Error", cause: new Error("provider"), retryable: true },
    { name: "unclassified Problem", cause: new RetryabilityCauseProblem(), retryable: false },
  ])("preserves durable dispatch retryability for $name", async ({ cause, retryable }) => {
    const dispatcher = createDispatcher();
    dispatcher.dispatch.mockRejectedValue(cause);
    const store = new InMemoryEngagementStore();
    const engagement = new EngagementService(
      directory,
      createRenderer(),
      dispatcher.service,
      undefined,
      store,
    );
    const command = {
      recipient: recipient.recipient,
      data: { tenantName: "Croco", secret: "payload-secret" },
      key: "durable-retryability-1",
    } as const;

    await expect(engagement.send(TrialEnding, command)).rejects.toMatchObject({
      code: "engagement-core/dispatch-failed",
      cause,
      extensions: { retryable },
    });
    await expect(
      store.findByIdentity({
        tenantId: recipient.recipient.tenantId,
        messageId: TrialEnding.id,
        recipientId: recipient.recipient.userId,
        channel: "email",
        semanticKey: command.key,
      }),
    ).resolves.toMatchObject({
      outcome: { kind: "failed", stage: "provider", retryable, executionIds: [] },
    });

    await expect(engagement.send(TrialEnding, command)).rejects.toMatchObject({
      code: "engagement-core/dispatch-failed",
      extensions: { retryable: false },
      cause: {
        code: "engagement-core/recorded-dispatch-failed",
        extensions: { providerRetryable: retryable, retryable: false },
      },
    });
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
  });

  it("preserves successful target evidence when a later endpoint fails", async () => {
    const dispatcher = createDispatcher();
    dispatcher.dispatch
      .mockResolvedValueOnce({ executionId: "email-execution" })
      .mockResolvedValueOnce({ executionId: "push-phone-execution" })
      .mockRejectedValueOnce(new NotificationDeliveryFailedProblem("fake-provider"));
    const store = new InMemoryEngagementStore();
    const engagement = new EngagementService(
      directory,
      createRenderer(),
      dispatcher.service,
      undefined,
      store,
    );
    const command = {
      recipient: recipient.recipient,
      data: { tenantName: "Croco", secret: "payload-secret" },
      key: "durable-partial-failure-1",
      policy: "all-reachable",
    } as const;

    const firstFailure = await engagement
      .send(TrialEnding, command)
      .catch((error: unknown) => error);
    expect(firstFailure).toBeInstanceOf(EngagementDispatchFailedProblem);
    expect(firstFailure).toMatchObject({
      extensions: {
        channelResults: [
          { channel: "email", status: "queued", executionIds: ["email-execution"] },
          {
            channel: "push",
            status: "queued",
            executionIds: ["push-phone-execution"],
          },
        ],
      },
    });

    await expect(
      store.findByIdentity({
        tenantId: recipient.recipient.tenantId,
        messageId: TrialEnding.id,
        recipientId: recipient.recipient.userId,
        channel: "push",
        semanticKey: command.key,
      }),
    ).resolves.toMatchObject({
      targets: [
        {
          endpointId: "push-phone",
          executionId: "push-phone-execution",
        },
        { endpointId: "push-tablet" },
      ],
      outcome: {
        kind: "failed",
        stage: "provider",
        executionIds: ["push-phone-execution"],
      },
    });

    const replayed = await engagement.send(TrialEnding, command).catch((error: unknown) => error);
    expect(replayed).toBeInstanceOf(EngagementDispatchFailedProblem);
    expect((replayed as EngagementDispatchFailedProblem).extensions?.channelResults).toEqual(
      (firstFailure as EngagementDispatchFailedProblem).extensions?.channelResults,
    );
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(3);
  });

  it("surfaces persistence failure when provider failure evidence cannot be recorded", async () => {
    const dispatcher = createDispatcher();
    dispatcher.dispatch.mockRejectedValue(new NotificationDeliveryFailedProblem("fake-provider"));
    const store = new InMemoryEngagementStore();
    vi.spyOn(store, "recordDispatch").mockRejectedValue(new Error("evidence store unavailable"));
    const engagement = new EngagementService(
      directory,
      createRenderer(),
      dispatcher.service,
      undefined,
      store,
    );

    const problem = await engagement
      .send(TrialEnding, {
        recipient: recipient.recipient,
        data: { tenantName: "Croco", secret: "payload-secret" },
        key: "failed-evidence-1",
      })
      .catch((error: unknown) => error);

    expect(problem).toBeInstanceOf(EngagementPersistenceProblem);
    expect((problem as EngagementPersistenceProblem).extensions).toMatchObject({
      operation: "record-failed-dispatch",
      retryable: true,
    });
  });

  it("records stored preference denial separately from provider failure", async () => {
    const dispatcher = createDispatcher();
    const store = new InMemoryEngagementStore();
    await store.setPreference({
      tenantId: "tenant-1",
      recipientId: "user-1",
      scope: "recipient",
      topic: "billing",
      channel: "email",
      state: "deny",
      source: "recipient-settings",
      changedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    const engagement = new EngagementService(
      directory,
      createRenderer(),
      dispatcher.service,
      new StoredEngagementPolicyEvaluator(store, store, { globalDefault: "allow" }),
      store,
    );

    await expect(
      engagement.send(TrialEnding, {
        recipient: recipient.recipient,
        data: { tenantName: "Croco", secret: "payload-secret" },
        key: "preference-denial-1",
      }),
    ).resolves.toMatchObject({
      status: "queued",
      channelResults: [
        { channel: "email", status: "suppressed", reason: "preference" },
        { channel: "push", status: "queued" },
      ],
    });
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(2);
    await expect(
      store.findByIdentity({
        tenantId: "tenant-1",
        messageId: TrialEnding.id,
        recipientId: "user-1",
        channel: "email",
        semanticKey: "preference-denial-1",
      }),
    ).resolves.toMatchObject({ outcome: { kind: "suppressed", reason: "preference" } });
  });

  it("continues to the next reachable channel after preference denial", async () => {
    const dispatcher = createDispatcher();
    dispatcher.prepareDispatch.mockImplementation((channel, options) => {
      if (channel === NotificationChannel.EMAIL) {
        throw new NotificationPreferenceDeniedProblem({
          context: {
            tenantId: "tenant-1",
            userId: "user-1",
            channel,
            topic: "billing",
          },
          reason: "user-opted-out",
          evaluationKey: "preference-1",
        });
      }
      return createDispatchPreparation(channel, options, dispatcher.dispatch);
    });
    dispatcher.dispatch.mockResolvedValue({ executionId: "push-execution" });
    const renderer = createRenderer();
    const renderSpy = vi.spyOn(renderer, "render");
    renderSpy.mockImplementation(async (_message, channel) => {
      if (channel === "email") {
        throw new Error("preference-denied email must not render");
      }
      return { title: "Trial ending", body: "Croco", deepLink: "/billing" } as never;
    });
    const engagement = new EngagementService(directory, renderer, dispatcher.service);

    await expect(
      engagement.send(TrialEnding, {
        recipient: recipient.recipient,
        data: { tenantName: "Croco", secret: "payload-secret" },
        key: "subscription-1",
      }),
    ).resolves.toEqual({
      status: "queued",
      executionIds: ["push-execution", "push-execution"],
      channelResults: [
        { channel: "email", status: "suppressed", reason: "preference" },
        {
          channel: "push",
          status: "queued",
          executionIds: ["push-execution", "push-execution"],
        },
      ],
    });
    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(renderSpy).toHaveBeenCalledWith(
      TrialEnding,
      "push",
      expect.objectContaining({ tenantName: "Croco" }),
    );
  });

  it("preflights preference denial before rendering any all-reachable channel", async () => {
    const dispatcher = createDispatcher();
    dispatcher.prepareDispatch.mockImplementation((channel, options) => {
      if (channel === NotificationChannel.EMAIL) {
        throw new NotificationPreferenceDeniedProblem({
          context: options.preferenceContext,
          reason: "user-opted-out",
          evaluationKey: "preference-all-reachable",
        });
      }
      return createDispatchPreparation(channel, options, dispatcher.dispatch);
    });
    const renderer = createRenderer();
    const renderSpy = vi.spyOn(renderer, "render");
    renderSpy.mockImplementation(async (_message, channel) => {
      if (channel === "email") {
        throw new Error("preference-denied email must not render");
      }
      return { title: "Trial ending", body: "Croco", deepLink: "/billing" } as never;
    });
    const engagement = new EngagementService(directory, renderer, dispatcher.service);

    await expect(
      engagement.send(TrialEnding, {
        recipient: recipient.recipient,
        data: { tenantName: "Croco", secret: "payload-secret" },
        key: "subscription-1",
        policy: "all-reachable",
      }),
    ).resolves.toEqual({
      status: "queued",
      executionIds: ["execution-1", "execution-2"],
      channelResults: [
        { channel: "email", status: "suppressed", reason: "preference" },
        {
          channel: "push",
          status: "queued",
          executionIds: ["execution-1", "execution-2"],
        },
      ],
    });
    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(renderSpy).toHaveBeenCalledWith(
      TrialEnding,
      "push",
      expect.objectContaining({ tenantName: "Croco" }),
    );
  });

  it("uses one prepared preference decision for every endpoint in a channel", async () => {
    const dispatcher = createDispatcher();
    dispatcher.dispatch
      .mockResolvedValueOnce({ executionId: "push-phone-execution" })
      .mockResolvedValueOnce({ executionId: "push-tablet-execution" });
    const pushOnlyDirectory = new InMemoryRecipientDirectory([
      { recipient: recipient.recipient, push: recipient.push },
    ]);
    const engagement = new EngagementService(
      pushOnlyDirectory,
      createRenderer(),
      dispatcher.service,
    );

    await expect(
      engagement.send(TrialEnding, {
        recipient: recipient.recipient,
        data: { tenantName: "Croco", secret: "payload-secret" },
        key: "subscription-1",
        policy: "all-reachable",
      }),
    ).resolves.toEqual({
      status: "queued",
      executionIds: ["push-phone-execution", "push-tablet-execution"],
      channelResults: [
        { channel: "email", status: "unavailable", reason: "no-endpoint" },
        {
          channel: "push",
          status: "queued",
          executionIds: ["push-phone-execution", "push-tablet-execution"],
        },
      ],
    });
    expect(dispatcher.prepareDispatch).toHaveBeenCalledTimes(1);
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(2);
  });

  it("returns suppression without rendering or provider failure", async () => {
    const suppressions: EngagementSuppressionEvaluator = {
      async evaluate() {
        return { suppressed: true, reason: "hard-bounce" };
      },
    };
    const dispatcher = createDispatcher();
    const render = createRenderer();
    const renderSpy = vi.spyOn(render, "render");
    const engagement = new EngagementService(directory, render, dispatcher.service, suppressions);

    await expect(
      engagement.send(TrialEnding, {
        recipient: recipient.recipient,
        data: { tenantName: "Croco", secret: "payload-secret" },
        key: "subscription-1",
      }),
    ).resolves.toMatchObject({ status: "suppressed", reason: "suppression" });
    expect(renderSpy).not.toHaveBeenCalled();
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });

  it("retains safe recipient evidence when rendering fails", async () => {
    @Renders(TrialEnding)
    class FailingRenderer implements MessageRenderer<typeof TrialEnding> {
      email(): never {
        throw new Error("payload-secret");
      }

      push() {
        return { title: "unused", body: "unused" };
      }
    }

    const dispatcher = createDispatcher();
    const engagement = new EngagementService(
      directory,
      createRenderer(new FailingRenderer()),
      dispatcher.service,
    );

    const problem = await engagement
      .send(TrialEnding, {
        recipient: recipient.recipient,
        data: { tenantName: "Croco", secret: "payload-secret" },
        key: "subscription-1",
      })
      .catch((error: unknown) => error);

    expect(problem).toBeInstanceOf(EngagementRenderFailedProblem);
    expect(problem).toMatchObject({
      extensions: {
        messageId: "billing.trial-ending",
        tenantId: "tenant-1",
        userId: "user-1",
        channel: "email",
      },
    });
    expect(JSON.stringify((problem as EngagementRenderFailedProblem).toJSON())).not.toContain(
      "payload-secret",
    );
  });

  it("preflights every all-reachable renderer before dispatch", async () => {
    @Renders(TrialEnding)
    class FailingPushRenderer implements MessageRenderer<typeof TrialEnding> {
      email() {
        return { subject: "Trial", html: "<p>Trial</p>", text: "Trial" };
      }

      push(): never {
        throw new Error("push renderer unavailable");
      }
    }

    const dispatcher = createDispatcher();
    const engagement = new EngagementService(
      directory,
      createRenderer(new FailingPushRenderer()),
      dispatcher.service,
    );

    await expect(
      engagement.send(TrialEnding, {
        recipient: recipient.recipient,
        data: { tenantName: "Croco", secret: "payload-secret" },
        key: "subscription-1",
        policy: "all-reachable",
      }),
    ).rejects.toMatchObject({
      code: "engagement-core/render-failed",
      extensions: { channel: "push" },
    });
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });

  it("preflights every all-reachable suppression decision before dispatch", async () => {
    const suppressions: EngagementSuppressionEvaluator = {
      async evaluate(context) {
        if (context.channel === "push") {
          throw new Error("suppression store unavailable");
        }
        return { suppressed: false };
      },
    };
    const dispatcher = createDispatcher();
    const engagement = new EngagementService(
      directory,
      createRenderer(),
      dispatcher.service,
      suppressions,
    );

    await expect(
      engagement.send(TrialEnding, {
        recipient: recipient.recipient,
        data: { tenantName: "Croco", secret: "payload-secret" },
        key: "subscription-1",
        policy: "all-reachable",
      }),
    ).rejects.toBeInstanceOf(EngagementSuppressionEvaluationProblem);
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });

  it("preserves partial channel evidence when provider dispatch fails", async () => {
    const dispatcher = createDispatcher();
    dispatcher.dispatch.mockImplementation(async (channel) => {
      if (channel === NotificationChannel.PUSH) {
        throw new NotificationDeliveryFailedProblem("fake-provider");
      }
      return { executionId: "email-execution" };
    });
    const engagement = new EngagementService(directory, createRenderer(), dispatcher.service);

    const problem = await engagement
      .send(TrialEnding, {
        recipient: recipient.recipient,
        data: { tenantName: "Croco", secret: "payload-secret" },
        key: "subscription-1",
        policy: "all-reachable",
      })
      .catch((error: unknown) => error);

    expect(problem).toBeInstanceOf(EngagementDispatchFailedProblem);
    expect(problem).toMatchObject({
      extensions: {
        channel: "push",
        causeCode: "notifications-core/delivery-failed",
        channelResults: [{ channel: "email", status: "queued", executionIds: ["email-execution"] }],
      },
    });
  });

  it("reuses deterministic execution identities across repeated sends", async () => {
    const dispatcher = createDispatcher();
    const engagement = new EngagementService(directory, createRenderer(), dispatcher.service);
    const command = {
      recipient: recipient.recipient,
      data: { tenantName: "Croco", secret: "payload-secret" },
      key: "subscription-1",
    } as const;

    const first = await engagement.send(TrialEnding, command);
    const second = await engagement.send(TrialEnding, command);

    expect(second).toEqual(first);
    expect(dispatcher.dispatch.mock.calls[0]?.[2].idempotencyKey).toBe(
      dispatcher.dispatch.mock.calls[1]?.[2].idempotencyKey,
    );
  });

  it("reuses the dispatch idempotency key when retrying failed persistence after an endpoint refresh", async () => {
    const store = new InMemoryEngagementStore();
    const endpoint = {
      id: "email-primary",
      tenantId: recipient.recipient.tenantId,
      recipientId: recipient.recipient.userId,
      kind: "email" as const,
      address: "user@example.com",
      lastSeenAt: new Date("2026-01-01T00:00:01.000Z"),
    };
    await store.saveEndpoint(endpoint);
    const storedDirectory = new StoreBackedRecipientDirectory(directory, store);
    const dispatcher = createDispatcher();
    vi.spyOn(store, "recordDispatch").mockRejectedValueOnce(
      new EngagementPersistenceProblem(
        "record-dispatch",
        endpoint.tenantId,
        new Error("evidence store unavailable"),
      ),
    );
    const engagement = new EngagementService(
      storedDirectory,
      createRenderer(),
      dispatcher.service,
      undefined,
      store,
    );
    const command = {
      recipient: recipient.recipient,
      data: { tenantName: "Croco", secret: "payload-secret" },
      key: "subscription-refresh",
    } as const;

    await expect(engagement.send(TrialEnding, command)).rejects.toMatchObject({
      code: "engagement-core/persistence-failed",
      extensions: { retryable: true },
    });
    await store.saveEndpoint({
      ...endpoint,
      lastSeenAt: new Date("2026-01-01T00:00:02.000Z"),
    });
    await engagement.send(TrialEnding, command);

    expect(dispatcher.dispatch).toHaveBeenCalledTimes(2);
    expect(dispatcher.dispatch.mock.calls[1]?.[2].idempotencyKey).toBe(
      dispatcher.dispatch.mock.calls[0]?.[2].idempotencyKey,
    );
  });

  it("deduplicates repeated sends through NotificationService and TaskRunner", async () => {
    let registeredProvider: NotificationProvider | undefined;
    const providerRegistry = {
      registerProvider(provider: NotificationProvider) {
        registeredProvider = provider;
      },
      getDefaultProviderName(channel: NotificationChannel) {
        return registeredProvider?.getChannel() === channel
          ? registeredProvider.getName()
          : undefined;
      },
      getProvider(name: string) {
        return registeredProvider?.getName() === name ? registeredProvider : undefined;
      },
      getProviderCapabilities(name: string) {
        return registeredProvider?.getName() === name
          ? registeredProvider.getCapabilities()
          : undefined;
      },
    };
    const providerSend = vi.fn(
      async () => ({ success: true, messageId: "fake-message-1" }) as const,
    );
    const provider: NotificationProvider = {
      getName: () => "fake-email",
      getChannel: () => NotificationChannel.EMAIL,
      getCapabilities: () => ({
        providerName: "fake-email",
        channels: [NotificationChannel.EMAIL],
        supportsIdempotencyKey: true,
        supportsProviderTemplates: false,
        supportsRenderedTemplates: true,
        outboxIntegration: "consumer-managed",
      }),
      send: providerSend,
    };
    const task = new SendNotificationTask(providerRegistry as never);
    const taskRegistry = new TaskRegistry();
    const metadata: TaskMetadata = {
      name: "send-notification",
      options: { maxAttempts: 1 },
      target: SendNotificationTask,
      methodName: "handle",
    };
    taskRegistry.register("send-notification", SendNotificationTask, "handle", metadata);
    const executionManager = createIdempotentExecutionManager();
    const taskRunner = new TaskRunner(executionManager as never, taskRegistry, undefined, {
      serviceResolver: (target) => {
        expect(target).toBe(SendNotificationTask);
        return task;
      },
    });
    const notificationService = new NotificationService(taskRunner, providerRegistry as never);
    notificationService.registerProvider(provider, true);
    const engagement = new EngagementService(directory, createRenderer(), notificationService);
    const command = {
      recipient: recipient.recipient,
      data: { tenantName: "Croco", secret: "payload-secret" },
      key: "subscription-1",
    } as const;

    const first = await engagement.send(TrialEnding, command);
    const second = await engagement.send(TrialEnding, command);

    expect(executionManager.create.mock.calls[1]?.[0].idempotencyKey).toBe(
      executionManager.create.mock.calls[0]?.[0].idempotencyKey,
    );
    expect(second).toEqual(first);
    expect(first).toMatchObject({ status: "queued", executionIds: ["execution-1"] });
    expect(providerSend).toHaveBeenCalledTimes(1);
  });
});

describe("createEngagementIdempotencyKey", () => {
  it("includes tenant, message, recipient, channel, semantic key, and endpoint identity", () => {
    const input = {
      tenantId: "tenant-1",
      messageId: "billing.trial-ending",
      userId: "user-1",
      channel: "email" as const,
      semanticKey: "subscription-1",
      endpointId: "email-primary",
    };

    expect(createEngagementIdempotencyKey(input)).toBe(createEngagementIdempotencyKey(input));
    expect(createEngagementIdempotencyKey({ ...input, tenantId: "tenant-2" })).not.toBe(
      createEngagementIdempotencyKey(input),
    );
  });
});

describe("durable push delivery outcomes", () => {
  const ref = { tenantId: "tenant-push", userId: "recipient-push" };
  const at = new Date("2026-01-01T00:00:00.000Z");

  class TestPushProblem extends Problem {
    constructor(kind: "token-unregistered" | "rate-limit") {
      super(
        `notifications-fcm/${kind}`,
        kind === "rate-limit" ? ProblemCategory.TooManyRequests : ProblemCategory.ValidationError,
        `FCM ${kind}`,
        {
          extensions: {
            provider: "fcm",
            endpointInvalid: kind === "token-unregistered",
            retryable: kind === "rate-limit",
          },
        },
      );
    }
  }

  async function createPushStore() {
    const store = new InMemoryEngagementStore(undefined, () => at);
    const endpoint = await store.saveEndpoint({
      id: "device-1",
      ...ref,
      recipientId: ref.userId,
      kind: "push",
      provider: "fcm",
      app: "app-1",
      platform: "ios",
      environment: "production",
      tokenReference: "vault://device-1",
      lastSeenAt: at,
    });
    const directory = new StoreBackedRecipientDirectory(
      new InMemoryRecipientDirectory([{ recipient: ref, push: [] }]),
      store,
    );
    return { store, endpoint, directory };
  }

  it("records provider acceptance and message ID for a resolved endpoint", async () => {
    const { store, directory } = await createPushStore();
    const dispatch = vi.fn(async () => ({
      executionId: "execution-push-1",
      providerName: "fcm",
      providerMessageId: "projects/project-1/messages/message-1",
    }));
    const notifications: EngagementNotificationDispatcher = {
      prepareDispatch: () => ({ dispatch }),
    };
    const service = new EngagementService(
      directory,
      createRenderer(),
      notifications,
      undefined,
      store,
      () => at,
      undefined,
      new EngagementDeliveryEventProcessor(store),
    );

    await service.send(TrialEnding, {
      recipient: ref,
      data: { tenantName: "Croco", secret: "redacted" },
      key: "push-accepted",
      policy: "all-reachable",
    });

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "vault://device-1",
        push: { title: "Trial ending", body: "Croco", deepLink: "/billing" },
      }),
      expect.anything(),
    );
    const dispatchId = createEngagementDispatchId({
      ...ref,
      recipientId: ref.userId,
      messageId: TrialEnding.id,
      channel: "push",
      semanticKey: "push-accepted",
    });
    const saved = await store.getDispatch(ref.tenantId, dispatchId);
    expect(saved?.targets).toMatchObject([
      {
        endpointId: "device-1",
        provider: "fcm",
        providerMessageId: "projects/project-1/messages/message-1",
      },
    ]);
    expect(await store.listByDispatch(ref.tenantId, dispatchId)).toMatchObject([
      { endpointId: "device-1", provider: "fcm", type: "accepted" },
    ]);
    const interaction = {
      tenantId: ref.tenantId,
      provider: "client-interaction",
      providerEventId: "authenticated-session:interaction-1",
      dispatchId,
      endpointId: "device-1",
      type: "opened" as const,
      occurredAt: at,
      recordedAt: at,
    };
    const processor = new EngagementDeliveryEventProcessor(store);
    expect((await processor.process(interaction)).event.duplicate).toBe(false);
    expect((await processor.process(interaction)).event.duplicate).toBe(true);
    expect(await store.listByDispatch(ref.tenantId, dispatchId)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "accepted" }),
        expect.objectContaining({ type: "opened", provider: "client-interaction" }),
      ]),
    );
  });

  it("reconciles acceptance after an event outage without sending again", async () => {
    const { store, directory } = await createPushStore();
    const dispatch = vi.fn(async () => ({ executionId: "execution-recover", providerName: "fcm" }));
    const notifications: EngagementNotificationDispatcher = {
      prepareDispatch: () => ({ dispatch }),
    };
    const processor = new EngagementDeliveryEventProcessor(store);
    vi.spyOn(processor, "process").mockRejectedValueOnce(new Error("event store unavailable"));
    const command = {
      recipient: ref,
      data: { tenantName: "Croco", secret: "redacted" },
      key: "push-recover-acceptance",
      policy: "all-reachable" as const,
    };
    await expect(
      new EngagementService(
        directory,
        createRenderer(),
        notifications,
        undefined,
        store,
        () => at,
        undefined,
        processor,
      ).send(TrialEnding, command),
    ).rejects.toThrow("event store unavailable");

    const reopened = store.reopen();
    const service = new EngagementService(
      directory,
      createRenderer(),
      notifications,
      undefined,
      reopened,
      () => at,
      undefined,
      new EngagementDeliveryEventProcessor(reopened),
    );
    await expect(service.send(TrialEnding, command)).resolves.toMatchObject({ status: "queued" });
    await service.send(TrialEnding, command);
    expect(dispatch).toHaveBeenCalledTimes(1);
    const saved = await reopened.findByIdentity({
      tenantId: ref.tenantId,
      recipientId: ref.userId,
      messageId: TrialEnding.id,
      channel: "push",
      semanticKey: command.key,
    });
    expect(saved).toBeDefined();
    expect(await reopened.listByDispatch(ref.tenantId, saved?.id ?? "")).toMatchObject([
      { type: "accepted", provider: "fcm" },
    ]);
  });

  it("reconciles terminal token invalidation after an event outage without sending again", async () => {
    const { store, endpoint, directory } = await createPushStore();
    const dispatch = vi.fn(async (): Promise<never> => {
      throw new TestPushProblem("token-unregistered");
    });
    const notifications: EngagementNotificationDispatcher = {
      prepareDispatch: () => ({ dispatch }),
    };
    const processor = new EngagementDeliveryEventProcessor(store);
    vi.spyOn(processor, "process").mockRejectedValueOnce(new Error("event store unavailable"));
    const command = {
      recipient: ref,
      data: { tenantName: "Croco", secret: "redacted" },
      key: "push-recover-invalid",
      policy: "all-reachable" as const,
    };
    await expect(
      new EngagementService(
        directory,
        createRenderer(),
        notifications,
        undefined,
        store,
        () => at,
        undefined,
        processor,
      ).send(TrialEnding, command),
    ).rejects.toThrow("event store unavailable");
    expect((await store.getEndpoint(ref.tenantId, endpoint.id))?.invalidatedAt).toBeUndefined();

    const reopened = store.reopen();
    const service = new EngagementService(
      directory,
      createRenderer(),
      notifications,
      undefined,
      reopened,
      () => at,
      undefined,
      new EngagementDeliveryEventProcessor(reopened),
    );
    await expect(service.send(TrialEnding, command)).rejects.toBeInstanceOf(
      EngagementDispatchFailedProblem,
    );
    await expect(service.send(TrialEnding, command)).rejects.toBeInstanceOf(
      EngagementDispatchFailedProblem,
    );
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect((await reopened.getEndpoint(ref.tenantId, endpoint.id))?.invalidationReason).toBe(
      "token-invalid",
    );
  });

  it("invalidates an unregistered endpoint and excludes it from later sends", async () => {
    const { store, endpoint, directory } = await createPushStore();
    const dispatch = vi.fn(async (): Promise<never> => {
      throw new TestPushProblem("token-unregistered");
    });
    const notifications: EngagementNotificationDispatcher = {
      prepareDispatch: () => ({ dispatch }),
    };
    const service = new EngagementService(
      directory,
      createRenderer(),
      notifications,
      undefined,
      store,
      () => at,
      undefined,
      new EngagementDeliveryEventProcessor(store),
    );

    await expect(
      service.send(TrialEnding, {
        recipient: ref,
        data: { tenantName: "Croco", secret: "redacted" },
        key: "push-invalid",
        policy: "all-reachable",
      }),
    ).rejects.toBeInstanceOf(EngagementDispatchFailedProblem);
    expect((await store.getEndpoint(ref.tenantId, endpoint.id))?.invalidationReason).toBe(
      "token-invalid",
    );
    expect(await store.listActiveEndpoints(ref.tenantId, ref.userId)).toEqual([]);
    await service.send(TrialEnding, {
      recipient: ref,
      data: { tenantName: "Croco", secret: "redacted" },
      key: "push-later",
      policy: "all-reachable",
    });
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("recovers a terminal task outcome after the dispatch write fails", async () => {
    const { store, endpoint, directory } = await createPushStore();
    const send = vi.fn(
      async () => ({ success: false, problem: new TestPushProblem("token-unregistered") }) as const,
    );
    const provider: NotificationProvider = {
      getName: () => "fcm",
      getChannel: () => NotificationChannel.PUSH,
      getCapabilities: () => ({
        providerName: "fcm",
        channels: [NotificationChannel.PUSH],
        supportsIdempotencyKey: false,
        supportsProviderTemplates: false,
        supportsRenderedTemplates: true,
        outboxIntegration: "consumer-managed",
        terminalEndpointFailureCodes: ["notifications-fcm/token-unregistered"],
      }),
      send,
    };
    const registry = {
      getProvider: () => provider,
      getDefaultProviderName: () => "fcm",
      getProviderCapabilities: () => provider.getCapabilities(),
    };
    const task = new SendNotificationTask(registry as never);
    const tasks = new TaskRegistry();
    tasks.register("send-notification", SendNotificationTask, "handle", {
      name: "send-notification",
      options: { maxAttempts: 1 },
      target: SendNotificationTask,
      methodName: "handle",
    });
    const executions = createIdempotentExecutionManager();
    const runner = new TaskRunner(executions as never, tasks, undefined, {
      serviceResolver: () => task,
    });
    const notifications = new NotificationService(runner, registry as never);
    vi.spyOn(store, "recordDispatch").mockRejectedValueOnce(
      new Error("dispatch store unavailable"),
    );
    const command = {
      recipient: ref,
      data: { tenantName: "Croco", secret: "redacted" },
      key: "push-recover-dispatch",
      policy: "all-reachable" as const,
    };
    const first = new EngagementService(
      directory,
      createRenderer(),
      notifications,
      undefined,
      store,
      () => at,
      undefined,
      new EngagementDeliveryEventProcessor(store),
    );
    await expect(first.send(TrialEnding, command)).rejects.toBeInstanceOf(
      EngagementPersistenceProblem,
    );
    expect((await store.getEndpoint(ref.tenantId, endpoint.id))?.invalidatedAt).toBeUndefined();

    const reopened = store.reopen();
    const replay = new EngagementService(
      directory,
      createRenderer(),
      notifications,
      undefined,
      reopened,
      () => at,
      undefined,
      new EngagementDeliveryEventProcessor(reopened),
    );
    await expect(replay.send(TrialEnding, command)).rejects.toBeInstanceOf(
      EngagementDispatchFailedProblem,
    );
    expect(send).toHaveBeenCalledTimes(1);
    expect((await reopened.getEndpoint(ref.tenantId, endpoint.id))?.invalidationReason).toBe(
      "token-invalid",
    );
  });

  it("keeps a push endpoint active after a retryable provider failure", async () => {
    const { store, endpoint, directory } = await createPushStore();
    const notifications: EngagementNotificationDispatcher = {
      prepareDispatch: () => ({
        dispatch: async () => {
          throw new TestPushProblem("rate-limit");
        },
      }),
    };
    const service = new EngagementService(
      directory,
      createRenderer(),
      notifications,
      undefined,
      store,
      () => at,
      undefined,
      new EngagementDeliveryEventProcessor(store),
    );

    await expect(
      service.send(TrialEnding, {
        recipient: ref,
        data: { tenantName: "Croco", secret: "redacted" },
        key: "push-quota",
        policy: "all-reachable",
      }),
    ).rejects.toBeInstanceOf(EngagementDispatchFailedProblem);
    expect((await store.getEndpoint(ref.tenantId, endpoint.id))?.invalidatedAt).toBeUndefined();
  });
});
