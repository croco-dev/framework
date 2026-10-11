import type { Execution, ExecutionManager } from "@croco/execution-core";
import { Container } from "@croco/framework-context";
import { TaskExecutionAlreadySettledProblem, TaskRegistry, TaskRunner } from "@croco/tasks-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createNotificationPreferenceEvaluationKey,
  createNotificationPreferenceContextFixture,
  type NotificationPreferenceContext,
} from "../libs/NotificationPreferences";
import { NotificationProviderRegistry } from "../libs/NotificationProviderRegistry";
import {
  NotificationService,
  type NotificationSendContractOptions,
} from "../libs/NotificationService";
import {
  NotificationIdempotencyKeyRequiredProblem,
  NotificationOutboxIdempotencyMismatchProblem,
  NotificationPreferenceChannelMismatchProblem,
  NotificationPreferenceContextRequiredProblem,
  NotificationPreferenceDeniedProblem,
  NotificationProviderChannelMismatchProblem,
  NotificationProviderIdempotencyUnsupportedProblem,
  NotificationProviderNotConfiguredProblem,
  NotificationProviderNotRegisteredProblem,
  NotificationTaskResultInvalidProblem,
} from "../libs/problems/NotificationProblems";
import { NotificationChannel } from "../libs/types";
import { SendNotificationTask } from "../libs/SendNotificationTask";
import {
  createConsumerManagedRenderedCapabilities,
  createProvider,
  type MockNotificationProvider,
} from "./__fixtures__/mockProvider";

const createRenderedProvider = (name: string, channel: NotificationChannel) =>
  createProvider(name, channel, createConsumerManagedRenderedCapabilities(name, channel));

describe("NotificationPreferenceDeniedProblem", () => {
  it("omits an absent preference rule id from serialized extensions", () => {
    const problem = new NotificationPreferenceDeniedProblem({
      context: {
        tenantId: "tenant-1",
        userId: "user-1",
        channel: NotificationChannel.EMAIL,
        topic: "billing.invoice-ready",
      },
      reason: "user-opted-out",
      evaluationKey: "tenant-1:user-1:email:billing.invoice-ready",
    });

    expect(problem.extensions).not.toHaveProperty("ruleId");
    expect(() => JSON.stringify(problem)).not.toThrow();
    expect(problem.toJSON()).toMatchObject({
      code: "notifications-core/preference-denied",
      evaluationKey: "tenant-1:user-1:email:billing.invoice-ready",
    });
  });
});

const createExecutionManager = (): ExecutionManager => ({
  get: vi.fn(async () => {
    throw new Error("not used in NotificationService tests");
  }),
  create: vi.fn(async () => {
    throw new Error("not used in NotificationService tests");
  }),
  start: vi.fn(async () => {
    throw new Error("not used in NotificationService tests");
  }),
  complete: vi.fn(async () => {
    throw new Error("not used in NotificationService tests");
  }),
  fail: vi.fn(async () => {
    throw new Error("not used in NotificationService tests");
  }),
  cancel: vi.fn(async () => {
    throw new Error("not used in NotificationService tests");
  }),
  retry: vi.fn(async () => {
    throw new Error("not used in NotificationService tests");
  }),
  updateProgress: vi.fn(async () => {
    throw new Error("not used in NotificationService tests");
  }),
  checkpoint: vi.fn(async () => {
    throw new Error("not used in NotificationService tests");
  }),
  timeout: vi.fn(async () => {
    throw new Error("not used in NotificationService tests");
  }),
  reconcileTimedOut: vi.fn(async () => {
    throw new Error("not used in NotificationService tests");
  }),
});

const createPreferenceContext = (
  channel: NotificationChannel,
  overrides: Partial<NotificationPreferenceContext> = {},
): NotificationPreferenceContext =>
  createNotificationPreferenceContextFixture({
    tenantId: "tenant-1",
    userId: "user-1",
    channel,
    topic: "notifications.test",
    ...overrides,
  });

