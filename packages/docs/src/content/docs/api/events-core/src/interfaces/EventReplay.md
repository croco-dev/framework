---
editUrl: false
next: false
prev: false
title: "EventReplay"
---

이벤트 리플레이(Replay) 인터페이스입니다.
과거 이벤트를 재생성하고 재처리하는 계약을 정의합니다.

## Methods

### createSnapshot()

> **createSnapshot**(`metadata?`): `Promise`\<[`EventSnapshot`](/api/events-core/src/type-aliases/eventsnapshot/)\>

현재 상태의 스냅샷을 생성합니다.

#### Parameters

##### metadata?

`Record`\<`string`, `unknown`\>

스냅샷 메타데이터

#### Returns

`Promise`\<[`EventSnapshot`](/api/events-core/src/type-aliases/eventsnapshot/)\>

생성된 스냅샷 정보

---

### deleteSnapshot()

> **deleteSnapshot**(`snapshotId`): `Promise`\<`void`\>

특정 스냅샷을 삭제합니다.

#### Parameters

##### snapshotId

`string`

삭제할 스냅샷 ID

#### Returns

`Promise`\<`void`\>

---

### listSnapshots()

> **listSnapshots**(): `Promise`\<[`EventSnapshot`](/api/events-core/src/type-aliases/eventsnapshot/)[]\>

사용 가능한 스냅샷 목록을 조회합니다.

#### Returns

`Promise`\<[`EventSnapshot`](/api/events-core/src/type-aliases/eventsnapshot/)[]\>

스냅샷 목록

---

### replay()

> **replay**(`options?`): `Promise`\<[`ReplayResult`](/api/events-core/src/type-aliases/replayresult/)\>

특정 시점부터 이벤트를 리플레이합니다.

#### Parameters

##### options?

[`ReplayOptions`](/api/events-core/src/type-aliases/replayoptions/)

리플레이 옵션

#### Returns

`Promise`\<[`ReplayResult`](/api/events-core/src/type-aliases/replayresult/)\>

리플레이 결과

---

### replayEvents()

> **replayEvents**(`eventIds`): `Promise`\<[`ReplayResult`](/api/events-core/src/type-aliases/replayresult/)\>

특정 이벤트만 리플레이합니다.

#### Parameters

##### eventIds

`string`[]

리플레이할 이벤트 ID 목록

#### Returns

`Promise`\<[`ReplayResult`](/api/events-core/src/type-aliases/replayresult/)\>

리플레이 결과

---

### restoreSnapshot()

> **restoreSnapshot**(`snapshotId`): `Promise`\<`void`\>

특정 스냅샷으로 복원합니다.

#### Parameters

##### snapshotId

`string`

복원할 스냅샷 ID

#### Returns

`Promise`\<`void`\>
