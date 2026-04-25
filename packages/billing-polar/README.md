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
import { PolarConfig } from '@croco/billing-polar';

const config: PolarConfig = {
  accessToken: 'polar-access-token',
  environment: 'sandbox',
  webhookSecret: 'polar-webhook-secret',
  organizationId: 'org-123',
};
```

### PolarConfig

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `accessToken` | `string` | ✅ | Polar API 액세스 토큰 |
| `environment` | `'sandbox' \| 'production'` | ✅ | Polar 환경 |
| `webhookSecret` | `string` | ✅ | 웹훅 서명 검증 시크릿 |
| `organizationId` | `string` | ❌ | Polar 조직 ID |

## 사용법

### Checkout 생성

```typescript
import { Container } from '@croco/framework-context';
import { PolarBillingGateway } from '@croco/billing-polar';

const gateway = Container.get(PolarBillingGateway);

const checkout = await gateway.createCheckout({
  billingAccountId: 'tenant-123',
  email: 'user@example.com',
  productId: 'prod-456',
  successUrl: 'https://example.com/success',
  cancelUrl: 'https://example.com/cancel',
});
```

### 구독 관리

```typescript
await gateway.cancelSubscription('sub-789', false);
await gateway.resumeSubscription('sub-789');
const portalUrl = await gateway.getCustomerPortalUrl('cust-101');
```

### 웹훅 처리

```typescript
import { PolarWebhookHandler } from '@croco/billing-polar';

const handler = new PolarWebhookHandler(config, {
  store: billingStore,
  eventPublisher: eventPublisher,
});

const result = await handler.handle(requestBody, requestHeaders);
```

## 웹훅 이벤트 타입

### 구독 이벤트

| 이벤트 타입 | 설명 |
|-------------|------|
| `subscription.created` | 구독 생성 |
| `subscription.active` | 구독 활성화 |
| `subscription.updated` | 구독 업데이트 |
| `subscription.canceled` | 구독 취소 |
| `subscription.revoked` | 구독 해지 |
| `subscription.past_due` | 결제 지연 |

### 주문 이벤트

| 이벤트 타입 | 설명 |
|-------------|------|
| `order.paid` | 주문 결제 완료 |
| `order.created` | 주문 생성 |
| `order.updated` | 주문 업데이트 |

## 멱등성

Polar 웹훅은 `eventId`를 멱등성 키로 사용합니다:

- 같은 `eventId`는 한 번만 처리됩니다
- 진행 중인 이벤트는 메모리에서 추적하여 중복 실행 방지
- 처리 실패 시 `unmarkWebhookProcessed`로 롤백 지원

## 스키마

### PolarSubscriptionData

```typescript
type PolarSubscriptionData = {
  id: string;
  status: 'active' | 'past_due' | 'canceled' | 'revoked' | 'trialing';
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

## 에러 처리

```typescript
import {
  WebhookValidationProblem,
  WebhookProcessingProblem,
  BillingStatusMappingProblem,
} from '@croco/billing-polar';
```

| 에러 | 코드 | 카테고리 | 설명 |
|------|------|----------|------|
| `WebhookValidationProblem` | `WEBHOOK_VALIDATION_FAILED` | BadRequest | 웹훅 서명 검증 실패 |
| `WebhookProcessingProblem` | `WEBHOOK_PROCESSING_FAILED` | InternalServerError | 웹훅 처리 실패 |
| `BillingStatusMappingProblem` | `BILLING_STATUS_MAPPING_FAILED` | InternalServerError | 알 수 없는 결제 상태 |

## 의존성

| 패키지 | 버전 | 설명 |
|--------|------|------|
| `@croco/billing-core` | - | 빌링 도메인 모델 |
| `@croco/events-core` | - | 이벤트 발행/구독 |
| `@croco/telemetry-api` | - | 분산 추적 |
| `@croco/framework-context` | - | DI 컨테이너 |
| `@polar-sh/sdk` | - | Polar SDK |
| `zod` | - | 스키마 검증 |

## 라이선스

MIT
---

## 성숙도 안내

| 항목 | 상태 | 설명 |
|------|------|------|
| **현재 상태** | 🟡 beta | 기능 완성, 실사용 검증 중 |
| **주요 기능** | Checkout 생성, Webhook 처리, 구독 관리 (활성화/취소/재개), 고객 포털 URL | Polar 플랫폼 핵심 연동 기능 |
| **테스트 존재 여부** | ✅ | 단위테스트 3개 파일 (`PolarWebhookHandler.spec.ts`, `PolarBillingGateway.spec.ts`, `PolarEventMapper.spec.ts`) |
| **운영 증거 수준** | L1 | 단위테스트 있음 / 통합테스트 미존재 / 샌드박스 미실행 / 프로덕션 미사용 |

### 참고

- 이 패키지는 `@croco/billing-core` 인터페이스를 구현합니다.
- 웹훅 서명 검증과 멱등성 처리가 구현되어 있습니다.
- 재시도 정책(지수 백오프)이 적용되어 있습니다.
