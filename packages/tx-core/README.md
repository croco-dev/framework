# @croco/tx-core

AsyncLocalStorage 기반 트랜잭션 컨텍스트 관리(UoW)를 제공합니다.

## 설치

```bash
pnpm add @croco/tx-core
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

### 2. TxManager 등록

```ts
import 'reflect-metadata';
import { Container } from '@croco/framework-context';
import { TxManager } from '@croco/tx-core';
import { createDrizzleTxAdapter } from '@croco/tx-drizzle';
import { drizzle } from 'drizzle-orm/node-postgres';

const db = drizzle(pool);
const adapter = createDrizzleTxAdapter(db);
const txManager = new TxManager(adapter, { defaultNesting: 'join' });

Container.set(TxManager, txManager);
```

### 3. Service에서 사용

```ts
import { Component, Container } from '@croco/framework-context';
import { TxManager } from '@croco/tx-core';

@Component()
class UserService {
  async createUser(name: string) {
    const txManager = Container.get(TxManager);
    return txManager.run(async () => {
      // 트랜잭션 내에서 실행됨
    });
  }

  async updateUser(id: string, name: string) {
    const txManager = Container.get(TxManager);
    return txManager.run(async () => {
      // 중첩 호출 시 savepoint 생성
    }, { nesting: 'savepoint' });
  }
}
```

### 4. Repository에서 현재 트랜잭션 클라이언트 사용

```ts
import { Component } from '@croco/framework-context';
import { TxManager } from '@croco/tx-core';

@Component()
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

`onAfterCommit()`으로 등록한 훅은 root transaction commit 이후, **트랜잭션 컨텍스트 밖에서** 순차 실행됩니다. 따라서 훅 내부의 `isInTransaction()`은 `false`, `getClient()`는 `null`을 반환합니다. 훅 하나가 실패해도 나머지 훅은 계속 시도되며, 하나 이상 실패하면 `run()`은 `AfterCommitHooksProblem`으로 reject 됩니다. 즉 DB commit은 유지되지만 post-commit 작업 실패는 호출자에게 숨겨지지 않습니다.

### TxRunOptions<TOptions>

```ts
interface TxRunOptions<TOptions> {
  nesting?: 'join' | 'savepoint';
  options?: TOptions;
}
```

## Dependencies

- `@croco/framework-context` - DI 컨테이너 및 컴포넌트 관리
