import { Container } from "@croco/framework-context";
import { beforeEach, describe, expectTypeOf, it } from "vitest";
import type { CheckResult } from "../libs/types";

describe("CheckResult", () => {
  beforeEach(() => {
    Container.reset();
  });

  it("couples each decision to its compatibility boolean", () => {
    expectTypeOf({ decision: "allow", allowed: true } as const).toMatchTypeOf<CheckResult>();
    expectTypeOf({ decision: "deny", allowed: false } as const).toMatchTypeOf<CheckResult>();
    expectTypeOf({ decision: "abstain", allowed: false } as const).toMatchTypeOf<CheckResult>();
  });
});

// @ts-expect-error allow decisions cannot deny through the compatibility boolean.
const contradictoryAllow: CheckResult = { decision: "allow", allowed: false };

// @ts-expect-error deny decisions cannot allow through the compatibility boolean.
const contradictoryDeny: CheckResult = { decision: "deny", allowed: true };

// @ts-expect-error abstain decisions cannot allow through the compatibility boolean.
const contradictoryAbstain: CheckResult = { decision: "abstain", allowed: true };

// @ts-expect-error every provider result must expose an authoritative decision.
const missingDecision: CheckResult = { allowed: true };

function assertImmutable(mutableResult: CheckResult): void {
  // @ts-expect-error compatibility booleans cannot be mutated after construction.
  mutableResult.allowed = true;

  // @ts-expect-error authoritative decisions cannot be mutated after construction.
  mutableResult.decision = "allow";
}

void contradictoryAllow;
void contradictoryDeny;
void contradictoryAbstain;
void missingDecision;
void assertImmutable;
