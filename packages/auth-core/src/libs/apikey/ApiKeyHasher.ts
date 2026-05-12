import { createHash, timingSafeEqual } from "node:crypto";

export class ApiKeyHasher {
  hash(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }

  verify(value: string, hash: string): boolean {
    const computed = this.hash(value);
    const computedBuffer = Buffer.from(computed);
    const hashBuffer = Buffer.from(hash);

    if (computedBuffer.length !== hashBuffer.length) {
      return false;
    }

    return timingSafeEqual(computedBuffer, hashBuffer);
  }
}
