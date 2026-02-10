# @croco/execution-core

실행(Execution) 상태 관리 및 추적을 위한 코어 라이브러리입니다. 모든 실행 가능한 단위(Task, Batch, Workflow)의 생명주기를 관리하는 기반을 제공합니다.

## 특징

- **표준화된 실행 모델**: `pending` -> `running` -> `completed` / `failed` 상태 전이 모델 제공
- **상태 추적**: 실행 이력, 재시도 횟수, 오류 정보, 진행률 추적
- **확장 가능한 저장소**: `ExecutionStore` 인터페이스를 통해 다양한 백엔드(DynamoDB, Redis, RDBMS 등) 지원

## 설치

```bash
pnpm add @croco/execution-core
```

## 주요 개념

### Execution Status

실행 상태는 다음과 같은 흐름을 따릅니다:

- **pending**: 실행 대기 중
- **running**: 실행 중
- **completed**: 성공적으로 완료됨
- **failed**: 실패함 (재시도 소진)
- **retrying**: 일시적 실패로 재시도 대기 중
- **timed_out**: 시간 초과
- **cancelled**: 취소됨

### ExecutionStore

실행 상태를 영속화하기 위한 인터페이스입니다. 애플리케이션 요구사항에 맞는 저장소를 구현하여 주입해야 합니다.

```typescript
import type { ExecutionStore, Execution } from '@croco/execution-core';

export class MyDynamoExecutionStore implements ExecutionStore {
  async save(execution: Execution): Promise<void> {
    // DynamoDB 저장 로직
  }
  
  async get(id: string): Promise<Execution | null> {
    // DynamoDB 조회 로직
  }
  
  // ... 기타 메서드 구현
}
```

## 사용 방법

### 실행 생성 및 관리

`ExecutionManager`를 통해 실행을 제어합니다.

```typescript
import { Container } from '@croco/framework-context';
import { ExecutionManagerImpl } from '@croco/execution-core';

// DI 컨테이너에 Store 등록 필요
Container.register(MyDynamoExecutionStore, 'ExecutionStore');

const manager = Container.get(ExecutionManagerImpl);

// 1. 실행 생성
const execution = await manager.create({
  type: 'my-task',
  payload: { userId: '123' },
  maxAttempts: 3
});

// 2. 실행 시작
await manager.start(execution.id);

try {
  // ... 작업 수행 ...
  
  // 3. 성공 처리
  await manager.complete(execution.id, { result: 'success' });
} catch (error) {
  // 4. 실패 처리 (자동으로 재시도 여부 판단)
  await manager.fail(execution.id, error);
}
```
