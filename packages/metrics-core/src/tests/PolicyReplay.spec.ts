import { describe, expect, it } from "vitest";
import {
  createPolicyReplayReport,
  importPolicyReplayReport,
  PolicyReplayProblem,
  replayPolicy,
  serializePolicyReplayReport,
  validatePolicyReplayInput,
} from "../libs/replay/PolicyReplay";
import type { PolicyReplayInput, ReplayRow } from "../libs/replay/PolicyReplay";

const at = (hour: number) => `2026-01-01T${String(hour).padStart(2, "0")}:00:00.000Z`;
function fixture(): PolicyReplayInput {
  return {
    scope: { appId: "app", environment: "test", tenantId: "tenant", subjectKind: "user" },
    snapshotRef: "campaign:1",
    currency: "KRW",
    unit: "won",
    observationWindow: { start: at(0), end: "2026-01-02T00:00:00.000Z", completed: true },
    attributionWindowMs: 6 * 3600000,
    definition: {
      revision: "v1",
      existingPredicate: { op: "all" },
      newPredicate: { op: "eq", trait: "eligible", value: true },
      unknownPolicy: "preserve",
      scenarios: ["click-only", "post-send-inclusive"],
      changes: ["filter"],
    },
    rows: Array.from({ length: 100 }, (_, i) => ({
      subjectId: `u${i}`,
      atDecision: at(1),
      traitsAtDecision: { eligible: i >= 20 },
      dispatch: { dispatchId: `m${i}`, at: at(2) },
      touchpoints: [],
      outcomes: [],
      cost: { amount: 10, currency: "KRW" },
    })),
  };
}
function withRows(rows: readonly ReplayRow[]): PolicyReplayInput {
  return { ...fixture(), rows };
}
describe("PolicyReplay", () => {
  it("compares 100 historical subjects and 20 observed sends costing 200 without causal claims", () => {
    const result = replayPolicy(fixture());
    expect(result).toMatchObject({
      baselineN: 100,
      keptN: 80,
      excludedN: 20,
      unknownN: 0,
      observedCostSaved: { status: "available", amount: 200 },
    });
    expect(result.limitations.join(" ")).toContain("do not identify causal");
    expect(Object.isFrozen(result)).toBe(true);
  });
  it("keeps unknown histories distinct while changing effective populations and definition hash", async () => {
    const base = fixture();
    const input = withRows([{ subjectId: "unknown", atDecision: at(1) }]);
    const preserve = await createPolicyReplayReport(input);
    const exclude = await createPolicyReplayReport({
      ...input,
      definition: { ...base.definition, revision: "v2", unknownPolicy: "exclude" },
    });
    expect(preserve.result).toMatchObject({
      unknownN: 1,
      effectiveKeptN: 1,
      effectiveExcludedN: 0,
      observedCostSaved: { status: "unavailable", amount: null },
    });
    expect(exclude.result).toMatchObject({ unknownN: 1, effectiveKeptN: 0, effectiveExcludedN: 1 });
    expect(exclude.definitionHash).not.toBe(preserve.definitionHash);
    expect(() =>
      validatePolicyReplayInput({ ...input, rows: [{ ...input.rows[0], currentAuth: true }] }),
    ).toThrow(PolicyReplayProblem);
  });
  it("separates visits and single-credits duplicate events across messages", () => {
    const row: ReplayRow = {
      subjectId: "u",
      atDecision: at(1),
      traitsAtDecision: { eligible: false },
      dispatch: { dispatchId: "m", at: at(2) },
      touchpoints: [{ kind: "click", at: at(4) }],
      outcomes: [
        { kind: "visit", eventId: "pre", at: at(1) },
        { kind: "visit", eventId: "nonclick", at: at(3) },
        { kind: "visit", eventId: "clicked", at: at(5) },
        { kind: "financial", eventId: "paid", at: at(5), amount: 100, currency: "KRW" },
      ],
    };
    const nonclick: ReplayRow = {
      ...row,
      subjectId: "v",
      dispatch: { dispatchId: "other", at: at(2) },
      touchpoints: [],
      outcomes: [
        { kind: "visit", eventId: "vvisit", at: at(3) },
        { kind: "financial", eventId: "vpaid", at: at(3), amount: 50, currency: "KRW" },
      ],
    };
    const result = replayPolicy(
      withRows([row, { ...row, dispatch: { dispatchId: "second", at: at(2) } }, nonclick]),
    );
    expect(result.observedVisits).toEqual({
      preSendN: 1,
      postClickN: 1,
      postSendNonClickN: 2,
      postSendUnknownClickN: 0,
    });
    expect(result.scenarioValues).toEqual([
      {
        scenario: "click-only",
        status: "available",
        excludedVisitSubjectN: 1,
        excludedFinancialEventN: 1,
        excludedObservedRevenue: 100,
      },
      {
        scenario: "post-send-inclusive",
        status: "available",
        excludedVisitSubjectN: 2,
        excludedFinancialEventN: 2,
        excludedObservedRevenue: 150,
      },
    ]);
    expect(result.observedCostSaved).toMatchObject({ status: "unavailable", amount: null });
  });
  it("marks missing sources and incomplete periods explicitly", () => {
    const base = fixture();
    const result = replayPolicy({
      ...base,
      observationWindow: { ...base.observationWindow, completed: false },
      rows: [
        {
          subjectId: "u",
          atDecision: at(1),
          traitsAtDecision: { eligible: false },
          dispatch: { dispatchId: "m", at: at(2) },
        },
      ],
    });
    expect(result.scenarioValues.every((s) => s.status === "unavailable")).toBe(true);
    expect(result.sourceCoverage).toMatchObject({ touchpointsN: 0, outcomesN: 0 });
    expect(result.limitations.join(" ")).toContain("incomplete");
  });
  it("reports partial costs without imputing missing prices", () => {
    const base = fixture();
    const result = replayPolicy({
      ...base,
      rows: [
        { ...base.rows[0] },
        {
          subjectId: "x",
          atDecision: at(1),
          traitsAtDecision: { eligible: false },
          dispatch: { dispatchId: "x", at: at(2) },
        },
      ],
    });
    expect(result.observedCostSaved).toMatchObject({
      status: "partial",
      amount: 10,
      observedDispatchN: 1,
      totalDispatchN: 2,
    });
  });
  it("enforces attribution boundaries and flags simultaneous policy changes", () => {
    const base = fixture();
    const result = replayPolicy({
      ...base,
      definition: { ...base.definition, changes: ["filter", "timing", "content"] },
      rows: [
        {
          subjectId: "u",
          atDecision: at(1),
          traitsAtDecision: { eligible: false },
          dispatch: { dispatchId: "m", at: at(2) },
          touchpoints: [],
          outcomes: [
            { kind: "financial", eventId: "boundary", at: at(8), amount: 4, currency: "KRW" },
            { kind: "financial", eventId: "late", at: at(9), amount: 10, currency: "KRW" },
          ],
        },
      ],
    });
    expect(result.scenarioValues[1]?.excludedObservedRevenue).toBe(4);
    expect(result.limitations.join(" ")).toContain("not a simple filter-removal");
  });
  it.each([
    (input: PolicyReplayInput) => ({ ...input, scope: { ...input.scope, tenantId: "" } }),
    (input: PolicyReplayInput) => ({ ...input, attributionWindowMs: 0 }),
    (input: PolicyReplayInput) => ({
      ...input,
      rows: [{ ...input.rows[0], cost: { amount: 10, currency: "USD" } }],
    }),
    (input: PolicyReplayInput) => ({
      ...input,
      rows: [{ ...input.rows[0], dispatch: { dispatchId: "m", at: at(0) } }],
    }),
    (input: PolicyReplayInput) => ({
      ...input,
      rows: [{ ...input.rows[0], touchpoints: [{ kind: "click", at: at(1) }] }],
    }),
    (input: PolicyReplayInput) => ({
      ...input,
      rows: [{ ...input.rows[0], atDecision: input.observationWindow.end }],
    }),
    (input: PolicyReplayInput) => ({
      ...input,
      rows: [{ ...input.rows[0], traitsAtDecision: { eligible: 1 } }],
    }),
    (input: PolicyReplayInput) => ({
      ...input,
      definition: { ...input.definition, newPredicate: { op: "sql", query: "select true" } },
    }),
  ])("rejects contradictory contracts with a stable Problem", (mutate) => {
    expect(() => replayPolicy(mutate(fixture()) as PolicyReplayInput)).toThrow(PolicyReplayProblem);
  });
  it("rejects conflicting unique events and multiple decision histories per subject", () => {
    const base = fixture(),
      first = base.rows[0] as ReplayRow;
    expect(() =>
      replayPolicy(
        withRows([
          first,
          { ...first, atDecision: at(2), dispatch: { dispatchId: "different", at: at(3) } },
        ]),
      ),
    ).toThrow(PolicyReplayProblem);
    expect(() =>
      replayPolicy(
        withRows([
          {
            ...first,
            outcomes: [
              { kind: "visit", eventId: "same", at: at(3) },
              { kind: "visit", eventId: "same", at: at(4) },
            ],
          },
        ]),
      ),
    ).toThrow(PolicyReplayProblem);
  });
  it("validates and freezes detached imports and rejects report tampering", async () => {
    const original = fixture();
    const input = validatePolicyReplayInput(original);
    expect(input).not.toBe(original);
    expect(Object.isFrozen(input.rows[0])).toBe(true);
    const report = await createPolicyReplayReport(input);
    expect(await importPolicyReplayReport(serializePolicyReplayReport(report))).toEqual(report);
    await expect(
      importPolicyReplayReport({ ...report, result: { ...report.result, excludedN: 0 } }),
    ).rejects.toThrow(PolicyReplayProblem);
    await expect(importPolicyReplayReport("{")).rejects.toThrow(PolicyReplayProblem);
  });
});

