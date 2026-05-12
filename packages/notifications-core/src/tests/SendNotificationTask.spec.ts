import { Container, MetadataStorage } from "@croco/framework-context";
import { Problem } from "@croco/problems-core";
import { TASK_METADATA_KEY, type TaskMetadata } from "@croco/tasks-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationProviderRegistry } from "../libs/NotificationProviderRegistry";
import { NotificationService } from "../libs/NotificationService";
import {
  NotificationDeliveryFailedProblem,
  NotificationProviderNotFoundProblem,
} from "../libs/problems/NotificationProblems";
import { SendNotificationTask } from "../libs/SendNotificationTask";
import type { NotificationJobPayload, NotificationProvider } from "../libs/types";

describe("SendNotificationTask", () => {
  let task!: SendNotificationTask;
  let registry!: NotificationProviderRegistry;
  let mockProvider!: NotificationProvider;

  beforeEach(() => {
    Container.reset();
    MetadataStorage.clear();
    vi.clearAllMocks();

    registry = new NotificationProviderRegistry();
    task = new SendNotificationTask(registry);

    mockProvider = {
      getName: vi.fn().mockReturnValue("resend"),
      getChannel: vi.fn().mockReturnValue("EMAIL"),
      send: vi.fn(),
    };
  });

  describe("registerProvider()", () => {
    it("should register provider successfully", () => {
      task.registerProvider(mockProvider);

      expect(mockProvider.getName).toHaveBeenCalled();
    });
  });

  describe("handle()", () => {
    beforeEach(() => {
      task.registerProvider(mockProvider);
    });

    it("should send notification successfully", async () => {
      const mockResult = { success: true, messageId: "msg-123" };
      vi.mocked(mockProvider.send).mockResolvedValue(mockResult);

      const payload: NotificationJobPayload = {
        providerName: "resend",
        to: "test@example.com",
        subject: "Test Subject",
        content: "Test Content",
      };

      await expect(task.handle(payload)).resolves.not.toThrow();

      expect(mockProvider.send).toHaveBeenCalledWith({
        to: "test@example.com",
        subject: "Test Subject",
        content: "Test Content",
      });
    });

    it("should include metadata in provider send call", async () => {
      const mockResult = { success: true, messageId: "msg-123" };
      vi.mocked(mockProvider.send).mockResolvedValue(mockResult);

      const payload: NotificationJobPayload = {
        providerName: "resend",
        to: "test@example.com",
        content: "Test Content",
        metadata: { userId: "123" },
      };

      await task.handle(payload);

      expect(mockProvider.send).toHaveBeenCalledWith({
        to: "test@example.com",
        content: "Test Content",
        metadata: { userId: "123" },
      });
    });

    it("should pass idempotency key to provider send options", async () => {
      const mockResult = { success: true, messageId: "msg-123" };
      vi.mocked(mockProvider.send).mockResolvedValue(mockResult);

      const payload: NotificationJobPayload = {
        providerName: "resend",
        to: "test@example.com",
        content: "Test Content",
        idempotencyKey: "fixed-key",
      };

      await task.handle(payload);

      expect(mockProvider.send).toHaveBeenCalledWith(
        {
          to: "test@example.com",
          content: "Test Content",
        },
        { idempotencyKey: "fixed-key" },
      );
    });

    it("should include templateId and variables in provider send call", async () => {
      const mockResult = { success: true, messageId: "msg-123" };
      vi.mocked(mockProvider.send).mockResolvedValue(mockResult);

      const payload: NotificationJobPayload = {
        providerName: "resend",
        to: "test@example.com",
        content: "Test Content",
        templateId: "welcome-email",
        variables: { name: "John" },
      };

      await task.handle(payload);

      expect(mockProvider.send).toHaveBeenCalledWith({
        to: "test@example.com",
        content: "Test Content",
        templateId: "welcome-email",
        variables: { name: "John" },
      });
    });

    it("should throw error when provider not found", async () => {
      const payload: NotificationJobPayload = {
        providerName: "non-existent",
        to: "test@example.com",
        content: "Test Content",
      };

      await expect(task.handle(payload)).rejects.toBeInstanceOf(
        NotificationProviderNotFoundProblem,
      );
    });

    it("should throw error when provider send fails", async () => {
      const mockError = new Error("API Error");
      const mockResult = { success: false, error: mockError };
      vi.mocked(mockProvider.send).mockResolvedValue(mockResult);

      const payload: NotificationJobPayload = {
        providerName: "resend",
        to: "test@example.com",
        content: "Test Content",
      };

      await expect(task.handle(payload)).rejects.toThrow("API Error");
    });

    it("should throw error when provider returns failure without error details", async () => {
      const mockResult = { success: false };
      vi.mocked(mockProvider.send).mockResolvedValue(mockResult);

      const payload: NotificationJobPayload = {
        providerName: "resend",
        to: "test@example.com",
        content: "Test Content",
      };

      await expect(task.handle(payload)).rejects.toBeInstanceOf(NotificationDeliveryFailedProblem);
    });

    it("should mark fallback delivery failures as retryable", async () => {
      const mockResult = { success: false };
      vi.mocked(mockProvider.send).mockResolvedValue(mockResult);

      const payload: NotificationJobPayload = {
        providerName: "resend",
        to: "test@example.com",
        content: "Test Content",
      };

      await expect(task.handle(payload)).rejects.toMatchObject({
        extensions: {
          providerName: "resend",
          retryable: true,
        },
      });
    });

    it("should preserve provider problem errors for upstream retry classification", async () => {
      class RetryableProviderProblem extends Problem {
        constructor() {
          super(
            "notifications-core/provider-temporary-failure",
            "InternalServerError" as never,
            "Temporary failure",
            {
              extensions: {
                retryable: true,
              },
            },
          );
        }
      }

      const providerProblem = new RetryableProviderProblem();
      const mockResult = { success: false, error: providerProblem };
      vi.mocked(mockProvider.send).mockResolvedValue(mockResult);

      const payload: NotificationJobPayload = {
        providerName: "resend",
        to: "test@example.com",
        content: "Test Content",
      };

      await expect(task.handle(payload)).rejects.toBe(providerProblem);
    });

    it("should handle optional subject field", async () => {
      const mockResult = { success: true, messageId: "msg-123" };
      vi.mocked(mockProvider.send).mockResolvedValue(mockResult);

      const payload: NotificationJobPayload = {
        providerName: "resend",
        to: "test@example.com",
        content: "Test Content",
      };

      await task.handle(payload);

      expect(mockProvider.send).toHaveBeenCalledWith({
        to: "test@example.com",
        content: "Test Content",
      });
    });
  });

  describe("shared registry", () => {
    it("should resolve provider registered through NotificationService", async () => {
      const service = new NotificationService(
        {
          execute: vi.fn().mockResolvedValue(undefined),
        } as never,
        registry,
      );
      const mockResult = { success: true, messageId: "msg-123" };
      vi.mocked(mockProvider.send).mockResolvedValue(mockResult);

      service.registerProvider(mockProvider as never, true);

      const payload: NotificationJobPayload = {
        providerName: "resend",
        to: "test@example.com",
        content: "Test Content",
      };

      await expect(task.handle(payload)).resolves.not.toThrow();
      expect(mockProvider.send).toHaveBeenCalledWith({
        to: "test@example.com",
        content: "Test Content",
      });
    });
  });

  describe("task metadata", () => {
    it("should use env-configured maxAttempts when present", async () => {
      vi.stubEnv("NOTIFICATIONS_SEND_MAX_ATTEMPTS", "5");

      const { SendNotificationTask: ReloadedTask } = await import(
        `../libs/SendNotificationTask?attempts=${Date.now()}`
      );
      const metadata = MetadataStorage.getAll<TaskMetadata>(TASK_METADATA_KEY).find((entry) => {
        const value = entry.value as TaskMetadata;

        return value.target === ReloadedTask && value.methodName === "handle";
      });

      const value = metadata?.value as TaskMetadata | undefined;
      const maxAttempts = value?.options?.maxAttempts;

      expect(maxAttempts).toBe(5);

      vi.unstubAllEnvs();
    });
  });
});
