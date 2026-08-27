---
editUrl: false
next: false
prev: false
title: "CrocoPageConfig"
---

> **CrocoPageConfig** = `Required`\<`Pick`\<[`PageRouteDefinition`](/api/meta-vite/src/type-aliases/pageroutedefinition/), `"mode"`\>\> & `Partial`\<`Pick`\<[`PageRouteDefinition`](/api/meta-vite/src/type-aliases/pageroutedefinition/), `"head"` \| `"path"` \| `"revalidate"`\>\>

@croco/frontend-react

React 앱에서 Croco의 SSR 기능을 사용하기 위한 유틸리티 패키지.

@croco/meta-vite runtime에서 렌더링한 page context를 React에 연결하며,
page data access 훅과 createCrocoPageConfig 함수을 제공한다.
