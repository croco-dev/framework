import { describe, expect, it } from "vitest";
import { BetterAuthAuthenticationProblem } from "../../packages/auth-better-auth/src/libs/problems/BetterAuthAuthenticationProblem";
import {
  ClerkTokenVerificationProblem,
  ClerkTokenVerificationUpstreamProblem,
} from "../../packages/auth-clerk/src/libs/problems/ClerkProblems";
import { QStashBatchPublishProblem } from "../../packages/batch-qstash/src/libs/problems/QStashBatchProblems";
import { RedisProblem } from "../../packages/metering-core/src/libs/problems/RedisProblem";
import { UpstashMeteringUpstreamProblem } from "../../packages/metering-upstash/src/libs/problems/UpstashMeteringProblems";
import { UpstashRateLimitUpstreamProblem } from "../../packages/ratelimit-upstash/src/libs/problems/RateLimitUpstashProblems";
import { QStashTaskPublishProblem } from "../../packages/tasks-qstash/src/libs/problems/QStashTaskProblems";

const adapters = [
  {
    name: "Better Auth",
    create: (error: Error | string) => new BetterAuthAuthenticationProblem("readiness", error),
  },
  {
    name: "Clerk authentication",
    create: (error: Error | string) => new ClerkTokenVerificationProblem(error),
  },
  {
    name: "Clerk upstream",
    create: (error: Error | string) => new ClerkTokenVerificationUpstreamProblem(error),
  },
  {
    name: "QStash batch",
    create: (error: Error | string) => new QStashBatchPublishProblem("publish", error),
  },
  { name: "Redis metering", create: (error: Error | string) => new RedisProblem("ZADD", error) },
  {
    name: "Upstash metering",
    create: (error: Error | string) => new UpstashMeteringUpstreamProblem("increment", error),
  },
  {
    name: "Upstash rate limit",
    create: (error: Error | string) => new UpstashRateLimitUpstreamProblem("limit", error),
  },
  { name: "QStash task", create: (error: Error | string) => new QStashTaskPublishProblem(error) },
] as const;

describe.each(adapters)("$name upstream Problem causes", ({ create }) => {
  it("retains the original Error and causal chain without exposing private cause data in JSON", () => {
    const inner = new Error("private-upstream-cause-canary");
    const upstream = Object.assign(new Error("upstream unavailable", { cause: inner }), {
      status: 503,
      credential: "private-upstream-credential-canary",
    });
    const problem = create(upstream);

    expect(problem.cause).toBe(upstream);
    expect(problem.cause?.cause).toBe(inner);
    expect(Object.keys(problem)).not.toContain("cause");
    expect(problem.toJSON()).not.toHaveProperty("cause");
    expect(JSON.stringify(problem)).not.toContain("private-upstream-cause-canary");
    expect(JSON.stringify(problem)).not.toContain("private-upstream-credential-canary");
  });

  it("keeps string failures usable without inventing an Error cause", () => {
    const problem = create("upstream unavailable");
    expect(problem.cause).toBeUndefined();
    expect(problem.detail).toContain("upstream unavailable");
    expect(problem.toJSON()).not.toHaveProperty("cause");
  });
});
