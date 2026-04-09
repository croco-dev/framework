import { HealthSignalRegistry, type SignalProvider } from '@croco/customer-health-core';
import { Component, Inject } from '@croco/framework-context';
import type { BillingSignalProvider } from './BillingSignalProvider';
import type { MeteringSignalProvider } from './MeteringSignalProvider';

/**
 * 기본 건강 신호 제공자 조합을 반환하는 레지스트리입니다.
 */
@Component()
export class DrizzleHealthSignalRegistry extends HealthSignalRegistry {
  /**
   * 사용량과 구독 신호 제공자를 받아 레지스트리를 초기화합니다.
   */
  constructor(
    @Inject() private readonly meteringProvider: MeteringSignalProvider,
    @Inject() private readonly billingProvider: BillingSignalProvider
  ) {
    super();
  }

  /**
   * 건강 점수 계산에 사용할 신호 제공자 목록을 반환합니다.
   */
  getProviders(): SignalProvider[] {
    return [this.meteringProvider, this.billingProvider];
  }
}
