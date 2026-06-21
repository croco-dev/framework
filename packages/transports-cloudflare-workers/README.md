# @croco/transports-cloudflare-workers

Croco HTTP 앱을 Cloudflare Workers `fetch` handler로 노출하는 transport adapter입니다.

## 런타임 증거

이 패키지의 beta runtime claim은 Worker request bridge와 published type surface를 함께
검증합니다.

- `pnpm --filter @croco/transports-cloudflare-workers test`는 `toWorkersHandler()` fetch dispatch,
  optional raw env injection, `Context.getRuntimeContext()` env/waitUntil propagation, and published
  Worker declaration import를 검증합니다.
- `pnpm create-croco-app:smoke meta-vite-fullstack-workers`는 generated `ssr-worker`의 Vite config,
  `dist/client` build output, presentation smoke, `ASSETS` fallback, and `API_WORKER` service binding
  call을 zero-credential fixture로 검증합니다.
- API reference는 `packages/docs/src/content/docs/api/transports-cloudflare-workers/`에서
  생성됩니다.

## 설치

```bash
pnpm add @croco/transports-cloudflare-workers @croco/transports-http
```

`WorkersFetchHandler`와 `toWorkersHandler()`의 공개 타입은 Cloudflare Workers
`ExecutionContext`를 포함합니다. 이 패키지는 `@cloudflare/workers-types`를 direct dependency로
선언하므로, 소비자는 별도 타입 패키지를 직접 설치하지 않아도 root entrypoint 선언을 typecheck할 수
있습니다.

## 사용법

```typescript
import "reflect-metadata";
import { Controller, Get } from "@croco/protocols-rest";
import { createApp } from "@croco/transports-http";
import { toWorkersHandler } from "@croco/transports-cloudflare-workers";

@Controller("/api")
class ApiController {
  @Get("/hello")
  hello() {
    return { message: "Hello, Workers" };
  }
}

const app = createApp({
  controllers: [ApiController],
  securityValidation: "off",
});

export default toWorkersHandler(app);
```

## Env 주입

Cloudflare `env` binding과 `ExecutionContext.waitUntil`은 기본적으로
`Context.getRuntimeContext()`에 반영됩니다. 기존 `@Raw()` 기반 Hono env 접근이 필요할 때만
`injectEnv: true`를 사용하면 Cloudflare `env` binding을 내부 Hono fetch 호출로도 전달합니다.

```typescript
import { Context } from "@croco/framework-context";

const runtime = Context.getRuntimeContext();

runtime?.waitUntil(Promise.resolve());
console.log(runtime?.platform); // "cloudflare-workers"
console.log(runtime?.env?.MY_BINDING);

export default toWorkersHandler(app, { injectEnv: true });
```

## API

- `toWorkersHandler(app, options?)` - `CrocoApp`을 Workers-compatible handler로 변환합니다.
- `WorkersFetchHandler` - `{ fetch(request, env, ctx): Promise<Response> }` handler contract입니다.
- `CloudflareEnv` - Worker binding object 타입입니다.
- `WorkersHandlerOptions` - Workers adapter option 타입입니다.

## 타입 계약

Published declarations intentionally reference Cloudflare Workers runtime types. The package manifest
keeps `@cloudflare/workers-types` on the install surface so clean TypeScript consumers can import
`WorkersFetchHandler` and `toWorkersHandler` from `@croco/transports-cloudflare-workers` without a
hoisted or manually installed Workers type package.
