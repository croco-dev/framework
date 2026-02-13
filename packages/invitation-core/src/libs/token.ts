import { createHash, randomBytes } from 'crypto';

/**
 * Generate a cryptographically secure random token
 * @param bytes - Number of random bytes to generate (default: 32)
 * @returns Hexadecimal string token
 */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

/**
 * Hash a token using SHA-256
 * @param token - Token to hash
 * @returns SHA-256 hashed token as hexadecimal string
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
