import { SamplingDecision } from '@opentelemetry/sdk-trace-base';
import { beforeEach, describe, expect, it } from 'vitest';
import { ProbabilitySampler } from '../libs/samplers/ProbabilitySampler';

describe('ProbabilitySampler', () => {
  describe('constructor', () => {
    it('should create sampler with valid probability', () => {
      const sampler = new ProbabilitySampler({ probability: 0.5 });
      expect(sampler.toString()).toBe('ProbabilitySampler{0.5}');
    });

    it('should create sampler with probability 0', () => {
      const sampler = new ProbabilitySampler({ probability: 0 });
      expect(sampler.toString()).toBe('ProbabilitySampler{0}');
    });

    it('should create sampler with probability 1', () => {
      const sampler = new ProbabilitySampler({ probability: 1 });
      expect(sampler.toString()).toBe('ProbabilitySampler{1}');
    });

    it('should throw error for invalid probability', () => {
      expect(() => new ProbabilitySampler({ probability: -0.1 })).toThrow();
      expect(() => new ProbabilitySampler({ probability: 1.1 })).toThrow();
    });
  });

  describe('shouldSample', () => {
    let sampler!: ProbabilitySampler;

    beforeEach(() => {
      sampler = new ProbabilitySampler({ probability: 0.5 });
    });

    it('should make sampling decision based on traceId', () => {
      const result1 = sampler.shouldSample({}, '00000000000000000000000000000001', 'test-span', undefined, {}, []);

      expect([SamplingDecision.RECORD_AND_SAMPLED, SamplingDecision.NOT_RECORD]).toContain(result1.decision);
    });

    it('should always sample when probability is 1', () => {
      const alwaysSampler = new ProbabilitySampler({ probability: 1 });

      const result = alwaysSampler.shouldSample({}, '00000000000000000000000000000001', 'test-span', undefined, {}, []);

      expect(result.decision).toBe(SamplingDecision.RECORD_AND_SAMPLED);
    });

    it('should never sample when probability is 0', () => {
      const neverSampler = new ProbabilitySampler({ probability: 0 });

      const result = neverSampler.shouldSample({}, '00000000000000000000000000000001', 'test-span', undefined, {}, []);

      expect(result.decision).toBe(SamplingDecision.NOT_RECORD);
    });
  });
});
