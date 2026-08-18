---
editUrl: false
next: false
prev: false
title: "RouteProblem"
---

> **RouteProblem**\<`TContract`\> = `TContract` *extends* `object` ? `ProblemEntry` *extends* [`ProblemConstructor`](/api/protocols-rest/src/type-aliases/problemconstructor/)\<infer TProblem\> ? `TProblem` : `ProblemEntry` *extends* [`RouteProblemDeclaration`](/api/protocols-rest/src/type-aliases/routeproblemdeclaration/)\<infer TProblem\> ? `TProblem` : `never` : `never`

## Type Parameters

### TContract

`TContract` *extends* [`RouteContractSpec`](/api/protocols-rest/src/type-aliases/routecontractspec/)
