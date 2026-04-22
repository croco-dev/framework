# Croco Frontend Support — Vite + Vike + Cloudflare Workers

## Context

Croco 프레임워크에 프론트엔드 지원을 최초 추가한다. 기존 4계층(Framework → Protocols → Transports → Integrations)은 유지하되, **별도의 Frontend 패키지 family**(`frontend-*`)를 신설한다. 기존 계층에 끼워넣지 않는다. Vite 6 + Vike + @cloudflare/vite-plugin 기반의 React SSR을 Cloudflare Workers에 배포할 수 있게 한다.

**배포 아키텍처**: API Worker(기존 CrocoApp) + SSR Worker(Vike) 별개 배포. Service Bindings로 통신.
**백엔드 통합 방식**: Shallow Integration — SSR에서 API로 `fetch()` 호출만. DI/Container 직접 사용 금지.
**브랜치 전략**: main 직접 커밋.

## Scope

### IN
- `@croco/transports-cloudflare-workers` — API Worker 어댑터
- `@croco/frontend-vite` — Vite 플러그인 코어
- `@croco/frontend-react` — React SSR (Vike 통합)
- `@croco/frontend-cloudflare` — Cloudflare Workers SSR 런타임
- `create-croco-app` 템플릿 업데이트 (Next.js → Vike)

### OUT
- 클라이언트 상태 관리 (Zustand, Jotai 등)
- CSS-in-JS / Tailwind 내장
- 인증/세션 관리
- ISR/PPR 패턴
- Node.js SSR 타겟 (Cloudflare만)

## Architecture Decision Record

### ADR-1: Shallow Integration (API fetch 기반)
- **결정**: SSR Worker → API Worker 통신은 Service Bindings 또는 HTTP fetch만 사용
- **근거**: Workers 환경에서 reflect-metadata/DI 빌드 복잡성 회피. 패키지 독립성 보장
- **결과**: frontend-* 패키지는 @croco/framework-context, typedi, reflect-metadata를 import하지 않음

### ADR-2: 별개 Worker 패턴
- **결정**: API Worker와 SSR Worker를 별도 Worker로 배포
- **근거**: 독립 스케일링, 독립 배포, 장애 격리
- **결과**: wrangler.toml에 두 Worker 정의 또는 별도 wrangler.toml

### ADR-3: Vike 채택 (Next.js 대체)
- **결정**: Next.js 기반 프론트엔드를 Vike + Vite로 완전 대체
- **근거**: Cloudflare-native, Vite 6 Environment API 활용, 프레임워크 수준 커스터마이징 가능
- **결과**: create-croco-app에서 Next.js 관련 템플릿 제거

### ADR-4: API ↔ SSR Worker 컨텍스트 전달 규약
- **Oracle 판정**: **CONDITIONAL** — ADR-2(별개 Worker 패턴)의 조건으로 auth/context 전파 규약이 필수
- **조건 반영**: Task 5.6에서 `createApiFetch` 헬퍼로 구현, Task 5.3/5.5에서 템플릿에 반영
- **결정**: API Worker와 SSR Worker 간 컨텍스트 전달에 표준 HTTP 헤더를 사용
- **근거**: DI/ALS를 공유할 수 없으므로 HTTP 경계에서 명시적 컨텍스트 전달 필수
- **표준 헤더 목록**:
  - `X-Request-Id` — 요청 추적 ID (SSR Worker가 생성, API Worker가 전파)
  - `X-Trace-Id` / `traceparent` — OpenTelemetry 분산 추적 (W3C Trace Context)
  - `Authorization` — 사용자 인증 토큰 (SSR Worker가 클라이언트 쿠키에서 추출하여 전달)
  - `X-Forwarded-For` — 원본 클라이언트 IP
- **결과**: SSR Worker의 API fetch 래퍼가 이 헤더들을 자동 주입. create-croco-app 템플릿의 `+data.ts`에 패턴 예시 포함

### ADR-5: Build-time vs Runtime 패키지 분리
- **Oracle 판정**: **CONDITIONAL (BLOCKER급)** — `frontend-cloudflare → frontend-vite` 의존은 runtime이 build-time에 의존하게 만들어 Workers 호환성 파괴
- **조건 반영**: Dependency Rules에서 해당 의존 금지, Task 4.1의 package.json에서 제거, Task 6.3에서 검증
- **결정**: `frontend-vite`는 **build-time 전용** 패키지. runtime import graph에 포함되지 않음
- **근거**: runtime 패키지(frontend-cloudflare)가 build-time 도구(Vite 플러그인)에 의존하면 번들 크기 폭발 + Workers 호환성 파괴
- **결과**: `frontend-cloudflare`는 `frontend-vite`를 import하지 않음. 각각 독립 패키지

### Oracle 전체 판정 요약
| ADR | 판정 | 조건/반영 |
|-----|------|-----------|
| ADR-1 Shallow Integration | **SAFE** | — |
| ADR-2 별개 Worker 패턴 | **CONDITIONAL** | ADR-4로 컨텍스트 전달 규약 추가 |
| ADR-3 Vike 채택 | **CONDITIONAL** | Wave 0 PoC에서 검증, 기존 Next.js 템플릿은 deprecated 표시만 |
| ADR-4 컨텍스트 전달 규약 | **CONDITIONAL** | Task 5.6에서 구현 |
| ADR-5 Build/Runtime 분리 | **CONDITIONAL (BLOCKER급)** | Dependency Rules + Task 4.1 + Task 6.3에서 강제 |

## Dependency Rules (MUST NOT 위반)

