import { describe, expect, it } from "vitest";
import {
  compareAssignedOutcomes,
  hashAssignedOutcomeInput,
} from "../libs/outcome/compareAssignedOutcomes";
import { OutcomeLedgerNormalizer, OUTCOME_KINDS } from "../libs/outcome/OutcomeLedgerNormalizer";
import { OutcomeProblem } from "../libs/outcome/OutcomeProblem";
import type { AssignedOutcomeInput, MoneyEvent, OutcomeKind } from "../libs/outcome/types";

const scope = { app: "shop", environment: "test", tenant: "tenant" };
const time = "2026-01-01T00:00:00Z";
const late = "2026-02-01T00:00:00Z";
function event(
  eventId: string,
  subject: string | null,
  kind: OutcomeKind,
  amountMinor: string,
  extra: Partial<MoneyEvent> = {},
): MoneyEvent {
  return {
    scope,
    source: "ledger",
    eventId,
    subject,
    kind,
    amountMinor,
    currency: "USD",
    occurredAt: time,
    observedAt: time,
    valuationKind: kind === "noncash_grant" ? "face_value" : "cash",
    ...extra,
  };
}
function input(events: MoneyEvent[] = []): AssignedOutcomeInput {
  return {
    assignmentSnapshot: {
      id: "assignment-v1",
      scope,
      unit: "person",
      arms: ["control", "test"],
      assignments: ["control", "test"].flatMap((arm) =>
        Array.from({ length: 100 }, (_, index) => ({ subject: `${arm}-${index}`, arm })),
      ),
    },
    events,
    cutoff: { effectiveAt: time, knownAt: time },
    revision: "1",
    metricDefinitionVersion: "assigned-net-v1",
    inputHash: "input-hash",
    definitionHash: "definition-hash",
    currencies: ["USD"],
    sources: ["ledger"],
    baselineArm: "control",
    costCompleteness: ["control", "test"].flatMap((arm) =>
      OUTCOME_KINDS.map((kind) => ({
        arm,
        source: "ledger",
        kind,
        currency: "USD",
        status: "complete" as const,
      })),
    ),
    retention: ["control", "test"].flatMap((arm) =>
      Array.from({ length: 100 }, (_, index) => ({
        subject: `${arm}-${index}`,
        retained: index < 80,
      })),
    ),
  };
}
const golden = () =>
  input([
    event("c-pay", "control-0", "payment", "100000"),
    event("c-ref", "control-0", "refund", "20000", { relatedPaymentId: "c-pay" }),
    event("t-pay", "test-0", "payment", "110000"),
    event("t-ref", "test-0", "refund", "15000", { relatedPaymentId: "t-pay" }),
    event("t-cashback", "test-0", "cashback", "20000"),
    event("t-cost", "test-0", "direct_contact_cost", "1000"),
  ]);

