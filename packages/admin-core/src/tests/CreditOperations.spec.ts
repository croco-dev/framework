import { describe, expect, it, vi } from "vitest";

import {
  assertCreditOperationsActionRequest,
  createCreditOperationsActions,
  createCreditOperationsTenantExtension,
  executeCreditOperationsAction,
  filterCreditOperationsTransactions,
  loadCreditOperations,
  resolveCreditOperationsReference,
  CreditOperationsValidationProblem,
  type CreditOperationsActionRequest,
  type CreditOperationsMutationExecutor,
  type CreditOperationsSnapshot,
  type CreditOperationsSource,
} from "../index";

const generatedAt = new Date("2026-07-30T00:00:00.000Z");
type GrantActionRequest = CreditOperationsActionRequest & {
  readonly input: Extract<CreditOperationsActionRequest["input"], { readonly kind: "grant" }>;
};

function createSnapshot(): CreditOperationsSnapshot {
  return {
    accountId: "credit-account-1",
    balance: {
      accountId: "credit-account-1",
      available: "61",
      consumed: "29",
      expired: "0",
      expiringSoon: "61",
      expiringSoonBefore: new Date("2026-08-06T00:00:00.000Z"),
      ledgerPosition: 3,
      lifetimeGranted: "100",
      netAdjusted: "0",
      reserved: "10",
    },
    generatedAt,
    grantLots: [
      {
        amount: "100",
        expiresAt: new Date("2026-08-03T00:00:00.000Z"),
        meterKeys: ["llm.tokens"],
        remaining: "61",
        source: {
          maskedValue: "promotion-***",
          requiredPermissions: ["credits:references:read"],
          type: "promotion",
          value: "promotion-secret",
          visibility: "masked",
        },
        status: "available",
        transactionId: "grant-1",
      },
    ],
    history: { kind: "complete" },
    reservations: [
      {
        allocations: [{ amount: "10", grantTransactionId: "grant-1" }],
        amount: "10",
        createdAt: new Date("2026-07-30T00:40:00.000Z"),
        id: "reservation-active",
        release: { allowed: true, reason: "Core reports the reservation as active" },
        status: "active",
      },
    ],
    tenantId: "tenant-1",
    transactions: [
      {
        allocations: [],
        amount: "100",
        id: "grant-1",
        kind: "grant",
        occurredAt: new Date("2026-07-30T00:00:00.000Z"),
        position: 1,
        reference: {
          maskedValue: "campaign-***",
          requiredPermissions: ["credits:references:read"],
          type: "campaign",
          value: "campaign-secret",
          visibility: "visible",
        },
      },
      {
        allocations: [{ amount: "29", grantTransactionId: "grant-1" }],
        amount: "29",
        id: "consume-1",
        kind: "consume",
        meterKey: "llm.tokens",
        occurredAt: new Date("2026-07-30T00:30:00.000Z"),
        position: 2,
        reference: {
          maskedValue: "request-***",
          type: "request",
          value: "request-secret",
          visibility: "masked",
        },
        refundableAmount: "29",
      },
      {
        allocations: [{ amount: "10", grantTransactionId: "grant-1" }],
        amount: "10",
        id: "reserve-1",
        kind: "reserve",
        meterKey: "llm.tokens",
        occurredAt: new Date("2026-07-30T00:40:00.000Z"),
        position: 3,
        reference: { type: "request", visibility: "denied" },
        reservationId: "reservation-active",
      },
    ],
  };
}

