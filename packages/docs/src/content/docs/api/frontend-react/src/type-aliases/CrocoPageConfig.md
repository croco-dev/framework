---
editUrl: false
next: false
prev: false
title: "CrocoPageConfig"
---

> **CrocoPageConfig** = `object`

@croco/frontend-react

React 앱에서 Croco의 SSR 기능을 사용하기 위한 유틸리티 패키지.

meta-vite 기반 SSR 플러그인과 함께 사용하며, usePageData 훅과
createCrocoPageConfig 함수을 제공한다.

## Properties

### head()?

> `optional` **head**: () => `object`

#### Returns

`object`

##### description?

> `optional` **description**: `string`

##### title?

> `optional` **title**: `string`

***

### mode

> **mode**: `RenderMode`

***

### revalidateMs?

> `optional` **revalidateMs**: `number`
