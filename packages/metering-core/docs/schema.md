# metering-core 스키마 정의

이 문서는 metering-core 패키지가 기대하는 DB 스키마와 Redis 키 패턴을 정의합니다.

## Database Schema

### meters 테이블

Meter 정의를 저장하는 테이블입니다.

```sql
CREATE TABLE meters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(255) NOT NULL,
  meter_id VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('COUNT', 'UNIQUE_COUNT', 'CUSTOM_EVENT')),
  quota INTEGER,
  allow_over_quota BOOLEAN DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(tenant_id, meter_id)
);

-- 인덱스
CREATE INDEX idx_meters_tenant_id ON meters(tenant_id);
CREATE INDEX idx_meters_meter_id ON meters(meter_id);
```

### usage_records 테이블

배치 저장된 Usage 기록을 저장하는 테이블입니다.

```sql
CREATE TABLE usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(255) NOT NULL,
  meter_id VARCHAR(255) NOT NULL,
  value INTEGER NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  idempotency_key VARCHAR(255) NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(tenant_id, meter_id, idempotency_key)
);

-- 인덱스 (조회 성능 최적화)
CREATE INDEX idx_usage_records_tenant_meter_timestamp
  ON usage_records(tenant_id, meter_id, timestamp);
CREATE INDEX idx_usage_records_idempotency
  ON usage_records(tenant_id, meter_id, idempotency_key);
```

## Redis Key Patterns

### Usage 데이터 (Sorted Set)

실시간 Usage 데이터는 Redis Sorted Set에 저장됩니다.

**키 패턴:**

```
usage2:{encodedTenantId}:{encodedMeterId}:{period}
```

**예시:**

```
usage2:tenant-123:api_calls:2024-01
usage2:tenant-123:storage:2024-01-15
```

각 identifier segment는 안전한 ASCII 문자를 제외한 UTF-16 code unit을 고정 폭으로 인코딩하므로,
delimiter나 Unicode가 포함된 서로 다른 tuple도 같은 physical key로 충돌하지 않습니다.

**자료구조:**

- Type: Sorted Set (ZSET)
- Score: timestamp (밀리초)
- Member: `{usageId}:{value}`

**명령어 예시:**

```redis
# 저장
ZADD usage2:tenant-123:api_calls:2024-01 1706745600000 "uuid-abc:5"

# 조회 (시간 범위)
ZRANGEBYSCORE usage2:tenant-123:api_calls:2024-01 1706745600000 1706832000000

# 삭제 (배치 저장 후)
ZREMRANGEBYSCORE usage2:tenant-123:api_calls:2024-01 0 1706832000000
```

### Idempotency 키 (String)

요청 lifecycle ownership과 durable usage record deduplication은 서로 독립된 키를 사용합니다.

**키 패턴:**

```
idem2:lifecycle:{encodedTenantId}:{encodedMeterId}:{encodedIdempotencyKey}
idem2:record:{encodedTenantId}:{encodedMeterId}:{encodedIdempotencyKey}
```

**예시:**

```
idem2:lifecycle:tenant-123:api_calls:req-abc-123
idem2:record:tenant-123:api_calls:req-abc-123
```

**자료구조:**

- Type: String
- Operation value: `"IN_PROGRESS"` 또는 `"COMPLETED"`
- Record value: `"1"`
- TTL: 24시간 (86400초)

`lifecycle` 키는 처리 소유권과 완료 상태만 나타내며, `record` 키는 sorted set에 반영된 usage의
deduplication만 나타냅니다. 두 계약은 동일한 logical request에서도 물리적으로 충돌하지 않습니다.
Usage sorted set과 `record` 키는 한 Lua script에서 원자적으로 기록되므로 첫 성공은 usage를 정확히 한 번
반영하고 같은 idempotency key의 재시도는 두 번째 record를 만들지 않습니다.

### Legacy Redis key 마이그레이션

이전 버전의 `idem:{tenantId}:{meterId}:{idempotencyKey}` 키는 lifecycle과 record 의미가 충돌하고,
`usage:{tenantId}:{meterId}:{period}`는 segment 경계가 모호하므로 새 버전에서 읽거나 자동 변환하지
않습니다. 기존 idempotency 키는 삭제하지 않고 원래 TTL에 따라 만료시킵니다.

rolling deployment 중에는 구버전 writer와 신버전 writer가 서로의 idempotency namespace를 인식하지
못하므로 혼합 운영하지 마십시오. 모든 metering writer를 중지하고 legacy `idem:*` 키가 모두 만료되었음을
확인한 뒤 신버전 writer를 시작해야 upgrade 경계를 넘는 retry의 중복 기록을 방지할 수 있습니다. 대기
시간은 configured lifecycle TTL, 24시간 record TTL, `isIdempotent()`에 전달한 custom TTL을 포함해
배포에서 사용한 가장 긴 TTL 이상이어야 합니다. 그 대기 시간을 보장할 수 없다면 upstream에서 upgrade
경계를 넘는 request key 재전송을 차단해야 합니다.

## Period 계산

### AggregationPeriod별 키 생성

| Period          | Format          | Example         |
| --------------- | --------------- | --------------- |
| `hour`          | `YYYY-MM-DD-HH` | `2024-01-15-14` |
| `day`           | `YYYY-MM-DD`    | `2024-01-15`    |
| `billing_cycle` | `YYYY-MM`       | `2024-01`       |

### TypeScript 헬퍼 예시

```typescript
function getPeriodKey(date: Date, period: AggregationPeriod): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");

  switch (period) {
    case "hour":
      return `${year}-${month}-${day}-${hour}`;
    case "day":
      return `${year}-${month}-${day}`;
    case "billing_cycle":
      return `${year}-${month}`;
  }
}
```

## 멀티테넌시 격리

모든 쿼리는 반드시 `tenant_id`를 포함해야 합니다.

### DB 쿼리 예시

```sql
-- 올바른 쿼리 (tenant_id 포함)
SELECT * FROM meters WHERE tenant_id = $1 AND meter_id = $2;

-- 잘못된 쿼리 (tenant_id 누락 - 보안 취약점!)
SELECT * FROM meters WHERE meter_id = $1;
```

### Redis 키 예시

```redis
# 올바른 키 (tenant_id 포함)
GET usage2:tenant-123:api_calls:2024-01

# 잘못된 키 (tenant_id 누락 - 보안 취약점!)
GET usage2:api_calls:2024-01
```

## 마이그레이션 가이드

1. 위의 SQL 스키마를 사용하여 테이블 생성
2. Redis 인스턴스 준비 (Upstash 권장)
3. `MeterRepository` 구현체 생성 (Drizzle/Prisma)
4. `RedisClient` 어댑터 생성 (ioredis/upstash)
5. DI 컨테이너에 구현체 등록
