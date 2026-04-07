---
editUrl: false
next: false
prev: false
title: "EventSnapshot"
---

> **EventSnapshot** = `object`

Defined in: [packages/events-core/src/libs/interfaces/EventReplay.ts:60](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventReplay.ts#L60)

스냅샷 정보입니다.

## Properties

### createdAt

> **createdAt**: `Date`

Defined in: [packages/events-core/src/libs/interfaces/EventReplay.ts:65](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventReplay.ts#L65)

스냅샷 생성 시간

***

### eventCount

> **eventCount**: `number`

Defined in: [packages/events-core/src/libs/interfaces/EventReplay.ts:74](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventReplay.ts#L74)

이벤트 수

***

### eventRange

> **eventRange**: `object`

Defined in: [packages/events-core/src/libs/interfaces/EventReplay.ts:68](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventReplay.ts#L68)

포함된 이벤트 범위

#### from

> **from**: `Date`

#### to

> **to**: `Date`

***

### metadata?

> `optional` **metadata**: `Record`\<`string`, `unknown`\>

Defined in: [packages/events-core/src/libs/interfaces/EventReplay.ts:77](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventReplay.ts#L77)

메타데이터

***

### snapshotId

> **snapshotId**: `string`

Defined in: [packages/events-core/src/libs/interfaces/EventReplay.ts:62](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/interfaces/EventReplay.ts#L62)

스냅샷 ID
