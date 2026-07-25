# @croco/metering-core

SaaS 사용량 기록, quota 검증, idempotency 처리를 제공하는 미터링 코어 패키지입니다.

## 설치

```bash
pnpm add @croco/metering-core
```

## 사용법

```ts
import {
  defineMeter,
  dimension,
  IdempotencyManager,
  MeterRegistry,
  MeteringService,
  RedisUsageStorage,
  setMeteringService,
} from "@croco/metering-core";

const usageStorage = new RedisUsageStorage(redisClient);
const idempotencyManager = new IdempotencyManager(redisClient);
const meterRegistry = new MeterRegistry(meterRepository);

const meteringService = new MeteringService({
  meterRegistry,
  usageStorage,
  idempotencyManager,
  eventBus,
});

setMeteringService(meteringService);

const aiTokens = defineMeter({
  key: "ai.tokens",
  aggregation: "SUM",
  unit: "token",
  dimensions: {
    model: dimension.enum(["gpt-5", "gpt-5-mini"]),
  },
  billing: "required",
});

await meteringService.record(aiTokens, {
  tenantId: "tenant-123",
  eventId: requestId,
  value: usage.totalTokens,
  dimensions: { model },
  metadata: { route: "/chat" },
});
```

`billing: "required"` meter는 재시도 사이에서 동일하게 유지되는 비어 있지 않은 `eventId`가 필수입니다.
`dimensions`는 선언한 key와 enum 값만 허용되며 application `metadata`와 합쳐지지 않습니다. `SUM` meter는
유한한 `value`가 필수이고 `COUNT` meter는 `value`를 생략해 1을 기록합니다. descriptor는 함수 없이
결정적으로 직렬화됩니다.

```ts
const apiRequests = defineMeter({
  key: "api.requests",
  aggregation: "COUNT",
  unit: "request",
  dimensions: {},
  billing: "local",
});

class ApiController {
  @Metered({ meter: apiRequests })
  async listUsers(): Promise<void> {}
}
```

`@Metered({ meter })`는 별도 추출기 없이 안전하게 기록할 수 있는 dimensionless local `COUNT` meter만
허용합니다.

### 호환성 API

기존 string 기반 `record(RecordOptions)`와 `{ meterId }` decorator는 source-compatible 호환 경로로
유지됩니다. 이 경로는 `idempotencyKey`가 없으면 기존처럼 ID를 생성하며 billing dimension 계약을
제공하지 않습니다.

```ts
await meteringService.record({
  tenantId: "tenant-123",
  meterId: "api_calls",
  value: 1,
});

class LegacyApiController {
  @Metered({ meterId: "api_calls" })
  async listUsers(): Promise<void> {}
}
```

## API 레퍼런스

### 핵심 클래스

- `MeteringService`, 사용량 기록과 조회를 담당합니다.
- `MeterRegistry`, 테넌트별 meter 정의를 조회하고 캐시합니다.
- `QuotaManager`, quota 확인과 기록을 원자적으로 처리합니다.
- `IdempotencyManager`, 중복 기록을 방지합니다.
- `RedisUsageStorage`, Redis 기반 실시간 사용량 저장소입니다.
- `UsageAggregator`, Redis 데이터를 영구 저장소로 flush 합니다.

### 데코레이터

- `@Meter`, 클래스에 meter 정의를 선언합니다.
- `@Metered`, 메서드 호출 시 사용량을 자동 기록합니다.
- `setMeteringService`, 데코레이터가 사용할 전역 서비스를 등록합니다.

### 주요 타입

- `RecordOptions`, 사용량 기록 입력입니다.
- `MeterRef`, definition-first meter 참조입니다.
- `MeterDescriptor`, 직렬화 가능한 meter 계약입니다.
- `MeterRecordInput`, meter 참조에서 추론되는 typed usage 입력입니다.
- `UsageQueryOptions`, 기간별 사용량 조회 입력입니다.
- `MeterDefinition`, meter 정의입니다.
- `UsageRecord`, 기록된 사용량 엔트리입니다.
- `FlushResult`, 배치 flush 결과입니다.

### 이벤트와 문제 타입

- 이벤트: `UsageRecordedEvent`, `QuotaExceededEvent`
- 문제 타입: `DuplicateRecordProblem`, `InvalidMeterDefinitionProblem`, `InvalidMeterProblem`,
  `InvalidUsageEnvelopeProblem`, `QuotaExceededProblem`, `RedisProblem`

## 구현 포인트

- 저장소는 `MeterRepository`, `UsageStorage`, `RedisClient` 계약을 구현해 연결합니다.
- quota 초과 시 `allowOverQuota` 설정에 따라 이벤트 발행 또는 Problem 예외가 발생합니다.
- billing, entitlements 같은 상위 패키지와 이벤트 기반으로 연결할 수 있습니다.
- `RedisUsageStorage.resetBillingCycle(tenantId)`는 현재 billing cycle의 tenant usage key를 `KEYS` 대신 bounded `SCAN` batch로 삭제합니다.
- tenant-wide reset은 이미 삭제된 key를 다시 삭제하지 않는 idempotent 작업이며, batch 사이에 새로 기록된 현재 cycle usage는 다음 reset에서 정리될 수 있습니다.
