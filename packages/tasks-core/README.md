# @croco/tasks-core

단일 작업(Task)의 정의와 실행을 관리하는 패키지입니다. 비동기 작업, 백그라운드 프로세싱을 위한 기본 단위를 제공합니다.

## 특징

- **@Task 데코레이터**: 메서드를 독립적인 실행 단위로 정의
- **자동 감지**: 컴포넌트 스캔 시 태스크 자동 등록
- **메타데이터 관리**: 태스크 이름, 옵션 등을 메타데이터로 관리

## 설치

```bash
pnpm add @croco/tasks-core
```

## 사용 방법

### @Task 데코레이터

클래스 메서드를 태스크로 지정합니다.

```typescript
import { Task } from "@croco/tasks-core";
import { Component } from "@croco/framework-context";

@Component()
export class ImageProcessor {
  @Task({ name: "process-image-resize" })
  async resizeImage(payload: { imageUrl: string; width: number }) {
    console.log(`Resizing image: ${payload.imageUrl}`);
    // ... 이미지 처리 로직
    return { status: "resized", url: "..." };
  }
}
```

### 태스크 실행

일반적으로 태스크는 `ExecutionManager`나 큐 워커에 의해 호출되지만, 직접 호출할 수도 있습니다. `@Task` 데코레이터는 메타데이터를 등록하는 역할만 하며, 메서드 자체의 동작을 변경하지는 않습니다.

```typescript
const processor = new ImageProcessor();
await processor.resizeImage({ imageUrl: "http://...", width: 100 });
```

### 실행 제한 시간과 협력적 취소

`TaskRunner`로 실행할 때 `timeout`은 실행 저장소에 기록된 `startedAt + timeout` 기준으로 강제됩니다.
핸들러는 선택적인 두 번째 인자로 실행 컨텍스트를 받아 제한 시간 만료에 협력할 수 있습니다.

```typescript
import { Task, type TaskExecutionContext } from "@croco/tasks-core";

class ImageProcessor {
  @Task({ name: "process-image-resize", timeout: 5_000 })
  async resizeImage(payload: { imageUrl: string; width: number }, context: TaskExecutionContext) {
    const response = await fetch(payload.imageUrl, { signal: context.signal });
    return { attempt: context.attempt, bytes: await response.arrayBuffer() };
  }
}
```

제한 시간이 지나면 실행은 `timed_out`으로 남고 `TaskExecutionTimeoutProblem`이 발생합니다. Problem의
`executionId`를 `TaskRunner.retry(executionId)`에 전달하면 idempotency key 없이도 같은 실행의 다음 시도를
명시적으로 시작할 수 있습니다. 임의의 JavaScript 작업을 강제 종료하지는 않으므로, 취소가 필요한 I/O에는
반드시 `context.signal`을 전달해야 합니다. `timeout`이 없거나 0 이하이면 기존과 같이 제한 시간을 적용하지 않습니다.
