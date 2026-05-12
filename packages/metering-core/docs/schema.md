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
usage:{tenantId}:{meterId}:{period}
```

**예시:**

```
usage:tenant-123:api_calls:2024-01
usage:tenant-123:storage:2024-01-15
```

**자료구조:**

- Type: Sorted Set (ZSET)
- Score: timestamp (밀리초)
- Member: `{usageId}:{value}`

**명령어 예시:**

```redis
# 저장
ZADD usage:tenant-123:api_calls:2024-01 1706745600000 "uuid-abc:5"

# 조회 (시간 범위)
ZRANGEBYSCORE usage:tenant-123:api_calls:2024-01 1706745600000 1706832000000

# 삭제 (배치 저장 후)
ZREMRANGEBYSCORE usage:tenant-123:api_calls:2024-01 0 1706832000000
```

### Idempotency 키 (String)

중복 요청 방지를 위한 키입니다.

**키 패턴:**

```
idem:{tenantId}:{meterId}:{idempotencyKey}
```

**예시:**

```
idem:tenant-123:api_calls:req-abc-123
```

**자료구조:**

- Type: String
- Value: "1"
- TTL: 24시간 (86400초)

**명령어 예시:**

```redis
# 설정 (NX = 존재하지 않을 때만, EX = TTL)
SET idem:tenant-123:api_calls:req-abc-123 1 NX EX 86400

# 결과
# - "OK": 새 키 (기록 가능)
# - null: 이미 존재 (중복)
```

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
GET usage:tenant-123:api_calls:2024-01

# 잘못된 키 (tenant_id 누락 - 보안 취약점!)
GET usage:api_calls:2024-01
```

## 마이그레이션 가이드

1. 위의 SQL 스키마를 사용하여 테이블 생성
2. Redis 인스턴스 준비 (Upstash 권장)
3. `MeterRepository` 구현체 생성 (Drizzle/Prisma)
4. `RedisClient` 어댑터 생성 (ioredis/upstash)
5. DI 컨테이너에 구현체 등록
