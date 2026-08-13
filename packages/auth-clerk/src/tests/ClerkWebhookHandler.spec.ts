import { verifyWebhook } from "@clerk/backend/webhooks";
import { deriveWebhookIdempotencyKey, InMemoryIdempotencyStore } from "@croco/idempotency-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClerkWebhookHandler } from "../libs/ClerkWebhookHandler";
import {
  ClerkWebhookDeliveryInFlightProblem,
  InvalidWebhookPayloadProblem,
} from "../libs/problems/ClerkProblems";
import type { WebhookEventHandler } from "../libs/types";

type VerifiedWebhook = Awaited<ReturnType<typeof verifyWebhook>>;
type StoredWebhookOutcome = {
  readonly deliveryId: string;
  readonly eventType: string;
  readonly outcome: "handled" | "ignored";
};
type MockWebhookHandlers = WebhookEventHandler &
  Required<Pick<WebhookEventHandler, "user.created" | "organization.updated">>;

vi.mock("@clerk/backend/webhooks", () => ({
  verifyWebhook: vi.fn(),
}));

describe("ClerkWebhookHandler", () => {
  let webhookHandler!: ClerkWebhookHandler;
  let mockHandlers!: MockWebhookHandlers;
  let idempotencyStore!: InMemoryIdempotencyStore<StoredWebhookOutcome>;
  const signingSecret = "whsec_test";

  beforeEach(() => {
    vi.clearAllMocks();
    mockHandlers = {
      "user.created": vi.fn(),
      "organization.updated": vi.fn(),
    };
    idempotencyStore = new InMemoryIdempotencyStore<StoredWebhookOutcome>();
    webhookHandler = new ClerkWebhookHandler({ signingSecret, idempotencyStore }, mockHandlers);
  });

  const createRequest = (deliveryId = "msg_test") =>
    new Request("http://localhost/webhook", {
      method: "POST",
      headers: { "svix-id": deliveryId },
      body: JSON.stringify({ type: "test" }),
    });

  it("should verify webhook signature", async () => {
    const request = createRequest();
    vi.mocked(verifyWebhook).mockResolvedValue({
      type: "user.created",
      data: { id: "user_123", email_addresses: [{ email_address: "test@example.com" }] },
    } as unknown as VerifiedWebhook);

    await webhookHandler.handleWebhook(request);

    expect(verifyWebhook).toHaveBeenCalledWith(request, { signingSecret });
  });

  it("should throw error if verification fails", async () => {
    const request = createRequest();
    vi.mocked(verifyWebhook).mockRejectedValue(new Error("Invalid signature"));

    await expect(webhookHandler.handleWebhook(request)).rejects.toThrow(
      "Webhook verification failed",
    );
  });

  it("should call registered handler for user.created", async () => {
    const request = createRequest();
    const eventData = { id: "user_123", email_addresses: [] };
    vi.mocked(verifyWebhook).mockResolvedValue({
      type: "user.created",
      data: eventData,
    } as unknown as VerifiedWebhook);

    await webhookHandler.handleWebhook(request);

    expect(mockHandlers["user.created"]).toHaveBeenCalledWith(eventData);
  });

  it("should call registered handler for organization.updated", async () => {
    const request = createRequest();
    const eventData = { id: "org_123", name: "New Name", slug: "new-name" };
    vi.mocked(verifyWebhook).mockResolvedValue({
      type: "organization.updated",
      data: eventData,
    } as unknown as VerifiedWebhook);

    await webhookHandler.handleWebhook(request);

    expect(mockHandlers["organization.updated"]).toHaveBeenCalledWith(eventData);
  });

  it("should invoke a mutation handler once for repeated delivery IDs", async () => {
    const event = {
      type: "user.created",
      data: { id: "user_123", email_addresses: [] },
    } as unknown as VerifiedWebhook;
    vi.mocked(verifyWebhook).mockResolvedValue(event);

    const firstOutcome = await webhookHandler.handleWebhook(createRequest("msg_duplicate"));
    const replayedOutcome = await webhookHandler.handleWebhook(createRequest("msg_duplicate"));

    expect(mockHandlers["user.created"]).toHaveBeenCalledTimes(1);
    expect(firstOutcome).toEqual({
      deliveryId: "msg_duplicate",
      eventType: "user.created",
      outcome: "handled",
    });
    expect(replayedOutcome).toEqual(firstOutcome);
  });

  it("should bound delivery reservations with the default idempotency TTL", async () => {
    const reserve = vi.spyOn(idempotencyStore, "reserve");
    vi.mocked(verifyWebhook).mockResolvedValue({
      type: "user.created",
      data: { id: "user_123", email_addresses: [] },
    } as unknown as VerifiedWebhook);

    await webhookHandler.handleWebhook(createRequest("msg_bounded"));

    expect(reserve).toHaveBeenCalledWith(expect.any(Object), {
      metadata: {
        deliveryId: "msg_bounded",
        eventType: "user.created",
        provider: "clerk",
      },
      ttlMs: 86_400_000,
    });
  });

  it("should not acknowledge an in-flight duplicate before the stored outcome exists", async () => {
    let releaseHandler!: () => void;
    const handlerBlocked = new Promise<void>((resolve) => {
      releaseHandler = resolve;
    });
    const userCreatedHandler = mockHandlers["user.created"];
    vi.mocked(userCreatedHandler).mockReturnValue(handlerBlocked);
    vi.mocked(verifyWebhook).mockResolvedValue({
      type: "user.created",
      data: { id: "user_123", email_addresses: [] },
    } as unknown as VerifiedWebhook);

    const firstDelivery = webhookHandler.handleWebhook(createRequest("msg_concurrent"));
    await vi.waitFor(() => expect(mockHandlers["user.created"]).toHaveBeenCalledTimes(1));

    await expect(webhookHandler.handleWebhook(createRequest("msg_concurrent"))).rejects.toThrow(
      ClerkWebhookDeliveryInFlightProblem,
    );
    const duplicateProblem = await webhookHandler
      .handleWebhook(createRequest("msg_concurrent"))
      .catch((error: unknown) => error);
    expect(duplicateProblem).toMatchObject({
      code: "auth-clerk/webhook-delivery-in-flight",
      extensions: { deliveryId: "msg_concurrent", retryable: true },
    });

    releaseHandler();
    await firstDelivery;
    await webhookHandler.handleWebhook(createRequest("msg_concurrent"));

    expect(mockHandlers["user.created"]).toHaveBeenCalledTimes(1);
    expect(idempotencyStore.size).toBe(1);
  });

  it("should keep different delivery IDs distinct for similar payloads", async () => {
    vi.mocked(verifyWebhook).mockResolvedValue({
      type: "user.created",
      data: { id: "user_123", email_addresses: [] },
    } as unknown as VerifiedWebhook);

    await webhookHandler.handleWebhook(createRequest("msg_first"));
    await webhookHandler.handleWebhook(createRequest("msg_second"));

    expect(mockHandlers["user.created"]).toHaveBeenCalledTimes(2);
    expect(idempotencyStore.size).toBe(2);
  });

  it("should retry a delivery after its mutation handler fails", async () => {
    const userCreatedHandler = mockHandlers["user.created"];
    vi.mocked(userCreatedHandler)
      .mockRejectedValueOnce(new Error("temporary database failure"))
      .mockResolvedValueOnce(undefined);
    vi.mocked(verifyWebhook).mockResolvedValue({
      type: "user.created",
      data: { id: "user_123", email_addresses: [] },
    } as unknown as VerifiedWebhook);

    await expect(webhookHandler.handleWebhook(createRequest("msg_retryable"))).rejects.toThrow(
      "temporary database failure",
    );
    await webhookHandler.handleWebhook(createRequest("msg_retryable"));
    await webhookHandler.handleWebhook(createRequest("msg_retryable"));

    expect(userCreatedHandler).toHaveBeenCalledTimes(2);
    expect(idempotencyStore.size).toBe(1);
  });

  it("should reclaim an abandoned delivery reservation after the configured TTL", async () => {
    let now = new Date("2026-08-13T00:00:00.000Z");
    const store = new InMemoryIdempotencyStore<StoredWebhookOutcome>({ now: () => now });
    const deliveryId = "msg_abandoned";
    const key = deriveWebhookIdempotencyKey({
      provider: "clerk",
      eventId: deliveryId,
      namespace: "auth-clerk-webhook",
    });
    await store.reserve(key, { ttlMs: 1_000 });
    now = new Date("2026-08-13T00:00:01.000Z");
    webhookHandler = new ClerkWebhookHandler(
      { signingSecret, idempotencyStore: store, idempotencyTtlMs: 1_000 },
      mockHandlers,
    );
    vi.mocked(verifyWebhook).mockResolvedValue({
      type: "user.created",
      data: { id: "user_123", email_addresses: [] },
    } as unknown as VerifiedWebhook);

    await webhookHandler.handleWebhook(createRequest(deliveryId));

    expect(mockHandlers["user.created"]).toHaveBeenCalledTimes(1);
    expect(store.size).toBe(1);
  });

  it("should not create idempotency records when verification fails", async () => {
    const reserve = vi.spyOn(idempotencyStore, "reserve");
    vi.mocked(verifyWebhook).mockRejectedValue(new Error("Invalid signature"));

    await expect(webhookHandler.handleWebhook(createRequest("msg_unverified"))).rejects.toThrow(
      "Webhook verification failed",
    );

    expect(reserve).not.toHaveBeenCalled();
    expect(idempotencyStore.size).toBe(0);
  });

  it("should reject a verified delivery without an identity before reserving it", async () => {
    const reserve = vi.spyOn(idempotencyStore, "reserve");
    vi.mocked(verifyWebhook).mockResolvedValue({
      type: "user.created",
      data: { id: "user_123", email_addresses: [] },
    } as unknown as VerifiedWebhook);

    const request = new Request("http://localhost/webhook", {
      method: "POST",
      body: JSON.stringify({ type: "user.created" }),
    });

    await expect(webhookHandler.handleWebhook(request)).rejects.toThrow(
      InvalidWebhookPayloadProblem,
    );

    expect(reserve).not.toHaveBeenCalled();
  });

  it("should ignore events with no registered handler", async () => {
    const request = createRequest();
    vi.mocked(verifyWebhook).mockResolvedValue({
      type: "user.deleted",
      data: { id: "user_123" },
    } as unknown as VerifiedWebhook);

    await webhookHandler.handleWebhook(request);

    // No error should be thrown, and no mock handler called
    expect(mockHandlers["user.created"]).not.toHaveBeenCalled();
    expect(mockHandlers["organization.updated"]).not.toHaveBeenCalled();
  });

  it("should throw validation problem for malformed user webhook payload", async () => {
    const request = createRequest();
    vi.mocked(verifyWebhook).mockResolvedValue({
      type: "user.created",
      data: { email_addresses: [] },
    } as unknown as VerifiedWebhook);

    await expect(webhookHandler.handleWebhook(request)).rejects.toBeInstanceOf(
      InvalidWebhookPayloadProblem,
    );
  });
});