```
frontend-vite       → vite, @cloudflare/vite-plugin, vike (peerDeps) [BUILD-TIME ONLY]
frontend-react      → react, react-dom, vike-react (peerDeps) [RUNTIME]
frontend-cloudflare → frontend-react (workspace dep) [RUNTIME]
transports-cloudflare-workers → transports-http (workspace dep) [RUNTIME]

금지:
- frontend-cloudflare → frontend-vite (runtime이 build-time에 의존 금지 — ADR-5)
- frontend-* → @croco/framework-context (DI 침투 방지)
- frontend-* → reflect-metadata
- frontend-* → typedi
- transports-cloudflare-workers → vite, vike (프론트엔드 침투 방지)
```

## Package Structure Reference

모든 새 패키지는 transports-http 패턴을 따른다:
```
packages/{name}/
├── src/
│   ├── index.ts              # Barrel exports
│   ├── libs/
│   │   ├── {MainClass}.ts
│   │   └── types.ts
│   └── tests/
│       └── {MainClass}.spec.ts
├── package.json              # tsup build, vitest test, workspace:* deps
└── tsconfig.json             # extends @croco/utils-tsconfig/tsconfig.node.json
```

**package.json 템플릿** (transports-http 기준):
- scripts: build (tsup), test (vitest run), typecheck (tsc --noEmit), lint (biome check .)
- publishConfig: esm+cjs dual, dist/ 디렉토리
- vitest: { include: ["src/**/*.spec.ts"] }

**tsconfig.json 템플릿** (Node 패키지용):
```json
{
  "exclude": ["node_modules"],
  "extends": "@croco/utils-tsconfig/tsconfig.node.json",
  "compilerOptions": { "module": "esnext", "moduleResolution": "bundler" },
  "include": ["src/**/*.ts"]
}
```

**tsconfig.json 템플릿** (React/TSX 패키지용 — frontend-react, frontend-cloudflare):
```json
{
  "exclude": ["node_modules"],
  "extends": "@croco/utils-tsconfig/tsconfig.react.json",
  "compilerOptions": { "module": "esnext", "moduleResolution": "bundler" },
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
```

## Implementation Waves

### Wave 0: PoC Validation (검증 스파이크)

PoC는 `/tmp/croco-vite-poc/` 임시 디렉토리에서 수행한다. 프레임워크 레포에 코드를 추가하지 않는다. PoC 완료 후 임시 디렉토리를 삭제한다.

- [x] **Task 0.1**: Vite 6 + Vike + @cloudflare/vite-plugin 호환성 검증 PoC
  - `/tmp/croco-vite-poc/` 디렉토리 생성
  - `pnpm create vike` 또는 수동으로 최소 프로젝트 생성
  - `vite.config.ts`에 `cloudflare()`, `vike()`, `react()` 플러그인 조합 설정
  - `vite build` 성공 확인 (client + worker 번들 출력)
  - `vite dev` 성공 확인 (HMR 동작)
  - **수락 기준**: `vite build`가 에러 없이 완료되고, `dist/client/` + worker 번들이 생성됨
  - **실패 시**: Vike 버전 조정 또는 @cloudflare/vite-plugin 버전 조정. 3회 시도 실패 시 사용자에게 보고

- [x] **Task 0.2**: Workers 환경에서 Hono + fetch 패턴 검증
  - PoC 디렉토리에 별도 `api-worker/` 생성
  - Hono 앱 생성 → `export default { fetch }` 패턴으로 Worker 엔트리 작성
  - `wrangler dev`로 로컬 실행 → curl로 API 응답 확인
  - **수락 기준**: Hono 앱이 Workers에서 정상 응답 반환

- [x] **Task 0.3**: Service Bindings 개발 모드 검증 + PoC 정리
  - PoC에서 API Worker + SSR Worker 두 개를 wrangler.toml에 정의
  - SSR Worker에서 `env.API_WORKER.fetch()` 호출 테스트
  - `wrangler dev` 모드에서 Service Binding 동작 확인
  - **수락 기준**: SSR Worker → API Worker 서비스 바인딩 호출 성공
  - **실패 시**: 개발 모드 fallback으로 `localhost:PORT` fetch 패턴 채택:
    - Task 4.2의 `createSsrHandler`에 `devFallbackUrl?: string` 옵션 추가
    - `SsrWorkerEnv.API_WORKER`가 없으면 `devFallbackUrl`로 일반 fetch 호출
    - Task 4.3 테스트에 "Service Binding 미존재 시 fallback fetch 동작" 케이스 추가
    - Task 5.3 템플릿의 `+data.ts`에 개발 모드 fallback 분기 예시 추가
  - PoC 완료 후 `/tmp/croco-vite-poc/` 디렉토리 삭제

### Wave 1: @croco/transports-cloudflare-workers

- [x] **Task 1.1**: 패키지 스캐폴딩
  - `packages/transports-cloudflare-workers/` 디렉토리 생성
  - **package.json** 작성:
    ```json
    {
      "name": "@croco/transports-cloudflare-workers",
      "version": "0.1.0",
      "type": "commonjs",
      "main": "./src/index.ts",
      "types": "./src/index.ts",
      "scripts": {
        "build": "tsup src/index.ts --format esm,cjs --minify --clean --dts",
        "test": "vitest run",
        "typecheck": "tsc --noEmit",
        "lint": "biome check ."
      },
      "dependencies": {
        "@croco/transports-http": "workspace:*"
      },
      "devDependencies": {
        "@croco/utils-tsconfig": "workspace:*",
        "@cloudflare/workers-types": "^4.0.0",
        "vitest": "4.0.16"
      },
      "vitest": { "include": ["src/**/*.spec.ts"] },
      "publishConfig": {
        "access": "public",
        "main": "./dist/index.js",
        "types": "./dist/index.d.ts",
        "exports": {
          ".": {
            "import": "./dist/index.js",
            "require": "./dist/index.cjs",
            "types": "./dist/index.d.ts"
          }
        }
      },
      "files": ["dist"]
    }
    ```
  - **tsconfig.json**: extends `@croco/utils-tsconfig/tsconfig.node.json`, module: esnext, moduleResolution: bundler
  - `pnpm install` 실행
  - **QA 검증 절차**:
    1. `pnpm typecheck --filter=@croco/transports-cloudflare-workers` 실행 → 에러 0건
    2. `ls packages/transports-cloudflare-workers/src/index.ts` → 파일 존재 확인
    3. `jq '.name' packages/transports-cloudflare-workers/package.json` → `"@croco/transports-cloudflare-workers"` 출력
  - **수락 기준**: typecheck 통과, 패키지 구조 정상

