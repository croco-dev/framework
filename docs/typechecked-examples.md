# Typechecked Documentation Examples

Authored TypeScript examples in README and docs use one of two explicit modes:

- `typecheck` fences are extracted and checked against workspace package public APIs.
- `no-check` fences are intentionally skipped because they are pseudo-code, partial code, or depend on runtime-only symbols.

```typescript typecheck
import { HttpStatus, ProblemCategory, ProblemFactory } from "@croco/problems-core";
import type { ProblemDetails } from "@croco/problems-core";

const problem = ProblemFactory.notFound("USER_NOT_FOUND", "User was not found");

const details: ProblemDetails = {
  type: problem.type,
  title: problem.title,
  status: HttpStatus.NOT_FOUND,
  detail: problem.detail,
  code: problem.code,
};

const category: ProblemCategory = problem.category;

void details;
void category;
```

```typescript no-check
@Controller("/runtime-owned")
class RuntimeProvidedController {
  @Get(":id")
  show() {
    return runtime.lookupCurrentTenant();
  }
}
```
