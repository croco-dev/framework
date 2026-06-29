---
editUrl: false
next: false
prev: false
title: "Checkpointable"
---

Checkpointable - 체크포인트 가능 인터페이스

## Description

배치 작업의 재시작을 위해 현재 처리 위치를 저장하고 복구할 수 있는 기능을 정의합니다.

## Remarks

대용량 배치 처리 중 실패가 발생했을 때, 마지막 체크포인트부터 재시작하기 위해 사용됩니다.

## Example

```typescript
class DatabaseReader implements ItemReader<User>, Checkpointable {
  private lastId = 0;

  async getCheckpoint(): Promise<number> {
    return this.lastId;
  }

  async restoreCheckpoint(checkpoint: number): Promise<void> {
    this.lastId = checkpoint;
  }
}
```

## Methods

### getCheckpoint()

> **getCheckpoint**(): `unknown`

Returns the current state of the component.

#### Returns

`unknown`

***

### restoreCheckpoint()

> **restoreCheckpoint**(`checkpoint`): `void`

Restores the component to the given state.

#### Parameters

##### checkpoint

`unknown`

#### Returns

`void`