describe("PolicyReplay review regressions", () => {
  it("does not classify unknown click history as observed non-click visits", () => {
    const input = fixture();
    const row: ReplayRow = {
      subjectId: "u",
      atDecision: at(1),
      traitsAtDecision: { eligible: false },
      dispatch: { dispatchId: "send-u", at: at(2) },
      outcomes: [{ kind: "visit", eventId: "visit-u", at: at(3) }],
    };
    expect(replayPolicy({ ...input, rows: [row] }).observedVisits.postSendNonClickN).toBe(0);
    expect(
      replayPolicy({ ...input, rows: [{ ...row, touchpoints: [] }] }).observedVisits
        .postSendNonClickN,
    ).toBe(1);
  });
  it.each([
    { unknownPolicy: ["preserve"] },
    { scenarios: [["click-only"]] },
    { changes: [["filter"]] },
    { newPredicate: { op: ["eq"], trait: "eligible", value: true } },
  ])("rejects array-valued enum input %j", (patch) => {
    const input = fixture();
    expect(() =>
      validatePolicyReplayInput({ ...input, definition: { ...input.definition, ...patch } }),
    ).toThrow(PolicyReplayProblem);
  });
  it("marks a completed source window partial when attribution extends beyond it", () => {
    const input = fixture();
    const result = replayPolicy({
      ...input,
      rows: [
        {
          subjectId: "u",
          atDecision: at(1),
          traitsAtDecision: { eligible: false },
          dispatch: { dispatchId: "late-send", at: at(23) },
          touchpoints: [],
          outcomes: [],
        },
      ],
    });
    expect(result.scenarioValues.map((s) => s.status)).toEqual(["partial", "partial"]);
  });
});

