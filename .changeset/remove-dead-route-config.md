---
"@croco/protocols-rest": minor
---

Remove the inert `TypedRouteConfig` and `ApiEndpoint` type families so `RouteContractSpec` is the only supported route configuration contract with runtime ownership. Consumers must migrate to `defineRouteContract` and its request, response, and handler inference types.
