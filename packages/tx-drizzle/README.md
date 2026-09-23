# @croco/tx-drizzle

Drizzle ORM용 `@croco/tx-core` 트랜잭션 어댑터입니다. Drizzle의 `db.transaction`/`tx.transaction(savepoint)`을 `tx-core`에 연결합니다.

## 설치

```bash
pnpm add @croco/framework-module @croco/tx-drizzle @croco/tx-core drizzle-orm typedi
```

## 사용법

### Application plugin

`drizzleTransaction`은 애플리케이션의 격리된 모듈 컨테이너에 `TxManager`를 등록하고 Drizzle 상태 확인을
`diagnostics.provider` contribution으로 제공합니다. 이 경로는 전역 `TxManagerRegistry`를 사용하지 않습니다.

```ts
import { createApplicationRuntime, defineCrocoApplication } from "@croco/framework-module";
import { TxManager } from "@croco/tx-core";
import { drizzleTransaction } from "@croco/tx-drizzle";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

const application = defineCrocoApplication({
  imports: [
    drizzleTransaction({
      db,
      transaction: { defaultNesting: "join" },
      diagnostics: { name: "primary-database" },
      shutdown: () => pool.end(),
    }),
  ],
});
const runtime = createApplicationRuntime(application);

await runtime.initialize();
const txManager = runtime.get(TxManager);
const diagnostics = runtime.getContributions("diagnostics.provider");
await runtime.dispose();
```

기존 `TxManagerRegistry`와 `Container.set` 경로는 호환성을 위해 유지되지만 새 애플리케이션 구성에는 plugin
factory를 사용하세요. plugin factory의 `db`, transaction 설정, diagnostics 이름은 명시적 입력이며 ambient
package discovery를 사용하지 않습니다. 애플리케이션이 데이터베이스 리소스를 소유하면 `shutdown`으로 정리
함수를 등록하고 `ApplicationRuntime.dispose()`가 완료될 때까지 기다리세요.

### 1. Drizzle DB 생성 및 어댑터 연결

```ts
import "reflect-metadata";
import { Container } from "typedi";
import { TxManager } from "@croco/tx-core";
import { createDrizzleTxAdapter } from "@croco/tx-drizzle";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

const adapter = createDrizzleTxAdapter(db);
const txManager = new TxManager(adapter, { defaultNesting: "join" });

Container.set(TxManager, txManager);
```

### 2. TxManager 등록

```ts
import 'reflect-metadata';
import { Container } from 'typedi';
import { TxManager } from '@croco/tx-core';
import { createDrizzleTxAdapter } from '@croco/tx-drizzle';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

const adapter = createDrizzleTxAdapter(db);
const txManager = new TxManager(adapter, { defaultNesting: 'join' });

Container.set(TxManager, txManager);
      const adapter = createDrizzleTxAdapter(db);
      const txManager = new TxManager(adapter, { defaultNesting: 'join' });
      Container.set(TxManager, txManager);
    },
  ],
});
```

### 3. 서비스에서 @Transactional 사용

```ts
import { Service } from "typedi";
import { Transactional, TxManager } from "@croco/tx-core";

@Service()
class UserService {
  constructor(private readonly txManager: TxManager<typeof db>) {}

  @Transactional()
  async createUser(name: string) {
    const client = this.txManager.getClient()!;
    await client.insert(users).values({ name });
  }

  @Transactional({ nesting: "savepoint" })
  async updateUserWithSavepoint(id: string, name: string) {
    const client = this.txManager.getClient()!;
    await client.update(users).set({ name }).where(eq(users.id, id));
  }
}
```

## API

### createDrizzleTxAdapter(db, adapterOptions?)

Drizzle DB 인스턴스를 받아 `TxAdapter`를 반환합니다.

```ts
import { createDrizzleTxAdapter } from "@croco/tx-drizzle";

const adapter = createDrizzleTxAdapter(db);
```

반환된 어댑터는 다음을 지원합니다:

- `transaction(fn, options?)`: `db.transaction` 호출
- `savepoint(client, fn, options?)`: `tx.transaction` 호출 (중첩 트랜잭션). 세이브포인트가 비활성화되어 있거나 클라이언트에 `transaction()`이 없으면 `SavepointUnsupportedProblem`으로 즉시 실패
- `supportsSavepoint(client?)`: 활성 트랜잭션 클라이언트의 `transaction()` 메서드를 확인. `adapterOptions.supportsSavepoint: false`이면 항상 `false` 반환. 클라이언트를 생략하면 기존처럼 기본값 `true` 반환

`TxManager`는 중첩 실행 전에 현재 클라이언트로 지원 여부를 확인합니다. 지원하지 않으면 경고를 남기고 부모 트랜잭션에 참여합니다. 이 경우 중첩 구간만 독립적으로 롤백할 수 없으며, 상위로 전파된 오류는 부모 트랜잭션을 롤백합니다.

드라이버가 `transaction()` 메서드를 제공하더라도 중첩 실행을 지원하지 않는다면 명시적으로 비활성화하세요.

```ts
const adapter = createDrizzleTxAdapter(db, { supportsSavepoint: false });
```

`supportsSavepoint: true`도 클라이언트에 없는 메서드를 지원하게 만들지는 않습니다. 이 설정은 세이브포인트에만 적용되며, 드라이버의 루트 트랜잭션 지원이 필요합니다.

### 타입 유틸리티

```ts
import { InferTxClient, InferTxOptions } from "@croco/tx-drizzle";

type TxClient = InferTxClient<typeof db>;
type TxOptions = InferTxOptions<typeof db>;
```

### PostgreSQL RLS

