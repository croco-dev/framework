import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createCreditOperationsActions, type CreditOperationsSnapshot } from "@croco/admin-core";

import { CreditOperationsConsole } from "../index";

const snapshot: CreditOperationsSnapshot = {
  accountId: "credit-account-1",
  balance: {
    accountId: "credit-account-1",
    available: "65",
    consumed: "25",
    expired: "0",
    expiringSoon: "65",
    expiringSoonBefore: new Date("2026-08-06T00:00:00.000Z"),
    ledgerPosition: 5,
    lifetimeGranted: "100",
    netAdjusted: "0",
    reserved: "10",
  },
  generatedAt: new Date("2026-07-30T00:00:00.000Z"),
  grantLots: [
    {
      amount: "100",
      expiresAt: new Date("2026-08-03T00:00:00.000Z"),
      meterKeys: ["llm.tokens"],
      remaining: "65",
      source: {
        maskedValue: "support-***",
        requiredPermissions: ["credits:references:read"],
        type: "support-case",
        value: "support-secret-42",
        visibility: "visible",
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
      createdAt: new Date("2026-07-30T01:00:00.000Z"),
      id: "reservation-active",
      release: { allowed: true, reason: "The reservation is still active" },
      status: "active",
    },
    {
      allocations: [{ amount: "40", grantTransactionId: "grant-1" }],
      amount: "40",
      createdAt: new Date("2026-07-30T00:30:00.000Z"),
      id: "reservation-committed",
      settledAt: new Date("2026-07-30T00:40:00.000Z"),
      status: "committed",
    },
  ],
  tenantId: "tenant-1",
  transactions: [
    {
      actorId: "operator-1",
      allocations: [],
      amount: "100",
      correlationId: "trace-1",
      id: "grant-1",
      kind: "grant",
      occurredAt: new Date("2026-07-30T00:00:00.000Z"),
      position: 1,
      reference: {
        maskedValue: "support-***",
        requiredPermissions: ["credits:references:read"],
        type: "support-case",
        value: "support-secret-42",
        visibility: "visible",
      },
    },
    {
      allocations: [{ amount: "40", grantTransactionId: "grant-1" }],
      amount: "40",
      id: "reserve-committed",
      kind: "reserve",
      meterKey: "llm.tokens",
      occurredAt: new Date("2026-07-30T00:30:00.000Z"),
      position: 2,
      reference: {
        maskedValue: "request-***",
        type: "usage-request",
        visibility: "masked",
      },
      reservationId: "reservation-committed",
    },
    {
      allocations: [{ amount: "25", grantTransactionId: "grant-1" }],
      amount: "25",
      id: "commit-1",
      kind: "commit",
      meterKey: "llm.tokens",
      occurredAt: new Date("2026-07-30T00:40:00.000Z"),
      position: 3,
      reference: {
        maskedValue: "request-***",
        type: "usage-request",
        visibility: "masked",
      },
      refundableAmount: "25",
      reservationId: "reservation-committed",
    },
    {
      allocations: [{ amount: "15", grantTransactionId: "grant-1" }],
      amount: "15",
      id: "release-partial-remainder",
      kind: "release",
      occurredAt: new Date("2026-07-30T00:40:00.000Z"),
      position: 4,
      reference: { type: "usage-request", visibility: "denied" },
      reservationId: "reservation-committed",
    },
    {
      allocations: [{ amount: "10", grantTransactionId: "grant-1" }],
      amount: "10",
      id: "reserve-active",
      kind: "reserve",
      meterKey: "llm.tokens",
      occurredAt: new Date("2026-07-30T01:00:00.000Z"),
      position: 5,
      reference: { type: "usage-request", visibility: "denied" },
      reservationId: "reservation-active",
    },
  ],
};

describe("CreditOperationsConsole", () => {
  it("renders reconciled balance, expiring credits, grant funding, and auditable actions", () => {
    const grantedPermissions = [
      "credits:read",
      "credits:write",
      "credits:refund",
      "credits:release",
    ];
    const markup = renderToStaticMarkup(
      createElement(CreditOperationsConsole, {
        onAction: () => undefined,
        selectedTransactionId: "commit-1",
        state: {
          actions: createCreditOperationsActions(snapshot, grantedPermissions),
          grantedPermissions,
          kind: "ready",
          snapshot,
        },
      }),
    );

    expect(markup).toContain('data-ledger-position="5"');
    expect(markup).toContain("Available</dt><dd>65");
    expect(markup).toContain("Reserved</dt><dd>10");
    expect(markup).toContain("Consumed</dt><dd>25");
    expect(markup).toContain("Expired</dt><dd>0");
    expect(markup).toContain("Expiring by 2026-08-06T00:00:00.000Z</dt><dd>65");
    expect(markup).toContain("25 funded by grant-1");
    expect(markup).toContain('data-action="grant"');
    expect(markup).toContain('data-action="refund"');
    expect(markup).toContain('data-action="release-reservation"');
    expect(markup).toContain('data-action="adjustment"');
    expect(markup).not.toContain("set balance");
  });

  it("never renders denied sensitive references and renders masked references only", () => {
    const markup = renderToStaticMarkup(
      createElement(CreditOperationsConsole, {
        state: {
          actions: [],
          grantedPermissions: ["credits:read"],
          kind: "ready",
          snapshot,
        },
      }),
    );

    expect(markup).not.toContain("support-secret-42");
    expect(markup).toContain("Permission required");
    expect(markup).toContain("request-***");
  });

  it("renders reverse links from consumptions and reservations to their settlement transactions", () => {
    const linkedSnapshot: CreditOperationsSnapshot = {
      ...snapshot,
      transactions: [
        ...snapshot.transactions,
        {
          allocations: [{ amount: "5", grantTransactionId: "grant-1" }],
          amount: "5",
          id: "refund-1",
          kind: "refund",
          occurredAt: new Date("2026-07-30T00:50:00.000Z"),
          position: 6,
          reference: { type: "support-case", visibility: "denied" },
          relatedTransactionId: "commit-1",
        },
      ],
    };
    const markup = renderToStaticMarkup(
      createElement(CreditOperationsConsole, {
        selectedReservationId: "reservation-committed",
        selectedTransactionId: "commit-1",
        state: {
          actions: [],
          grantedPermissions: ["credits:read"],
          kind: "ready",
          snapshot: linkedSnapshot,
        },
      }),
    );

    expect(markup).toContain("Refund transactions: refund-1");
    expect(markup).toContain("Settlement transactions: commit-1, release-partial-remainder");
  });

  it("renders complete filter controls and filters timeline and reservations", () => {
    const markup = renderToStaticMarkup(
      createElement(CreditOperationsConsole, {
        filter: {
          kinds: ["commit"],
          meterKey: "llm.tokens",
          reservationStatus: "committed",
          semanticReference: "request",
        },
        state: {
          actions: [],
          grantedPermissions: ["credits:read"],
          kind: "ready",
          snapshot,
        },
      }),
    );

    expect(markup).toContain('aria-label="Credit ledger filters"');
    expect(markup).toContain("Transaction kind");
    expect(markup).toContain("Semantic reference");
    expect(markup).toContain("From");
    expect(markup).toContain("To");
    expect(markup).toContain("Reservation status");
    expect(markup).toContain("#3 commit 25");
    expect(markup).not.toContain("#1 grant 100");
    expect(markup).toContain("reservation-committed: 40 committed");
    expect(markup).not.toContain("reservation-active: 10 active");
  });

  it("round-trips datetime-local filters in the operator timezone", () => {
    const previousTimezone = process.env.TZ;
    process.env.TZ = "Asia/Seoul";
    try {
      const markup = renderToStaticMarkup(
        createElement(CreditOperationsConsole, {
          filter: { from: new Date("2026-07-30T00:00:00.000Z") },
          state: {
            actions: [],
            grantedPermissions: ["credits:read"],
            kind: "ready",
            snapshot,
          },
        }),
      );
      expect(markup).toContain('type="datetime-local" value="2026-07-30T09:00"');
    } finally {
      if (previousTimezone === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = previousTimezone;
      }
    }
  });

  it.each([
    {
      expected: 'data-state="loading"',
      state: { accountId: "credit-account-1", kind: "loading" as const, tenantId: "tenant-1" },
    },
    {
      expected: 'data-state="empty"',
      state: { kind: "empty" as const, message: "No wallet", tenantId: "tenant-1" },
    },
    {
      expected: 'data-state="permission-denied"',
      state: {
        grantedPermissions: [],
        kind: "permission-denied" as const,
        problem: { code: "admin-core/credit-operations-permission-denied" },
        requiredPermissions: ["credits:read"],
        tenantId: "tenant-1",
      },
    },
    {
      expected: 'data-state="problem"',
      state: {
        kind: "problem" as const,
        problem: { code: "credits-provider/store-failed" },
        tenantId: "tenant-1",
      },
    },
    {
      expected: 'data-state="stale"',
      state: {
        actualPosition: 6,
        expectedPosition: 5,
        grantedPermissions: ["credits:read"],
        kind: "stale" as const,
        problem: { code: "credits-core/stale-ledger-position" },
        snapshot,
        tenantId: "tenant-1",
      },
    },
  ])("renders explicit $expected state", ({ expected, state }) => {
    expect(renderToStaticMarkup(createElement(CreditOperationsConsole, { state }))).toContain(
      expected,
    );
  });

  it("keeps partial history visible without presenting it as complete", () => {
    const partialSnapshot: CreditOperationsSnapshot = {
      ...snapshot,
      history: {
        earliestPosition: 3,
        kind: "partial",
        reason: "The oldest page failed to load",
      },
      transactions: snapshot.transactions.slice(2),
    };
    const markup = renderToStaticMarkup(
      createElement(CreditOperationsConsole, {
        state: {
          kind: "problem",
          partial: {
            actions: [],
            grantedPermissions: ["credits:read"],
            kind: "ready",
            snapshot: partialSnapshot,
          },
          problem: { code: "credits-provider/history-page-failed" },
          tenantId: "tenant-1",
        },
      }),
    );

    expect(markup).toContain('data-history="partial"');
    expect(markup).toContain("Partial history from position 3");
    expect(markup).not.toContain("Complete ledger history is shown");
    expect(markup.match(/role="alert"/g)).toHaveLength(1);
  });

  it("preserves semantic reference permissions while rendering a stale snapshot", () => {
    const markup = renderToStaticMarkup(
      createElement(CreditOperationsConsole, {
        state: {
          actualPosition: 6,
          expectedPosition: 5,
          grantedPermissions: ["credits:read", "credits:references:read"],
          kind: "stale",
          problem: { code: "credits-core/stale-ledger-position" },
          snapshot,
          tenantId: "tenant-1",
        },
      }),
    );

    expect(markup).toContain("support-secret-42");
  });

  it("omits refund and release controls when the domain snapshot does not permit them", () => {
    const unsafe: CreditOperationsSnapshot = {
      ...snapshot,
      reservations: snapshot.reservations.map((reservation) => ({
        ...reservation,
        release: undefined,
      })),
      transactions: snapshot.transactions.map((transaction) => ({
        ...transaction,
        refundableAmount: undefined,
      })),
    };
    const actions = createCreditOperationsActions(unsafe, [
      "credits:write",
      "credits:refund",
      "credits:release",
    ]);
    const markup = renderToStaticMarkup(
      createElement(CreditOperationsConsole, {
        onAction: () => undefined,
        state: {
          actions,
          grantedPermissions: ["credits:write", "credits:refund", "credits:release"],
          kind: "ready",
          snapshot: unsafe,
        },
      }),
    );

    expect(markup).not.toContain('data-action="refund"');
    expect(markup).not.toContain('data-action="release-reservation"');
    expect(markup).toContain('data-action="grant"');
    expect(markup).toContain('data-action="adjustment"');
  });
});
