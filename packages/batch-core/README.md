# @croco/batch-core

대용량 데이터 처리를 위한 배치 프레임워크입니다. Spring Batch의 개념(Reader, Processor, Writer)을 차용하여 Node.js 환경에 맞게 구현했습니다.

## 특징

- **Chunk 지향 처리**: 메모리 효율적인 대용량 데이터 처리
- **단계별 구성 (Step & Job)**: 재사용 가능한 스텝과 작업 구성
- **체크포인트 & 재시작**: 실패 지점부터 재시작 가능한 구조 (Checkpointable)
- **타입 안전성**: 제네릭을 통한 입출력 타입 보장

## 설치

```bash
pnpm add @croco/batch-core
```

## 주요 개념

- **ItemReader**: 데이터를 읽어오는 역할 (예: DB 조회, 파일 읽기)
- **ItemProcessor**: 데이터를 가공하는 역할 (비즈니스 로직)
- **ItemWriter**: 가공된 데이터를 저장하는 역할 (예: DB 저장, 파일 쓰기)
- **Step**: Reader -> Processor -> Writer 로 구성된 단위 작업
- **Job**: 하나 이상의 Step으로 구성된 전체 배치 작업

## 사용 방법

### 1. Reader, Processor, Writer 구현

```typescript
import type { ItemReader, ItemProcessor, ItemWriter } from '@croco/batch-core';

// Reader
class UserReader implements ItemReader<User> {
  private offset = 0;
  async read(): Promise<User | null> {
    const users = await db.users.find({ skip: this.offset, take: 1 });
    this.offset++;
    return users[0] || null;
  }
}

// Processor
class UserActiveProcessor implements ItemProcessor<User, UserActiveEvent> {
  async process(user: User): Promise<UserActiveEvent | null> {
    if (!user.isActive) return null; // 필터링
    return { userId: user.id, timestamp: new Date() };
  }
}

// Writer
class EventWriter implements ItemWriter<UserActiveEvent> {
  async write(events: UserActiveEvent[]): Promise<void> {
    await eventBus.publishAll(events);
  }
}
```

### 2. Job 구성

`JobBuilder`를 사용하여 Step과 Job을 구성합니다.

```typescript
import { JobBuilder, Step } from '@croco/batch-core';

const userStep = new Step({
  name: 'process-active-users',
  reader: new UserReader(),
  processor: new UserActiveProcessor(),
  writer: new EventWriter(),
  chunkSize: 100
});

const job = new JobBuilder('daily-user-batch')
  .start(userStep)
  .build();
```
