import type { CircuitBreakerOptions } from "./CircuitBreaker";
import { CircuitBreaker } from "./CircuitBreaker";
import type { RecoveryCallback, RetryCallback, RetryTemplateOptions } from "./RetryTemplate";
import { RetryTemplate } from "./RetryTemplate";

/**
 * Circuit Breaker와 Retry를 결합한 템플릿.
 *
 * Circuit Breaker로 회로가 닫혀 있을 때만 Retry를 수행합니다.
 *
 * @example
 * ```typescript
 * const template = new CircuitBreakerRetryTemplate(
 *   new CircuitBreaker({ circuitId: 'api-service' }),
 *   new RetryTemplate({ maxAttempts: 3 })
 * );
 *
 * const result = await template.execute(
 *   async (ctx) => await riskyOperation(),
 *   async (ctx) => fallbackValue
 * );
 * ```
 */
export class CircuitBreakerRetryTemplate {
  constructor(
    private readonly circuitBreaker: CircuitBreaker,
    private readonly retryTemplate: RetryTemplate,
  ) {}

  /**
   * Circuit Breaker로 보호하며 재시도 로직을 적용하여 작업을 실행합니다.
   *
   * @param callback 실행할 작업
   * @param recovery 선택적 복구 콜백
   * @returns 작업 결과
   */
  async execute<T>(callback: RetryCallback<T>, recovery?: RecoveryCallback<T>): Promise<T> {
    return this.circuitBreaker.execute(() => this.retryTemplate.execute(callback, recovery));
  }

  /**
   * Circuit Breaker 인스턴스를 반환합니다.
   */
  getCircuitBreaker(): CircuitBreaker {
    return this.circuitBreaker;
  }

  /**
   * RetryTemplate 인스턴스를 반환합니다.
   */
  getRetryTemplate(): RetryTemplate {
    return this.retryTemplate;
  }

  /**
   * Circuit Breaker와 Retry 옵션으로 새 인스턴스를 생성합니다.
   *
   * @param circuitBreakerOptions Circuit Breaker 옵션
   * @param retryTemplateOptions Retry 옵션
   * @returns 새 인스턴스
   */
  static withOptions(
    circuitBreakerOptions: CircuitBreakerOptions,
    retryTemplateOptions: RetryTemplateOptions = {},
  ): CircuitBreakerRetryTemplate {
    return new CircuitBreakerRetryTemplate(
      new CircuitBreaker(circuitBreakerOptions),
      new RetryTemplate(retryTemplateOptions),
    );
  }
}
