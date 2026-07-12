# @croco/idempotency-core

HTTP 요청, webhook, task, event consumer가 같은 방식으로 idempotency key를 만들고 저장소 어댑터를 검증할 수 있는 코어 패키지입니다.

## 설치

```bash
pnpm add @croco/idempotency-core
```

## 사용법

```ts
import {
  IdempotencyCoordinator,
  InMemoryIdempotencyStore,
  deriveHttpIdempotencyKey,
} from "@croco/idempotency-core";

const store = new InMemoryIdempotencyStore<{ orderId: string }>();
const coordinator = new IdempotencyCoordinator({ store });

const key = deriveHttpIdempotencyKey({
  tenantId: "tenant-a",
  idempotencyKey: "checkout-123",
  method: "POST",
  path: "/orders",
  bodyFingerprint: "sha256:request-body",
});

const result = await coordinator.execute({ key, ttlMs: 86_400_000 }, async () => {
  return { orderId: "order-1" };
});
```

동일 key와 동일 fingerprint는 완료된 응답을 replay합니다. 동일 key에 다른 fingerprint가 들어오면 `IdempotencyConflictProblem`으로 실패합니다.

TTL이 설정된 in-flight reservation은 `expiresAt` 직전까지만 완료할 수 있습니다. 만료 시각부터 `commit`과 `fail`은
`IdempotencyReservationExpiredProblem`으로 거부되며, 새 `reserve`가 발급한 reservation만 상태를 전이할 수 있습니다.

## 통합 키 헬퍼

```ts
import {
  deriveEventConsumerIdempotencyKey,
  deriveTaskIdempotencyKey,
  deriveWebhookIdempotencyKey,
} from "@croco/idempotency-core";

const webhookKey = deriveWebhookIdempotencyKey({
  provider: "stripe",
  eventId: "evt_123",
  tenantId: "tenant-a",
});

const taskKey = deriveTaskIdempotencyKey({
  taskName: "invoice.send",
  taskId: "job-123",
  tenantId: "tenant-a",
  payloadFingerprint: "sha256:payload",
});

const eventKey = deriveEventConsumerIdempotencyKey({
  consumerName: "billing-projection",
  eventId: "event-123",
  eventType: "invoice.created",
  tenantId: "tenant-a",
});
```

## Store conformance

저장소 어댑터는 `createIdempotencyStoreConformanceSuite()`가 반환하는 case를 자체 테스트 러너에서 실행해 replay, in-flight, conflict, tenant scope, expiration 동작을 검증할 수 있습니다.

```ts
import { createIdempotencyStoreConformanceSuite } from "@croco/idempotency-core";

const suite = createIdempotencyStoreConformanceSuite({
  createStore: () => new MyDurableIdempotencyStore(),
});

for (const testCase of suite.cases) {
  it(testCase.name, testCase.run);
}
```

## API 요약

- `deriveIdempotencyKey()`: explicit key, request fingerprint, provider event id, tenant-scoped key를 공통 `DerivedIdempotencyKey`로 정규화합니다.
- `deriveHttpIdempotencyKey()`, `deriveWebhookIdempotencyKey()`, `deriveTaskIdempotencyKey()`, `deriveEventConsumerIdempotencyKey()`: 런타임별 key helper입니다.
- `IdempotencyStore`: `reserve`, `commit`, `replay`, `fail`, `expire` 저장소 계약입니다.
- `IdempotencyCoordinator`: 저장소 계약 위에서 execute/replay/in-flight/failure 결과를 통합합니다.
- `InMemoryIdempotencyStore`: conformance와 로컬 개발에 사용할 수 있는 reference store입니다.
- `IdempotencyConflictProblem`: 동일 key와 다른 fingerprint 충돌을 표준 Problem으로 표현합니다.
- `IdempotencyReservationExpiredProblem`: 만료된 reservation의 완료 시도를 안전한 진단 시각과 함께 표현합니다.

## 라이선스

MIT