- [x] **Task 1.2**: types.ts 작성
  - `src/libs/types.ts` 생성
  - 타입 정의:
    ```typescript
    export type CloudflareEnv = Record<string, unknown>;

    export type WorkersHandlerOptions = {
      /** env를 FrameworkContext에 주입할지 여부 (기본: false) */
      injectEnv?: boolean;
    };

    export type WorkersFetchHandler = {
      fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response>;
    };
    ```
  - `CloudflareEnv`는 generic이 아닌 `Record<string, unknown>`으로 시작 (V2에서 타입 파라미터 추가 가능)
  - **QA 검증 절차**: `pnpm typecheck --filter=@croco/transports-cloudflare-workers` 실행 → 에러 0건
  - **수락 기준**: typecheck 통과

- [x] **Task 1.3**: WorkersAdapter.ts 구현
  - `src/libs/adapters/WorkersAdapter.ts` 생성
  - LambdaAdapter 패턴을 정확히 미러링:
    ```typescript
    import type { CrocoApp } from '@croco/transports-http';
    import type { CloudflareEnv, WorkersFetchHandler, WorkersHandlerOptions } from '../types';

    export function toWorkersHandler(app: CrocoApp, options?: WorkersHandlerOptions): WorkersFetchHandler {
      return {
        async fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response> {
          return app.fetch(request);
        },
      };
    }
    ```
  - 함수 시그니처: `toWorkersHandler(app: CrocoApp, options?: WorkersHandlerOptions): WorkersFetchHandler`
  - **주의**: V1에서 `env`, `ctx`는 전달만 받고 사용하지 않음. `options.injectEnv`는 스텁만 (미구현, TODO 주석)
  - **QA 검증 절차**: `pnpm typecheck --filter=@croco/transports-cloudflare-workers` 실행 → 에러 0건
  - **수락 기준**: typecheck 통과

- [x] **Task 1.4**: 테스트 + barrel export
  - `src/tests/WorkersAdapter.spec.ts` 생성
  - 테스트 케이스:
    1. `toWorkersHandler(app)`가 `{ fetch }` 객체를 반환하는지
    2. `handler.fetch(request, env, ctx)`가 `app.fetch(request)`의 응답을 그대로 반환하는지
    3. 다양한 HTTP 메서드 (GET, POST, PUT, DELETE) 라우팅
  - 테스트에서 CrocoApp은 실제 인스턴스 사용 (최소 컨트롤러 + createApp)
  - `src/index.ts` barrel export 작성:
    ```typescript
    export { toWorkersHandler } from './libs/adapters/WorkersAdapter';
    export type { CloudflareEnv, WorkersFetchHandler, WorkersHandlerOptions } from './libs/types';
    ```
  - **QA 검증 절차**:
    1. `pnpm test --filter=@croco/transports-cloudflare-workers` 실행 → 전체 테스트 PASS
    2. `pnpm build --filter=@croco/transports-cloudflare-workers` 실행 → `dist/` 디렉토리 생성, `dist/index.js` + `dist/index.cjs` + `dist/index.d.ts` 존재
    3. `pnpm typecheck --filter=@croco/transports-cloudflare-workers` 실행 → 에러 0건
  - **수락 기준**: test + build + typecheck 모두 통과

### Wave 2: @croco/frontend-vite

- [x] **Task 2.1**: 패키지 스캐폴딩
  - `packages/frontend-vite/` 디렉토리 생성
  - **package.json**:
    ```json
    {
      "name": "@croco/frontend-vite",
      "version": "0.1.0",
      "type": "commonjs",
      "main": "./src/index.ts",
      "types": "./src/index.ts",
      "scripts": {
        "build": "tsup src/index.ts --format esm,cjs --minify --clean --dts",
        "test": "vitest run",
        "typecheck": "tsc --noEmit",
        "lint": "biome check ."
      },
      "peerDependencies": {
        "vite": "^6.0.0",
        "vike": "^0.4.0"
      },
      "dependencies": {},
      "devDependencies": {
        "@croco/utils-tsconfig": "workspace:*",
        "vite": "^6.0.0",
        "vike": "^0.4.0",
        "@cloudflare/vite-plugin": "^1.0.0",
        "vitest": "4.0.16"
      },
      "vitest": { "include": ["src/**/*.spec.ts"] },
      "publishConfig": {
        "access": "public",
        "main": "./dist/index.js",
        "types": "./dist/index.d.ts",
        "exports": {
          ".": {
            "import": "./dist/index.js",
            "require": "./dist/index.cjs",
            "types": "./dist/index.d.ts"
          }
        }
      },
      "files": ["dist"]
    }
    ```
  - **핵심 동작**: cloudflare + vike 플러그인을 올바른 순서로 래핑
  - **QA 검증 절차**:
    1. `pnpm install` — lockfile 업데이트, 에러 없음
    2. `pnpm typecheck --filter=@croco/frontend-vite` 실행 → 에러 0건
    3. `tsconfig.json`이 `tsconfig.node.json`을 extends하는지 확인
  - **수락 기준**: `pnpm install` + `pnpm typecheck` 통과