it("keeps inclusive attribution endpoints partial at an exclusive observation boundary", () => {
  const input = fixture();
  const result = replayPolicy({
    ...input,
    rows: [
      {
        subjectId: "u",
        atDecision: at(1),
        traitsAtDecision: { eligible: false },
        dispatch: { dispatchId: "boundary-send", at: at(18) },
        touchpoints: [],
        outcomes: [],
      },
    ],
  });
  expect(result.scenarioValues.map((s) => s.status)).toEqual(["partial", "partial"]);
});

it.each(["traitsAtDecision", "dispatch", "cost", "touchpoints", "outcomes"])(
  "rejects an explicitly undefined optional %s with the replay Problem",
  (field) => {
    expect(() =>
      validatePolicyReplayInput({
        ...fixture(),
        rows: [{ subjectId: "u", atDecision: at(1), [field]: undefined }],
      }),
    ).toThrow(PolicyReplayProblem);
  },
);

it("rejects sparse declarative conditions with the replay Problem", () => {
  const input = fixture();
  const conditions: unknown[] = [];
  conditions.length = 1;
  expect(() =>
    validatePolicyReplayInput({
      ...input,
      definition: { ...input.definition, newPredicate: { op: "and", conditions } },
    }),
  ).toThrow(PolicyReplayProblem);
});
