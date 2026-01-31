# @croco/metering-core

Usage Metering 핵심 패키지 - SaaS 애플리케이션을 위한 사용량 측정 및 quota 관리

## 설치

```bash
pnpm add @croco/metering-core
```

## 핵심 기능

- **사용량 기록**: API 호출, 스토리지, 대역폭 등 다양한 메트릭 추적
- **Quota 관리**: 테넌트별 사용량 제한 및 초과 처리
- **Idempotency**: 중복 기록 방지 (24시간 TTL)
- **실시간 집계**: Redis 기반 실시간 사용량 조회
- **배치 저장**: 장기 보관을 위한 DB 영구 저장
- **이벤트 발행**: billing-core와 연동을 위한 이벤트 기반 통합

## 빠른 시작

### 1. 설정

```typescript
import { Container } from 'typedi';
import {
  MeteringService,
  MeterRegistry,
  IdempotencyManager,
  RedisUsageStorage,
  setMeteringService,
} from '@croco/metering-core';

// Redis 클라이언트 (ioredis, upstash 등)
const redisClient = createRedisClient();

// 구성 요소 초기화
const usageStorage = new RedisUsageStorage(redisClient);
const idempotencyManager = new IdempotencyManager(redisClient);
const meterRegistry = new MeterRegistry(meterRepository); // 사용자 구현

const meteringService = new MeteringService({
  meterRegistry,
  usageStorage,
  idempotencyManager,
  eventBus, // optional: @croco/events-core
});

// 데코레이터용 서비스 설정
setMeteringService(meteringService);
```

### 2. 프로그래매틱 사용

```typescript
// 사용량 기록
const usage = await meteringService.record({
  tenantId: 'tenant-123',
  meterId: 'api_calls',
  value: 1,
  metadata: { endpoint: '/api/users' },
});

// 사용량 조회
const totalUsage = await meteringService.getUsage({
  tenantId: 'tenant-123',
  meterId: 'api_calls',
  period: 'billing_cycle',
});
```

### 3. 데코레이터 사용

```typescript
import { Meter, Metered } from '@croco/metering-core';

// 클래스에 Meter 정의
@Meter({
  meterId: 'api_calls',
  type: 'COUNT',
  quota: 10000,
})
class ApiController {
  // 메서드 호출 시 자동 기록
  @Metered({ meterId: 'api_calls' })
  async handleRequest(req: Request): Promise<Response> {
    // ...
  }

  // 커스텀 value 추출
  @Metered({
    meterId: 'data_transfer',
    valueExtractor: (args, result) => result.size,
  })
  async uploadFile(file: Buffer): Promise<{ size: number }> {
    // ...
  }
}
```

## API 레퍼런스

### MeteringService

핵심 서비스 클래스

```typescript
class MeteringService {
  // 사용량 기록
  record(options: RecordOptions): Promise<UsageRecord>;
  
  // 사용량 조회
  getUsage(options: UsageQueryOptions): Promise<number>;
}

type RecordOptions = {
  tenantId: string;
  meterId: string;
  value?: number;           // 기본값: 1
  idempotencyKey?: string;  // 미제공시 자동 생성
  metadata?: Record<string, unknown>;
};
```

### MeterRegistry

Meter 정의 관리

```typescript
class MeterRegistry {
  // 앱 시작 시 모든 Meter 로드
  loadAll(): Promise<void>;
  
  // Meter 조회
  get(tenantId: string, meterId: string): Promise<MeterDefinition | null>;
  getOrThrow(tenantId: string, meterId: string): Promise<MeterDefinition>;
  
  // 새 Meter 등록
  register(options: MeterRegistrationOptions): Promise<MeterDefinition>;
}
```

### UsageAggregator

배치 집계 및 DB 저장

```typescript
class UsageAggregator {
  // Redis → DB 배치 저장
  flushUsageToDB(tenantId: string, meterId: string): Promise<FlushResult>;
  
  // 테넌트 전체 flush
  flushAllForTenant(tenantId: string): Promise<FlushResult>;
}
```

### 데코레이터

```typescript
// 클래스 데코레이터 - Meter 정의
@Meter({
  meterId: string;
  type?: 'COUNT' | 'UNIQUE_COUNT' | 'CUSTOM_EVENT';  // 기본: 'COUNT'
  quota?: number;
  allowOverQuota?: boolean;  // 기본: false
})

// 메서드 데코레이터 - 자동 기록
@Metered({
  meterId: string;
  valueExtractor?: (args, result) => number;  // 기본: () => 1
  idempotencyKeyExtractor?: (args) => string;
  metadataExtractor?: (args, result) => Record<string, unknown>;
})
```

## 인터페이스

사용자가 구현해야 하는 인터페이스:

### MeterRepository

```typescript
interface MeterRepository {
  findByMeterIdAndTenant(meterId: string, tenantId: string): Promise<MeterDefinition | null>;
  save(meter: MeterRegistrationOptions): Promise<MeterDefinition>;
  findAll(): Promise<MeterDefinition[]>;
  findByTenant(tenantId: string): Promise<MeterDefinition[]>;
  saveUsageRecords(records: UsageRecord[]): Promise<void>;
}
```

### RedisClient

```typescript
interface RedisClient {
  zadd(key: string, score: number, member: string): Promise<number>;
  zrangebyscore(key: string, min: number, max: number): Promise<string[]>;
  set(key: string, value: string, mode: 'NX', expireMode: 'EX', expire: number): Promise<string | null>;
}
```

## 이벤트

billing-core 연동을 위한 도메인 이벤트:

- `UsageRecordedEvent`: 사용량 기록 시 발행
- `QuotaExceededEvent`: quota 초과 시 발행

## 에러 처리

RFC 7807 Problem 기반 에러:

- `QuotaExceededProblem` (403): quota 초과
- `InvalidMeterProblem` (404): Meter 없음
- `DuplicateRecordProblem` (409): 중복 기록
- `RedisProblem` (500): Redis 오류

## 스키마

DB 스키마 및 Redis 키 패턴은 [docs/schema.md](./docs/schema.md) 참조.

## 라이선스

MIT