function createRefundSnapshot(): CreditOperationsSnapshot {
  const snapshot = createSnapshot();
  return {
    ...snapshot,
    balance: {
      ...snapshot.balance,
      available: "62",
      consumed: "28",
      ledgerPosition: 4,
    },
    grantLots: [
      snapshot.grantLots[0],
      {
        amount: "1",
        meterKeys: [],
        remaining: "1",
        status: "available",
        transactionId: "refund-1",
      },
    ],
    transactions: [
      snapshot.transactions[0],
      { ...snapshot.transactions[1], refundableAmount: "28" },
      snapshot.transactions[2],
      {
        allocations: [{ amount: "1", grantTransactionId: "grant-1" }],
        amount: "1",
        id: "refund-1",
        kind: "refund",
        occurredAt: new Date("2026-07-30T00:50:00.000Z"),
        position: 4,
        reference: { type: "support-case", visibility: "denied" },
        relatedTransactionId: "consume-1",
      },
    ],
  };
}

function createSettledReservationSnapshot(): CreditOperationsSnapshot {
  const snapshot = createSnapshot();
  return {
    ...snapshot,
    balance: { ...snapshot.balance, ledgerPosition: 5 },
    reservations: [
      snapshot.reservations[0],
      {
        allocations: [{ amount: "10", grantTransactionId: "grant-1" }],
        amount: "10",
        createdAt: new Date("2026-07-30T00:50:00.000Z"),
        id: "reservation-released",
        settledAt: new Date("2026-07-30T00:55:00.000Z"),
        status: "released",
      },
    ],
    transactions: [
      ...snapshot.transactions,
      {
        allocations: [{ amount: "10", grantTransactionId: "grant-1" }],
        amount: "10",
        id: "reserve-released",
        kind: "reserve",
        occurredAt: new Date("2026-07-30T00:50:00.000Z"),
        position: 4,
        reference: { type: "request", visibility: "denied" },
        reservationId: "reservation-released",
      },
      {
        allocations: [{ amount: "10", grantTransactionId: "grant-1" }],
        amount: "10",
        id: "release-1",
        kind: "release",
        occurredAt: new Date("2026-07-30T00:55:00.000Z"),
        position: 5,
        reference: { type: "request", visibility: "denied" },
        reservationId: "reservation-released",
      },
    ],
  };
}

function createPartiallyCommittedReservationSnapshot(): CreditOperationsSnapshot {
  const snapshot = createSnapshot();
  const settledAt = new Date("2026-07-30T00:50:00.000Z");
  return {
    ...snapshot,
    balance: {
      ...snapshot.balance,
      available: "65",
      consumed: "35",
      expiringSoon: "65",
      ledgerPosition: 5,
      reserved: "0",
    },
    grantLots: [{ ...snapshot.grantLots[0], remaining: "65" }],
    reservations: [
      {
        ...snapshot.reservations[0],
        release: undefined,
        settledAt,
        status: "committed",
      },
    ],
    transactions: [
      ...snapshot.transactions,
      {
        allocations: [{ amount: "6", grantTransactionId: "grant-1" }],
        amount: "6",
        id: "commit-1",
        kind: "commit",
        occurredAt: settledAt,
        position: 4,
        reference: { type: "request", visibility: "denied" },
        refundableAmount: "6",
        reservationId: "reservation-active",
      },
      {
        allocations: [{ amount: "4", grantTransactionId: "grant-1" }],
        amount: "4",
        id: "release-remainder",
        kind: "release",
        occurredAt: settledAt,
        position: 5,
        reference: { type: "request", visibility: "denied" },
        reservationId: "reservation-active",
      },
    ],
  };
}

function source(
  result: Awaited<ReturnType<CreditOperationsSource["load"]>>,
): CreditOperationsSource {
  return {
    requiredPermissions: ["credits:read"],
    load: vi.fn().mockResolvedValue(result),
  };
}

