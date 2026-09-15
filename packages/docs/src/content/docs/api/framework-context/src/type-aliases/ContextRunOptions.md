---
editUrl: false
next: false
prev: false
title: "ContextRunOptions"
---

> **ContextRunOptions** = `object`

중첩 컨텍스트 실행 시 부모 요청 scope 상속 여부를 설정합니다.

## Properties

### inheritScope?

> `readonly` `optional` **inheritScope?**: `boolean`

`true`이면 활성 부모의 요청 시작 시각과 scoped cache를 공유합니다. 기본값은 `false`입니다.
