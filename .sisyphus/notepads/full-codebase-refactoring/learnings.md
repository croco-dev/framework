# learnings.md

## EventBus ISP 적용 (Task 5-13)

### 패턴: 인터페이스 분리를 통한 ISP 적용

**목적**: 클라이언트가 자신이 사용하지 않는 메서드에 의존하지 않도록 인터페이스를 분리

**적용 전**:
```typescript
export interface EventBus {
  publish(event: DomainEvent): Promise<void>;
  subscribe(subscription: EventSubscription): void;
  unsubscribe(subscription: EventSubscription): void;
  clear(): void;
}
```

**적용 후**:
```typescript
// EventPublishing.ts
export interface EventPublishing {
  publish(event: DomainEvent): Promise<void>;
}

// EventSubscribing.ts
export interface EventSubscribing {
  subscribe(subscription: EventSubscription): void;
  unsubscribe(subscription: EventSubscription): void;
  clear(): void;
}

// EventBus.ts
export interface EventBus extends EventPublishing, EventSubscribing {}
```

### 핵심 학습 포인트

1. **명명 규칙**: `IEventPublisher`, `IEventSubscriber` 대신 `EventPublishing`, `EventSubscribing` 사용
   - 이유: 이미 `EventPublisher` 구현체가 존재하므로 인터페이스 이름과 충돌 방지
   - "-ing" 형태로 동사형 명사를 사용하여 인터페이스의 역할을 명확히 표현

2. **하위호환성 보존**: `EventBus extends EventPublishing, EventSubscribing`으로 100% 하위호환성 유지
   - 기존 `EventBus` 의존하는 코드는 변경 없음
   - 새로운 `EventPublishing`, `EventSubscribing` 의존만 가능해짐

3. **메서드 분류 기준**:
   - `EventPublishing`: 이벤트 발행 관련 메서드만 포함
   - `EventSubscribing`: 이벤트 구독/구독 해제/초기화 관련 메서드 포함
   - `clear()`는 구독 관련(모든 구독 제거)이므로 `EventSubscribing`에 포함

4. **barrel export**: 새 인터페이스를 index.ts에 추가하여 공개 API로 노출
   - docstring으로 각 인터페이스의 목적 명확히 문서화

### 파일 구조
```
packages/events-core/src/libs/
├── interfaces/
│   ├── EventPublishing.ts    # 이벤트 발행 인터페이스
│   └── EventSubscribing.ts   # 이벤트 구독 인터페이스
└── EventBus.ts               # 통합 EventBus 인터페이스
```

### 테스트 결과
- events-core: 135 tests passed ✓
- events-inmemory: 20 tests passed ✓
- 하위호환성 100% 보존
## Problem super() 호출 패턴 (tx-core 수정)

### 패턴: Problem 하위클래스 생성자에서 super() 호출 형식

**목적**: Problem 하위클래스에서 `problem.detail`이 올바르게 설정되도록 생성자 형식 통일

### Problem.ts constructor signature
```typescript
protected constructor(code?: string, category?: ProblemCategory, detail?: string, options?: ProblemOptions)
```

### 올바른 super() 호출 형식
```typescript
export class SomeProblem extends Problem {
  readonly code = 'some-code';
  readonly category = ProblemCategory.InternalServerError;
  constructor() {
    super(undefined, undefined, 'Error message');  // ✓ 올바름
  }
}
```

### 잘못된 super() 호출 형식
```typescript
export class SomeProblem extends Problem {
  readonly code = 'some-code';
  readonly category = ProblemCategory.InternalServerError;
  constructor() {
    super('Error message');  // ✗ 잘못됨 - message가 detail이 아님
  }
}
```

### 핵심 학습 포인트

1. **Parameter 순서**: `code`, `category`, `detail`, `options` 순서
   - 첫 번째 인자는 `code` (문자열이 아니라 `detail`로 해석됨)
   - 두 번째 인자는 `category`
   - 세 번째 인자는 `detail` (여기에 메시지를 넣어야 함)

2. **code와 category의 생략**: 이미 readonly 속성으로 선언했으므로 `undefined`로 생략
   - `super(undefined, undefined, message)` 형태로 호출
   - readonly 속성이 이미 값이 설정되어 있음

3. **테스트 패턴**: TransactionProblems.spec.ts
   ```typescript
   it('should create SomeProblem with expected metadata', () => {
     const error = new SomeProblem();
     expect(error.code).toBe('some-code');
     expect(error.category).toBe(ProblemCategory.InternalServerError);
     expect(error.detail).toBe('Error message');  // 이것이 확인 포인트
   });
   ```

### 적용된 파일 (tx-core)
- `packages/tx-core/src/libs/problems/TransactionProblems.ts`
  - `TransactionDecoratorProblem`
  - `TransactionContextProblem`
- `packages/tx-core/src/libs/errors.ts`
  - `TxManagerNotRegisteredError`
  - `TxPropagationError`

### 테스트 결과
- TransactionProblems.spec.ts: 4/4 tests passed ✓
- `problem.detail`이 undefined에서 올바른 메시지로 변경됨
