# @croco/protocols-rest

Croco REST 프로토콜 정의 계층입니다. 컨트롤러, 라우트, 파라미터 바인딩, Guard, Pipe, Interceptor, 검증 유틸리티를 제공합니다.

## 설치

```bash
pnpm add @croco/protocols-rest @croco/framework-context reflect-metadata zod
```

## 사용법

### 컨트롤러와 라우트 정의

```typescript
import "reflect-metadata";
import { Body, Controller, Get, Param, Post } from "@croco/protocols-rest";

@Controller("/users")
class UserController {
  @Get("/:id")
  getUser(@Param("id") id: string) {
    return { id };
  }

  @Post("/")
  createUser(@Body() body: { name: string }) {
    return { id: "user-1", ...body };
  }
}
```

### Guard와 역할 검사

```typescript
import { AuthGuard, Roles, RolesGuard, UseGuards } from "@croco/protocols-rest";

@UseGuards(AuthGuard, RolesGuard)
class AdminController {
  @Roles("admin")
  removeUser() {
    return { ok: true };
  }
}
```

### Zod 기반 검증

```typescript
import { createValidationPipe, validateRequest } from "@croco/protocols-rest";
import { z } from "zod";

const schema = z.object({ page: z.coerce.number().int().min(1) });
const pipe = createValidationPipe(schema);
const page = validateRequest(schema, { page: "1" });
```

## API 레퍼런스

- 데코레이터: `Controller`, `Get`, `Post`, `Put`, `Patch`, `Delete`, `Options`, `Head`, `All`
- 파라미터 바인딩: `Param`, `Query`, `Header`, `Body`, `Ctx`, `Raw`
- 라이프사이클: `UseGuards`, `UsePipes`, `UseInterceptors`, `UseFilters`, `Roles`
- 기본 구현체: `AuthGuard`, `RolesGuard`, `LoggingInterceptor`, `HttpExceptionFilter`, `ValidationPipe`
- 메타데이터 조회: `getControllerMeta`, `getRouteMeta`, `getParamsMeta`, `getGuards`, `getPipes`, `getInterceptors`, `getFilters`, `isController`
- 검증 유틸리티: `createValidator`, `validateRequest`, `validateResponse`, `createValidationPipe`
- 검증 Problem: `ValidationProblem`, `RequestValidationProblem`, `ResponseValidationProblem`
- 타입: `ExecutionContext`, `PipeTransform`, `ExceptionFilter`, `CallHandler`, `RouteSchema`, `TypedRouteConfig`
