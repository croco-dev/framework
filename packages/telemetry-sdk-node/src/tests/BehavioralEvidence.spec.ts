import { ROOT_CONTEXT, SpanKind } from "@opentelemetry/api";
import { SamplingDecision } from "@opentelemetry/sdk-trace-base";
import { describe, expect, it } from "vitest";
import { ProbabilitySampler, SamplerProblem } from "../index";

describe("telemetry-sdk-node behavioral evidence", () => {
  it("samples a valid trace through the public Node telemetry sampler", () => {
    const sampler = new ProbabilitySampler({ probability: 1 });

    const result = sampler.shouldSample(
      ROOT_CONTEXT,
      "00000000000000000000000000000001",
      "evidence.success",
      SpanKind.INTERNAL,
      {},
      [],
    );

    expect(result.decision).toBe(SamplingDecision.RECORD_AND_SAMPLED);
  });

  it("rejects an invalid public sampling probability with a typed Problem", () => {
    expect(() => new ProbabilitySampler({ probability: 1.01 })).toThrow(SamplerProblem);
  });
});
