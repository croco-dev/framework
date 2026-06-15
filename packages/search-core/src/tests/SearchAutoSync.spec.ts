import type { Constructor, ILogger } from "@croco/framework-context";
import { Container, LOGGER_TOKEN, MetadataStorage } from "@croco/framework-context";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import type { SearchableMetadata } from "../libs/decorators/Searchable";
import {
  DocumentDeletedEvent,
  DocumentIndexedEvent,
  SearchSyncFailedEvent,
} from "../libs/events/SearchEvents";
import { SearchEngine } from "../libs/SearchEngine";
import { SearchAutoSync, type SearchSyncFailedEventPublisher } from "../libs/sync/SearchAutoSync";

describe("SearchAutoSync", () => {
  let searchAutoSync!: SearchAutoSync;
  let searchEngine!: SearchEngine;
  let eventBusMock!: {
    publishNow: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    Container.reset();
    Container.remove(LOGGER_TOKEN);

    searchEngine = {
      indexDocument: vi.fn(),
      deleteDocument: vi.fn(),
    } as unknown as SearchEngine;
    Container.set(SearchEngine.token as unknown as Constructor<SearchEngine>, searchEngine);

    eventBusMock = {
      publishNow: vi.fn(),
    };

    searchAutoSync = new SearchAutoSync(eventBusMock as SearchSyncFailedEventPublisher);
  });

  const mockUserAutoSyncMetadata = (): void => {
    vi.spyOn(MetadataStorage, "getAll").mockReturnValue([
      {
        target: class User {},
        value: {
          index: "users",
          autoSync: true,
          target: class User {},
        } as SearchableMetadata,
      },
    ]);
  };

  type LoggerMock = ILogger & {
    error: ReturnType<typeof vi.fn>;
    child: ReturnType<typeof vi.fn>;
  };

  const createLoggerMock = (): LoggerMock => {
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn(),
    } as unknown as LoggerMock;
    logger.child.mockReturnValue(logger);
    return logger;
  };

  it("should be defined", () => {
    expect(searchAutoSync).not.toBeNull();
  });

  it("should register both index and delete events with domain event names", async () => {
    const subscribeCalls: string[] = [];
    subscribeCalls.push(DocumentIndexedEvent.eventName, DocumentDeletedEvent.eventName);

    expect(subscribeCalls).toContain(DocumentIndexedEvent.eventName);
    expect(subscribeCalls).toContain(DocumentDeletedEvent.eventName);
  });

  describe("handle DocumentIndexedEvent", () => {
    it("should index document when autoSync is true", async () => {
      vi.spyOn(MetadataStorage, "getAll").mockReturnValue([
        {
          target: class User {},
          value: {
            index: "users",
            autoSync: true,
            target: class User {},
          } as SearchableMetadata,
        },
      ]);

      const event = new DocumentIndexedEvent("users", "user-1", "tenant-1", { name: "John" });

      await searchAutoSync.handle(event);

      expect(searchEngine.indexDocument).toHaveBeenCalledWith("users", {
        id: "user-1",
        tenantId: "tenant-1",
        name: "John",
      });
    });

    it("should NOT index document when autoSync is false", async () => {
      vi.spyOn(MetadataStorage, "getAll").mockReturnValue([
        {
          target: class Product {},
          value: {
            index: "products",
            autoSync: false,
            target: class Product {},
          } as SearchableMetadata,
        },
      ]);

      const event = new DocumentIndexedEvent("products", "prod-1", "tenant-1", { name: "Widget" });

      await searchAutoSync.handle(event);

      expect(searchEngine.indexDocument).not.toHaveBeenCalled();
    });

    it("should ignore duplicate events", async () => {
      vi.spyOn(MetadataStorage, "getAll").mockReturnValue([
        {
          target: class User {},
          value: {
            index: "users",
            autoSync: true,
            target: class User {},
          } as SearchableMetadata,
        },
      ]);

      const event = new DocumentIndexedEvent("users", "user-1", "tenant-1", { name: "John" });

      await searchAutoSync.handle(event);
      await searchAutoSync.handle(event);

      expect(searchEngine.indexDocument).toHaveBeenCalledTimes(1);
    });

    it("should publish SearchSyncFailedEvent on error", async () => {
      vi.spyOn(MetadataStorage, "getAll").mockReturnValue([
        {
          target: class User {},
          value: {
            index: "users",
            autoSync: true,
            target: class User {},
          } as SearchableMetadata,
        },
      ]);

      const error = new Error("Indexing failed");
      (searchEngine.indexDocument as Mock).mockRejectedValue(error);

      const event = new DocumentIndexedEvent("users", "user-1", "tenant-1", { name: "John" });

      await searchAutoSync.handle(event);

      expect(eventBusMock.publishNow).toHaveBeenCalledWith(expect.any(SearchSyncFailedEvent));
      const failedEvent = eventBusMock.publishNow.mock.calls[0][0];
      expect(failedEvent.error).toBe(error);
      expect(failedEvent.operation).toBe("index");
    });

    it("should log failed event publisher errors with sync context", async () => {
      mockUserAutoSyncMetadata();
      const logger = createLoggerMock();
      Container.set(LOGGER_TOKEN, logger);
      const originalError = new Error("Indexing failed");
      const publishError = new Error("Failed event publisher unavailable");
      (searchEngine.indexDocument as Mock).mockRejectedValue(originalError);
      eventBusMock.publishNow.mockRejectedValue(publishError);

      const event = new DocumentIndexedEvent("users", "user-1", "tenant-1", { name: "John" });

      await expect(searchAutoSync.handle(event)).resolves.toBeUndefined();

      expect(logger.child).toHaveBeenCalledWith({
        searchSyncFailedEvent: {
          eventName: SearchSyncFailedEvent.eventName,
          indexName: "users",
          documentId: "user-1",
          tenantId: "tenant-1",
          operation: "index",
          syncErrorName: "Error",
          syncErrorMessage: "Indexing failed",
        },
      });
      expect(logger.error).toHaveBeenCalledWith(
        "Failed to publish search sync failed event",
        publishError,
      );
    });

    it("should fall back to console error when logger lookup fails after publisher error", async () => {
      mockUserAutoSyncMetadata();
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const originalError = new Error("Indexing failed");
      const publishError = new Error("Failed event publisher unavailable");
      (searchEngine.indexDocument as Mock).mockRejectedValue(originalError);
      eventBusMock.publishNow.mockRejectedValue(publishError);

      const event = new DocumentIndexedEvent("users", "user-1", "tenant-1", { name: "John" });

      await expect(searchAutoSync.handle(event)).resolves.toBeUndefined();

      expect(consoleError).toHaveBeenCalledWith(
        "Failed to publish search sync failed event",
        {
          searchSyncFailedEvent: {
            eventName: SearchSyncFailedEvent.eventName,
            indexName: "users",
            documentId: "user-1",
            tenantId: "tenant-1",
            operation: "index",
            syncErrorName: "Error",
            syncErrorMessage: "Indexing failed",
          },
        },
        publishError,
      );
    });
  });

  describe("handle DocumentDeletedEvent", () => {
    it("should delete document when autoSync is true", async () => {
      vi.spyOn(MetadataStorage, "getAll").mockReturnValue([
        {
          target: class User {},
          value: {
            index: "users",
            autoSync: true,
            target: class User {},
          } as SearchableMetadata,
        },
      ]);

      const event = new DocumentDeletedEvent("users", "user-1", "tenant-1");

      await searchAutoSync.handle(event);

      expect(searchEngine.deleteDocument).toHaveBeenCalledWith("users", "user-1");
    });

    it("should publish SearchSyncFailedEvent on delete error", async () => {
      vi.spyOn(MetadataStorage, "getAll").mockReturnValue([
        {
          target: class User {},
          value: {
            index: "users",
            autoSync: true,
            target: class User {},
          } as SearchableMetadata,
        },
      ]);

      const error = new Error("Delete failed");
      (searchEngine.deleteDocument as Mock).mockRejectedValue(error);

      const event = new DocumentDeletedEvent("users", "user-1", "tenant-1");

      await searchAutoSync.handle(event);

      expect(eventBusMock.publishNow).toHaveBeenCalledWith(expect.any(SearchSyncFailedEvent));
      const failedEvent = eventBusMock.publishNow.mock.calls[0][0];
      expect(failedEvent.operation).toBe("delete");
    });

    it("should skip publishing when no failed event publisher is configured", async () => {
      vi.spyOn(MetadataStorage, "getAll").mockReturnValue([
        {
          target: class User {},
          value: {
            index: "users",
            autoSync: true,
            target: class User {},
          } as SearchableMetadata,
        },
      ]);

      const error = new Error("Delete failed");
      (searchEngine.deleteDocument as Mock).mockRejectedValue(error);
      searchAutoSync = new SearchAutoSync();

      await expect(
        searchAutoSync.handle(new DocumentDeletedEvent("users", "user-1", "tenant-1")),
      ).resolves.toBeUndefined();
      expect(eventBusMock.publishNow).not.toHaveBeenCalled();
    });
  });
});
