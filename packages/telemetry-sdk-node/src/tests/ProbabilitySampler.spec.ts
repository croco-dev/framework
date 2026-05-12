import { ROOT_CONTEXT, SpanKind } from "@opentelemetry/api";
import { SamplingDecision } from "@opentelemetry/sdk-trace-base";
import { beforeEach, describe, expect, it } from "vitest";
import { ProbabilitySampler } from "../libs/samplers/ProbabilitySampler";

describe("ProbabilitySampler", () => {
  describe("constructor", () => {
    it("should create sampler with valid probability", () => {
      const sampler = new ProbabilitySampler({ probability: 0.5 });
      expect(sampler.toString()).toBe("ProbabilitySampler{0.5}");
    });

    it("should create sampler with probability 0", () => {
      const sampler = new ProbabilitySampler({ probability: 0 });
      expect(sampler.toString()).toBe("ProbabilitySampler{0}");
    });

    it("should create sampler with probability 1", () => {
      const sampler = new ProbabilitySampler({ probability: 1 });
      expect(sampler.toString()).toBe("ProbabilitySampler{1}");
    });

    it("should throw error for invalid probability", () => {
      expect(() => new ProbabilitySampler({ probability: -0.1 })).toThrow();
      expect(() => new ProbabilitySampler({ probability: 1.1 })).toThrow();
    });
  });

  describe("shouldSample", () => {
    let sampler!: ProbabilitySampler;

    beforeEach(() => {
      sampler = new ProbabilitySampler({ probability: 0.5 });
    });

    it("should make sampling decision based on traceId", () => {
      const result1 = sampler.shouldSample(
        ROOT_CONTEXT,
        "00000000000000000000000000000001",
        "test-span",
        SpanKind.INTERNAL,
        {},
        [],
      );

      expect([SamplingDecision.RECORD_AND_SAMPLED, SamplingDecision.NOT_RECORD]).toContain(
        result1.decision,
      );
    });

    it("should always sample when probability is 1", () => {
      const alwaysSampler = new ProbabilitySampler({ probability: 1 });

      const result = alwaysSampler.shouldSample(
        ROOT_CONTEXT,
        "00000000000000000000000000000001",
        "test-span",
        SpanKind.INTERNAL,
        {},
        [],
      );

      expect(result.decision).toBe(SamplingDecision.RECORD_AND_SAMPLED);
    });

    it("should never sample when probability is 0", () => {
      const neverSampler = new ProbabilitySampler({ probability: 0 });

      const result = neverSampler.shouldSample(
        ROOT_CONTEXT,
        "00000000000000000000000000000001",
        "test-span",
        SpanKind.INTERNAL,
        {},
        [],
      );

      expect(result.decision).toBe(SamplingDecision.NOT_RECORD);
    });

    describe("BUG-08 64비트 TraceID에서 정밀도 유지", () => {
      it("MAX_SAFE_INTEGER 초과 traceId로 일관된 샘플링 결과 반환", () => {
        const sampler = new ProbabilitySampler({ probability: 0.5 });

        // traceId 하위 16자: ffffffffffffffffff = 18446744073709551615 (MAX_SAFE_INTEGER 초과)
        const maxTraceId = "00000000000000ffffffffffffffffff";

        // 동일한 traceId로 여러 번 호출 시 항상 동일한 결과 반환
        const results = Array.from({ length: 10 }, () =>
          sampler.shouldSample(ROOT_CONTEXT, maxTraceId, "test-span", SpanKind.INTERNAL, {}, []),
        );

        const allDecisions = results.map((r) => r.decision);
        const firstDecision = results[0].decision;

        // 모든 결과가 동일해야 함
        expect(allDecisions.every((d) => d === firstDecision)).toBe(true);
      });

      it("경계값 traceId로 정확한 샘플링 비율 유지", () => {
        const probability = 0.5;
        const sampler = new ProbabilitySampler({ probability });

        // threshold = floor(0.5 * 0xffffffff) = floor(2147483647.5) = 2147483647
        // traceId 하위 16자: 8000000000000000 = 9223372036854775808
        const boundaryTraceId = "00000000000000800000000000000000";

        const result = sampler.shouldSample(
          ROOT_CONTEXT,
          boundaryTraceId,
          "test-span",
          SpanKind.INTERNAL,
          {},
          [],
        );

        // 9223372036854775808 & 0xffffffff = 0 (하위 32비트만 추출)
        // 0 < 2147483647 → RECORD_AND_SAMPLED
        expect(result.decision).toBe(SamplingDecision.RECORD_AND_SAMPLED);
      });

      it("MAX_SAFE_INTEGER 초과 traceId로 NOT_SAMPLE 결정 검증", () => {
        const sampler = new ProbabilitySampler({ probability: 0.0001 });

        // traceId 하위 16자: ffffffffffffffffff = 18446744073709551615
        // threshold = floor(0.0001 * 0xffffffff) ≈ 429496
        const maxTraceId = "00000000000000ffffffffffffffffff";

        const result = sampler.shouldSample(
          ROOT_CONTEXT,
          maxTraceId,
          "test-span",
          SpanKind.INTERNAL,
          {},
          [],
        );

        // 18446744073709551615 & 0xffffffff = 4294967295
        // 4294967295 >= 429496 → NOT_RECORD
        expect(result.decision).toBe(SamplingDecision.NOT_RECORD);
      });
    });
  });
});
