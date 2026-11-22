---
---

Run GraphQL server integration tests on OS-assigned ports so another listener on the CI runner cannot fail the suite with `EADDRINUSE`. No published runtime behavior changes.
