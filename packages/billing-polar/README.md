# @croco/billing-polar

Polar 결제 플랫폼 연동 — checkout, webhook, 구독 관리

## 설치

```bash
pnpm add @croco/billing-polar
```

## 개요

Polar 결제 플랫폼을 `@croco/billing-core`와 통합하여 SaaS 구독 비즈니스를 구축합니다.

- **Checkout**: Polar checkout 세션 생성
- **Webhook**: 서명 검증, 멱등성, 이벤트 매핑
- **구독 관리**: 활성화/취소/재개, 고객 포털 URL

## 구성

```typescript
import { PolarConfig } from "@croco/billing-polar";

const config: PolarConfig = {
  accessToken: "polar-access-token",
  environment: "sandbox",
  webhookSecret: "polar-webhook-secret",
  organizationId: "org-123",
};
```

### PolarConfig

| 필드             | 타입                        | 필수 | 설명                  |
| ---------------- | --------------------------- | ---- | --------------------- |
| `accessToken`    | `string`                    | ✅   | Polar API 액세스 토큰 |
| `environment`    | `'sandbox' \| 'production'` | ✅   | Polar 환경            |
| `webhookSecret`  | `string`                    | ✅   | 웹훅 서명 검증 시크릿 |
| `organizationId` | `string`                    | ❌   | Polar 조직 ID         |

### 환경 변수

운영 앱에서는 아래 환경 변수를 `PolarConfig`로 명시적으로 주입하는 방식을 권장합니다.

| 환경 변수               | 필수 | 설명                                                  |
| ----------------------- | ---- | ----------------------------------------------------- |
| `POLAR_ACCESS_TOKEN`    | ✅   | Polar API 액세스 토큰                                 |
| `POLAR_WEBHOOK_SECRET`  | ✅   | Polar webhook endpoint의 서명 검증 시크릿             |
| `POLAR_ENVIRONMENT`     | ❌   | `sandbox` 또는 `production` (기본 테스트는 `sandbox`) |
| `POLAR_ORGANIZATION_ID` | ❌   | live smoke에서 조직 읽기 검증을 수행할 때 필요        |

`accessToken`과 `webhookSecret`은 diagnostics, 로그, 테스트 출력에 원문으로 남기지 않습니다.

## 사용법

### Checkout 생성

```typescript
import { Container } from "@croco/framework-context";
import { PolarBillingGateway } from "@croco/billing-polar";

const gateway = Container.get(PolarBillingGateway);

const checkout = await gateway.createCheckout({
  billingAccountId: "tenant-123",
  email: "user@example.com",
  productId: "prod-456",
  successUrl: "https://example.com/success",
  cancelUrl: "https://example.com/cancel",
});
```

### 구독 관리

```typescript
await gateway.cancelSubscription("sub-789", false);
await gateway.resumeSubscription("sub-789");
const portalUrl = await gateway.getCustomerPortalUrl("cust-101");
```

### 웹훅 처리

```typescript
import { PolarWebhookHandler } from "@croco/billing-polar";

const handler = new PolarWebhookHandler(config, {
  store: billingStore,
  eventPublisher: eventPublisher,
});

const result = await handler.handle(requestBody, requestHeaders);
```

웹훅 검증에는 Polar가 보낸 raw body와 signature header가 필요합니다. JSON으로 재직렬화한 body를
사용하면 서명 검증이 실패할 수 있습니다. 잘못된 서명 또는 구조적으로 잘못된 webhook payload는
`WebhookValidationProblem`으로 실패합니다. Polar SDK가 replay-style signature, 오래된 timestamp,
또는 clock-skew를 거부하면 Croco는 안정적인 `WEBHOOK_VALIDATION_FAILED` Problem code와 HTTP
400 status로 정규화하고, webhook secret/signature 값은 응답 detail에 노출하지 않습니다.

## 웹훅 이벤트 타입

### 구독 이벤트

