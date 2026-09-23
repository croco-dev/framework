---
editUrl: false
next: false
prev: false
title: "EventPublishOptions"
---

> **EventPublishOptions** = `object`

이벤트 버스가 지원하는 발행 대기 구간을 취소하는 옵션입니다. 시작된 핸들러 실행은 중단하지 않습니다.

## Properties

### signal?

> `optional` **signal?**: `AbortSignal`

대기 중인 발행에 전달할 취소 신호입니다.
