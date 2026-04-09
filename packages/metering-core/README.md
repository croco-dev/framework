# @croco/metering-core

SaaS 사용량 기록, quota 검증, idempotency 처리를 제공하는 미터링 코어 패키지입니다.

## 설치

```bash
pnpm add @croco/metering-core
```

## 사용법

```ts
import {
  IdempotencyManager,
  MeterRegistry,
  MeteringService,
  RedisUsageStorage,
  setMeteringService,
} from '@croco/metering-core';

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

await meteringService.record({
  tenantId: 'tenant-123',
  meterId: 'api_calls',
  value: 1,
});
```

```ts
import { Meter, Metered } from '@croco/metering-core';

@Meter({ meterId: 'api_calls', type: 'COUNT', quota: 10000 })
class ApiController {
  @Metered({ meterId: 'api_calls' })
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
- `UsageQueryOptions`, 기간별 사용량 조회 입력입니다.
- `MeterDefinition`, meter 정의입니다.
- `UsageRecord`, 기록된 사용량 엔트리입니다.
- `FlushResult`, 배치 flush 결과입니다.

### 이벤트와 문제 타입

- 이벤트: `UsageRecordedEvent`, `QuotaExceededEvent`
- 문제 타입: `DuplicateRecordProblem`, `InvalidMeterProblem`, `QuotaExceededProblem`, `RedisProblem`

## 구현 포인트

- 저장소는 `MeterRepository`, `UsageStorage`, `RedisClient` 계약을 구현해 연결합니다.
- quota 초과 시 `allowOverQuota` 설정에 따라 이벤트 발행 또는 Problem 예외가 발생합니다.
- billing, entitlements 같은 상위 패키지와 이벤트 기반으로 연결할 수 있습니다.
