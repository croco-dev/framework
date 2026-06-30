---
editUrl: false
next: false
prev: false
title: "ProblemRegistryStatusForCategory"
---

> **ProblemRegistryStatusForCategory**\<`Category`\> = `Category` *extends* [`BadRequest`](/api/problems-core/src/enumerations/problemcategory/#badrequest) ? `400` : `Category` *extends* [`Unauthorized`](/api/problems-core/src/enumerations/problemcategory/#unauthorized) ? `401` : `Category` *extends* [`Forbidden`](/api/problems-core/src/enumerations/problemcategory/#forbidden) ? `403` : `Category` *extends* [`NotFound`](/api/problems-core/src/enumerations/problemcategory/#notfound) ? `404` : `Category` *extends* [`Conflict`](/api/problems-core/src/enumerations/problemcategory/#conflict) ? `409` : `Category` *extends* [`Gone`](/api/problems-core/src/enumerations/problemcategory/#gone) ? `410` : `Category` *extends* [`ValidationError`](/api/problems-core/src/enumerations/problemcategory/#validationerror) ? `422` : `Category` *extends* [`BusinessRuleViolation`](/api/problems-core/src/enumerations/problemcategory/#businessruleviolation) ? `422` : `Category` *extends* [`TooManyRequests`](/api/problems-core/src/enumerations/problemcategory/#toomanyrequests) ? `429` : `Category` *extends* [`InternalServerError`](/api/problems-core/src/enumerations/problemcategory/#internalservererror) ? `500` : ... *extends* ... ? ... : ...

## Type Parameters

### Category

`Category` *extends* [`ProblemCategory`](/api/problems-core/src/enumerations/problemcategory/)