describe("Assigned outcomes", () => {
  it("uses all assigned units for exact per-person amounts and observed difference", () => {
    const result = compareAssignedOutcomes(golden());
    expect(result.byCurrency[0].arms.map((arm) => arm.perUnit)).toEqual([
      { numerator: "800", denominator: "1" },
      { numerator: "740", denominator: "1" },
    ]);
    expect(result.byCurrency[0].delta[0].value).toEqual({ numerator: "-60", denominator: "1" });
    expect(result.byCurrency[0].arms[0].retentionRate).toEqual({
      numerator: "4",
      denominator: "5",
    });
    expect(result.byCurrency[0].arms[0].refundRate).toEqual({ numerator: "1", denominator: "1" });
    expect(result.quality).toBe("complete");
    expect(() => JSON.stringify(result)).not.toThrow();
  });
  it("deduplicates payment and refund retransmission but rejects conflicting payloads even beyond cutoff", () => {
    const data = golden();
    data.events = [...data.events, data.events[0], data.events[1]];
    expect(compareAssignedOutcomes(data).counts.duplicates).toBe(2);
    data.events = [...data.events, { ...data.events[0], amountMinor: "100001", observedAt: late }];
    expect(() => compareAssignedOutcomes(data)).toThrow(OutcomeProblem);
  });
  it("replays late refunds independently at effective and known cutoffs", () => {
    const data = input([
      event("p", "control-0", "payment", "100"),
      event("r", "control-0", "refund", "20", { relatedPaymentId: "p", observedAt: late }),
    ]);
    expect(compareAssignedOutcomes(data).byCurrency[0].arms[0].netMinor).toBe("100");
    data.cutoff.knownAt = late;
    data.revision = "2";
    expect(compareAssignedOutcomes(data).byCurrency[0].arms[0].netMinor).toBe("80");
    data.events = data.events.map((row) =>
      row.kind === "refund" ? { ...row, occurredAt: late } : row,
    );
    expect(compareAssignedOutcomes(data).byCurrency[0].arms[0].netMinor).toBe("100");
  });
  it("replaces a corrected refund once while preserving historical reports", () => {
    const data = input([
      event("p", "control-0", "payment", "100"),
      event("r", "control-0", "refund", "20", { relatedPaymentId: "p" }),
      event("r2", "control-0", "refund", "10", {
        relatedPaymentId: "p",
        observedAt: late,
        correctionOf: { source: "ledger", eventId: "r" },
      }),
    ]);
    expect(compareAssignedOutcomes(data).byCurrency[0].arms[0].netMinor).toBe("80");
    data.cutoff.knownAt = late;
    expect(compareAssignedOutcomes(data).byCurrency[0].arms[0].netMinor).toBe("90");
    expect(compareAssignedOutcomes(data).counts.superseded).toBe(1);
  });
  it("preserves payment references after payment correction", () => {
    const data = input([
      event("p", "control-0", "payment", "100"),
      event("p2", "control-0", "payment", "120", {
        observedAt: late,
        correctionOf: { source: "ledger", eventId: "p" },
      }),
      event("r", "control-0", "refund", "20", { relatedPaymentId: "p" }),
    ]);
    data.cutoff.knownAt = late;
    expect(compareAssignedOutcomes(data).byCurrency[0].arms[0].netMinor).toBe("100");
  });
  it("separates noncash face value and preserves huge integer and fractional results", () => {
    const data = input([
      event("p", "control-0", "payment", "900719925474099312345"),
      event("g", "control-0", "noncash_grant", "5000"),
    ]);
    const arm = compareAssignedOutcomes(data).byCurrency[0].arms[0];
    expect(arm.netMinor).toBe("900719925474099312345");
    expect(arm.components.noncash_grant).toBe("5000");
    expect(arm.perUnit).toEqual({ numerator: "180143985094819862469", denominator: "20" });
  });
  it("keeps mixed currencies in separate reports", () => {
    const data = input([
      event("usd", "control-0", "payment", "100"),
      event("eur", "control-0", "payment", "200", { currency: "EUR" }),
    ]);
    data.currencies = ["USD", "EUR"];
    data.costCompleteness = [
      ...data.costCompleteness,
      ...data.costCompleteness.map((row) => ({ ...row, currency: "EUR" })),
    ];
    expect(compareAssignedOutcomes(data).byCurrency.map((row) => row.arms[0].netMinor)).toEqual([
      "100",
      "200",
    ]);
  });
  it("rejects missing subjects, unassigned purchases, and orphan refunds with counts", () => {
    const data = input([
      event("missing", null, "payment", "5"),
      event("unassigned", "outsider", "payment", "10"),
      event("orphan", "control-0", "refund", "20"),
    ]);
    const result = compareAssignedOutcomes(data);
    expect(result.counts.rejected).toBe(3);
    expect(result.diagnostics.map((row) => row.code)).toEqual(
      expect.arrayContaining(["missing_subject", "unassigned_event", "orphan_refund"]),
    );
    expect(result.byCurrency[0].arms[0].perUnit).toBeNull();
  });
  it("does not claim complete zero for missing costs or pending refunds", () => {
    for (const status of ["missing", "pending"] as const) {
      const data = input();
      data.costCompleteness = data.costCompleteness.map((row) =>
        row.kind === "refund" ? { ...row, status, pendingCount: 1 } : row,
      );
      const result = compareAssignedOutcomes(data);
      expect(result.byCurrency[0].arms[0]).toMatchObject({
        netMinor: "0",
        complete: false,
        perUnit: null,
      });
      expect(result.byCurrency[0].delta[0].value).toBeNull();
    }
    const data = input();
    data.costCompleteness = [];
    expect(compareAssignedOutcomes(data).quality).toBe("partial");
  });
  it("includes empty arms with null denominators and unknown retention explicitly", () => {
    const data = input();
    data.assignmentSnapshot.assignments = [];
    data.retention = [];
    expect(compareAssignedOutcomes(data).byCurrency[0].arms[0].perUnit).toBeNull();
    expect(compareAssignedOutcomes(data).diagnostics).toContainEqual({
      code: "zero_denominator",
      arm: "control",
      currency: "USD",
    });
    const populated = input();
    delete populated.retention;
    expect(compareAssignedOutcomes(populated).byCurrency[0].arms[0].retentionRate).toBeNull();
  });
  it.each([
    { amountMinor: "1.2" },
    { amountMinor: "-1" },
    { amountMinor: "01" },
    { currency: "usd" },
    { occurredAt: "2026-02-30T00:00:00Z" },
    { scope: { ...scope, tenant: "" } },
    { scope: { ...scope, tenant: "other" } },
  ])("fails malformed event %j", (extra) => {
    expect(() =>
      compareAssignedOutcomes(input([event("p", "control-0", "payment", "1", extra)])),
    ).toThrow(OutcomeProblem);
  });
  it("enforces assignment and event bounds before calculation", () => {
    expect(() => compareAssignedOutcomes({ ...input(), maxAssignments: 1 })).toThrow(
      OutcomeProblem,
    );
    expect(() => compareAssignedOutcomes({ ...golden(), maxEvents: 1 })).toThrow(OutcomeProblem);
    expect(() =>
      new OutcomeLedgerNormalizer().normalize([], {
        scope,
        cutoff: { effectiveAt: time, knownAt: time },
        maxEvents: 0,
      }),
    ).toThrow(OutcomeProblem);
  });
  it("hashes provenance and exact input content deterministically", async () => {
    const data = golden();
    const hash = await hashAssignedOutcomeInput(data);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(await hashAssignedOutcomeInput({ ...data, inputHash: hash })).toBe(hash);
    expect(await hashAssignedOutcomeInput({ ...data, revision: "2" })).not.toBe(hash);
    expect(await hashAssignedOutcomeInput({ ...data, definitionHash: "other" })).not.toBe(hash);
  });
});
