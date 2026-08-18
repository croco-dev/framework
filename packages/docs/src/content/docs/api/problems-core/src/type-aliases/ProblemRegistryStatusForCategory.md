---
editUrl: false
next: false
prev: false
title: "ProblemRegistryStatusForCategory"
---

> **ProblemRegistryStatusForCategory**\<`Category`\> = `Category` _extends_ [`BadRequest`](/api/problems-core/src/enumerations/problemcategory/#badrequest) ? `400` : `Category` _extends_ [`Unauthorized`](/api/problems-core/src/enumerations/problemcategory/#unauthorized) ? `401` : `Category` _extends_ [`Forbidden`](/api/problems-core/src/enumerations/problemcategory/#forbidden) ? `403` : `Category` _extends_ [`NotFound`](/api/problems-core/src/enumerations/problemcategory/#notfound) ? `404` : `Category` _extends_ [`Conflict`](/api/problems-core/src/enumerations/problemcategory/#conflict) ? `409` : `Category` _extends_ [`Gone`](/api/problems-core/src/enumerations/problemcategory/#gone) ? `410` : `Category` _extends_ [`PayloadTooLarge`](/api/problems-core/src/enumerations/problemcategory/#payloadtoolarge) ? `413` : `Category` _extends_ [`ValidationError`](/api/problems-core/src/enumerations/problemcategory/#validationerror) ? `422` : `Category` _extends_ [`BusinessRuleViolation`](/api/problems-core/src/enumerations/problemcategory/#businessruleviolation) ? `422` : `Category` _extends_ [`TooManyRequests`](/api/problems-core/src/enumerations/problemcategory/#toomanyrequests) ? `429` : ... _extends_ ... ? ... : ...

## Type Parameters

### Category

`Category` _extends_ [`ProblemCategory`](/api/problems-core/src/enumerations/problemcategory/)
