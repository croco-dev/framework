import { describe, expect, it } from 'vitest';
import { generateToken, hashToken } from '../libs/token';

describe('token', () => {
  describe('generateToken', () => {
    it('should generate a token with default length', () => {
      const token = generateToken();
      expect(token).toBeDefined();
      expect(token).toHaveLength(64);
    });

    it('should generate a token with custom length', () => {
      const token = generateToken(16);
      expect(token).toBeDefined();
      expect(token).toHaveLength(32);
    });

    it('should generate different tokens on each call', () => {
      const token1 = generateToken();
      const token2 = generateToken();
      expect(token1).not.toBe(token2);
    });

    it('should generate only hexadecimal characters', () => {
      const token = generateToken();
      expect(token).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe('hashToken', () => {
    it('should hash a token to SHA-256 format', () => {
      const token = generateToken();
      const hashed = hashToken(token);
      expect(hashed).toBeDefined();
      expect(hashed).toHaveLength(64);
    });

    it('should produce consistent hash for same input', () => {
      const token = 'test-token';
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = hashToken('token1');
      const hash2 = hashToken('token2');
      expect(hash1).not.toBe(hash2);
    });

    it('should generate only hexadecimal characters', () => {
      const token = generateToken();
      const hashed = hashToken(token);
      expect(hashed).toMatch(/^[0-9a-f]+$/);
    });
  });
});