`createRlsPolicy`와 `createRlsTxAdapter`는 동일한 PostgreSQL 설정 키 규칙을 사용하며, 잘못된 설정은 SQL 또는 트랜잭션이 실행되기 전에 `RlsConfigurationProblem`으로 거부합니다. Problem에는 잘못된 필드 이름만 포함되고 설정 값은 포함되지 않습니다.

- 테이블 이름: `table` 또는 `schema.table`
- 테넌트 컬럼과 관리자 역할: 단일 식별자
- 테넌트 컬럼 타입: `tenantColumnType: "uuid" | "text"`. 기본값은 `"uuid"`입니다. `text` 컬럼에 문자열·슬러그 ID를 저장한다면 `"text"`를 지정하여 UUID 캐스팅을 생략합니다.
- 설정 키: 정확히 `namespace.parameter` 두 부분
- 각 식별자 부분: `[A-Za-z_][A-Za-z0-9_$]*`, 최대 63 UTF-8 바이트
- 미리 따옴표 처리된 이름은 허용하지 않습니다. 논리 이름을 전달하면 헬퍼가 PostgreSQL 식별자 인용을 적용합니다.
- 헬퍼는 테이블 이름에 `_tenant_isolation`을 붙인 restrictive 정책과 `_tenant_access`를 붙인 permissive 정책을 소유합니다. 두 이름 모두 63바이트 제한을 지켜야 합니다.
- `adminRoles`의 기본값은 빈 배열입니다. 관리자 예외가 필요하면 실제로 등록된 PostgreSQL 역할 이름을 명시하세요.

```ts
const policySql = createRlsPolicy({
  tableName: "Tenant.Order",
  tenantColumn: "tenant_id",
  configKey: "app.current_tenant",
  adminRoles: ["app_admin", "support_admin"],
});

const adapter = createRlsTxAdapter(db, tenantProvider, {
  configKey: "app.current_tenant",
});
```

테이블 소유자 권한으로 마이그레이션에서 `policySql` 전체를 한 번 실행하세요. SQL은 단일 `DO` 문 안에서 RLS를 켜고 헬퍼가 소유한 두 정책만 교체합니다. 기존 `_tenant_isolation` 정책만 설치된 테이블도 같은 SQL로 이관할 수 있고, 재실행해도 정책이 중복되지 않습니다. 기존 설치에서 암묵적인 `app_admin` 예외를 계속 사용하려면 새 SQL 생성 시 `adminRoles: ["app_admin"]`을 명시하세요. 해당 역할을 등록하지 않았다면 기본값을 사용하세요. 두 정책 이름은 헬퍼 전용으로 예약하고 다른 애플리케이션 정책에는 별도 이름을 사용하세요. `_tenant_access` 정책에는 헬퍼 소유 표시가 기록됩니다. 같은 이름에 이 표시가 없는 정책이 있으면 설치가 실패하며 기존 정책은 그대로 유지됩니다. `tenantColumnType`, 설정 키, 관리자 역할을 바꿀 때도 새 옵션으로 생성한 SQL을 다시 실행하세요.

```sql
-- 별도 마이그레이션에서 테이블 소유자로 실행합니다.
GRANT USAGE ON SCHEMA "Tenant" TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON "Tenant"."Order" TO app_user;
```

위 `GRANT`는 예시입니다. 헬퍼는 테이블 권한이나 역할을 생성·부여하지 않습니다. 일반 애플리케이션 역할은 테이블 소유자, superuser, `BYPASSRLS` 역할이 아니어야 정책 검증이 유효합니다. 테이블 소유자에게도 RLS를 적용하려면 별도로 `FORCE ROW LEVEL SECURITY`를 설정하세요. 직접 SQL을 실행할 수 있는 역할이 테넌트 설정 키를 임의로 바꿀 수 있다면 이 정책만으로 그 역할을 격리할 수 없으므로, 테넌트 컨텍스트 설정은 신뢰된 애플리케이션 경계에서 관리해야 합니다.

두 정책 모두 기존 행의 `USING`과 새 행의 `WITH CHECK`에 같은 테넌트 조건을 적용합니다. 일치하는 테넌트의 읽기·쓰기만 허용하고, 누락되거나 빈 테넌트 컨텍스트는 거부합니다. 다른 permissive 정책이 있어도 restrictive 정책의 테넌트 경계는 계속 적용됩니다. 명시한 `adminRoles`의 구성원에게만 테넌트 조건 예외를 적용합니다.

런타임 어댑터는 `set_config(name, value, true)`를 파라미터화하여 현재 트랜잭션 범위에만 테넌트 값을 설정합니다.

`debug: true`는 RLS 설정 직전에 진단 로그를 기록합니다. `logger`를 직접 주입할 수 있으며, 생략하면 프레임워크 컨테이너에서 `Logger`를 해석합니다. 디버그가 요청된 상태에서 로거를 해석할 수 없거나 로그 기록이 실패하면 `RlsDebugLoggingProblem`으로 명시적으로 실패합니다. `debug`가 꺼져 있으면 로거가 없어도 트랜잭션 동작은 바뀌지 않습니다.

```ts
const adapter = createRlsTxAdapter(db, tenantProvider, {
  debug: true,
  logger,
});
```

## Dialect 지원

이 패키지는 dialect-agnostic으로 설계되어 Drizzle이 지원하는 모든 데이터베이스에서 동작합니다:

- PostgreSQL
- MySQL
- SQLite

각 dialect의 트랜잭션 옵션은 Drizzle의 타입 시그니처에서 자동으로 추론됩니다.

## Peer Dependencies

- `drizzle-orm` >=0.30.0