| 이벤트 타입             | 설명          |
| ----------------------- | ------------- |
| `subscription.created`  | 구독 생성     |
| `subscription.active`   | 구독 활성화   |
| `subscription.updated`  | 구독 업데이트 |
| `subscription.canceled` | 구독 취소     |
| `subscription.revoked`  | 구독 해지     |
| `subscription.past_due` | 결제 지연     |

### 주문 이벤트

| 이벤트 타입     | 설명           |
| --------------- | -------------- |
| `order.paid`    | 주문 결제 완료 |
| `order.created` | 주문 생성      |
| `order.updated` | 주문 업데이트  |

## 멱등성

Polar 웹훅은 `eventId`를 멱등성 키로 사용합니다:

- 같은 `eventId`는 한 번만 처리됩니다
- 동일한 `webhook-id`, timestamp, signature로 재전송된 delivery는 성공 응답을 유지하면서 도메인
  side effect를 반복하지 않습니다
- 진행 중인 이벤트는 메모리에서 추적하여 중복 실행 방지
- 저장소의 중복 reservation 충돌은 이미 처리된 delivery로 간주합니다
- 처리 실패 시 `failWebhook`으로 롤백 지원

## 스키마

### PolarSubscriptionData

```typescript
type PolarSubscriptionData = {
  id: string;
  status: "active" | "past_due" | "canceled" | "revoked" | "trialing";
  customer?: {
    externalId?: string | null;
    metadata?: Record<string, unknown> | null;
  };
  product?: {
    id?: string;
  };
  currentPeriodEnd?: Date | string | null;
  cancelAtPeriodEnd?: boolean | null;
};
```

### PolarOrderData

```typescript
type PolarOrderData = {
  id: string;
  amount?: number;
  currency?: string;
  createdAt?: Date | string | null;
  customer?: {
    externalId?: string | null;
    metadata?: Record<string, unknown> | null;
  };
};
```

## 재시도 정책

Polar API 호출에 자동 재시도 적용:

- **전략**: 지수 백오프
- **초기 간격**: 500ms
- **최대 간격**: 5초
- **최대 경과 시간**: 15초
- **재시도 코드**: 429, 500, 502, 503, 504

## Diagnostics / Readiness

`PolarBillingDiagnosticsProvider`는 설정 존재 여부와 선택적 readiness check 결과를
`@croco/diagnostics-core`의 `DiagnosticsProvider` 형태로 노출합니다.

```typescript
import { PolarBillingDiagnosticsProvider } from "@croco/billing-polar";

const provider = new PolarBillingDiagnosticsProvider(config);
const health = await provider.getHealth();
```

기본 diagnostics는 Polar에 네트워크 요청을 보내지 않습니다. live readiness가 필요하면
`readinessCheck`를 주입합니다. 반환되는 details는 token, secret, signature, password, api key 같은
민감한 키를 자동으로 redaction합니다.

## 에러 처리

```typescript
import {
  PolarCustomerNotFoundProblem,
  PolarMissingConfigProblem,
  PolarRetryableUpstreamProblem,
  PolarSubscriptionNotFoundProblem,
  PolarTerminalUpstreamProblem,
  PolarValidationProblem,
  WebhookValidationProblem,
  WebhookProcessingProblem,
  BillingStatusMappingProblem,
} from "@croco/billing-polar";
```

| 에러                               | 코드                                   | 카테고리            | 설명                                 |
| ---------------------------------- | -------------------------------------- | ------------------- | ------------------------------------ |
| `PolarMissingConfigProblem`        | `billing-polar/missing-config`         | InternalServerError | 필수 Polar 설정 누락                 |
| `PolarValidationProblem`           | `billing-polar/validation-failed`      | ValidationError     | Polar 요청 또는 설정 검증 실패       |
| `PolarCustomerNotFoundProblem`     | `billing-polar/customer-not-found`     | NotFound            | 고객 포털/고객 조회 대상 없음        |
| `PolarSubscriptionNotFoundProblem` | `billing-polar/subscription-not-found` | NotFound            | 구독 취소/재개 대상 없음             |
| `PolarRetryableUpstreamProblem`    | `billing-polar/retryable-upstream`     | InternalServerError | 재시도 가능한 Polar upstream 실패    |
| `PolarTerminalUpstreamProblem`     | `billing-polar/terminal-upstream`      | InternalServerError | 재시도로 복구되지 않는 upstream 실패 |
| `WebhookValidationProblem`         | `WEBHOOK_VALIDATION_FAILED`            | BadRequest          | 웹훅 서명 또는 payload 검증 실패     |
| `WebhookProcessingProblem`         | `WEBHOOK_PROCESSING_FAILED`            | InternalServerError | 웹훅 처리 실패                       |
| `BillingStatusMappingProblem`      | `BILLING_STATUS_MAPPING_FAILED`        | InternalServerError | 알 수 없는 결제 상태                 |

