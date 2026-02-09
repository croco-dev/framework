import { randomBytes } from 'node:crypto';

export class ApiKeyGenerator {
  constructor(
    private readonly shortLength: number = 12,
    private readonly longLength: number = 32
  ) {}

  generate(prefix: string = 'sk'): {
    prefix: string;
    shortToken: string;
    longToken: string;
    fullKey: string;
  } {
    const shortToken = this.randomString(this.shortLength);
    const longToken = this.randomString(this.longLength);
    const fullKey = `${prefix}_${shortToken}_${longToken}`;
    return { prefix, shortToken, longToken, fullKey };
  }

  parse(rawKey: string): { prefix: string; shortToken: string; longToken: string } | null {
    const parts = rawKey.split('_');
    if (parts.length !== 3) return null;
    const [prefix, shortToken, longToken] = parts;
    if (!prefix || !shortToken || !longToken) return null;
    return { prefix, shortToken, longToken };
  }

  private randomString(length: number): string {
    return randomBytes(length).toString('base64url').replace(/_/g, '~').slice(0, length);
  }
}
