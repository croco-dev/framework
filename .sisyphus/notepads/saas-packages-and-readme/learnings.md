# SignalProvider 어댑터 구현 학습 내용

## 작업 완료
- MeteringSignalProvider 구현 (category: 'usage')
- BillingSignalProvider 구현 (category: 'business', subscription status → score mapping)
- DrizzleHealthSignalRegistry 구현 (@Component, @Inject constructor, getProviders)
- 테스트 파일 작성 (MeteringSignalProvider.spec.ts, BillingSignalProvider.spec.ts)
- index.ts barrel exports 업데이트
- 테스트 검증 통과 (14/14 tests passed)

## 주요 패턴

### SignalProvider 구현
- `@Component()` 데코레이터로 등록
- `@Inject()`를 통해 의존성 주입
- `extends SignalProvider`로 추상 클래스 상속
- `category` 프로퍼티와 `collect()` 메서드 구현

### 테스트 패턴
- `vi.mock('@croco/customer-health-core', ...)`로 데코레이터 실행 방지
- 수동 인스턴스화 (Container 사용하지 않음)
- `beforeEach`에서 mock 설정

### 점수 정규화 로직 (MeteringSignalProvider)
- 0-50% 사용량: 100점
- 50-75% 사용량: 100 → 50점 선형 감소
- 75-100% 사용량: 50 → 0점 선형 감소
- 100% 초과: 0점

### Subscription 상태 점수 매핑 (BillingSignalProvider)
- active: 100점
- trialing: 80점
- past_due: 30점
- canceled: 0점

### Storage 인터페이스 정의
- `UsageStorage`, `SubscriptionStorage` 인터페이스를 구현 패키지 내에서 정의
- 실제 구현은 사용자가 직접 제공
- `Token`을 사용하여 DI 컨테이너에 등록
## Problem 클래스 구현 학습 내용

### 작업 완료 (TASK 20)
- ImpersonationProblems.ts 생성 (3개 Problem 클래스)
- 타입체크 통과 (10 tasks successful)

### 주요 패턴

### Problem 클래스 구현
- `import { Problem, ProblemCategory } from '@croco/problems-core'`
- `extends Problem`로 RFC 7807 표준 에러 클래스 상속
- `constructor(code: string, category: ProblemCategory, detail?: string)` 형태
- 코드는 SCREAMING_SNAKE_CASE 사용 (예: 'SELF_IMPERSONATION_NOT_ALLOWED')
- 카테고리는 HTTP 의미론 매핑 (Forbidden, BadRequest, NotFound 등)

### ProblemCategory 종류
- BadRequest: 잘못된 요청 형식 또는 파라미터 문제
- Unauthorized: 인증 실패
- Forbidden: 권한 부족
- NotFound: 리소스 미발견
- Conflict: 리소스 충돌
- ValidationError: 입력 검증 실패
- BusinessRuleViolation: 비즈니스 규칙 위반
- TooManyRequests: 속도 제한
- InternalServerError: 서버 내부 오류
- NotImplemented: 기능 미구현

### 구현된 Problem 클래스
- SelfImpersonationProblem: 자기 자신 대리 접속 시도 (Forbidden)
- NestedImpersonationProblem: 중첩 대리 접속 시도 (Forbidden)
- ImpersonationReasonRequiredProblem: reason 필수 누락 (BadRequest)
