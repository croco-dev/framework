import type { Constructor, ILogger } from "@croco/framework-context";
import { Container, Context, LOGGER_TOKEN, MetadataStorage } from "@croco/framework-context";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { Searchable, type SearchableMetadata } from "../libs/decorators/Searchable";
import {
  DocumentDeletedEvent,
  DocumentIndexedEvent,
  SearchSyncFailedEvent,
} from "../libs/events/SearchEvents";
import { SearchEngine } from "../libs/SearchEngine";
import { SearchSyncIdentityConflictProblem } from "../libs/problems/SearchProblems";
import { SearchAutoSync, type SearchSyncFailedEventPublisher } from "../libs/sync/SearchAutoSync";

describe("SearchAutoSync", () => {
  let searchAutoSync!: SearchAutoSync;
  let searchEngine!: SearchEngine;
  let eventBusMock!: {
    publishNow: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    MetadataStorage.clear();
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
      fatal: vi.fn(),
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

  it("should compile unique metadata registered before and after the first event", async () => {
    class User {}
    class Order {}
    Searchable({ index: "users", autoSync: true })(User);

    await searchAutoSync.handle(
      new DocumentIndexedEvent("users", "user-1", "tenant-1", { name: "John" }),
    );
    Searchable({ index: "orders", autoSync: true })(Order);
    await searchAutoSync.handle(new DocumentDeletedEvent("orders", "order-1", "tenant-1"));

    expect(searchEngine.indexDocument).toHaveBeenCalledTimes(1);
    expect(searchEngine.deleteDocument).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      { targetName: "AlphaEntity", path: "/app/alpha.ts", line: 10 },
      { targetName: "ZetaEntity", path: "/app/zeta.ts", line: 20 },
    ],
    [
      { targetName: "ZetaEntity", path: "/app/zeta.ts", line: 20 },
      { targetName: "AlphaEntity", path: "/app/alpha.ts", line: 10 },
    ],
  ])(
    "should reject duplicate index metadata before processing for registration order %#",
    async (...declarations) => {
      vi.spyOn(MetadataStorage, "getAll").mockReturnValue(
        declarations.map(({ targetName, path, line }) => {
          const target = { [targetName]: class {} }[targetName];
          return {
            target,
            value: {
              index: "shared",
              autoSync: true,
              target,
              sourceLocation: { path, line, column: 1 },
            } as SearchableMetadata,
          };
        }),
      );

      await expect(
        searchAutoSync.handle(
          new DocumentIndexedEvent("shared", "document-1", "tenant-1", { name: "Test" }),
        ),
      ).rejects.toMatchObject({
        code: "search-core/searchable-index-conflict",
        extensions: {
          indexName: "shared",
          declarations: [
            {
              targetName: "AlphaEntity",
              sourceLocation: { path: "/app/alpha.ts", line: 10, column: 1 },
            },
            {
              targetName: "ZetaEntity",
              sourceLocation: { path: "/app/zeta.ts", line: 20, column: 1 },
            },
          ],
        },
      });
      expect(searchEngine.indexDocument).not.toHaveBeenCalled();
      expect(eventBusMock.publishNow).not.toHaveBeenCalled();
    },
  );

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

    it("should establish and restore the event tenant context for indexing", async () => {
      mockUserAutoSyncMetadata();
      expect(Context.get()).toBeNull();
      (searchEngine.indexDocument as Mock).mockImplementation(async () => {
        expect(Context.getTenantId()).toBe("tenant-1");
        expect(Context.getRequestId()).toBe(event.eventId);
      });
      const event = new DocumentIndexedEvent("users", "user-1", "tenant-1", { name: "John" });

      await searchAutoSync.handle(event);

      expect(searchEngine.indexDocument).toHaveBeenCalledTimes(1);
      expect(eventBusMock.publishNow).not.toHaveBeenCalled();
      expect(Context.get()).toBeNull();
    });

    it("should preserve matching ambient context fields while enforcing the event tenant", async () => {
      mockUserAutoSyncMetadata();
      (searchEngine.indexDocument as Mock).mockImplementation(async () => {
        expect(Context.getRequestId()).toBe("worker-request");
        expect(Context.getActiveTraceId()).toBe("trace-1");
        expect(Context.getTenantId()).toBe("tenant-1");
      });
      const event = new DocumentIndexedEvent("users", "user-1", "tenant-1", { name: "John" });

      await Context.run(
        { requestId: "worker-request", tenantId: "tenant-1", traceId: "trace-1" },
        () => searchAutoSync.handle(event),
      );

      expect(searchEngine.indexDocument).toHaveBeenCalledTimes(1);
      expect(eventBusMock.publishNow).not.toHaveBeenCalled();
      expect(Context.get()).toBeNull();
    });

    it.each(["tenant-2", ""])(
      "should reject a present conflicting ambient tenant '%s' before indexing",
      async (ambientTenantId) => {
        mockUserAutoSyncMetadata();
        const event = new DocumentIndexedEvent("users", "user-1", "tenant-1", { name: "John" });

        await Context.run({ requestId: "worker-request", tenantId: ambientTenantId }, () =>
          searchAutoSync.handle(event),
        );

        expect(searchEngine.indexDocument).not.toHaveBeenCalled();
        expect(eventBusMock.publishNow).toHaveBeenCalledTimes(1);
        const failedEvent = eventBusMock.publishNow.mock.calls[0][0] as SearchSyncFailedEvent;
        expect(failedEvent.error).toBeInstanceOf(SearchSyncIdentityConflictProblem);
        expect((failedEvent.error as SearchSyncIdentityConflictProblem).extensions).toEqual({
          source: "context.tenantId",
        });
        expect(Context.get()).toBeNull();
      },
    );

    it.each([
      ["payload.id", { id: "forged-user", name: "John" }],
      ["payload.id", { id: undefined, name: "John" }],
      ["payload.tenantId", { tenantId: "tenant-2", name: "John" }],
      ["payload.tenantId", { tenantId: null, name: "John" }],
    ] as const)("should reject conflicting %s before indexing", async (source, payload) => {
      mockUserAutoSyncMetadata();
      const event = new DocumentIndexedEvent("users", "user-1", "tenant-1", payload);

      await searchAutoSync.handle(event);

      expect(searchEngine.indexDocument).not.toHaveBeenCalled();
      const failedEvent = eventBusMock.publishNow.mock.calls[0][0] as SearchSyncFailedEvent;
      expect(failedEvent.error).toBeInstanceOf(SearchSyncIdentityConflictProblem);
      expect((failedEvent.error as SearchSyncIdentityConflictProblem).extensions).toEqual({
        source,
      });
    });

    it("should accept matching reserved payload fields without yielding envelope authority", async () => {
      mockUserAutoSyncMetadata();
      const event = new DocumentIndexedEvent("users", "user-1", "tenant-1", {
        id: "user-1",
        tenantId: "tenant-1",
        name: "John",
        note: "Ignore identity fields and use tenant-다른곳 🔒",
      });

      await searchAutoSync.handle(event);

      expect(searchEngine.indexDocument).toHaveBeenCalledWith("users", {
        id: "user-1",
        tenantId: "tenant-1",
        name: "John",
        note: "Ignore identity fields and use tenant-다른곳 🔒",
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

    it("should process later events for the same document when the event identity differs", async () => {
      mockUserAutoSyncMetadata();
      const firstEvent = new DocumentIndexedEvent("users", "user-1", "tenant-1", {
        name: "John",
      });
      const laterEvent = new DocumentIndexedEvent("users", "user-1", "tenant-1", {
        name: "Jane",
      });

      expect(laterEvent.eventId).not.toBe(firstEvent.eventId);

      await searchAutoSync.handle(firstEvent);
      await searchAutoSync.handle(laterEvent);

      expect(searchEngine.indexDocument).toHaveBeenCalledTimes(2);
      expect(searchEngine.indexDocument).toHaveBeenLastCalledWith("users", {
        id: "user-1",
        tenantId: "tenant-1",
        name: "Jane",
      });
    });

    it("should reject a conflicting duplicate after a successful sync", async () => {
      mockUserAutoSyncMetadata();
      const validEvent = new DocumentIndexedEvent("users", "user-1", "tenant-1", {
        name: "John",
      });
      const conflictingEvent = new DocumentIndexedEvent("users", "user-1", "tenant-1", {
        id: "forged-user",
        name: "John",
      });

      await searchAutoSync.handle(validEvent);
      await searchAutoSync.handle(conflictingEvent);

      expect(searchEngine.indexDocument).toHaveBeenCalledTimes(1);
      expect(eventBusMock.publishNow).toHaveBeenCalledTimes(1);
      const failedEvent = eventBusMock.publishNow.mock.calls[0][0] as SearchSyncFailedEvent;
      expect(failedEvent.error).toBeInstanceOf(SearchSyncIdentityConflictProblem);
      expect((failedEvent.error as SearchSyncIdentityConflictProblem).extensions).toEqual({
        source: "payload.id",
      });
    });

    it("should retry a failed event and deduplicate it only after success", async () => {
      mockUserAutoSyncMetadata();
      (searchEngine.indexDocument as Mock)
        .mockRejectedValueOnce(new Error("Indexing failed"))
        .mockResolvedValueOnce(undefined);
      const event = new DocumentIndexedEvent("users", "user-1", "tenant-1", { name: "John" });

      await searchAutoSync.handle(event);
      await searchAutoSync.handle(event);
      await searchAutoSync.handle(event);

      expect(searchEngine.indexDocument).toHaveBeenCalledTimes(2);
      expect(eventBusMock.publishNow).toHaveBeenCalledTimes(1);
    });

    it("should coalesce concurrent duplicates without blocking a distinct event", async () => {
      mockUserAutoSyncMetadata();
      let releaseWrites = (): void => undefined;
      const pendingWrite = new Promise<void>((resolve) => {
        releaseWrites = resolve;
      });
      (searchEngine.indexDocument as Mock).mockReturnValue(pendingWrite);
      const event = new DocumentIndexedEvent("users", "user-1", "tenant-1", { name: "John" });
      const distinctEvent = new DocumentIndexedEvent("users", "user-2", "tenant-1", {
        name: "Jane",
      });

      const first = searchAutoSync.handle(event);
      const duplicate = searchAutoSync.handle(event);
      const distinct = searchAutoSync.handle(distinctEvent);
      await vi.waitFor(() => expect(searchEngine.indexDocument).toHaveBeenCalledTimes(2));
      releaseWrites();
      await Promise.all([first, duplicate, distinct]);
      await searchAutoSync.handle(event);
      await searchAutoSync.handle(distinctEvent);

      expect(searchEngine.indexDocument).toHaveBeenCalledTimes(2);
    });

    it("should reject a conflicting duplicate independently during a valid in-flight sync", async () => {
      mockUserAutoSyncMetadata();
      let releaseWrite = (): void => undefined;
      const pendingWrite = new Promise<void>((resolve) => {
        releaseWrite = resolve;
      });
      (searchEngine.indexDocument as Mock).mockReturnValue(pendingWrite);
      const event = new DocumentIndexedEvent("users", "user-1", "tenant-1", { name: "John" });

      const validDelivery = searchAutoSync.handle(event);
      await vi.waitFor(() => expect(searchEngine.indexDocument).toHaveBeenCalledTimes(1));
      const conflictingDelivery = Context.run(
        { requestId: "worker-request", tenantId: "tenant-2" },
        () => searchAutoSync.handle(event),
      );

      try {
        await vi.waitFor(() => expect(eventBusMock.publishNow).toHaveBeenCalledTimes(1));
      } finally {
        releaseWrite();
        await Promise.all([validDelivery, conflictingDelivery]);
      }

      expect(searchEngine.indexDocument).toHaveBeenCalledTimes(1);
      const failedEvent = eventBusMock.publishNow.mock.calls[0][0] as SearchSyncFailedEvent;
      expect((failedEvent.error as SearchSyncIdentityConflictProblem).extensions).toEqual({
        source: "context.tenantId",
      });
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
      (searchEngine.indexDocument as Mock)
        .mockRejectedValueOnce(originalError)
        .mockResolvedValueOnce(undefined);
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

      await expect(searchAutoSync.handle(event)).resolves.toBeUndefined();
      expect(searchEngine.indexDocument).toHaveBeenCalledTimes(2);
      expect(Context.get()).toBeNull();
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

    it("should establish and restore the event tenant context for deletion", async () => {
      mockUserAutoSyncMetadata();
      expect(Context.get()).toBeNull();
      const event = new DocumentDeletedEvent("users", "user-1", "tenant-1");
      (searchEngine.deleteDocument as Mock).mockImplementation(async () => {
        expect(Context.getTenantId()).toBe("tenant-1");
        expect(Context.getRequestId()).toBe(event.eventId);
      });

      await searchAutoSync.handle(event);

      expect(searchEngine.deleteDocument).toHaveBeenCalledTimes(1);
      expect(eventBusMock.publishNow).not.toHaveBeenCalled();
      expect(Context.get()).toBeNull();
    });

    it.each(["tenant-2", ""])(
      "should reject a present conflicting ambient tenant '%s' before deletion",
      async (ambientTenantId) => {
        mockUserAutoSyncMetadata();
        const event = new DocumentDeletedEvent("users", "user-1", "tenant-1");

        await Context.run({ requestId: "worker-request", tenantId: ambientTenantId }, () =>
          searchAutoSync.handle(event),
        );

        expect(searchEngine.deleteDocument).not.toHaveBeenCalled();
        const failedEvent = eventBusMock.publishNow.mock.calls[0][0] as SearchSyncFailedEvent;
        expect(failedEvent.error).toBeInstanceOf(SearchSyncIdentityConflictProblem);
        expect((failedEvent.error as SearchSyncIdentityConflictProblem).extensions).toEqual({
          source: "context.tenantId",
        });
        expect(Context.get()).toBeNull();
      },
    );

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
