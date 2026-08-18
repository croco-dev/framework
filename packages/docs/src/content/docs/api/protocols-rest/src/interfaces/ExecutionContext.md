---
editUrl: false
next: false
prev: false
title: "ExecutionContext"
---

실행 컨텍스트 - Guard, Interceptor, Filter에서 사용
NestJS의 ExecutionContext를 참고하되 Croco에 맞게 단순화

## Methods

### getClass()

> **getClass**(): [`Constructor`](/api/protocols-rest/src/type-aliases/constructor/)

컨트롤러 클래스 참조

#### Returns

[`Constructor`](/api/protocols-rest/src/type-aliases/constructor/)

---

### getHandler()

> **getHandler**(): `string` \| `symbol`

핸들러 메서드 이름

#### Returns

`string` \| `symbol`

---

### getMethod()

> **getMethod**(): `string`

HTTP 메서드 (GET, POST 등)

#### Returns

`string`

---

### getPath()

> **getPath**(): `string`

요청 URL 경로

#### Returns

`string`

---

### getRequest()

> **getRequest**(): `Request`

원본 HTTP Request 객체

#### Returns

`Request`
