---
editUrl: false
next: false
prev: false
title: "CrocoPageOptions"
---

> **CrocoPageOptions** = `object`

@croco/frontend-react

React 앱에서 Croco의 SSR 기능을 사용하기 위한 유틸리티 패키지.

@croco/meta-vite runtime에서 렌더링한 page context를 React에 연결하며,
page data access 훅과 createCrocoPageConfig 함수을 제공한다.

## Properties

### head?

> `optional` **head?**: () => `object`

head 메타데이터 반환 함수

#### Returns

`object`

##### description?

> `optional` **description?**: `string`

##### title?

> `optional` **title?**: `string`

---

### path?

> `optional` **path?**: `string`

페이지 경로

---

### revalidate?

> `optional` **revalidate?**: `number`

ISR revalidate 시간(ms)

---

### ssr?

> `optional` **ssr?**: `boolean`

SSR 렌더링 여부 (default: true)