describe("credit operations contracts", () => {
  it("loads a position-consistent snapshot and derives only domain-eligible write actions", async () => {
    const snapshot = createSnapshot();
    const state = await loadCreditOperations({
      grantedPermissions: ["credits:read", "credits:write", "credits:refund", "credits:release"],
      source: source({ kind: "ready", snapshot }),
      tenantId: "tenant-1",
    });

    expect(state).toMatchObject({
      kind: "ready",
      snapshot: { balance: { ledgerPosition: 3 } },
    });
    if (state.kind !== "ready") return;
    expect(state.actions.map((action) => [action.kind, action.targetId])).toEqual([
      ["grant", "credit-account-1"],
      ["adjustment", "credit-account-1"],
      ["refund", "consume-1"],
      ["release-reservation", "reservation-active"],
    ]);
    expect(state.actions.every((action) => action.ledgerPosition === 3)).toBe(true);
    expect(state.actions.every((action) => action.possibleProblems.length > 0)).toBe(true);
  });

  it("fails closed before loading when read permission is missing", async () => {
    const creditSource = source({ kind: "ready", snapshot: createSnapshot() });
    const state = await loadCreditOperations({
      grantedPermissions: [],
      source: creditSource,
      tenantId: "tenant-1",
    });

    expect(state).toMatchObject({
      kind: "permission-denied",
      requiredPermissions: ["credits:read"],
    });
    expect(creditSource.load).not.toHaveBeenCalled();
  });

  it("keeps partial history and provider failure evidence distinct from empty state", async () => {
    const snapshot: CreditOperationsSnapshot = {
      ...createSnapshot(),
      history: { earliestPosition: 3, kind: "partial", reason: "Older pages were not loaded" },
      transactions: createSnapshot().transactions.slice(2),
    };
    const partial = await loadCreditOperations({
      grantedPermissions: ["credits:read"],
      source: source({
        kind: "problem",
        partial: snapshot,
        problem: { code: "credits-provider/history-page-failed", retryable: true },
      }),
      tenantId: "tenant-1",
    });
    const failed = await loadCreditOperations({
      grantedPermissions: ["credits:read"],
      source: {
        requiredPermissions: ["credits:read"],
        load: () => Promise.reject(new CreditOperationsValidationProblem("source", "failed")),
      },
      tenantId: "tenant-1",
    });

    expect(partial).toMatchObject({
      kind: "problem",
      partial: { kind: "ready", snapshot: { history: { kind: "partial" } } },
    });
    expect(failed).toMatchObject({
      kind: "problem",
      problem: { code: "admin-core/credit-operations-source-failed" },
    });
  });

  it("rejects cross-tenant, cross-account, and incomplete or inconsistent ledger evidence", async () => {
    await expect(
      loadCreditOperations({
        accountId: "credit-account-other",
        grantedPermissions: ["credits:read"],
        source: source({ kind: "ready", snapshot: createSnapshot() }),
        tenantId: "tenant-1",
      }),
    ).rejects.toBeInstanceOf(CreditOperationsValidationProblem);

    for (const snapshot of [
      {
        ...createSnapshot(),
        transactions: createSnapshot().transactions.slice(0, 2),
      },
      {
        ...createSnapshot(),
        transactions: [
          createSnapshot().transactions[0],
          createSnapshot().transactions[1],
          { ...createSnapshot().transactions[2], position: 2 },
        ],
      },
      {
        ...createSnapshot(),
        balance: { ...createSnapshot().balance, available: "62" },
      },
      {
        ...createSnapshot(),
        balance: {
          ...createSnapshot().balance,
          available: "961",
          lifetimeGranted: "1000",
        },
        grantLots: [{ ...createSnapshot().grantLots[0], amount: "1000", remaining: "961" }],
        transactions: [
          { ...createSnapshot().transactions[0], amount: "1000" },
          createSnapshot().transactions[1],
          createSnapshot().transactions[2],
        ],
      },
      {
        ...createSnapshot(),
        transactions: [
          createSnapshot().transactions[0],
          {
            ...createSnapshot().transactions[1],
            allocations: [{ amount: "28", grantTransactionId: "grant-1" }],
          },
          createSnapshot().transactions[2],
        ],
      },
    ]) {
      await expect(
        loadCreditOperations({
          grantedPermissions: ["credits:read"],
          source: source({ kind: "ready", snapshot }),
          tenantId: "tenant-1",
        }),
      ).rejects.toBeInstanceOf(CreditOperationsValidationProblem);
    }

    await expect(
      loadCreditOperations({
        grantedPermissions: ["credits:read"],
        source: source({
          kind: "ready",
          snapshot: {
            ...createSnapshot(),
            transactions: [
              {
                ...createSnapshot().transactions[0],
                position: 9,
              },
            ],
          },
        }),
        tenantId: "tenant-1",
      }),
    ).rejects.toBeInstanceOf(CreditOperationsValidationProblem);
  });

  it("rejects forged refund eligibility and invalid refund targets", async () => {
    for (const snapshot of [
      {
        ...createSnapshot(),
        transactions: [
          createSnapshot().transactions[0],
          { ...createSnapshot().transactions[1], refundableAmount: "30" },
          createSnapshot().transactions[2],
        ],
      },
      {
        ...createSnapshot(),
        transactions: [
          { ...createSnapshot().transactions[0], refundableAmount: "1" },
          createSnapshot().transactions[1],
          createSnapshot().transactions[2],
        ],
      },
      {
        ...createSnapshot(),
        transactions: [
          createSnapshot().transactions[0],
          { ...createSnapshot().transactions[1], refundableAmount: "29.0" },
          createSnapshot().transactions[2],
        ],
      },
      {
        ...createRefundSnapshot(),
        transactions: createRefundSnapshot().transactions.map((transaction) =>
          transaction.id === "refund-1"
            ? { ...transaction, relatedTransactionId: "grant-1" }
            : transaction,
        ),
      },
      {
        ...createRefundSnapshot(),
        transactions: createRefundSnapshot().transactions.map((transaction) =>
          transaction.id === "refund-1"
            ? {
                ...transaction,
                allocations: [{ amount: "1", grantTransactionId: "refund-1" }],
              }
            : transaction,
        ),
      },
    ]) {
      await expect(
        loadCreditOperations({
          grantedPermissions: ["credits:read"],
          source: source({ kind: "ready", snapshot }),
          tenantId: "tenant-1",
        }),
      ).rejects.toBeInstanceOf(CreditOperationsValidationProblem);
    }
  });

  it("rejects reservation status swaps and per-lot balance swaps even when aggregates reconcile", async () => {
    const settled = createSettledReservationSnapshot();
    const partiallyCommitted = createPartiallyCommittedReservationSnapshot();
    await expect(
      loadCreditOperations({
        grantedPermissions: ["credits:read"],
        source: source({ kind: "ready", snapshot: settled }),
        tenantId: "tenant-1",
      }),
    ).resolves.toMatchObject({ kind: "ready" });
    await expect(
      loadCreditOperations({
        grantedPermissions: ["credits:read"],
        source: source({ kind: "ready", snapshot: partiallyCommitted }),
        tenantId: "tenant-1",
      }),
    ).resolves.toMatchObject({ kind: "ready" });

    const [active, released] = settled.reservations;
    if (active === undefined || released === undefined) return;
    for (const snapshot of [
      {
        ...settled,
        reservations: [
          {
            ...active,
            release: undefined,
            settledAt: released.settledAt,
            status: "released" as const,
          },
          {
            ...released,
            release: { allowed: true, reason: "Forged active state" },
            settledAt: undefined,
            status: "active" as const,
          },
        ],
      },
      {
        ...createRefundSnapshot(),
        grantLots: [
          { ...createRefundSnapshot().grantLots[0], remaining: "60" },
          { ...createRefundSnapshot().grantLots[1], remaining: "2" },
        ],
      },
      {
        ...partiallyCommitted,
        reservations: partiallyCommitted.reservations.map((reservation) => ({
          ...reservation,
          settledAt: new Date("2026-07-30T00:51:00.000Z"),
        })),
        transactions: partiallyCommitted.transactions.map((transaction) =>
          transaction.kind === "release"
            ? { ...transaction, occurredAt: new Date("2026-07-30T00:51:00.000Z") }
            : transaction,
        ),
      },
      {
        ...partiallyCommitted,
        transactions: partiallyCommitted.transactions.map((transaction) =>
          transaction.position === 4
            ? { ...partiallyCommitted.transactions[4], position: 4 }
            : transaction.position === 5
              ? { ...partiallyCommitted.transactions[3], position: 5 }
              : transaction,
        ),
      },
    ]) {
      await expect(
        loadCreditOperations({
          grantedPermissions: ["credits:read"],
          source: source({ kind: "ready", snapshot }),
          tenantId: "tenant-1",
        }),
      ).rejects.toBeInstanceOf(CreditOperationsValidationProblem);
    }
  });

  it("rejects a refund that references a later consumption transaction", async () => {
    const snapshot = createRefundSnapshot();
    const [grant, , reserve, refund] = snapshot.transactions;
    if (grant === undefined || reserve === undefined || refund === undefined) {
      return;
    }
    await expect(
      loadCreditOperations({
        grantedPermissions: ["credits:read"],
        source: source({
          kind: "ready",
          snapshot: {
            ...snapshot,
            balance: { ...snapshot.balance, ledgerPosition: 5 },
            transactions: [
              grant,
              {
                allocations: [{ amount: "1", grantTransactionId: "grant-1" }],
                amount: "1",
                id: "consume-earlier",
                kind: "consume",
                occurredAt: new Date("2026-07-30T00:10:00.000Z"),
                position: 2,
                reference: { type: "request", visibility: "denied" },
                refundableAmount: "1",
              },
              {
                ...refund,
                occurredAt: new Date("2026-07-30T00:20:00.000Z"),
                position: 3,
                relatedTransactionId: "consume-later",
              },
              {
                allocations: [{ amount: "28", grantTransactionId: "grant-1" }],
                amount: "28",
                id: "consume-later",
                kind: "consume",
                occurredAt: new Date("2026-07-30T00:30:00.000Z"),
                position: 4,
                reference: { type: "request", visibility: "denied" },
                refundableAmount: "27",
              },
              { ...reserve, position: 5 },
            ],
          },
        }),
        tenantId: "tenant-1",
      }),
    ).rejects.toBeInstanceOf(CreditOperationsValidationProblem);
  });

  it("keeps source loading unfiltered so a complete snapshot is validated before local filtering", async () => {
    const creditSource = source({ kind: "ready", snapshot: createSnapshot() });
    const state = await loadCreditOperations({
      accountId: "credit-account-1",
      grantedPermissions: ["credits:read"],
      source: creditSource,
      tenantId: "tenant-1",
    });

    expect(creditSource.load).toHaveBeenCalledWith({
      accountId: "credit-account-1",
      signal: undefined,
      tenantId: "tenant-1",
    });
    expect(state.kind).toBe("ready");
    expect(
      filterCreditOperationsTransactions(createSnapshot().transactions, { kinds: ["consume"] }, []),
    ).toHaveLength(1);
  });

  it("masks sensitive references before filtering or rendering without permission", () => {
    const [transaction] = createSnapshot().transactions;
    if (transaction === undefined) return;
    expect(resolveCreditOperationsReference(transaction.reference, [])).toBeUndefined();
    expect(
      resolveCreditOperationsReference(transaction.reference, ["credits:references:read"]),
    ).toBe("campaign-secret");
    expect(
      filterCreditOperationsTransactions(
        createSnapshot().transactions,
        {
          semanticReference: "secret",
        },
        [],
      ),
    ).toEqual([]);
    expect(
      filterCreditOperationsTransactions(
        createSnapshot().transactions,
        { kinds: ["consume"], meterKey: "llm.tokens", semanticReference: "request-" },
        [],
      ),
    ).toHaveLength(1);
  });

  it("requires canonical amounts, future expiry, restrictions, actor, reason, and idempotency", () => {
    const request = requestFixture();
    expect(assertCreditOperationsActionRequest(request, generatedAt)).toBe(request);
    for (const field of ["actorId", "reason", "idempotencyKey"] as const) {
      expect(() =>
        assertCreditOperationsActionRequest({ ...request, [field]: " " }, generatedAt),
      ).toThrow(CreditOperationsValidationProblem);
    }
    expect(() =>
      assertCreditOperationsActionRequest(
        {
          ...request,
          input: { ...request.input, amount: "1.0" },
        },
        generatedAt,
      ),
    ).toThrow(CreditOperationsValidationProblem);
    expect(() =>
      assertCreditOperationsActionRequest(
        {
          ...request,
          input: {
            ...request.input,
            expiresAt: generatedAt,
          },
        },
        generatedAt,
      ),
    ).toThrow(CreditOperationsValidationProblem);
    expect(() =>
      assertCreditOperationsActionRequest(
        {
          ...request,
          input: { ...request.input, meterKeys: ["llm.tokens", "llm.tokens"] },
        },
        generatedAt,
      ),
    ).toThrow(CreditOperationsValidationProblem);
  });

  it("binds append-only execution to permission, target, ledger position, and declared Problems", async () => {
    const snapshot = createSnapshot();
    const [action] = createCreditOperationsActions(snapshot, ["credits:write"]);
    if (action === undefined) return;
    const executor: CreditOperationsMutationExecutor = {
      execute: vi.fn().mockResolvedValue({
        kind: "succeeded",
        ledgerPosition: 9,
        replayed: false,
        transactionIds: ["grant-2"],
      }),
    };

    await expect(
      executeCreditOperationsAction({
        action,
        executor,
        grantedPermissions: ["credits:write"],
        now: generatedAt,
        request: requestFixture(),
      }),
    ).resolves.toMatchObject({ kind: "succeeded", ledgerPosition: 9 });
    expect(executor.execute).toHaveBeenCalledOnce();

    await expect(
      executeCreditOperationsAction({
        action,
        executor,
        grantedPermissions: [],
        now: generatedAt,
        request: requestFixture(),
      }),
    ).rejects.toBeInstanceOf(CreditOperationsValidationProblem);

    const undeclaredExecutor: CreditOperationsMutationExecutor = {
      execute: vi.fn().mockResolvedValue({
        kind: "problem",
        problem: { code: "provider/secret-failure" },
        recovery: "change-input",
      }),
    };
    await expect(
      executeCreditOperationsAction({
        action,
        executor: undeclaredExecutor,
        grantedPermissions: ["credits:write"],
        now: generatedAt,
        request: requestFixture(),
      }),
    ).rejects.toBeInstanceOf(CreditOperationsValidationProblem);
  });

  it("mounts the same state as a Tenant 360 extension without adding a balance editor", () => {
    const state = {
      actions: createCreditOperationsActions(createSnapshot(), ["credits:write"]),
      grantedPermissions: ["credits:write"],
      kind: "ready" as const,
      snapshot: createSnapshot(),
    };
    const extension = createCreditOperationsTenantExtension(state);

    expect(extension).toMatchObject({
      contractId: "credits/tenant-operations",
      label: "Credits",
      slot: "tab",
      state,
    });
    expect(JSON.stringify(extension)).not.toContain("set balance");
  });
});

function requestFixture(): GrantActionRequest {
  return {
    accountId: "credit-account-1",
    action: "grant",
    actorId: "operator-1",
    expectedPosition: 3,
    idempotencyKey: "grant-recovery-1",
    input: {
      amount: "5.5",
      expiresAt: new Date("2026-08-30T00:00:00.000Z"),
      kind: "grant",
      meterKeys: ["llm.tokens"],
      source: "service-recovery",
    },
    reason: "Customer support recovery",
    reference: { id: "case-42", type: "support-case" },
    targetId: "credit-account-1",
    tenantId: "tenant-1",
  };
}
