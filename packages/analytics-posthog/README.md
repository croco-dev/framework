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
import { Component } from "@croco/framework-context";
import { PostHogAnalyticsManager } from "@croco/analytics-posthog";

@Component()
class MyService {
  constructor(private readonly analytics: PostHogAnalyticsManager) {}
}
```

### 2. 이벤트 캡처

사용자 행동 이벤트를 PostHog에 전송합니다. `userId`와 `tenantId`는 Context에서 자동으로 주입됩니다.

```typescript
this.analytics.capture("order.created", {
  orderId: "order-123",
  amount: 99.99,
});
```

### 3. 사용자 식별

로그인 또는 회원가입 후 사용자를 식별합니다.

```typescript
this.analytics.identify("user-123", {
  name: "John Doe",
  email: "john@example.com",
});
```

### 4. 그룹 연결

사용자를 테넌트 또는 조직과 연결합니다. B2B SaaS 환경에서 필수적입니다.

```typescript
this.analytics.group("tenant", "tenant-456", {
  plan: "enterprise",
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

## Flush / Lambda lifecycle

`PostHogAnalyticsManager.flush()`는 내부 `PostHogClient.shutdown()`을 호출해 SDK 버퍼를
drain합니다. Lambda나 서버리스 핸들러에서는 응답 직전 `finally` 블록에서 호출하세요.
flush 실패는 `PostHogAnalyticsFlushProblem`으로 다시 throw되며 로그에는
`analytics-posthog/flush-failed` 코드가 남습니다.

```typescript
try {
  this.analytics.capture("order.created", { orderId: "order-123" });
} finally {
  await this.analytics.flush();
}
```

## Disabled mode

테스트, 로컬 개발, 임시 운영 차단처럼 이벤트 전송을 명시적으로 꺼야 할 때 세 번째
생성자 인자 대신 `POSTHOG_ANALYTICS_MANAGER_OPTIONS` 토큰을 등록합니다. 이 모드에서는
`capture`, `identify`, `group`, `flush`가 PostHog SDK를 호출하지 않고 `info` 로그에
skipped operation evidence를 남깁니다.

```typescript
import {
  POSTHOG_ANALYTICS_MANAGER_OPTIONS,
  PostHogAnalyticsManager,
} from "@croco/analytics-posthog";
import { Container } from "@croco/framework-context";

Container.set(POSTHOG_ANALYTICS_MANAGER_OPTIONS, { enabled: false });
const analytics = Container.get(PostHogAnalyticsManager);
```

## Diagnostics / Readiness

`PostHogAnalyticsDiagnosticsProvider`는 `@croco/diagnostics-core`의
`DiagnosticsProvider`로 안전한 설정 상태와 선택적 upstream readiness를 제공합니다.
기본 diagnostics는 PostHog에 네트워크 요청을 보내지 않습니다. live readiness가 필요하면
`readinessCheck`를 주입합니다.

```typescript
import { PostHogAnalyticsDiagnosticsProvider } from "@croco/analytics-posthog";

const diagnostics = new PostHogAnalyticsDiagnosticsProvider({
  apiKey: process.env.POSTHOG_API_KEY,
  host: process.env.POSTHOG_HOST,
});

const health = await diagnostics.getHealth();
```

반환 details는 `hasApiKey`, `hasHost`, `hostSource`, `configValidation`, `liveCheck`처럼
secret 값을 노출하지 않는 boolean/source/status evidence만 포함합니다. 진단은 런타임
클라이언트와 같은 HTTP(S) host 검증을 사용하며 네트워크 연결은 시도하지 않습니다.
`authorization`, `token`, `secret`, `apiKey` 이름을 가진 readiness details는 redacted
처리됩니다.

### Recovery actions

- `integrations-posthog/missing-config`: `POSTHOG_API_KEY`와 data residency에 맞는
  `POSTHOG_HOST`를 설정하거나 생성자 config에 `host`를 명시합니다.
- `analytics-posthog/capture-failed`: `capture()` 호출이 PostHog SDK로 전달되었지만
  provider가 거부했습니다. 로그의 event name과 provider 상태를 확인하고 필요하면 같은
  business event를 재전송합니다.
- `analytics-posthog/identify-failed`: `identify()` 호출이 PostHog SDK에서 실패했습니다.
  호출자에게 실패를 전파하지 않으며 식별자와 속성은 로그에 남기지 않습니다.
- `analytics-posthog/group-failed`: `group()` 호출이 PostHog SDK에서 실패했습니다.
  호출자에게 실패를 전파하지 않으며 그룹 키와 속성은 로그에 남기지 않습니다.
- `analytics-posthog/readiness-failed`: injected readiness check가 upstream 장애를 감지한
  상태입니다. health details의 `upstreamCode`/`upstreamStatus`를 확인하고 provider 복구
  후 재시도합니다.
- `analytics-posthog/flush-failed`: 서버리스 반환 전 flush가 실패했습니다. 이벤트가
  durable하게 전송되었다고 간주하지 말고 재시도 또는 dead-letter 경로를 사용합니다.

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

- **`flush(): Promise<void>`**
  - PostHog SDK 버퍼를 drain합니다.

### `PostHogAnalyticsDiagnosticsProvider`

PostHog analytics 설정, disabled mode, optional readiness check를 안전한 health status로
노출합니다.

## 의존성

- `@croco/analytics-core`
- `@croco/diagnostics-core`
- `@croco/framework-context`
- `@croco/integrations-posthog`
- `@croco/problems-core`
