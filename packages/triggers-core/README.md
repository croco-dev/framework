# @croco/triggers-core

스케줄링 및 이벤트 기반 실행을 위한 트리거 시스템입니다. Cron 표현식이나 외부 이벤트를 통해 작업을 예약하고 실행할 수 있게 해줍니다.

## 특징

- **데코레이터 기반**: 선언적인 방식으로 트리거 정의
- **Cron 지원**: 표준 Cron 표현식을 통한 주기적 작업 예약
- **확장성**: Webhook, EventBridge 등 다양한 트리거 소스로 확장 가능

## 설치

```bash
pnpm add @croco/triggers-core
```

## 사용 방법

### @Cron 데코레이터

메서드를 주기적으로 실행하도록 예약합니다.

```typescript
import { Cron } from "@croco/triggers-core";
import { Component } from "@croco/framework-context";

@Component()
export class ReportScheduler {
  // 매일 자정에 실행
  @Cron("0 0 * * *", { name: "daily-report" })
  async generateDailyReport() {
    console.log("Generating daily report...");
    // ... 리포트 생성 로직
  }

  // 5분마다 실행
  @Cron("*/5 * * * *")
  async healthCheck() {
    console.log("System health check...");
  }
}
```

### 타입이 지정된 Event/Webhook 트리거

`defineEventTrigger`와 `defineWebhookTrigger`는 registry가 읽을 수 있는 이름·경로·HTTP method를
직렬화 가능한 reference로 만들고, 데코레이터가 handler의 첫 인자와 반환 타입을 컴파일 단계에서
검증하게 합니다. 기존 문자열 event와 path/method 호출도 호환성을 위해 계속 지원됩니다.

```typescript
import { defineEventTrigger, defineWebhookTrigger, OnEvent, OnWebhook } from "@croco/triggers-core";

type OrderPlaced = {
  orderId: string;
};

const orderPlaced = defineEventTrigger<OrderPlaced>()("OrderPlaced");
const stripeWebhook = defineWebhookTrigger<Request, Response>()("/webhooks/stripe", "POST");

class OrderTriggers {
  @OnEvent(orderPlaced)
  async recordOrder(event: OrderPlaced): Promise<void> {
    console.log(event.orderId);
  }

  @OnWebhook(stripeWebhook)
  async receiveStripe(request: Request): Promise<Response> {
    const payload = await request.json();
    return Response.json(payload);
  }
}
```

지원하지 않는 HTTP method나 reference 계약과 일치하지 않는 handler payload/result는 `typecheck`에서
거부됩니다. 기존 코드에서 설정값을 `string`으로 전달하는 경우도 계속 지원하며, 실제 값이 지원되지
않는 method라면 decorator 등록 시 `triggers-core/unsupported-webhook-method` Problem으로 실패합니다.

### 트리거 등록 확인

`triggerRegistry`를 통해 등록된 모든 트리거 정보를 조회할 수 있습니다. 이는 인프라(EventBridge Scheduler 등) 프로비저닝 시 유용합니다.

```typescript
import { triggerRegistry } from "@croco/triggers-core";

const triggers = triggerRegistry.getAll();
triggers.forEach((trigger) => {
  console.log(`Registered trigger: ${trigger.methodName} (${trigger.expression})`);
});
```
