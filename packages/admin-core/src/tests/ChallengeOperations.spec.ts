import { describe, expect, it, vi } from "vitest";
import {
  assertChallengeOperationsAudit,
  ChallengeOperationsProblem,
  loadChallengeOperations,
} from "../libs/ChallengeOperations";

describe("Challenge operations", () => {
  it("denies reads without invoking the source", async () => {
    const source = { load: vi.fn(), save: vi.fn(), close: vi.fn() };
    expect(await loadChallengeOperations(source, [])).toMatchObject({ kind: "denied" });
    expect(source.load).not.toHaveBeenCalled();
  });
  it("preserves incomplete evidence", async () => {
    const state = { kind: "error" as const, message: "Source unavailable" };
    const source = { load: vi.fn().mockResolvedValue(state), save: vi.fn(), close: vi.fn() };
    expect(await loadChallengeOperations(source, ["challenge.read"])).toBe(state);
  });
  it.each([
    { actor: "" },
    { reason: " " },
    { idempotencyKey: "" },
    { expectedVersion: 0 },
    { expectedVersion: 1.5 },
  ])("requires audited versioned writes: %j", (invalid) => {
    expect(() =>
      assertChallengeOperationsAudit({
        actor: "operator",
        reason: "reviewed",
        idempotencyKey: "write-1",
        expectedVersion: 1,
        ...invalid,
      }),
    ).toThrow(ChallengeOperationsProblem);
  });
});
