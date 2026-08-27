# @croco/features-posthog

PostHog 기반 Feature 플래그 관리 구현체. `@croco/features-core`의 `FeatureManager`를 구현하여 PostHog Feature Flags와 통합합니다.

## 설치

```bash
pnpm add @croco/features-posthog
```

## 의존성

이 패키지를 사용하려면 다음 패키지도 필요합니다:

```bash
pnpm add @croco/integrations-posthog
```

## 사용법

### 기본 설정

PostHogFeatureManager를 DI 컨테이너에 등록합니다.

```typescript
import { Container } from "@croco/framework-context";
import { PostHogFeatureManager } from "@croco/features-posthog";
import { PostHogClient } from "@croco/integrations-posthog";

const posthogClient = new PostHogClient({
  apiKey: process.env.POSTHOG_API_KEY!,
  host: "https://app.posthog.com",
});

Container.register(PostHogFeatureManager, {
  scope: "singleton",
  useFactory: () => new PostHogFeatureManager(posthogClient),
});
```

### 서비스에서 사용

```typescript
import { Service } from "@croco/framework-context";
import { FeatureManager } from "@croco/features-core";

@Service()
class OrderService {
  constructor(private readonly features: FeatureManager) {}

  async createOrder(dto: CreateOrderDto) {
    const isNewFlow = await this.features.isEnabled("new-order-flow", {
      userId: dto.userId,
    });

    if (isNewFlow) {
      return this.createOrderV2(dto);
    }
    return this.createOrderV1(dto);
  }

  async getDiscount(userId: string) {
    const variant = await this.features.getVariant("discount-variant", { userId });

    switch (variant) {
      case "20_percent":
        return 0.2;
      case "15_percent":
        return 0.15;
      default:
        return 0.1;
    }
  }
}
```

## API Reference

### PostHogFeatureManager

PostHog Feature Flags와 통합하는 FeatureManager 구현체입니다.

#### `isEnabled(flag: string, context?: Record<string, unknown>): Promise<boolean>`

Feature 플래그가 활성화되어 있는지 확인합니다.

**Context 자동 주입:**

- `distinctId`: `context.userId` → `Context.getCurrentUser().id` → `anonymous:<requestId>` →
  `tenant:<context.tenantId>` → `tenant:<Context.getTenantId()>` → `anonymous`
- `groups`: `context.groups` → `{ tenant: context.tenantId }` → `{ tenant: Context.getTenantId() }`

`context.tenantId`는 문자열이고, 공백을 제거한 길이가 1 이상일 때만 명시적 테넌트로 사용합니다. 유효하지 않은 명시적
테넌트 ID는 PostHog `personProperties`에도 전달하지 않습니다.

#### `getVariant(flag: string, context?: Record<string, unknown>): Promise<string | boolean | object>`

Feature 플래그의 변형(variant) 값을 가져옵니다. A/B 테스트, 다변량 실험에 사용합니다.

**반환값:**

- 플래그가 비활성화: `false`
- 활성화: 변형 값 (문자열, 객체 등)

## Context 매핑

PostHog로 전달되는 컨텍스트:

| 소스               | PostHog 매핑                                                                                        |
| ------------------ | --------------------------------------------------------------------------------------------------- |
| `context.userId`   | 우선적으로 `distinctId`에 사용                                                                      |
| `context.groups`   | 우선적으로 `groups`에 사용                                                                          |
| `context.tenantId` | 유효할 때 명시적 groups가 없으면 `groups.tenant`에, 상위 식별자가 없으면 테넌트 `distinctId`에 사용 |
| `context.*`        | `undefined`, 객체, 함수를 제외하고 `personProperties`로 문자열 변환                                 |

## 라이선스

MIT
