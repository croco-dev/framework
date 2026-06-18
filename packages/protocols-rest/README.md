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

### 스키마 단일 출처

`defineRouteSchema`는 DTO 타입, 런타임 검증, 응답 스키마, OpenAPI/RPC 산출물의 출처를 하나의
route schema 객체로 모읍니다. 새 외부 스키마 의존성을 추가하지 않고 기존 Zod 기반 REST 검증
경로를 사용합니다.

```typescript
import {
  Body,
  Controller,
  Post,
  ResponseSchema,
  defineRouteSchema,
  type InferRouteSchemaRequest,
  type InferRouteSchemaResponse,
} from "@croco/protocols-rest";
import { z } from "zod";

const createUserRoute = defineRouteSchema({
  request: {
    body: z.object({
      name: z.string().min(1),
      email: z.string().email(),
    }),
  },
  response: z.object({
    id: z.string().uuid(),
    name: z.string(),
    email: z.string().email(),
  }),
});

type CreateUserBody = InferRouteSchemaRequest<typeof createUserRoute>["body"];
type CreateUserResponse = InferRouteSchemaResponse<typeof createUserRoute>;

@Controller("/users")
class UserController {
  @Post("/")
  @ResponseSchema(createUserRoute.response)
  createUser(@Body(createUserRoute.request.body) body: CreateUserBody): CreateUserResponse {
    return { id: "4ea573de-cfb9-4696-bc48-216f19f44300", ...body };
  }
}
```

### 타입 기반 라우트 계약

```typescript
import {
  Body,
  Controller,
  defineRouteContract,
  Get,
  HttpMethod,
  Param,
  Post,
  ResponseSchema,
  routeBodySchema,
  routeParam,
  routeResponseSchema,
  type RouteBody,
  type RouteMethodReturn,
  type RouteParam,
} from "@croco/protocols-rest";
import { z } from "zod";

const userSchema = z.object({ id: z.string(), name: z.string() });
const createUserSchema = z.object({ name: z.string() });

const getUser = defineRouteContract({
  method: HttpMethod.GET,
  path: "/users/:id",
  params: z.object({ id: z.string() }),
  response: userSchema,
});

const createUser = defineRouteContract({
  method: HttpMethod.POST,
  path: "/users",
  body: createUserSchema,
  response: userSchema,
});

@Controller("/users")
class UserController {
  @Get(getUser.path)
  @ResponseSchema(routeResponseSchema(getUser))
  find(
    @Param(routeParam(getUser, "id")) id: RouteParam<typeof getUser, "id">,
  ): RouteMethodReturn<typeof getUser> {
    return { id, name: "Ada" };
  }

  @Post(createUser.path)
  @ResponseSchema(routeResponseSchema(createUser))
  create(
    @Body(routeBodySchema(createUser)) body: RouteBody<typeof createUser>,
  ): RouteMethodReturn<typeof createUser> {
    return { id: "user-1", name: body.name };
  }
}
```

`defineRouteContract`는 path params, query, body, response, Problem union을 TypeScript 계약으로 연결합니다. `routeParam(getUser, "userId")`처럼 path에 없는 이름이나 response schema와 맞지 않는 반환 타입은 typecheck 단계에서 실패합니다. 런타임 값 검증은 기존처럼 Zod schema와 pipe가 담당합니다.

## API 레퍼런스

- 데코레이터: `Controller`, `Get`, `Post`, `Put`, `Patch`, `Delete`, `Options`, `Head`, `All`
- 파라미터 바인딩: `Param`, `Query`, `Header`, `Body`, `Ctx`, `Raw`
- 라이프사이클: `UseGuards`, `UsePipes`, `UseInterceptors`, `UseFilters`, `Roles`
- 기본 구현체: `AuthGuard`, `RolesGuard`, `LoggingInterceptor`, `HttpExceptionFilter`, `ValidationPipe`
- 메타데이터 조회: `getControllerMeta`, `getRouteMeta`, `getParamsMeta`, `getGuards`, `getPipes`, `getInterceptors`, `getFilters`, `isController`
- 검증 유틸리티: `createValidator`, `validateRequest`, `validateResponse`, `createValidationPipe`
- 검증 Problem: `ValidationProblem`, `RequestValidationProblem`, `ResponseValidationProblem`
- 스키마 계약: `defineRouteSchema`, `InferRouteSchemaRequest`, `InferRouteSchemaResponse`
- 타입: `ExecutionContext`, `PipeTransform`, `ExceptionFilter`, `CallHandler`, `RouteSchema`, `TypedRouteConfig`, `RouteContractSpec`, `RouteMethodReturn`
