# @croco/frontend-problems

> Croco Presentation Tier - browser-safe Problem client runtime

`@croco/frontend-problems` provides shared RFC 7807 Problem parsing, typed Result
models, fetch helpers, and form Problem mapping for browser and edge frontend code.
It does not depend on React or Node-only APIs.

## Install

```bash
pnpm add @croco/frontend-problems
```

## Problem-aware requests

```typescript
import { fetchProblemJson } from "@croco/frontend-problems";

type User = {
  readonly id: string;
  readonly name: string;
};

const result = await fetchProblemJson<User>("/api/users/1");

if (result.ok) {
  console.log(result.data.name);
} else if (result.kind === "problem") {
  console.error(result.problem.code, result.problem.detail);
} else {
  console.error(result.error.message);
}
```

Problem responses preserve `type`, `title`, `status`, `code`, `detail`,
`instance`, and extension fields. Non-Problem HTTP failures stay visibly separate
as `kind: "external"`.

When the HTTP status and Problem body status disagree, the request fails with
`ProblemStatusMismatchError`. Its `httpStatus`, `problemStatus`, and `problemCode`
fields preserve the conflicting protocol evidence without entering a typed Problem branch.

## Declared Problem unions

Generated clients can pass declared route Problems to keep exhaustive unions:

```typescript
import {
  assertProblemExhaustive,
  handleJsonResult,
  type ProblemDeclaration,
} from "@croco/frontend-problems";

const getUserProblems = [
  { code: "USER_NOT_FOUND", category: "NotFound", status: 404 },
] as const satisfies readonly ProblemDeclaration[];

const result = await handleJsonResult<User, (typeof getUserProblems)[number]>(
  response,
  getUserProblems,
);

if (!result.ok && result.kind === "problem") {
  switch (result.code) {
    case "USER_NOT_FOUND":
      break;
    default:
      assertProblemExhaustive(result);
  }
}
```
