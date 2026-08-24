import type { ExecutionManager } from "@croco/execution-core";
import { Container } from "@croco/framework-context";
import { TaskRegistry, TaskRunner } from "@croco/tasks-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
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
} from "../libs/problems/NotificationProblems";
import { NotificationChannel } from "../libs/types";
import {
  createConsumerManagedRenderedCapabilities,
  createProvider,
  type MockNotificationProvider,
} from "./__fixtures__/mockProvider";

const createRenderedProvider = (name: string, channel: NotificationChannel) =>
  createProvider(name, channel, createConsumerManagedRenderedCapabilities(name, channel));

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
    executeSpy = vi.spyOn(taskRunner, "execute").mockResolvedValue(undefined);
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