- [x] **Task 2.2**: types.ts 생성
  - `src/libs/types.ts` 생성:
    ```typescript
    import type { Plugin } from 'vite';

    export type CrocoViteOptions = {
      /** SSR 활성화 여부 (기본: true) */
      ssr?: boolean;
      /** Cloudflare Workers 타겟 여부 (기본: true) */
      cloudflare?: boolean;
    };

    export type CrocoViteConfig = {
      /** 생성된 Vite 플러그인 배열 */
      plugins: Plugin[];
    };
    ```
  - **QA 검증 절차**:
    1. `pnpm typecheck --filter=@croco/frontend-vite` 실행 → 에러 0건
    2. `CrocoViteOptions` 타입에 `ssr`, `cloudflare` 필드가 optional로 존재하는지 확인
  - **수락 기준**: typecheck 통과

- [x] **Task 2.3**: crocoVitePlugin.ts 구현
  - `src/libs/crocoVitePlugin.ts` 생성
  - Vite 플러그인 팩토리 함수 — **정적 import 방식** (동기 반환):
    ```typescript
    import type { Plugin } from 'vite';
    import cloudflare from '@cloudflare/vite-plugin';
    import vike from 'vike/plugin';
    import type { CrocoViteOptions } from './types';

    export function crocoVitePlugin(options: CrocoViteOptions = {}): Plugin[] {
      const { ssr = true, cloudflare: useCloudflare = true } = options;
      const plugins: Plugin[] = [];

      if (useCloudflare) {
        plugins.push(cloudflare({ viteEnvironment: { name: 'ssr' } }));
      }

      plugins.push(vike({ prerender: false }));

      return plugins;
    }
    ```
  - **설계 결정**: `@cloudflare/vite-plugin`과 `vike`는 peerDependencies로 선언되어 항상 설치됨. 따라서 정적 import 사용 (동기 `Plugin[]` 반환 유지). 동적 import와의 충돌 문제 제거.
  - **핵심 동작**: cloudflare + vike 플러그인을 올바른 순서로 조합하여 반환
  - 플러그인 순서: `[cloudflare({ viteEnvironment: { name: 'ssr' } }), vike({ prerender: false })]`
  - cloudflare 비활성화 시 vike만 반환 (Node.js 개발용)
  - **QA 검증 절차**:
    1. `pnpm typecheck --filter=@croco/frontend-vite` 실행 → 에러 0건
    2. `crocoVitePlugin()` 반환값이 `Plugin[]` 타입인지 테스트에서 검증 (Task 2.4)
  - **수락 기준**: typecheck 통과, 함수가 Plugin[] 반환

- [x] **Task 2.4**: 테스트 + barrel export
  - `src/tests/crocoVitePlugin.spec.ts` 생성
  - 테스트 케이스:
    1. 기본 옵션으로 Plugin[] 반환 확인
    2. `cloudflare: false` 시 cloudflare 플러그인 미포함 확인
    3. `ssr: false` 시 SSR 관련 설정 미적용 확인
  - `src/index.ts` barrel export:
    ```typescript
    export { crocoVitePlugin } from './libs/crocoVitePlugin';
    export type { CrocoViteConfig, CrocoViteOptions } from './libs/types';
    ```
  - **QA 검증 절차**:
    1. `pnpm test --filter=@croco/frontend-vite` 실행 → 전체 테스트 PASS
    2. `pnpm build --filter=@croco/frontend-vite` 실행 → `dist/` 디렉토리 생성
    3. `pnpm typecheck --filter=@croco/frontend-vite` 실행 → 에러 0건
  - **수락 기준**: test + typecheck + build 모두 통과

### Wave 3: @croco/frontend-react

- [x] **Task 3.1**: 패키지 스캐폴딩
  - `packages/frontend-react/` 디렉토리 생성
  - **package.json**:
    ```json
    {
      "name": "@croco/frontend-react",
      "version": "0.1.0",
      "type": "commonjs",
      "main": "./src/index.ts",
      "types": "./src/index.ts",
      "scripts": {
        "build": "tsup src/index.ts --format esm,cjs --minify --clean --dts",
        "test": "vitest run",
        "typecheck": "tsc --noEmit",
        "lint": "biome check ."
      },
      "peerDependencies": {
        "react": "^19.0.0",
        "react-dom": "^19.0.0",
        "vike": "^0.4.0",
        "vike-react": "^0.5.0"
      },
      "devDependencies": {
        "@croco/utils-tsconfig": "workspace:*",
        "@types/react": "^19.0.0",
        "@types/react-dom": "^19.0.0",
        "react": "^19.0.0",
        "react-dom": "^19.0.0",
        "vike": "^0.4.0",
        "vike-react": "^0.5.0",
        "vitest": "4.0.16"
      },
      "vitest": { "include": ["src/**/*.spec.ts"] },
      "publishConfig": {
        "access": "public",
        "main": "./dist/index.js",
        "types": "./dist/index.d.ts",
        "exports": {
          ".": {
            "import": "./dist/index.js",
            "require": "./dist/index.cjs",
            "types": "./dist/index.d.ts"
          }
        }
      },
      "files": ["dist"]
    }
    ```
  - **tsconfig.json**: extends `@croco/utils-tsconfig/tsconfig.react.json` (tsx 지원), include에 `src/**/*.tsx` 추가
  - **QA 검증 절차**:
    1. `pnpm install` 실행 → 에러 없음
    2. `pnpm typecheck --filter=@croco/frontend-react` 실행 → 에러 0건
  - **수락 기준**: install + typecheck 통과

