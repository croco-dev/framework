# @croco/tx-core

AsyncLocalStorage 기반 트랜잭션 컨텍스트 관리(UoW) 및 TypeDI 연동 `@Transactional` 데코레이터를 제공합니다.

## 설치

```bash
pnpm add @croco/tx-core typedi
```

## 사용법

### 1. TxAdapter 구현 또는 사용

`@croco/tx-drizzle` 같은 어댑터 패키지를 사용하거나, 직접 `TxAdapter` 인터페이스를 구현합니다.

```ts
import { TxAdapter } from '@croco/tx-core';

const adapter: TxAdapter<MyClient, MyOptions> = {
  async transaction(fn, options) {
    return myDb.transaction(fn, options);
  },
  async savepoint(client, fn, options) {
    return client.transaction(fn, options);
  },
  supportsSavepoint() {
    return true;
  },
};
```

### 2. TxManager 등록 (TypeDI)

```ts
import 'reflect-metadata';
import { Container } from 'typedi';
import { TxManager } from '@croco/tx-core';
import { createDrizzleTxAdapter } from '@croco/tx-drizzle';
import { drizzle } from 'drizzle-orm/node-postgres';

const db = drizzle(pool);
const adapter = createDrizzleTxAdapter(db);
const txManager = new TxManager(adapter, { defaultNesting: 'join' });

Container.set(TxManager, txManager);
```

### 3. @Transactional 데코레이터 사용

메서드 데코레이터:

```ts
import { Service } from 'typedi';
import { Transactional } from '@croco/tx-core';

@Service()
class UserService {
  @Transactional()
  async createUser(name: string) {
    // 트랜잭션 내에서 실행됨
  }

  @Transactional({ nesting: 'savepoint' })
  async updateUser(id: string, name: string) {
    // 중첩 호출 시 savepoint 생성
  }
}
```

클래스 데코레이터:

```ts
import { Service } from 'typedi';
import { Transactional } from '@croco/tx-core';

@Transactional()
@Service()
class OrderService {
  async createOrder() {
    // 트랜잭션 내에서 실행됨
  }

  async cancelOrder() {
    // 트랜잭션 내에서 실행됨
  }
}
```

### 4. Repository에서 현재 트랜잭션 클라이언트 사용

```ts
import { Service } from 'typedi';
import { TxManager } from '@croco/tx-core';

@Service()
class UserRepository {
  constructor(
    private readonly db: DrizzleDb,
    private readonly txManager: TxManager<typeof db>
  ) {}

  async findById(id: string) {
    const client = this.txManager.getClient() ?? this.db;
    return client.select().from(users).where(eq(users.id, id));
  }
}
```

## API

### TxAdapter<TClient, TOptions>

트랜잭션을 여는 책임을 가진 인터페이스입니다.

- `transaction(fn, options?)`: 새 트랜잭션 시작
- `savepoint(client, fn, options?)`: 중첩 트랜잭션(savepoint) 시작
- `supportsSavepoint()`: savepoint 지원 여부

### TxManager<TClient, TOptions>

AsyncLocalStorage를 사용해 트랜잭션 컨텍스트를 관리합니다.

- `run(fn, options?)`: 트랜잭션 내에서 함수 실행
- `getClient()`: 현재 트랜잭션 클라이언트 반환 (없으면 `null`)
- `isInTransaction()`: 현재 트랜잭션 내부인지 여부

### TxRunOptions<TOptions>

```ts
interface TxRunOptions<TOptions> {
  nesting?: 'join' | 'savepoint';
  options?: TOptions;
}
```

### @Transactional(options?)

TypeDI Container에서 `TxManager`를 resolve하여 메서드/클래스를 트랜잭션으로 감쌉니다.

## Peer Dependencies

- `typedi` ^0.10.0



