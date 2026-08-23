import type { Attributes, Context, Link, SpanKind } from "@opentelemetry/api";
import { isSpanContextValid, isValidTraceId, TraceFlags, trace } from "@opentelemetry/api";
import { type Sampler, SamplingDecision, type SamplingResult } from "@opentelemetry/sdk-trace-base";
import { SamplerProblem } from "../problems/TelemetryProblems";

type ProbabilitySamplerOptions = {
  probability: number;
};

class ProbabilitySampler implements Sampler {
  private readonly probability: number;
  private readonly threshold: number;

  constructor(options: ProbabilitySamplerOptions) {
    if (
      !Number.isFinite(options.probability) ||
      options.probability < 0 ||
      options.probability > 1
    ) {
      throw new SamplerProblem("Probability must be a finite number between 0 and 1");
    }
    this.probability = options.probability;
    this.threshold = Math.floor(options.probability * (0xffffffff + 1));
  }

  shouldSample(
    context: Context,
    traceId: string,
    _spanName: string,
    _spanKind: SpanKind,
    _attributes: Attributes,
    _links: Link[],
  ): SamplingResult {
    const spanContext = trace.getSpanContext(context);

    if (spanContext && isSpanContextValid(spanContext)) {
      if (spanContext.traceFlags & TraceFlags.SAMPLED) {
        return { decision: SamplingDecision.RECORD_AND_SAMPLED };
      }
    }

    if (!isValidTraceId(traceId)) {
      return { decision: SamplingDecision.NOT_RECORD };
    }

    const lowerLong = BigInt(`0x${traceId.slice(16, 32)}`);
    const scaledLowerLong = lowerLong & BigInt(0xffffffff);

    if (scaledLowerLong < BigInt(this.threshold)) {
      return { decision: SamplingDecision.RECORD_AND_SAMPLED };
    }

    return { decision: SamplingDecision.NOT_RECORD };
  }

  toString(): string {
    return `ProbabilitySampler{${this.probability}}`;
  }
}

export { ProbabilitySampler };
