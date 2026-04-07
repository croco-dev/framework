import type { EntitlementQuotaStatus } from '@croco/entitlements-core';

export abstract class SeatLimitChecker {
  abstract checkSeatAvailability(tenantId: string): Promise<EntitlementQuotaStatus>;
  abstract getCurrentMemberCount(tenantId: string): Promise<number>;
  abstract getMaxSeats(tenantId: string): Promise<number>;
}