- [x] **Task 3.2**: types.ts + PageContext 타입 작성
  - `src/libs/types.ts` 생성:
    ```typescript
    export type CrocoPageContext = {
      /** 현재 페이지 URL */
      urlOriginal: string;
      /** API Worker에서 가져온 데이터 */
      data?: unknown;
      /** 페이지별 메타 정보 */
      title?: string;
      description?: string;
      /** Service Binding 환경 (SSR 전용) */
      env?: Record<string, unknown>;
    };

    export type CrocoDataFn<T = unknown> = (pageContext: CrocoPageContext) => Promise<T> | T;
    ```
  - **QA 검증 절차**: `pnpm typecheck --filter=@croco/frontend-react` 실행 → 에러 0건
  - **수락 기준**: typecheck 통과

- [x] **Task 3.3**: createCrocoPages 유틸리티 구현
  - `src/libs/createCrocoPages.ts` 생성
  - Vike의 `+config.ts` 기본 설정을 Croco 스타일로 래핑:
    ```typescript
    import type { CrocoPageContext } from './types';

    /**
     * Croco 앱에서 Vike 페이지 설정의 기본값을 제공한다.
     * 사용자는 각 페이지의 +config.ts에서 이 함수의 반환값을 spread하여 사용한다.
     */
    export function createCrocoPageConfig(options?: { ssr?: boolean }) {
      return {
        ssr: options?.ssr ?? true,
        passToClient: ['data', 'title', 'description'] as const,
      };
    }
    ```
  - `src/libs/hooks/usePageData.ts` 생성:
    ```typescript
    // Vike의 usePageContext를 래핑하여 data에 타입 안전 접근 제공
    export function usePageData<T = unknown>(): T {
      // vike-react의 usePageContext() 사용
      // pageContext.data를 T로 캐스팅하여 반환
    }
    ```
  - **QA 검증 절차**:
    1. `pnpm typecheck --filter=@croco/frontend-react` 통과 확인
    2. `createCrocoPageConfig()` 반환 타입이 `{ ssr: boolean; passToClient: readonly ['data', 'title', 'description'] }`인지 소스 코드에서 확인
    3. `usePageData` 제네릭 타입 파라미터가 올바르게 동작하는지 — `usePageData<{ name: string }>()` 형태의 타입 테스트 코드 작성
  - **수락 기준**: typecheck 통과

- [x] **Task 3.4**: 테스트 + barrel export
  - `src/tests/createCrocoPages.spec.ts` 생성
  - 테스트 케이스:
    1. `createCrocoPageConfig()` 기본값 확인 (ssr: true, passToClient 포함)
    2. `createCrocoPageConfig({ ssr: false })` 시 ssr: false 확인
  - `src/index.ts` barrel export:
    ```typescript
    export { createCrocoPageConfig } from './libs/createCrocoPages';
    export { usePageData } from './libs/hooks/usePageData';
    export type { CrocoDataFn, CrocoPageContext } from './libs/types';
    ```
  - **QA 검증 절차**:
    1. `pnpm vitest run --filter=@croco/frontend-react` — 2개 테스트 케이스 모두 PASS
    2. `pnpm typecheck --filter=@croco/frontend-react` — 에러 0건
    3. `pnpm build --filter=@croco/frontend-react` — `dist/` 디렉토리에 index.js, index.cjs, index.d.ts 생성 확인
    4. `src/index.ts`에서 `createCrocoPageConfig`, `usePageData`, `CrocoDataFn`, `CrocoPageContext` 모두 export되는지 확인
  - **수락 기준**: test + typecheck + build 모두 통과

### Wave 4: @croco/frontend-cloudflare

- [x] **Task 4.1**: 패키지 스캐폴딩
  - `packages/frontend-cloudflare/` 디렉토리 생성
  - **package.json**:
    ```json
    {
      "name": "@croco/frontend-cloudflare",
      "version": "0.1.0",
      "type": "commonjs",
      "main": "./src/index.ts",
      "types": "./src/index.ts",
      "scripts": {
        "build": "tsup src/index.ts --format esm,cjs --minify --clean --dts",
        "test": "vitest run",
        "typecheck": "tsc --noEmit",
        "lint": "biome check ."
      },
      "dependencies": {
        "@croco/frontend-react": "workspace:*"
      },
      "peerDependencies": {
        "vike": "^0.4.0"
      },
      "devDependencies": {
        "@croco/utils-tsconfig": "workspace:*",
        "@cloudflare/workers-types": "^4.0.0",
        "vike": "^0.4.0",
        "vitest": "4.0.16"
      },
      "vitest": { "include": ["src/**/*.spec.ts"] },
      "publishConfig": {
        "access": "public",
        "main": "./dist/index.js",
        "types": "./dist/index.d.ts",
        "exports": {
          ".": {
            "import": "./dist/index.js",
            "require": "./dist/index.cjs",
            "types": "./dist/index.d.ts"
          }
        }
      },
      "files": ["dist"]
    }
    ```
  - **tsconfig.json**: extends `@croco/utils-tsconfig/tsconfig.react.json` (tsx 지원), include에 `src/**/*.tsx` 추가
  - **QA 검증 절차**:
    1. `pnpm install` — lockfile 업데이트, 에러 없음
    2. `pnpm typecheck --filter=@croco/frontend-cloudflare` — 에러 0건
    3. `package.json`에 `@croco/frontend-vite` 의존이 **없는지** 확인 (ADR-5)
    4. `tsconfig.json`이 `tsconfig.react.json`을 extends하는지 확인
  - **수락 기준**: `pnpm install` + `pnpm typecheck` 통과

