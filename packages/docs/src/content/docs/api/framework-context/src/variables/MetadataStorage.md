---
editUrl: false
next: false
prev: false
title: "MetadataStorage"
---

> `const` **MetadataStorage**: `MetadataStorageImpl`

Defined in: [packages/framework-context/src/libs/MetadataStorage.ts:97](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/framework-context/src/libs/MetadataStorage.ts#L97)

심볼 키 기반으로 메타데이터를 저장하고 조회하는 저장소 인스턴스입니다.

## Param

`MetadataStorage.define()` 또는 `MetadataStorage.get()`에 사용할 메타데이터 키입니다.

## Returns

메타데이터 정의와 조회 API를 제공하는 `MetadataStorage` 인스턴스를 반환합니다.

## Example

```typescript
import { MetadataStorage } from '@croco/framework-context';

const key = Symbol('sample');
class Sample {}

MetadataStorage.define(key, Sample, { enabled: true });
const metadata = MetadataStorage.get<{ enabled: boolean }>(key, Sample);
```