const createSendOptions = (
  channel: NotificationChannel,
  overrides: Partial<NotificationSendContractOptions> = {},
): NotificationSendContractOptions => ({
  idempotencyKey: "notification-key",
  preferenceContext: createPreferenceContext(channel),
  ...overrides,
});

describe("NotificationService", () => {
  let service!: NotificationService;
  let registry!: NotificationProviderRegistry;
  let taskRunner!: TaskRunner;
  let executeSpy!: ReturnType<typeof vi.fn>;
  let emailProvider!: MockNotificationProvider;

  beforeEach(() => {
    Container.reset();
    vi.clearAllMocks();

    registry = new NotificationProviderRegistry();
    taskRunner = new TaskRunner(createExecutionManager(), new TaskRegistry());
    executeSpy = vi.spyOn(taskRunner, "executeTracked").mockResolvedValue({
      executionId: "execution-1",
      result: { providerName: "email-provider" },
    });
    service = new NotificationService(taskRunner, registry);
    emailProvider = createRenderedProvider("email-provider", NotificationChannel.EMAIL);
  });

  describe("registerProvider()", () => {
    it("should register provider successfully", () => {
      service.registerProvider(emailProvider);

      expect(emailProvider.getName).toHaveBeenCalledTimes(1);
      expect(emailProvider.getChannel).toHaveBeenCalledTimes(1);
      expect(emailProvider.getCapabilities).toHaveBeenCalledTimes(1);
    });

    it("should register provider as default when isDefault is true", () => {
      service.registerProvider(emailProvider, true);

      expect(emailProvider.getName).toHaveBeenCalledTimes(1);
      expect(emailProvider.getChannel).toHaveBeenCalledTimes(1);
      expect(emailProvider.getCapabilities).toHaveBeenCalledTimes(1);
    });
  });

  describe("send()", () => {
    it("preserves the original provider identity when a completed execution is replayed", async () => {
      const executionManager = createExecutionManager();
      let saved: Execution | undefined;
      executionManager.create = vi.fn(async (input) => {
        expect(input.idempotencyKey).toMatch(/^task:v2:/);
        if (saved !== undefined) {
          expect(input.idempotencyKey).toBe(saved.idempotencyKey);
          return saved;
        }
        saved = {
          id: "original-execution",
          type: input.type,
          payload: input.payload,
          status: "pending",
          attempts: 0,
          maxAttempts: 1,
          createdAt: new Date(),
          idempotencyKey: input.idempotencyKey,
        };
        return saved;
      });
      executionManager.start = vi.fn(async () => {
        if (saved === undefined) throw new Error("Execution was not created");
        saved = { ...saved, status: "running", attempts: 1, startedAt: new Date() };
        return saved;
      });
      executionManager.complete = vi.fn(async (_id, result) => {
        if (saved === undefined) throw new Error("Execution was not created");
        saved = { ...saved, status: "completed", result };
        return saved;
      });
      const replacement = createRenderedProvider("replacement-provider", NotificationChannel.EMAIL);
      emailProvider.send.mockResolvedValue({ success: true, messageId: "original-message" });
      registry.registerProvider(emailProvider);
      registry.registerProvider(replacement);
      const task = new SendNotificationTask(registry);
      const tasks = new TaskRegistry();
      tasks.register("send-notification", SendNotificationTask, "handle", {
        name: "send-notification",
        options: { maxAttempts: 1 },
        target: SendNotificationTask,
        methodName: "handle",
      });
      const runner = new TaskRunner(executionManager, tasks, undefined, {
        serviceResolver: () => task,
      });
      const notifications = new NotificationService(runner, registry);
      const payload = { to: "recipient@example.com", content: "Hello" };
      const original = await notifications.dispatch(
        NotificationChannel.EMAIL,
        payload,
        createSendOptions(NotificationChannel.EMAIL, { providerName: "email-provider" }),
      );
      await expect(
        notifications.dispatch(
          NotificationChannel.EMAIL,
          payload,
          createSendOptions(NotificationChannel.EMAIL, { providerName: "replacement-provider" }),
        ),
      ).resolves.toEqual(original);
      expect(original).toEqual({
        executionId: "original-execution",
        providerName: "email-provider",
        providerMessageId: "original-message",
      });
      expect(emailProvider.send).toHaveBeenCalledTimes(1);
      expect(replacement.send).not.toHaveBeenCalled();
    });

    it.each([
      ["failed", "provider/token-invalid", true],
      ["failed", "provider/rate-limit", false],
      ["failed", "unknown/token-invalid", false],
      ["cancelled", "provider/token-invalid", false],
      ["timed_out", "provider/token-invalid", false],
    ] as const)("replays %s %s with endpoint invalidation %s", async (status, code, invalid) => {
      emailProvider.getCapabilities.mockReturnValue({
        ...createConsumerManagedRenderedCapabilities("email-provider", NotificationChannel.EMAIL),
        terminalEndpointFailureCodes: ["provider/token-invalid"],
      });
      service.registerProvider(emailProvider, true);
      const settled = new TaskExecutionAlreadySettledProblem(
        "send-notification",
        "failed-execution",
        status,
        code,
      );
      executeSpy.mockRejectedValue(settled);
      const failure = await service
        .dispatch(
          NotificationChannel.EMAIL,
          { to: "opaque-reference", content: "Test" },
          createSendOptions(NotificationChannel.EMAIL),
        )
        .catch((error: unknown) => error);
      if (invalid) {
        expect(failure).toMatchObject({
          code,
          extensions: { provider: "email-provider", endpointInvalid: true, retryable: false },
        });
        expect(JSON.stringify(failure)).not.toContain("opaque-reference");
      } else {
        expect(failure).toBe(settled);
      }
      expect(emailProvider.send).not.toHaveBeenCalled();
    });

    it("should retain the task execution id for tracked dispatches", async () => {
      service.registerProvider(emailProvider, true);

      await expect(
        service.dispatch(
          NotificationChannel.EMAIL,
          { to: "test@example.com", content: "Test Content" },
          createSendOptions(NotificationChannel.EMAIL),
        ),
      ).resolves.toEqual({ executionId: "execution-1", providerName: "email-provider" });
    });

    it("returns the provider message ID from a completed task", async () => {
      executeSpy.mockResolvedValueOnce({
        executionId: "execution-2",
        result: { providerName: "email-provider", providerMessageId: "provider-message-2" },
      });
      service.registerProvider(emailProvider, true);

      await expect(
        service.dispatch(
          NotificationChannel.EMAIL,
          { to: "test@example.com", content: "Test Content" },
          createSendOptions(NotificationChannel.EMAIL),
        ),
      ).resolves.toEqual({
        executionId: "execution-2",
        providerName: "email-provider",
        providerMessageId: "provider-message-2",
      });
    });

    it("retains only the execution ID for legacy completed tasks without delivery evidence", async () => {
      executeSpy.mockResolvedValueOnce({ executionId: "legacy-execution", result: undefined });
      service.registerProvider(emailProvider, true);
      await expect(
        service.dispatch(
          NotificationChannel.EMAIL,
          { to: "test@example.com", content: "Test Content" },
          createSendOptions(NotificationChannel.EMAIL),
        ),
      ).resolves.toEqual({ executionId: "legacy-execution" });
      expect(emailProvider.send).not.toHaveBeenCalled();
    });

    it("returns only the recorded provider evidence and the tracked execution ID", async () => {
      executeSpy.mockResolvedValueOnce({
        executionId: "tracked-execution",
        result: {
          providerName: "email-provider",
          providerMessageId: "original-message",
          executionId: "untrusted-execution",
          token: "untrusted-token",
        },
      });
      service.registerProvider(emailProvider, true);
      await expect(
        service.dispatch(
          NotificationChannel.EMAIL,
          { to: "test@example.com", content: "Test Content" },
          createSendOptions(NotificationChannel.EMAIL),
        ),
      ).resolves.toEqual({
        executionId: "tracked-execution",
        providerName: "email-provider",
        providerMessageId: "original-message",
      });
    });

    it.each([
      "unattributed-message-id",
      { providerMessageId: "unattributed-message-id" },
      { providerName: "" },
      { providerName: "email-provider", providerMessageId: 123 },
      null,
    ])("rejects malformed recorded delivery evidence %j", async (result) => {
      executeSpy.mockResolvedValueOnce({ executionId: "malformed-execution", result });
      service.registerProvider(emailProvider, true);
      await expect(
        service.dispatch(
          NotificationChannel.EMAIL,
          { to: "test@example.com", content: "Test Content" },
          createSendOptions(NotificationChannel.EMAIL),
        ),
      ).rejects.toBeInstanceOf(NotificationTaskResultInvalidProblem);
      expect(emailProvider.send).not.toHaveBeenCalled();
    });

    it("should reject providers that cannot honor a required idempotency key", async () => {
      service.registerProvider(emailProvider, true);

      await expect(
        service.send(
          NotificationChannel.EMAIL,
          { to: "test@example.com", content: "Test Content" },
          createSendOptions(NotificationChannel.EMAIL, {
            requireProviderIdempotency: true,
          }),
        ),
      ).rejects.toBeInstanceOf(NotificationProviderIdempotencyUnsupportedProblem);
      expect(executeSpy).not.toHaveBeenCalled();
    });

    it("should dispatch when the provider declares idempotency support", async () => {
      emailProvider.getCapabilities = vi.fn().mockReturnValue({
        providerName: "email-provider",
        channels: [NotificationChannel.EMAIL],
        supportsIdempotencyKey: true,
        supportsProviderTemplates: false,
        supportsRenderedTemplates: true,
        outboxIntegration: "consumer-managed",
      });
      service.registerProvider(emailProvider, true);

      await service.send(
        NotificationChannel.EMAIL,
        { to: "test@example.com", content: "Test Content" },
        createSendOptions(NotificationChannel.EMAIL, {
          requireProviderIdempotency: true,
        }),
      );

      expect(executeSpy).toHaveBeenCalledTimes(1);
    });

    it("should send notification via task execution with default provider", async () => {
      service.registerProvider(emailProvider, true);

      const payload = {
        to: "test@example.com",
        subject: "Test Subject",
        content: "Test Content",
      };

      await service.send(
        NotificationChannel.EMAIL,
        payload,
        createSendOptions(NotificationChannel.EMAIL),
      );

      expect(executeSpy).toHaveBeenCalledWith(
        "send-notification",
        expect.objectContaining({
          ...payload,
          providerName: "email-provider",
          idempotencyKey: "notification-key",
        }),
        { idempotencyKey: "notification-key" },
      );
      expect(executeSpy.mock.calls[0]?.[1]).toMatchObject({
        dispatchContext: {
          channel: NotificationChannel.EMAIL,
          providerCapabilities: {
            providerName: "email-provider",
            channels: [NotificationChannel.EMAIL],
            supportsIdempotencyKey: false,
            supportsProviderTemplates: false,
            supportsRenderedTemplates: true,
            outboxIntegration: "consumer-managed",
          },
          preferenceDecision: expect.objectContaining({
            allowed: true,
            reason: "default-allow",
          }),
        },
      });
    });

    it("should dispatch with the capability snapshot validated at registration", async () => {
      const capabilities = {
        providerName: "snapshot-provider",
        channels: [NotificationChannel.EMAIL],
        supportsIdempotencyKey: false,
        supportsProviderTemplates: false,
        supportsRenderedTemplates: true,
        outboxIntegration: "consumer-managed" as const,
      };
      const provider = createProvider("snapshot-provider", NotificationChannel.EMAIL, capabilities);
      service.registerProvider(provider, true);

      capabilities.providerName = "mutated-provider";
      capabilities.supportsIdempotencyKey = true;
      capabilities.channels.push(NotificationChannel.SMS);

      await service.send(
        NotificationChannel.EMAIL,
        { to: "test@example.com", content: "Test Content" },
        createSendOptions(NotificationChannel.EMAIL),
      );

      expect(executeSpy.mock.calls[0]?.[1]).toMatchObject({
        dispatchContext: {
          providerCapabilities: {
            providerName: "snapshot-provider",
            channels: [NotificationChannel.EMAIL],
            supportsIdempotencyKey: false,
          },
        },
      });
      expect(provider.getCapabilities).toHaveBeenCalledTimes(1);
    });

    it("should use specified provider name when it matches the requested channel", async () => {
      const smsProvider = createRenderedProvider("sms-provider", NotificationChannel.SMS);

      service.registerProvider(emailProvider, true);
      service.registerProvider(smsProvider);

      const payload = {
        to: "test@example.com",
        content: "Test Content",
      };

      await service.send(
        NotificationChannel.SMS,
        payload,
        createSendOptions(NotificationChannel.SMS, {
          providerName: "sms-provider",
          idempotencyKey: "sms-notification-key",
        }),
      );

      expect(executeSpy).toHaveBeenCalledWith(
        "send-notification",
        expect.objectContaining({
          ...payload,
          providerName: "sms-provider",
          idempotencyKey: "sms-notification-key",
        }),
        { idempotencyKey: "sms-notification-key" },
      );
    });

    it("should include idempotency key in job payload when options provide it", async () => {
      service.registerProvider(emailProvider, true);

      const payload = {
        to: "test@example.com",
        subject: "Test Subject",
        content: "Test Content",
      };

      await service.send(
        NotificationChannel.EMAIL,
        payload,
        createSendOptions(NotificationChannel.EMAIL, { idempotencyKey: "fixed-key" }),
      );

      expect(executeSpy).toHaveBeenCalledWith(
        "send-notification",
        expect.objectContaining({
          ...payload,
          providerName: "email-provider",
          idempotencyKey: "fixed-key",
        }),
        { idempotencyKey: "fixed-key" },
      );
    });

    it("should use provider name from options when it matches the requested channel", async () => {
      const smsProvider = createRenderedProvider("sms-provider", NotificationChannel.SMS);

      service.registerProvider(emailProvider, true);
      service.registerProvider(smsProvider);

      const payload = {
        to: "test@example.com",
        content: "Test Content",
      };

      await service.send(NotificationChannel.SMS, payload, {
        providerName: "sms-provider",
        idempotencyKey: "fixed-key",
        preferenceContext: createPreferenceContext(NotificationChannel.SMS),
      });

      expect(executeSpy).toHaveBeenCalledWith(
        "send-notification",
        expect.objectContaining({
          ...payload,
          providerName: "sms-provider",
          idempotencyKey: "fixed-key",
        }),
        { idempotencyKey: "fixed-key" },
      );
    });

    it("should send notification with empty-string default provider name", async () => {
      const unnamedProvider = createRenderedProvider("", NotificationChannel.EMAIL);

      service.registerProvider(unnamedProvider, true);

      const payload = {
        to: "test@example.com",
        subject: "Test Subject",
        content: "Test Content",
      };

      await service.send(
        NotificationChannel.EMAIL,
        payload,
        createSendOptions(NotificationChannel.EMAIL),
      );

      expect(executeSpy).toHaveBeenCalledWith(
        "send-notification",
        expect.objectContaining({
          ...payload,
          providerName: "",
          idempotencyKey: "notification-key",
        }),
        { idempotencyKey: "notification-key" },
      );
    });

    it("should use explicit empty-string provider name when it matches the requested channel", async () => {
      const unnamedProvider = createRenderedProvider("", NotificationChannel.EMAIL);

      service.registerProvider(emailProvider, true);
      service.registerProvider(unnamedProvider);

      const payload = {
        to: "test@example.com",
        subject: "Test Subject",
        content: "Test Content",
      };

      await service.send(
        NotificationChannel.EMAIL,
        payload,
        createSendOptions(NotificationChannel.EMAIL, {
          providerName: "",
          idempotencyKey: "empty-provider-key",
        }),
      );

      expect(executeSpy).toHaveBeenCalledWith(
        "send-notification",
        expect.objectContaining({
          ...payload,
          providerName: "",
          idempotencyKey: "empty-provider-key",
        }),
        { idempotencyKey: "empty-provider-key" },
      );
    });

    it("should include metadata in job payload", async () => {
      service.registerProvider(emailProvider, true);

      const payload = {
        to: "test@example.com",
        subject: "Test Subject",
        content: "Test Content",
        metadata: { userId: "123", category: "promo" },
      };

      await service.send(
        NotificationChannel.EMAIL,
        payload,
        createSendOptions(NotificationChannel.EMAIL),
      );

      expect(executeSpy).toHaveBeenCalledWith(
        "send-notification",
        expect.objectContaining({
          ...payload,
          providerName: "email-provider",
          idempotencyKey: "notification-key",
        }),
        { idempotencyKey: "notification-key" },
      );
    });

    it("should include templateId and variables in job payload", async () => {
      service.registerProvider(emailProvider, true);

      const payload = {
        to: "test@example.com",
        content: "Test Content",
        templateId: "welcome-email",
        variables: { name: "John" },
      };

      await service.send(
        NotificationChannel.EMAIL,
        payload,
        createSendOptions(NotificationChannel.EMAIL),
      );

      expect(executeSpy).toHaveBeenCalledWith(
        "send-notification",
        expect.objectContaining({
          ...payload,
          providerName: "email-provider",
          idempotencyKey: "notification-key",
        }),
        { idempotencyKey: "notification-key" },
      );
    });

    it("should render template payload before dispatch", async () => {
      service.registerProvider(emailProvider, true);
      service.registerTemplate({
        id: "welcome-email",
        version: "v1",
        locale: "en-US",
        channel: NotificationChannel.EMAIL,
        subject: "Welcome {{name}}",
        content: "<h1>Hello {{name}}</h1>",
        variablesSchema: {
          additionalProperties: false,
          properties: {
            name: { type: "string", required: true },
          },
        },
      });

      await service.sendTemplate(
        NotificationChannel.EMAIL,
        {
          to: "test@example.com",
          template: {
            id: "welcome-email",
            version: "v1",
            locale: "en-US",
          },
          variables: { name: "Ada" },
          metadata: { topic: "welcome" },
        },
        {
          idempotencyKey: "welcome-user-1",
          preferenceContext: createPreferenceContext(NotificationChannel.EMAIL, {
            topic: "welcome",
          }),
        },
      );

      expect(executeSpy).toHaveBeenCalledWith(
        "send-notification",
        expect.objectContaining({
          to: "test@example.com",
          subject: "Welcome Ada",
          content: "<h1>Hello Ada</h1>",
          metadata: { topic: "welcome" },
          templateId: "welcome-email",
          templateVersion: "v1",
          locale: "en-US",
          variables: { name: "Ada" },
          providerName: "email-provider",
          idempotencyKey: "welcome-user-1",
        }),
        { idempotencyKey: "welcome-user-1" },
      );
      expect(executeSpy.mock.calls[0]?.[1]).toMatchObject({
        dispatchContext: {
          template: {
            id: "welcome-email",
            version: "v1",
            locale: "en-US",
          },
        },
      });
    });

    it("should stop before dispatch when preference denies the notification", async () => {
      service.registerProvider(emailProvider, true);
      service.registerPreferenceRule({
        id: "billing-deny",
        tenantId: "tenant-1",
        userId: "user-1",
        channel: NotificationChannel.EMAIL,
        topic: "billing.invoice-ready",
        enabled: false,
        reason: "user-opted-out",
      });

      await expect(
        service.send(
          NotificationChannel.EMAIL,
          {
            to: "test@example.com",
            subject: "Invoice",
            content: "Ready",
          },
          {
            idempotencyKey: "billing-deny-key",
            preferenceContext: {
              tenantId: "tenant-1",
              userId: "user-1",
              channel: NotificationChannel.EMAIL,
              topic: "billing.invoice-ready",
            },
          },
        ),
      ).rejects.toBeInstanceOf(NotificationPreferenceDeniedProblem);
      expect(executeSpy).not.toHaveBeenCalled();
    });

    it("should dispatch with the preference decision captured during preparation", async () => {
      service.registerProvider(emailProvider, true);
      const preferenceContext = {
        tenantId: "tenant-1",
        userId: "user-1",
        channel: NotificationChannel.EMAIL,
        topic: "billing.prepared",
      };
      const expectedContext = { ...preferenceContext };
      const preparation = service.prepareDispatch(NotificationChannel.EMAIL, {
        preferenceContext,
      });

      service.registerPreferenceRule({
        id: "deny-after-preparation",
        tenantId: expectedContext.tenantId,
        userId: expectedContext.userId,
        channel: expectedContext.channel,
        topic: expectedContext.topic,
        enabled: false,
      });
      preferenceContext.userId = "user-2";
      preferenceContext.topic = "security.alert";

      await preparation.dispatch(
        { to: "test@example.com", content: "Prepared content" },
        { idempotencyKey: "prepared-key" },
      );

      expect(executeSpy).toHaveBeenCalledWith(
        "send-notification",
        expect.objectContaining({
          idempotencyKey: "prepared-key",
          dispatchContext: expect.objectContaining({
            preferenceDecision: expect.objectContaining({
              allowed: true,
              context: expectedContext,
              reason: "default-allow",
              evaluationKey: createNotificationPreferenceEvaluationKey(expectedContext),
            }),
          }),
        }),
        { idempotencyKey: "prepared-key" },
      );
    });

    it("should include allowed preference and outbox context in job payload", async () => {
      service.registerProvider(emailProvider, true);
      service.registerPreferenceRule({
        id: "billing-allow",
        tenantId: "tenant-1",
        channel: NotificationChannel.EMAIL,
        topic: "billing.invoice-ready",
        enabled: true,
        reason: "tenant-enabled",
      });

      await service.send(
        NotificationChannel.EMAIL,
        {
          to: "test@example.com",
          subject: "Invoice",
          content: "Ready",
        },
        {
          idempotencyKey: "notification-key",
          outbox: {
            outboxMessageId: "outbox-1",
            idempotencyKey: "notification-key",
          },
          preferenceContext: {
            tenantId: "tenant-1",
            userId: "user-1",
            channel: NotificationChannel.EMAIL,
            topic: "billing.invoice-ready",
          },
        },
      );

      expect(executeSpy).toHaveBeenCalledWith(
        "send-notification",
        expect.objectContaining({
          providerName: "email-provider",
          idempotencyKey: "notification-key",
          outbox: {
            outboxMessageId: "outbox-1",
            idempotencyKey: "notification-key",
          },
          dispatchContext: expect.objectContaining({
            preferenceDecision: expect.objectContaining({
              allowed: true,
              reason: "tenant-enabled",
              ruleId: "billing-allow",
            }),
          }),
        }),
        { idempotencyKey: "notification-key" },
      );
    });

    it("should stop before dispatch when preference context is missing", async () => {
      service.registerProvider(emailProvider, true);

      await expect(
        service.send(
          NotificationChannel.EMAIL,
          {
            to: "test@example.com",
            subject: "Invoice",
            content: "Ready",
          },
          { idempotencyKey: "missing-preference-key" } as NotificationSendContractOptions,
        ),
      ).rejects.toBeInstanceOf(NotificationPreferenceContextRequiredProblem);
      expect(executeSpy).not.toHaveBeenCalled();
    });

    it("should stop before dispatch when idempotency key is missing", async () => {
      service.registerProvider(emailProvider, true);

      await expect(
        service.send(
          NotificationChannel.EMAIL,
          {
            to: "test@example.com",
            subject: "Invoice",
            content: "Ready",
          },
          {
            preferenceContext: createPreferenceContext(NotificationChannel.EMAIL),
          } as NotificationSendContractOptions,
        ),
      ).rejects.toBeInstanceOf(NotificationIdempotencyKeyRequiredProblem);
      expect(executeSpy).not.toHaveBeenCalled();
    });

    it("should stop before dispatch when preference channel does not match requested channel", async () => {
      service.registerProvider(emailProvider, true);

      await expect(
        service.send(
          NotificationChannel.EMAIL,
          {
            to: "test@example.com",
            subject: "Invoice",
            content: "Ready",
          },
          createSendOptions(NotificationChannel.EMAIL, {
            preferenceContext: createPreferenceContext(NotificationChannel.SMS),
          }),
        ),
      ).rejects.toBeInstanceOf(NotificationPreferenceChannelMismatchProblem);
      expect(executeSpy).not.toHaveBeenCalled();
    });

    it("should stop before dispatch when outbox and dispatch idempotency keys differ", async () => {
      service.registerProvider(emailProvider, true);

      await expect(
        service.send(
          NotificationChannel.EMAIL,
          {
            to: "test@example.com",
            subject: "Invoice",
            content: "Ready",
          },
          createSendOptions(NotificationChannel.EMAIL, {
            idempotencyKey: "dispatch-key",
            outbox: {
              outboxMessageId: "outbox-1",
              idempotencyKey: "outbox-key",
            },
          }),
        ),
      ).rejects.toBeInstanceOf(NotificationOutboxIdempotencyMismatchProblem);
      expect(executeSpy).not.toHaveBeenCalled();
    });

    it("should allow an explicit unsafe migration path without preference or idempotency", async () => {
      service.registerProvider(emailProvider, true);

      const payload = {
        to: "test@example.com",
        subject: "Test Subject",
        content: "Test Content",
      };

      await service.send(NotificationChannel.EMAIL, payload, {
        unsafeSkipPreferenceEvaluation: true,
        unsafeAllowMissingIdempotencyKey: true,
      });

      expect(executeSpy).toHaveBeenCalledWith(
        "send-notification",
        expect.objectContaining({
          ...payload,
          providerName: "email-provider",
          dispatchContext: expect.not.objectContaining({
            preferenceDecision: expect.anything(),
          }),
        }),
        {},
      );
      expect(executeSpy.mock.calls[0]?.[1]).not.toHaveProperty("idempotencyKey");
    });

    it("should throw error when no default provider found for channel", async () => {
      const payload = {
        to: "test@example.com",
        content: "Test Content",
      };

      await expect(
        service.send(
          NotificationChannel.EMAIL,
          payload,
          createSendOptions(NotificationChannel.EMAIL),
        ),
      ).rejects.toBeInstanceOf(NotificationProviderNotConfiguredProblem);
    });

    it("should throw error when specified provider is not registered", async () => {
      service.registerProvider(emailProvider, true);

      const payload = {
        to: "test@example.com",
        content: "Test Content",
      };

      await expect(
        service.send(
          NotificationChannel.EMAIL,
          payload,
          createSendOptions(NotificationChannel.EMAIL, { providerName: "non-existent" }),
        ),
      ).rejects.toBeInstanceOf(NotificationProviderNotRegisteredProblem);
    });

    it("should throw error when specified provider channel does not match requested channel", async () => {
      const smsProvider = createRenderedProvider("sms-provider", NotificationChannel.SMS);

      service.registerProvider(emailProvider, true);
      service.registerProvider(smsProvider);

      const payload = {
        to: "test@example.com",
        content: "Test Content",
      };

      await expect(
        service.send(
          NotificationChannel.EMAIL,
          payload,
          createSendOptions(NotificationChannel.EMAIL, { providerName: "sms-provider" }),
        ),
      ).rejects.toBeInstanceOf(NotificationProviderChannelMismatchProblem);
      expect(executeSpy).not.toHaveBeenCalled();
    });
  });
});