- [x] **Task 4.2**: types.ts + CloudflareSsrHandler 구현
  - `src/libs/types.ts` 생성:
    ```typescript
    export type SsrWorkerEnv = {
      /** API Worker Service Binding */
      API_WORKER?: Fetcher;
      /** Workers Assets (자동 바인딩) */
      ASSETS?: Fetcher;
      [key: string]: unknown;
    };

    export type SsrHandlerOptions = {
      /** API Worker Service Binding 이름 (기본: 'API_WORKER') */
      apiBindingName?: string;
    };
    ```
  - `src/libs/CloudflareSsrHandler.ts` 생성:
    ```typescript
    import type { SsrHandlerOptions, SsrWorkerEnv } from './types';

    /**
     * Cloudflare Workers용 SSR fetch 핸들러를 생성한다.
     * Vike의 renderPage()를 호출하여 HTML을 반환한다.
     */
    export function createSsrHandler(options?: SsrHandlerOptions) {
      return {
        async fetch(request: Request, env: SsrWorkerEnv, ctx: ExecutionContext): Promise<Response> {
          const url = new URL(request.url);

          // 1. 정적 자산은 ASSETS에 위임
          // env.ASSETS가 존재하면 env.ASSETS.fetch(request)로 먼저 시도
          // 404가 아니면 그대로 반환

          // 2. Vike renderPage 호출
          // import { renderPage } from 'vike/server' (dynamic import)
          // pageContext에 env를 전달 (API_WORKER 바인딩 접근용)
          // const pageContext = await renderPage({ urlOriginal: url.pathname + url.search, env })

          // 3. Response 생성
          // pageContext.httpResponse가 없으면 404
          // httpResponse.body + statusCode + headers로 Response 구성
        },
      };
    }
    ```
  - **핵심**: renderPage를 dynamic import로 호출 (번들링 시점에 vike가 엔트리를 결정하므로)
  - **QA 검증 절차**:
    1. `pnpm typecheck --filter=@croco/frontend-cloudflare` — 에러 0건
    2. `createSsrHandler()` 반환 타입이 `{ fetch: (request: Request, env: SsrWorkerEnv, ctx: ExecutionContext) => Promise<Response> }` 형태인지 소스 확인
    3. `SsrWorkerEnv` 타입에 `API_WORKER?: Fetcher`, `ASSETS?: Fetcher` 존재 확인
    4. `grep -r "frontend-vite" packages/frontend-cloudflare/src/` → 결과 0건 (ADR-5 준수)
  - **수락 기준**: typecheck 통과

- [x] **Task 4.3**: 테스트 + barrel export
  - `src/tests/CloudflareSsrHandler.spec.ts` 생성
  - 테스트 케이스:
    1. `createSsrHandler()` 가 `{ fetch }` 객체를 반환하는지
    2. 함수 시그니처 타입 검증 (Request, SsrWorkerEnv, ExecutionContext 인자)
  - 참고: renderPage는 Vike 런타임 의존이므로 유닛 테스트에서는 모킹
    - `vi.mock('vike/server', () => ({ renderPage: vi.fn() }))`
    - 모킹된 renderPage가 올바른 pageContext를 받는지 검증
    - 모킹된 httpResponse를 Response로 변환하는 로직 검증
  - `src/index.ts` barrel export:
    ```typescript
    export { createSsrHandler } from './libs/CloudflareSsrHandler';
    export type { SsrHandlerOptions, SsrWorkerEnv } from './libs/types';
    ```
  - **QA 검증 절차**:
    1. `pnpm vitest run --filter=@croco/frontend-cloudflare` — 모든 테스트 PASS
    2. `pnpm typecheck --filter=@croco/frontend-cloudflare` — 에러 0건
    3. `pnpm build --filter=@croco/frontend-cloudflare` — `dist/` 생성 확인
    4. `src/index.ts`에서 `createSsrHandler`, `SsrHandlerOptions`, `SsrWorkerEnv` 모두 export 확인
  - **수락 기준**: test + typecheck + build 모두 통과

### Wave 5: create-croco-app 업데이트

- [x] **Task 5.1**: GeneratorOptions 타입 확장
  - `packages/create-croco-app/src/types.ts` 수정
  - `frontendDeploy` 옵션에 `'cloudflare-vike'` 추가 (기존: `'opennext' | 'vercel' | 'docker'`)
  - `preset` 옵션에 `'ddd-vike-fullstack'` 추가 또는 기존 `'ddd-fullstack'`의 frontend를 Vike로 교체
  - **결정**: 기존 `'ddd-fullstack'`을 Vike로 교체. Next.js 프리셋은 deprecated 표시만 하고 V1에서는 제거하지 않음 (breaking change 최소화)
  - **QA 검증 절차**:
    1. `pnpm typecheck --filter=create-croco-app` — 에러 0건
    2. `GeneratorOptions` 타입에서 `frontendDeploy`에 `'cloudflare-vike'` 리터럴이 union에 포함되는지 소스 확인
    3. 기존 `'opennext' | 'vercel' | 'docker'` 값이 여전히 유효한지 확인 (breaking change 없음)
  - **수락 기준**: typecheck 통과

