---
editUrl: false
next: false
prev: false
title: "CrocoPageConfig"
---

> **CrocoPageConfig** = `object`

@croco/frontend-react

React 앱에서 Croco의 SSR 기능을 사용하기 위한 유틸리티 패키지.

@croco/meta-vite runtime에서 렌더링한 page context를 React에 연결하며,
usePageData 훅과 createCrocoPageConfig 함수을 제공한다.

## Properties

### head?

> `optional` **head?**: () => `object`

#### Returns

`object`

##### description?

> `optional` **description?**: `string`

##### title?

> `optional` **title?**: `string`

---

### mode

> **mode**: [`RenderMode`](/api/meta-vite/src/type-aliases/rendermode/)

---

### revalidateMs?

> `optional` **revalidateMs?**: `number`
