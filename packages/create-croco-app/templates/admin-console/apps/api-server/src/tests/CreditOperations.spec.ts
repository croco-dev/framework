import { describe, expect, it } from "vitest";

import {
  executeCreditOperationsAction,
  loadCreditOperations,
  type CreditOperationsAction,
  type CreditOperationsActionRequest,
  type CreditOperationsReadyState,
} from "@croco/admin-core";
import {
  CreditLedgerService,
  creditAccountId,
  creditAmount,
  InMemoryCreditLedgerStore,
} from "@croco/credits-core";

import {
  CreditOperationsService,
  createActionRequest,
  createExecutor,
  createFixtureSnapshot,
} from "../creditOperations";

const now = new Date("2026-07-30T00:00:00.000Z");
const permissions = ["credits:read", "credits:write", "credits:refund", "credits:release"];

describe("generated credit operations smoke", () => {
  it("derives executable actions on the server instead of trusting client action metadata", async () => {
    const service = new CreditOperationsService();
    const snapshot = await service.snapshot("authorization-tenant");
    const state = await loadCreditOperations({
      grantedPermissions: permissions,
      source: {
        requiredPermissions: ["credits:read"],
        load: async () => ({ kind: "ready", snapshot }),
      },
      tenantId: snapshot.tenantId,
    });
    if (state.kind !== "ready") {
      throw new Error(`Expected ready credit operations state, received ${state.kind}`);
    }
    const grant = requireAction(state, "grant");

    await expect(
      service.execute(
        { kind: "grant", targetId: "client-forged-target" },
        createActionRequest(grant, {
          actorId: "smoke-operator",
          idempotencyKey: "forged-action",
          reason: "Verify server-derived authorization",
        }),
      ),
    ).rejects.toMatchObject({
      code: "admin-core/credit-operations-validation-failed",
    });
  });

  it("executes and renders the append-only ledger journey with hostile recovery cases", async () => {
    const store = new InMemoryCreditLedgerStore();
    const service = new CreditLedgerService({ store });
    const ready = await loadReadyState(service);
    const positions = ready.snapshot.transactions.map((transaction) => transaction.position);

    expect(positions).toEqual(positions.map((_, index) => index + 1));
    expect(positions[positions.length - 1]).toBe(ready.snapshot.balance.ledgerPosition);
    expect(ready.snapshot.transactions.map((transaction) => transaction.kind)).toEqual(
      expect.arrayContaining([
        "grant",
        "reserve",
        "commit",
        "release",
        "expire",
        "consume",
        "refund",
      ]),
    );
    expect(
      ready.snapshot.transactions.find((transaction) => transaction.kind === "consume")?.allocations
        .length,
    ).toBeGreaterThan(0);
    const grant = requireAction(ready, "grant");
    const request = createActionRequest(grant, {
      actorId: "smoke-operator",
      idempotencyKey: "smoke-grant",
      reason: "Verify generated admin recovery",
    });
    const executor = createExecutor(service);
    const appended = await executeCreditOperationsAction({
      action: grant,
      executor,
      grantedPermissions: permissions,
      now,
      request,
    });
    expect(appended).toMatchObject({ kind: "succeeded", replayed: false });
    if (appended.kind !== "succeeded") {
      throw new Error("Generated grant did not append a transaction");
    }
    const afterAppend = await service.getHistory(creditAccountId(ready.snapshot.accountId));
    expect(
      afterAppend.transactions
        .slice(0, ready.snapshot.transactions.length)
        .map((transaction) => transaction.id),
    ).toEqual(ready.snapshot.transactions.map((transaction) => transaction.id));
    const appendedTransaction = afterAppend.transactions.find(
      (transaction) => transaction.id === appended.transactionIds[0],
    );
    const auditReference = new URLSearchParams(appendedTransaction?.reference.id);
    expect(auditReference.get("actorId")).toBe("smoke-operator");
    expect(auditReference.get("reason")).toBe("Verify generated admin recovery");

    const replayed = await executeCreditOperationsAction({
      action: grant,
      executor,
      grantedPermissions: permissions,
      now,
      request,
    });
    expect(replayed).toMatchObject({ kind: "succeeded", replayed: true });
    expect((await service.getHistory(creditAccountId(ready.snapshot.accountId))).position).toBe(
      afterAppend.position,
    );

    if (request.input.kind !== "grant") {
      throw new Error("Generated grant action did not create grant input");
    }
    const conflictingRequest: CreditOperationsActionRequest = {
      ...request,
      input: { ...request.input, amount: "6" },
    };
    await expect(
      executeCreditOperationsAction({
        action: grant,
        executor,
        grantedPermissions: permissions,
        now,
        request: conflictingRequest,
      }),
    ).resolves.toMatchObject({
      kind: "problem",
      problem: { code: "credits-core/duplicate-conflict" },
      recovery: "change-input",
    });

    const refreshed = await loadReadyState(service);
    const staleGrant = requireAction(refreshed, "grant");
    await service.grantCredits({
      accountId: creditAccountId(refreshed.snapshot.accountId),
      amount: creditAmount("1"),
      expectedPosition: refreshed.snapshot.balance.ledgerPosition,
      idempotencyKey: "advance-ledger",
      reference: { id: "advance-ledger", type: "smoke" },
      source: "smoke",
    });
    await expect(
      executeCreditOperationsAction({
        action: staleGrant,
        executor,
        grantedPermissions: permissions,
        now,
        request: createActionRequest(staleGrant, {
          actorId: "smoke-operator",
          idempotencyKey: "stale-grant",
          reason: "Verify stale recovery",
        }),
      }),
    ).resolves.toMatchObject({
      kind: "problem",
      problem: { code: "credits-core/stale-ledger-position" },
      recovery: "refresh-ledger",
    });

    const eventStore = new InMemoryCreditLedgerStore();
    const fixtureService = new CreditLedgerService({ store: eventStore });
    const eventReady = await loadReadyState(fixtureService, "event-tenant");
    const eventGrant = requireAction(eventReady, "grant");
    const eventService = new CreditLedgerService({
      eventPublisher: {
        publishAfterCommit() {
          throw new Error("event publisher unavailable");
        },
        publishNow: () => Promise.reject(new Error("event publisher unavailable")),
      },
      store: eventStore,
    });
    await expect(
      executeCreditOperationsAction({
        action: eventGrant,
        executor: createExecutor(eventService),
        grantedPermissions: permissions,
        now,
        request: createActionRequest(eventGrant, {
          actorId: "smoke-operator",
          idempotencyKey: "event-grant",
          reason: "Verify committed event recovery",
        }),
      }),
    ).resolves.toMatchObject({
      kind: "problem",
      ledgerCommitted: true,
      problem: { code: "credits-core/event-publication-failed" },
      recovery: "retry-event-publication",
    });
    expect(
      (await eventService.getHistory(creditAccountId(eventReady.snapshot.accountId))).position,
    ).toBe(eventReady.snapshot.balance.ledgerPosition + 1);
  });
});

async function loadReadyState(
  service: CreditLedgerService,
  tenantId = "smoke-tenant",
): Promise<CreditOperationsReadyState> {
  const snapshot = await createFixtureSnapshot(service, tenantId, now);
  const state = await loadCreditOperations({
    grantedPermissions: permissions,
    source: {
      requiredPermissions: ["credits:read"],
      load: async () => ({ kind: "ready", snapshot }),
    },
    tenantId,
  });
  if (state.kind !== "ready") {
    throw new Error(`Expected ready credit operations state, received ${state.kind}`);
  }
  return state;
}

function requireAction(
  state: CreditOperationsReadyState,
  kind: CreditOperationsAction["kind"],
): CreditOperationsAction {
  const action = state.actions.find((candidate) => candidate.kind === kind);
  if (action === undefined) {
    throw new Error(`Missing generated ${kind} action`);
  }
  return action;
}