- [x] **Task 5.2**: web-vike 템플릿 생성
  - `packages/create-croco-app/templates/addons/web-vike/` 디렉토리 생성
  - 파일 구조:
    ```
    web-vike/
    ├── package.json.hbs          # @croco/frontend-react, vike, vike-react, react deps
    ├── tsconfig.json.hbs
    ├── vite.config.ts.hbs        # crocoVitePlugin({ cloudflare: true })
    ├── wrangler.toml.hbs         # SSR Worker 설정
    ├── src/
    │   ├── pages/
    │   │   └── index/
    │   │       ├── +Page.tsx     # 기본 홈페이지
    │   │       ├── +data.ts      # fetch 기반 데이터 로딩 예시
    │   │       └── +title.ts
    │   └── layouts/
    │       └── LayoutDefault.tsx  # 기본 레이아웃
    └── public/
        └── favicon.ico
    ```
  - **Handlebars 변수**: `{{projectName}}`, `{{packageManager}}` 등 기존 템플릿 패턴 따름
  - **QA 검증 절차**:
    1. 각 .hbs 파일이 유효한 Handlebars 문법인지 확인: 기존 `packages/create-croco-app/templates/addons/web-trpc/` 템플릿과 변수 패턴 대조
    2. `package.json.hbs`를 수동 렌더링하여 유효한 JSON 출력 확인 (projectName="test-app"으로 치환)
    3. `vite.config.ts.hbs` 렌더링 결과가 유효한 TypeScript인지 확인
    4. 기존 `packages/create-croco-app/templates/addons/frontend-opennext/` 템플릿의 `wrangler.toml.hbs`와 구조 비교 — 동일 패턴 사용
  - **수락 기준**: 모든 .hbs 파일이 Handlebars 문법 유효 + 렌더링 결과가 각 파일 형식에 맞는 유효한 내용

- [x] **Task 5.3**: web-vike-fullstack 템플릿 생성
  - `packages/create-croco-app/templates/addons/web-vike-fullstack/` 디렉토리 생성
  - web-vike 템플릿을 기반으로 확장:
    ```
    web-vike-fullstack/
    ├── (web-vike 내용 전부 포함)
    ├── wrangler.toml.hbs         # SSR Worker + API Worker Service Binding 설정
    └── src/
        └── pages/
            └── index/
                └── +data.ts      # Service Binding을 통한 API 호출 예시
    ```
  - wrangler.toml에 Service Binding 설정:
    ```toml
    [[services]]
    binding = "API_WORKER"
    service = "{{projectName}}-api"
    ```
  - +data.ts에서 `env.API_WORKER.fetch('/api/...')` 패턴 예시
  - **QA 검증 절차**:
    1. `wrangler.toml.hbs` 렌더링 결과에 `[[services]]` 블록과 `binding = "API_WORKER"` 존재 확인
    2. `+data.ts`에서 `env.API_WORKER.fetch()` 패턴이 올바른 TypeScript인지 확인
    3. web-vike 템플릿과의 차이점이 wrangler.toml과 +data.ts 뿐인지 확인 (나머지 파일은 동일해야 함)
  - **수락 기준**: 템플릿 파일 생성 완료 + Service Binding 설정이 렌더링 결과에 정확히 반영됨

- [x] **Task 5.4**: Generator 로직 업데이트
  - `packages/create-croco-app/src/` 의 generator 코드에서 `frontendDeploy === 'cloudflare-vike'` 분기 추가
  - web-vike / web-vike-fullstack 템플릿을 선택적으로 복사하는 로직
  - CLI 프롬프트에 Vike 옵션 추가 (기존 OpenNext/Vercel 옵션과 나란히)
  - **QA 검증 절차**:
    1. `pnpm typecheck --filter=create-croco-app` — 에러 0건
    2. Generator 코드에서 `frontendDeploy === 'cloudflare-vike'` 분기가 존재하는지 grep 확인
    3. 해당 분기에서 `web-vike` (또는 `web-vike-fullstack`) 템플릿 경로를 참조하는지 확인
    4. CLI 프롬프트 목록에 Vike 관련 선택지가 추가되었는지 소스 확인
  - **수락 기준**: `pnpm typecheck --filter=create-croco-app` 통과

- [x] **Task 5.5**: create-croco-app E2E 검증
  - dry-run으로 각 프리셋 테스트:
    1. `web-vike` 템플릿만 사용하여 프로젝트 생성 → `pnpm install` + `pnpm typecheck` 통과
    2. `web-vike-fullstack` 템플릿 → 생성된 프로젝트에 API + SSR Worker 설정 존재 확인
  - 기존 프리셋(ddd-api, blank) 회귀 검증 — 기존 테스트 통과 확인
  - **QA 검증 절차**:
    1. `pnpm test --filter=create-croco-app` — 기존 테스트 전체 PASS (회귀 없음)
    2. dry-run: Generator를 `frontendDeploy: 'cloudflare-vike'`로 실행하여 /tmp에 프로젝트 생성
    3. 생성된 프로젝트에서 `pnpm install && pnpm typecheck` 통과 확인
    4. 생성된 프로젝트에 `vite.config.ts`, `wrangler.toml`, `src/pages/index/+Page.tsx` 존재 확인
    5. 기존 프리셋(`ddd-api`, `blank`) dry-run → 생성 결과 변경 없음 확인
  - **수락 기준**: 새 템플릿으로 생성된 프로젝트가 typecheck 통과, 기존 테스트 미깨짐

## Final Verification Wave

