## T18: retry-core 타입 안전성 강화

### 완료 사항

#### 1. `as any` 캐스트 제거
- 기존에 `as any`가 없었으나, `RetryContext.getAttribute()`의 타입 캐스트 방식 개선

#### 2. CircuitBreaker 상태머신 타입 안전성 강화
- `CircuitStateTransition` 타입 추가: 상태 전환 규칙을 타입으로 표현
  - CLOSED → OPEN: failure_threshold_reached
  - OPEN → HALF_OPEN: timeout_elapsed
  - HALF_OPEN → CLOSED: success_threshold_reached
  - HALF_OPEN → OPEN: failure_occurred

#### 3. 분산 CircuitBreaker 인터페이스 개선
- `CircuitBreakerStateStore` 추상 클래스에 TSDoc 주석 추가
- 모든 메서드에 문서화 추가
- `DistributedCircuitBreakerStateStore` deprecated 문서 개선

#### 4. CircuitBreaker fallback 타입 강화
- `CircuitBreakerFallback<T>` 타입 추가
- `CircuitBreakerOptions.fallback` 타입 개선

#### 5. @Retryable 데코레이터 타입 강화
- `CircuitBreakerConfig` 인터페이스 분리 및 문서화
- 각 옵션에 TSDoc 주석 추가

#### 6. BackoffPolicy 제네릭 강화
- `BackoffPolicy<T>`로 제네릭 타입 파라미터 추가
- `options?: T` 프로퍼티 추가

### 새로 추가된 타입
- `CircuitStateTransition`: 상태 전환 규칙 타입
- `CircuitBreakerConfig`: CircuitBreaker 설정 인터페이스
- `CircuitBreakerFallback<T>`: 폴백 함수 타입

### 검증 결과
- Typecheck: 0 errors
- Tests: 116 passed (9 test files)
- Biome: No issues
- Build: Success

### 파일 변경
- `packages/retry-core/src/libs/CircuitBreakerState.ts`
- `packages/retry-core/src/libs/CircuitBreaker.ts`
- `packages/retry-core/src/libs/BackoffPolicy.ts`
- `packages/retry-core/src/libs/Retryable.ts`
- `packages/retry-core/src/libs/RetryContext.ts`
- `packages/retry-core/src/index.ts`
- `packages/retry-core/README.md` (신규)