Polar SDK 오류는 not-found, validation, retryable upstream, terminal upstream Problem으로
정규화됩니다. SDK의 원본 token, webhook secret, authorization header는 Problem extensions에
포함하지 않습니다.

## 검증

기본 검증은 Polar credential 없이 실행됩니다.

```bash
pnpm --filter @croco/billing-polar test
pnpm --filter @croco/testing test
```

`@croco/testing`의 `createBillingProviderConformanceSuite()`를 사용해 checkout, customer portal,
subscription lifecycle, webhook 처리, webhook idempotency, invalid signature/payload rejection을
mocked Polar backend로 검증합니다.

`PolarWebhookHandler` 테스트는 credential 없이 real `@polar-sh/sdk` signature verifier를 통과하는
replayed signed delivery, duplicate event idempotency, stale timestamp/clock-skew rejection mapping,
invalid signature Problem code/status, 그리고 caller-facing Problem detail redaction을 검증합니다.
`PolarBillingDiagnosticsProvider` 테스트는 provider report에 signature-like diagnostics가 노출되지
않는지 확인합니다.

### Optional live smoke

live smoke는 환경 변수가 없으면 skip됩니다.

```bash
POLAR_ACCESS_TOKEN=... \
POLAR_WEBHOOK_SECRET=... \
POLAR_ORGANIZATION_ID=... \
POLAR_ENVIRONMENT=sandbox \
pnpm --filter @croco/billing-polar test -- src/tests/PolarLiveSmoke.spec.ts
```

이 smoke는 configured organization을 읽는 read-only readiness check만 수행합니다.

## 의존성

| 패키지                     | 버전 | 설명                       |
| -------------------------- | ---- | -------------------------- |
| `@croco/billing-core`      | -    | 빌링 도메인 모델           |
| `@croco/diagnostics-core`  | -    | safe readiness diagnostics |
| `@croco/events-core`       | -    | 이벤트 발행/구독           |
| `@croco/telemetry-api`     | -    | 분산 추적                  |
| `@croco/framework-context` | -    | DI 컨테이너                |
| `@polar-sh/sdk`            | -    | Polar SDK                  |
| `zod`                      | -    | 스키마 검증                |

## 라이선스

MIT

---

## 성숙도 안내

| 항목                 | 상태                                                                     | 설명                                                                                                    |
| -------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| **현재 상태**        | 🟡 beta                                                                  | 기능 완성, 실사용 검증 중                                                                               |
| **주요 기능**        | Checkout 생성, Webhook 처리, 구독 관리 (활성화/취소/재개), 고객 포털 URL | Polar 플랫폼 핵심 연동 기능                                                                             |
| **테스트 존재 여부** | ✅                                                                       | 단위테스트, billing conformance, diagnostics, optional live smoke test                                  |
| **운영 증거 수준**   | L2                                                                       | credential 없는 mocked conformance와 readiness diagnostics 있음 / live Polar smoke는 env-gated optional |

### 참고

- 이 패키지는 `@croco/billing-core` 인터페이스를 구현합니다.
- 웹훅 서명 검증과 멱등성 처리가 구현되어 있습니다.
- 재시도 정책(지수 백오프)이 적용되어 있습니다.
- production-ready 승격에는 기본 conformance와 diagnostics 통과 외에도 실제 Polar credential로 수행한
  optional live smoke 증거가 필요합니다. package catalog maturity는 해당 증거가 확인되기 전까지 beta로
  유지합니다.
