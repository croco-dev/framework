/**
 * @packageDocumentation
 *
 * Analytics Core - 분산 추적 및 이벤트 분석을 위한 추상화 계층
 *
 * 이 패키지는 애플리케이션의 사용자 행동, 비즈니스 이벤트, 그룹 관계를 추적하는
 * 추상化管理자를 제공합니다. 구체적인 구현(Analytics, Mixpanel, Amplitude 등)은
 * 이 추상 클래스를 상속받아 구현합니다.
 *
 * @example
 * ```typescript
 * import { AnalyticsManager } from '@croco/analytics-core';
 *
 * @Service()
 * class CustomAnalytics extends AnalyticsManager {
 *   capture(event: string, properties?: Record<string, unknown>) {
 *     // 구체적인 구현
 *   }
 *
 *   identify(distinctId: string, properties?: Record<string, unknown>) {
 *     // 구체적인 구현
 *   }
 *
 *   group(groupType: string, groupKey: string, properties?: Record<string, unknown>) {
 *     // 구체적인 구현
 *   }
 * }
 * ```
 */

export {
  /**
   * 분석 이벤트를 관리하는 추상化管理자
   *
   * @description
   * AnalyticsManager는 사용자 행동 추적, 사용자 식별, 그룹 연결을 위한
   * 추상 인터페이스를 정의합니다. Context에서 자동으로 `userId`와 `tenantId`를
   * 주입받아 B2B SaaS 환경에서 테넌트별 분석을 지원합니다.
   *
   * @example
   * ```typescript
   * import { AnalyticsManager } from '@croco/analytics-core';
   * import { Container } from '@croco/framework-context';
   *
   * // 의존성 주입으로 사용
   * @Service()
   * class OrderService {
   *   constructor(
   *     private readonly analytics: AnalyticsManager
   *   ) {}
   *
   *   async createOrder(dto: CreateOrderDto) {
   *     const order = await this.repository.save(dto);
   *
   *     // 이벤트 캡처 (userId, tenantId는 자동 주입)
   *     this.analytics.capture('order.created', {
   *       orderId: order.id,
   *       amount: order.total,
   *     });
   *
   *     return order;
   *   }
   * }
   * ```
   *
   * @returns AnalyticsManager 추상 클래스 타입
   */
  AnalyticsManager,
} from './libs/AnalyticsManager';
