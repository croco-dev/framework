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
import { TaskRegistry, TaskRunner, type TaskMetadata } from "@croco/tasks-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  defineMessage,
  EngagementCommandInvalidProblem,
  EngagementDispatchFailedProblem,
  EngagementRenderFailedProblem,
  EngagementService,
  EngagementSuppressionEvaluationProblem,
  InMemoryMessageRendererResolver,
  InMemoryRecipientDirectory,
  MessageDataInvalidProblem,
  MessageRendererRegistry,
  RecipientDirectoryLookupProblem,
  RecipientDirectoryScopeMismatchProblem,
  RecipientNotFoundProblem,
  RegistryEngagementMessageRenderer,
  Renders,
  createEngagementIdempotencyKey,
  type EngagementNotificationDispatcher,
  type EngagementSendCommand,
  type EngagementSuppressionEvaluator,
  type MessageContext,
  type MessageRenderer,
  type RecipientDirectory,
  type ResolvedRecipient,
} from "../index";

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
    { id: "push-phone", token: "push-token-phone" },
    { id: "push-tablet", token: "push-token-tablet" },
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
  status: "pending" | "running" | "completed";
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  startedAt?: Date;
  result?: unknown;
  idempotencyKey?: string;
};

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
      if (execution === undefined) throw new Error(`Execution ${id} was not created`);
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
      if (execution === undefined) throw new Error(`Execution ${id} was not created`);
      const completed: TestExecution = { ...execution, status: "completed", result };
      executions.set(id, completed);
      return completed;
    }),
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
    Container.set(SendNotificationTask, task);

    const executionManager = createIdempotentExecutionManager();
    const taskRunner = new TaskRunner(executionManager as never, taskRegistry);
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
