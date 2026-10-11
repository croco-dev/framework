import { describe, expect, it } from "vitest";
import {
  calculateActivationCandidates,
  hashActivationInputs,
} from "../libs/activation/ActivationCandidates";
import type { ActivationDefinition, ActivationRow } from "../libs/activation/ActivationCandidates";

const definition: ActivationDefinition = {
  id: "activation",
  version: 1,
  subjectKind: "user",
  cohortPolicy: "new",
  timezone: "UTC",
  unit: "subjects",
  sourceRevisions: { signup: "v1" },
  sourceRunRef: "run-1",
  maxRows: 1000,
  maxCandidates: 10,
  minSupport: 0.1,
  windows: [{ id: "first", fromMs: 0, toMs: 1000 }],
  outcomeWindow: { fromMs: 1000, toMs: 2000 },
  candidates: [
    { id: "action", actionId: "publish", windowId: "first", threshold: 1, countMode: "frequency" },
  ],
};
function row(id: number, count: number, outcome: boolean | null): ActivationRow {
  return {
    subjectId: `subject-${id}`,
    anchorAt: "2026-01-01T00:00:00.000Z",
    cohort: "new",
    actionCountsByWindow: { first: { publish: count } },
    outcome,
    outcomeWindow: definition.outcomeWindow,
    completeThrough: "2026-01-01T00:00:02.000Z",
  };
}
const golden = Array.from({ length: 100 }, (_, id) =>
  row(id, id < 40 ? 1 : 0, id < 30 || (id >= 40 && id < 60)),
);

