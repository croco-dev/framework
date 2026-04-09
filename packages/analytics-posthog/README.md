# @croco/analytics-posthog

PostHog 기반 분석 이벤트 추적 구현체입니다. `@croco/analytics-core`의 `AnalyticsManager` 추상 클래스를 구현하여 사용자 행동, 사용자 식별, 그룹 연결을 PostHog에 전송합니다.

B2B SaaS 환경에서 Context에서 자동으로 `userId`와 `tenantId`를 주입받아 테넌트별 분석을 지원합니다.

## 설치

```bash
pnpm add @croco/analytics-posthog
```

## 사용법

### 1. 의존성 주입

`PostHogAnalyticsManager`는 `@croco/integrations-posthog`의 `PostHogClient`를 의존성으로 주입받습니다.

```typescript
import { Component } from '@croco/framework-context';
import { PostHogAnalyticsManager } from '@croco/analytics-posthog';

@Component()
class MyService {
  constructor(
    private readonly analytics: PostHogAnalyticsManager
  ) {}
}
```

### 2. 이벤트 캡처

사용자 행동 이벤트를 PostHog에 전송합니다. `userId`와 `tenantId`는 Context에서 자동으로 주입됩니다.

```typescript
this.analytics.capture('order.created', {
  orderId: 'order-123',
  amount: 99.99,
});
```

### 3. 사용자 식별

로그인 또는 회원가입 후 사용자를 식별합니다.

```typescript
this.analytics.identify('user-123', {
  name: 'John Doe',
  email: 'john@example.com',
});
```

### 4. 그룹 연결

사용자를 테넌트 또는 조직과 연결합니다. B2B SaaS 환경에서 필수적입니다.

```typescript
this.analytics.group('tenant', 'tenant-456', {
  plan: 'enterprise',
  seats: 100,
});
```

## Context 자동 주입

`PostHogAnalyticsManager`는 다음 순서로 `distinctId`를 결정합니다:

1. `properties.userId`가 있으면 사용
2. Context의 `currentUser.id`가 있으면 사용
3. Context의 `requestId`가 있으면 `anonymous:{requestId}` 사용
4. Context의 `tenantId`가 있으면 `tenant:{tenantId}` 사용
5. 그 외에는 `anonymous:{randomUUID}` 사용

그룹(`groups`)은 다음 순서로 결정합니다:

1. `properties.groups`가 있으면 사용
2. Context의 `tenantId`가 있으면 `{ tenant: tenantId }` 사용
3. 그 외에는 undefined

## API Reference

### `PostHogAnalyticsManager`

`AnalyticsManager`를 상속받는 PostHog 구현체입니다.

#### Methods

- **`capture(event: string, properties?: Record<string, unknown>): void`**
  - 이벤트를 PostHog에 전송합니다.
  - 실패 시 로그에 기록하고 애플리케이션 흐름을 차단하지 않습니다.

- **`identify(distinctId: string, properties?: Record<string, unknown>): void`**
  - 사용자를 식별합니다.

- **`group(groupType: string, groupKey: string, properties?: Record<string, unknown>): void`**
  - 사용자를 그룹과 연결합니다.

## 의존성

- `@croco/analytics-core`
- `@croco/framework-context`
- `@croco/integrations-posthog`