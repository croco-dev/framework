import type { SpanContext } from '@opentelemetry/api';
import { type Sampler, SamplingDecision, type SamplingResult } from '@opentelemetry/sdk-trace-base';
import { SamplerProblem } from '../problems/TelemetryProblems';

type ProbabilitySamplerOptions = {
  probability: number;
};

class ProbabilitySampler implements Sampler {
  private readonly probability: number;
  private readonly threshold: number;

  constructor(options: ProbabilitySamplerOptions) {
    if (options.probability < 0 || options.probability > 1) {
      throw new SamplerProblem('Probability must be between 0 and 1');
    }
    this.probability = options.probability;
    this.threshold = Math.floor(options.probability * 0xffffffff);
  }

  shouldSample(
    context: unknown,
    traceId: string,
    _spanName: string,
    _spanKind: unknown,
    _attributes: unknown,
    _links: unknown
  ): SamplingResult {
    const spanContext = context as SpanContext | undefined;
    const parentSpanContext = spanContext?.traceId ? spanContext : undefined;

    if (parentSpanContext) {
      const parentSampled = parentSpanContext.traceFlags;

      if (parentSampled === 1) {
        return { decision: SamplingDecision.RECORD_AND_SAMPLED };
      }
    }

    // BigInt로 64비트 정밀도 보장: parseInt는 MAX_SAFE_INTEGER 초과 시 정밀도 손실
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