describe("activation candidates", () => {
  it("calculates DO=40 RE=30 NO=20 without selecting a best candidate or exposing subjects", () => {
    const report = calculateActivationCandidates(golden, definition);
    expect(report.candidates[0]).toMatchObject({
      DO: 40,
      RE: 30,
      NO: 20,
      eligibleN: 100,
      precision: { value: 0.75 },
      coverage: { value: 0.6 },
      noRedo: { value: 0.5 },
      support: { value: 0.4 },
      achievementCurve: { status: "unsupported", reason: "missingVerifiedAchievementTimes" },
    });
    expect(JSON.stringify(report)).not.toContain("subject-");
  });
  it("reports the precision and coverage tradeoff for all thresholds and flags low support", () => {
    const rows = [row(1, 3, true), row(2, 1, true), row(3, 1, false), row(4, 0, true)];
    const results = calculateActivationCandidates(rows, {
      ...definition,
      minSupport: 0.5,
      candidates: [
        ...definition.candidates,
        { ...definition.candidates[0]!, id: "strict", threshold: 3 },
      ],
    }).candidates;
    expect(results[0]).toMatchObject({
      precision: { value: 2 / 3 },
      coverage: { value: 2 / 3 },
      passesMinSupport: true,
    });
    expect(results[1]).toMatchObject({
      precision: { value: 1 },
      coverage: { value: 1 / 3 },
      passesMinSupport: false,
    });
  });
  it("accounts for missing outcomes, incomplete windows, missing counts, and cohort exclusions", () => {
    const rows: ActivationRow[] = [
      row(1, 1, true),
      row(2, 1, null),
      { ...row(3, 1, true), completeThrough: "2026-01-01T00:00:01.999Z" },
      { ...row(4, 1, true), actionCountsByWindow: {} },
      { ...row(5, 1, true), cohort: "returning" },
    ];
    const results = calculateActivationCandidates(rows, {
      ...definition,
      cohortPolicy: "separate",
    }).candidates;
    expect(results[0]).toMatchObject({
      eligibleN: 1,
      excluded: { missingOutcome: 1, incompleteObservation: 1, missingCount: 1, cohort: 1 },
    });
    expect(results[1]).toMatchObject({ cohort: "returning", eligibleN: 1, DO: 1 });
  });
  it("returns explicit null reasons on zero denominators", () => {
    expect(calculateActivationCandidates([], definition).candidates[0]).toMatchObject({
      precision: { value: null, zeroDenominatorReason: "noAchievedSubjects" },
      coverage: { value: null, zeroDenominatorReason: "noRetainedSubjects" },
      support: { value: null, zeroDenominatorReason: "noEligibleSubjects" },
      passesMinSupport: false,
    });
  });
  it("uses nested active-day counts and verified threshold-specific times for curves", () => {
    const rows: ActivationRow[] = [
      {
        ...row(1, 0, true),
        activeDaysByWindow: { first: { publish: 1 } },
        achievementAtByCandidate: { action: "2026-01-01T00:00:00.500Z" },
      },
      { ...row(2, 0, false), activeDaysByWindow: { first: { publish: 0 } } },
    ];
    expect(
      calculateActivationCandidates(rows, {
        ...definition,
        candidates: [{ ...definition.candidates[0]!, countMode: "activeDays" }],
      }).candidates[0],
    ).toMatchObject({
      DO: 1,
      achievementCurve: {
        status: "available",
        points: [{ elapsedMs: 500, achieved: 1, fraction: 0.5 }],
      },
    });
  });
  it.each([-1, 0.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid counts %s instead of dropping rows",
    (count) => {
      expect(() => calculateActivationCandidates([row(1, count, true)], definition)).toThrow(
        "count must be a safe integer",
      );
    },
  );
  it("rejects future/overlapping windows, invalid timestamps, duplicate subjects, inconsistent outcomes and unsupported counts", () => {
    expect(() =>
      calculateActivationCandidates([], {
        ...definition,
        windows: [{ id: "first", fromMs: 0, toMs: 1001 }],
      }),
    ).toThrow("action windows");
    expect(() =>
      calculateActivationCandidates([], {
        ...definition,
        windows: [{ id: "first", fromMs: -1, toMs: 1000 }],
      }),
    ).toThrow("window.fromMs");
    expect(() =>
      calculateActivationCandidates([{ ...row(1, 1, true), anchorAt: "2026-01-01" }], definition),
    ).toThrow("canonical");
    expect(() =>
      calculateActivationCandidates([row(1, 1, true), row(1, 1, false)], definition),
    ).toThrow("duplicate subject");
    expect(() =>
      calculateActivationCandidates(
        [{ ...row(1, 1, true), outcomeWindow: { fromMs: 0, toMs: 1 } }],
        definition,
      ),
    ).toThrow("row outcome window");
    expect(() =>
      calculateActivationCandidates(
        [{ ...row(1, 1, true), actionCountsByWindow: { unknown: { publish: 1 } } }],
        definition,
      ),
    ).toThrow("unknown count window");
    expect(() => calculateActivationCandidates(golden, { ...definition, maxRows: 1 })).toThrow(
      "maxRows",
    );
    expect(() => calculateActivationCandidates([], { ...definition, maxCandidates: 0 })).toThrow(
      "maxCandidates",
    );
  });
  it("rejects unverified curve times outside the half-open action window or contradicting the threshold", () => {
    expect(() =>
      calculateActivationCandidates(
        [{ ...row(1, 1, true), achievementAtByCandidate: { action: "2026-01-01T00:00:01.000Z" } }],
        definition,
      ),
    ).toThrow("outside");
    expect(() =>
      calculateActivationCandidates(
        [{ ...row(1, 0, true), achievementAtByCandidate: { action: "2026-01-01T00:00:00.500Z" } }],
        definition,
      ),
    ).toThrow("contradicts");
  });
  it("hashes canonical input independent of row/key order and changes hashes with input or definition", async () => {
    const hashes = await hashActivationInputs(golden, definition);
    expect(hashes.inputHash).toMatch(/^[a-f0-9]{64}$/);
    expect(await hashActivationInputs([...golden].reverse(), definition)).toEqual(hashes);
    expect((await hashActivationInputs(golden.slice(1), definition)).inputHash).not.toEqual(
      hashes.inputHash,
    );
    expect(
      (await hashActivationInputs(golden, { ...definition, version: 2 })).definitionHash,
    ).not.toEqual(hashes.definitionHash);
  });
  it("rejects invalid definition controls and timestamp overflow", () => {
    for (const threshold of [0, -1, 1.5, Infinity]) {
      expect(() =>
        calculateActivationCandidates([], {
          ...definition,
          candidates: [{ ...definition.candidates[0]!, threshold }],
        }),
      ).toThrow("threshold");
    }
    expect(() => calculateActivationCandidates([], { ...definition, minSupport: NaN })).toThrow(
      "minSupport",
    );
    expect(() =>
      calculateActivationCandidates([], { ...definition, timezone: "Unknown/Zone" }),
    ).toThrow("IANA");
    expect(() =>
      calculateActivationCandidates([row(1, 1, true)], {
        ...definition,
        outcomeWindow: { fromMs: 1000, toMs: Number.MAX_SAFE_INTEGER },
      }),
    ).toThrow("timestamp range");
  });
  it("treats absent prototype-named actions as missing, and absent outcomes as missing", () => {
    const candidate = { ...definition.candidates[0]!, actionId: "toString" };
    expect(
      calculateActivationCandidates([row(1, 1, true)], { ...definition, candidates: [candidate] })
        .candidates[0]?.excluded.missingCount,
    ).toBe(1);
    const missingOutcome = { ...row(1, 1, true), outcome: undefined } as unknown as ActivationRow;
    expect(
      calculateActivationCandidates([missingOutcome], definition).candidates[0]?.excluded
        .missingOutcome,
    ).toBe(1);
  });
  it("canonicalizes object key ordering for reproducible hashes", async () => {
    const first = { ...definition, sourceRevisions: { a: "1", b: "2" } };
    const second = { ...definition, sourceRevisions: { b: "2", a: "1" } };
    expect(await hashActivationInputs(golden, first)).toEqual(
      await hashActivationInputs(golden, second),
    );
  });
});
