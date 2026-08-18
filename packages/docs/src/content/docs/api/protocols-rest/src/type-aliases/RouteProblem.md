---
editUrl: false
next: false
prev: false
title: "RouteProblem"
---

> **RouteProblem**\<`TContract`\> = `TContract` _extends_ `object` ? `ProblemEntry` _extends_ [`ProblemConstructor`](/api/protocols-rest/src/type-aliases/problemconstructor/)\<infer TProblem\> ? `TProblem` : `ProblemEntry` _extends_ [`RouteProblemDeclaration`](/api/protocols-rest/src/type-aliases/routeproblemdeclaration/)\<infer TProblem\> ? `TProblem` : `never` : `never`

## Type Parameters

### TContract

`TContract` _extends_ [`RouteContractSpec`](/api/protocols-rest/src/type-aliases/routecontractspec/)
