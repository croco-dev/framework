# @croco/testing

First-class test harness utilities for Croco applications.

```typescript
import { createTestingApp } from "@croco/testing";

const app = createTestingApp({ controllers: [UserController] });
const response = await app.get("/users");
```

## API

| Helper                                            | Purpose                                                                                       |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `createTestingApp(config)`                        | Creates an isolated `CrocoApp` with seeded test defaults and HTTP request helpers.            |
| `createTestingHarness(app)`                       | Wraps an existing `CrocoApp` with the same request and contract helpers.                      |
| `resetCrocoTestingContext()`                      | Resets the Croco DI container and seeds test logger/error/health defaults.                    |
| `assertProblemResponse(response, expected)`       | Verifies an RFC 7807 Problem Details response without depending on a test runner.             |
| `assertOpenAPIRoute(controllersOrSpec, expected)` | Verifies generated OpenAPI route metadata and response contracts.                             |
| `createRpcTestFetch(app)`                         | Returns a fetch-compatible function that routes generated RPC clients into the in-memory app. |
