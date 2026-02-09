import type { AccessProvider } from './interfaces/AccessProvider.js';
import type { CheckRequest, CheckResult, GrantRequest, ListRequest, RevokeRequest } from './types.js';

export class AccessEngine {
  constructor(private provider: AccessProvider) {}

  async check(request: CheckRequest): Promise<CheckResult> {
    try {
      return await this.provider.check(request);
    } catch {
      return { allowed: false };
    }
  }

  async grant(request: GrantRequest): Promise<void> {
    return this.provider.grant(request);
  }

  async revoke(request: RevokeRequest): Promise<void> {
    return this.provider.revoke(request);
  }

  async list(request: ListRequest) {
    return this.provider.list(request);
  }
}
