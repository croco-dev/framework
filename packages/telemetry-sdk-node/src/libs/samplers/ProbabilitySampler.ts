import type { SpanContext } from '@opentelemetry/api';
import { type Sampler, SamplingDecision, type SamplingResult } from '@opentelemetry/sdk-trace-base';

type ProbabilitySamplerOptions = {
  probability: number;
};

class ProbabilitySampler implements Sampler {
  private readonly probability: number;
  private readonly threshold: number;

  constructor(options: ProbabilitySamplerOptions) {
    if (options.probability < 0 || options.probability > 1) {
      throw new Error('Probability must be between 0 and 1');
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

    const buffer = Buffer.alloc(8);
    buffer.writeUInt32BE(0, 0);
    buffer.writeUInt32BE(parseInt(traceId.slice(16, 32), 16), 4);
    const lowerLong = buffer.readBigUInt64BE(0);
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
