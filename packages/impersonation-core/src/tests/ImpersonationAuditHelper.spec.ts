import { describe, expect, it } from 'vitest';
import { withImpersonationAudit } from '../libs/ImpersonationAuditHelper';
import type { ImpersonationContext } from '../libs/ImpersonationService';

describe('withImpersonationAudit', () => {
  it('should add impersonatorId when impersonation context exists', () => {
    const metadata = { action: 'sensitive' };
    const context = {
      impersonation: {
        sessionId: 'imp_123',
        impersonatorId: 'admin-1',
        targetUserId: 'user-1',
        startedAt: new Date(),
        expiresAt: new Date(),
      },
    } as ImpersonationContext;
    const result = withImpersonationAudit(metadata, context);
    expect(result).toHaveProperty('impersonatorId', 'admin-1');
    expect(result).toHaveProperty('impersonationSessionId', 'imp_123');
  });

  it('should return unchanged metadata when no impersonation context', () => {
    const metadata = { action: 'normal' };
    const context = { user: { id: 'user-1' } };
    const result = withImpersonationAudit(metadata, context);
    expect(result).toEqual(metadata);
  });
});
