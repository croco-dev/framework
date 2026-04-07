import { Context } from '@croco/framework-context';
import { describe, expect, it } from 'vitest';
import { BlockDuringImpersonation } from '../libs/decorators/BlockDuringImpersonation';
import type { ImpersonationContext } from '../libs/ImpersonationService';
import { BlockedDuringImpersonationProblem } from '../libs/problems/ImpersonationProblems';

describe('BlockDuringImpersonation', () => {
  class TestService {
    @BlockDuringImpersonation()
    sensitiveOperation(): string {
      return 'success';
    }
  }

  it('should allow execution when not impersonating', async () => {
    const service = new TestService();
    const result = await Context.run({ requestId: 'req-1', user: { id: 'user-1' } }, async () => {
      return service.sensitiveOperation();
    });
    expect(result).toBe('success');
  });

  it('should throw BlockedDuringImpersonationProblem when impersonating', async () => {
    const service = new TestService();
    const impersonationContext = {
      requestId: 'req-1',
      user: { id: 'user-1' },
      impersonation: {
        sessionId: 'imp_123',
        impersonatorId: 'admin-1',
        targetUserId: 'user-1',
        startedAt: new Date(),
        expiresAt: new Date(),
      },
    } as ImpersonationContext;

    await expect(
      Context.run(impersonationContext, async () => {
        return service.sensitiveOperation();
      })
    ).rejects.toThrow(BlockedDuringImpersonationProblem);
  });
});