- [x] **Task 5.6**: ADR-4 컨텍스트 전달 규약 반영
  - `web-vike-fullstack` 템플릿의 `+data.ts`에 API fetch 래퍼 헬퍼 예시 추가:
    ```typescript
    // src/helpers/apiFetch.ts
    export function createApiFetch(env: { API_WORKER?: Fetcher }, request: Request) {
      const headers = new Headers();
      headers.set('X-Request-Id', crypto.randomUUID());
      // traceparent 전파 (있으면)
      const traceparent = request.headers.get('traceparent');
      if (traceparent) headers.set('traceparent', traceparent);
      // 인증 토큰 전달 (쿠키에서 추출)
      const authToken = parseCookie(request.headers.get('cookie') ?? '', 'token');
      if (authToken) headers.set('Authorization', `Bearer ${authToken}`);
      // X-Forwarded-For
      headers.set('X-Forwarded-For', request.headers.get('cf-connecting-ip') ?? '');

      return async (path: string, init?: RequestInit) => {
        const fetcher = env.API_WORKER ?? globalThis;
        return fetcher.fetch(new Request(`https://api${path}`, { ...init, headers: mergeHeaders(headers, init?.headers) }));
      };
    }
    ```
  - `+data.ts` 예시에서 `createApiFetch(env, request)` 사용 패턴 포함
  - **QA 검증 절차**:
    1. `apiFetch.ts` 소스에서 4개 표준 헤더(`X-Request-Id`, `traceparent`, `Authorization`, `X-Forwarded-For`) 문자열 존재 확인
    2. `+data.ts` 예시에서 `createApiFetch()` import + 사용 패턴 확인
    3. `pnpm typecheck --filter=create-croco-app` — 에러 0건 (hbs 파일은 typecheck 대상 아니므로, 렌더링 결과 기준)
  - **수락 기준**: 헬퍼 파일이 유효한 TypeScript, 4개 표준 헤더(X-Request-Id, traceparent, Authorization, X-Forwarded-For) 모두 포함

- [x] **Task 6.1**: 전체 빌드 + 타입체크
  - `pnpm build` (전체 모노레포)
  - `pnpm typecheck` (전체 모노레포)
  - 새 패키지 4개 모두 빌드 산출물 확인 (dist/ 디렉토리)
  - **QA 검증 절차**:
    1. `pnpm build` — 전체 모노레포 빌드, exit code 0
    2. `pnpm typecheck` — 전체 모노레포 타입체크, exit code 0
    3. 각 신규 패키지 빌드 산출물 존재 확인:
       - `ls packages/transports-cloudflare-workers/dist/` → index.js, index.cjs, index.d.ts
       - `ls packages/frontend-vite/dist/` → index.js, index.cjs, index.d.ts
       - `ls packages/frontend-react/dist/` → index.js, index.cjs, index.d.ts
       - `ls packages/frontend-cloudflare/dist/` → index.js, index.cjs, index.d.ts
  - **수락 기준**: 에러 0개

- [x] **Task 6.2**: 전체 테스트 + 린트
  - `pnpm test` (전체 모노레포)
  - `pnpm check` (Biome 린트)
  - 기존 패키지 테스트 회귀 없음 확인
  - **QA 검증 절차**:
    1. `pnpm test` — 전체 모노레포 테스트, exit code 0
    2. `pnpm check` — Biome 린트, exit code 0
    3. 기존 패키지(transports-http, protocols-rest 등) 테스트 결과가 PASS인지 로그 확인 — 실패 건 0
    4. 신규 패키지 4개 테스트 결과가 각각 PASS인지 확인
  - **수락 기준**: 에러 0개

- [x] **Task 6.3**: Dependency Rule 검증
  - `grep -r "framework-context\|typedi\|reflect-metadata" packages/frontend-*/src/` → 결과 0건
  - `grep -r "vite\|vike" packages/transports-cloudflare-workers/src/` → 결과 0건
  - `grep -r "frontend-vite" packages/frontend-cloudflare/src/` → 결과 0건 (ADR-5: runtime→build-time 의존 금지)
  - `packages/frontend-cloudflare/package.json`에 `frontend-vite` 의존 없음 확인
  - Barrel export 확인: 각 패키지의 index.ts가 모든 public API를 export하는지
  - **QA 검증 절차**:
    1. `grep -r "framework-context\|typedi\|reflect-metadata" packages/frontend-*/src/` → 결과 0건
    2. `grep -r "vite\|vike" packages/transports-cloudflare-workers/src/` → 결과 0건
    3. `grep -r "frontend-vite" packages/frontend-cloudflare/src/` → 결과 0건
    4. `cat packages/frontend-cloudflare/package.json | grep frontend-vite` → 결과 0건
    5. 각 패키지 `src/index.ts`에서 public API export 목록이 해당 태스크 수락 기준과 일치하는지 확인
  - **수락 기준**: 의존성 규칙 위반 0건

## Guardrails (실행자 필독)

1. **frontend-* 패키지에서 절대 import 금지**: `@croco/framework-context`, `typedi`, `reflect-metadata`
2. **SSR data loading은 반드시 fetch()만**: `Container.get()`, DI 직접 사용 금지
3. **각 패키지는 독립적으로 test + typecheck + build 통과해야 함**
4. **Service Binding 이름은 `API_WORKER`로 고정** (wrangler.toml + 코드 모두)
5. **Vike/Vite 버전은 PoC에서 확인된 버전 고정** — PoC 단계에서 정확한 버전 기록
6. **tsup 빌드, vitest 테스트 — 기존 패턴 준수** (webpack, jest 도입 금지)
7. **파일 네이밍**: 클래스 PascalCase, 유틸리티 camelCase, 테스트 `src/tests/{Name}.spec.ts`
8. **frontend-cloudflare는 frontend-vite를 import 금지** (ADR-5: runtime이 build-time에 의존하면 안 됨)
9. **Frontend는 별도 패키지 family** — 기존 4계층(Framework→Protocols→Transports→Integrations)에 끼워넣지 않음
10. **API ↔ SSR Worker 컨텍스트 전달**: 표준 헤더 4종 (X-Request-Id, traceparent, Authorization, X-Forwarded-For) 사용 (ADR-4)
