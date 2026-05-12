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
