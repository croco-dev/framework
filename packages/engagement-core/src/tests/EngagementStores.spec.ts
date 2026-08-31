import { describe, expect, it, vi } from "vitest";
import {
  createEngagementStoreConformanceSuite,
  EngagementPersistenceProblem,
  EngagementStoreValidationProblem,
  InMemoryEngagementStore,
  InMemoryRecipientDirectory,
  StoreBackedRecipientDirectory,
} from "../index";

describe("InMemoryEngagementStore", () => {
  const suite = createEngagementStoreConformanceSuite({
    createStore: () =>
      new InMemoryEngagementStore(undefined, () => new Date("2026-01-01T00:00:00.000Z")),
    reopenStore: (store) => (store as InMemoryEngagementStore).reopen(),
  });

  for (const testCase of suite.cases) {
    // oxlint-disable-next-line jest/valid-title -- exported conformance cases own stable names
    it(testCase.name, testCase.run);
  }

  it("keeps push token references out of validation Problem serialization", async () => {
    const tokenReference = "secret://push/raw-token-reference";
    const store = new InMemoryEngagementStore();

    let caught: unknown;
    try {
      await store.saveEndpoint({
        id: "",
        tenantId: "tenant-secret",
        recipientId: "recipient-secret",
        kind: "push",
        provider: "fixture-provider",
        app: "fixture-app",
        platform: "ios",
        environment: "production",
        tokenReference,
        lastSeenAt: new Date("2026-01-01T00:00:00.000Z"),
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(EngagementStoreValidationProblem);
    expect(JSON.stringify(caught)).not.toContain(tokenReference);
  });

  it("keeps endpoint PII out of persistence Problem serialization", () => {
    const emailAddress = "private-recipient@example.invalid";
    const endpointId = "private-endpoint-identifier";
    const problem = new EngagementPersistenceProblem(
      "save-endpoint",
      "tenant-private",
      new Error(`database rejected ${emailAddress} at ${endpointId}`),
    );

    const serialized = JSON.stringify(problem.toJSON());
    expect(serialized).not.toContain(emailAddress);
    expect(serialized).not.toContain(endpointId);
  });

  it("resolves only active durable endpoints without exposing push token references", async () => {
    const store = new InMemoryEngagementStore(
      undefined,
      () => new Date("2026-01-01T00:00:10.000Z"),
    );
    const recipient = { tenantId: "tenant-directory", userId: "recipient-directory" };
    const email = await store.saveEndpoint({
      id: "email-directory",
      tenantId: recipient.tenantId,
      recipientId: recipient.userId,
      kind: "email",
      address: "recipient@example.invalid",
      lastSeenAt: new Date("2026-01-01T00:00:01.000Z"),
    });
    await store.saveEndpoint({
      id: "push-directory",
      tenantId: recipient.tenantId,
      recipientId: recipient.userId,
      kind: "push",
      provider: "fixture-provider",
      app: "fixture-app",
      platform: "ios",
      environment: "production",
      tokenReference: "secret://push/directory",
      lastSeenAt: new Date("2026-01-01T00:00:02.000Z"),
    });
    const resolveToken = vi.fn(async () => "resolved-push-token");
    const directory = new StoreBackedRecipientDirectory(
      new InMemoryRecipientDirectory([{ recipient, push: [], locale: "ko-KR" }]),
      store,
      { resolveToken },
    );

    await expect(directory.resolve(recipient)).resolves.toMatchObject({
      recipient,
      email: { id: email.id, address: "recipient@example.invalid", version: email.version },
      push: [{ id: "push-directory", token: "resolved-push-token", version: 1 }],
      locale: "ko-KR",
    });
    expect(resolveToken).toHaveBeenCalledWith(
      expect.objectContaining({ tokenReference: "secret://push/directory" }),
    );

    await store.invalidateEndpoint({
      tenantId: recipient.tenantId,
      endpointId: email.id,
      expectedVersion: email.version,
      reason: "hard-bounce",
      invalidatedAt: new Date("2026-01-01T00:00:03.000Z"),
    });
    await expect(directory.resolve(recipient)).resolves.not.toHaveProperty("email");
  });

  it("does not discard a concurrent reopened-handle write when a transaction rolls back", async () => {
    const store = new InMemoryEngagementStore();
    const reopened = store.reopen();
    let signalTransactionStarted = (): void => undefined;
    const transactionStarted = new Promise<void>((resolve) => {
      signalTransactionStarted = resolve;
    });
    let releaseTransaction = (): void => undefined;
    const transactionBlocked = new Promise<void>((resolve) => {
      releaseTransaction = resolve;
    });
    const transactionFailure = new Error("transaction failed");
    const transactionResult = store
      .transaction(async (stores) => {
        await stores.saveEndpoint({
          id: "transaction-endpoint",
          tenantId: "tenant-concurrent",
          recipientId: "recipient-concurrent",
          kind: "email",
          address: "transaction@example.invalid",
          lastSeenAt: new Date("2026-01-01T00:00:01.000Z"),
        });
        signalTransactionStarted();
        await transactionBlocked;
        throw transactionFailure;
      })
      .catch((error: unknown) => error);
    await transactionStarted;

    let standaloneWriteCompleted = false;
    const standaloneWrite = reopened
      .saveEndpoint({
        id: "standalone-endpoint",
        tenantId: "tenant-concurrent",
        recipientId: "recipient-concurrent",
        kind: "email",
        address: "standalone@example.invalid",
        lastSeenAt: new Date("2026-01-01T00:00:02.000Z"),
      })
      .then(() => {
        standaloneWriteCompleted = true;
      });
    await Promise.resolve();
    expect(standaloneWriteCompleted).toBe(false);

    releaseTransaction();
    await expect(transactionResult).resolves.toBe(transactionFailure);
    await standaloneWrite;

    await expect(
      store.getEndpoint("tenant-concurrent", "transaction-endpoint"),
    ).resolves.toBeUndefined();
    await expect(
      store.getEndpoint("tenant-concurrent", "standalone-endpoint"),
    ).resolves.toBeDefined();
    await expect(
      reopened.getEndpoint("tenant-concurrent", "standalone-endpoint"),
    ).resolves.toBeDefined();
  });
});
