import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QStashReceiver, QStashSignatureInvalidProblem } from '../libs/QStashReceiver';

// Mock @upstash/qstash Receiver
vi.mock('@upstash/qstash', () => ({
  Receiver: class MockReceiver {
    verify = vi.fn().mockResolvedValue(true);
  },
}));

describe('QStashReceiver', () => {
  let receiver: QStashReceiver;

  beforeEach(() => {
    receiver = new QStashReceiver({
      currentSigningKey: 'test-current-key',
      nextSigningKey: 'test-next-key',
    });
  });

  describe('verify', () => {
    it('should create receiver with signing keys', () => {
      expect(receiver).toBeDefined();
    });

    it('should verify valid signature', async () => {
      const result = await receiver.verify('valid-signature', '{"test": true}');
      expect(result).toBe(true);
    });
  });

  describe('QStashSignatureInvalidProblem', () => {
    it('should have correct code', () => {
      const problem = new QStashSignatureInvalidProblem();
      expect(problem.code).toBe('QSTASH_SIGNATURE_INVALID');
    });
  });
});
