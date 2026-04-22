# Task 5.1: GeneratorOptions 타입 확장

## 작업 내용
- `packages/create-croco-app/src/types.ts` 수정
- `frontendDeploy` 옵션에 `'cloudflare-vike'` 추가
- `preset` 옵션에 `'ddd-vike-fullstack'` 추가

## 변경 사항
```typescript
// Before
preset: 'ddd-fullstack' | 'ddd-api' | 'blank';
frontendDeploy?: 'opennext' | 'vercel' | 'docker';

// After
preset: 'ddd-fullstack' | 'ddd-vike-fullstack' | 'ddd-api' | 'blank';
frontendDeploy?: 'opennext' | 'vercel' | 'docker' | 'cloudflare-vike';
```

## 학습 사항
- 리터럴 타입 추가 시 기존 옵션을 유지하면서 새로운 옵션만 추가
- TypeScript 유니언 타입으로 새로운 배포 옵션과 프리셋을 지원
- typecheck 통과 확인으로 타입 안전성 검증

## Task 5.4: cloudflare-vike generator 분기

### 작업 내용
- `packages/create-croco-app/src/generator.ts`에서 `ddd-vike-fullstack` 전용 흐름 추가
- `packages/create-croco-app/src/installers/frontend-deploy.ts`에서 `frontendDeploy === 'cloudflare-vike'` 분기 추가
- `packages/create-croco-app/src/prompts.ts`, `src/cli.ts`에 Vike 관련 프리셋/배포 옵션 노출

### 학습 사항
- `cloudflare-vike`는 기존 `frontend-*` addon 규칙과 달리 preset에 따라 설치 대상 경로가 달라진다.
  - `ddd-fullstack`에서는 `apps/{webAppName}` 아래에 `web-vike`를 병합한다.
  - `ddd-vike-fullstack`에서는 루트에 `web-vike-fullstack`를 병합한다.
- `ddd-vike-fullstack` 프리셋은 기존 GraphQL/tRPC + shared-ui + backend deploy installer 흐름을 타지 않도록 generator에서 별도 가드가 필요하다.
- CLI 프롬프트는 `frontendDeploy` 유니언뿐 아니라 `preset` 선택지와 타입 캐스팅도 함께 확장해야 일관성이 유지된다.

## Task 5.5: create-croco-app E2E 검증

### 검증 결과
- `pnpm test --filter=create-croco-app`는 통과했다.
- 하지만 빌드된 CLI(`packages/create-croco-app/dist/index.js`)는 여전히 오래된 템플릿 경로(`packages/templates/...`)를 참조하고, `cloudflare-vike` 분기 전 로직이 남아 있어 실제 CLI dry-run이 실패한다.
- 소스의 `generate()`를 직접 호출하면 `web-vike`, `web-vike-fullstack`, `ddd-api`, `blank` 생성 결과를 확인할 수 있었지만, `ddd-fullstack`/`ddd-api` 생성물은 루트 `package.json`과 `pnpm-workspace.yaml`이 없어 `pnpm install --frozen-lockfile` 및 루트 `pnpm typecheck` 검증이 불가능했다.

### 생성물 관찰
- `web-vike` 생성 시 `apps/web/vite.config.ts`, `apps/web/wrangler.toml`, `apps/web/src/pages/index/+Page.tsx`는 생성된다.
- 같은 생성물에서 루트 대신 `web/` 디렉토리에 Dockerfile이 생기고, `apps/api`, `apps/graphql-api`가 함께 남아 있어 기대한 단일 템플릿 구조와 다르다.
- `web-vike-fullstack` 생성 시 `api-worker/`, `ssr-worker/`, `pnpm-workspace.yaml`은 생성되며 `api-worker/wrangler.toml`과 `ssr-worker/wrangler.toml`에서 API/SSR Worker 및 service binding 설정을 확인했다.
- 기존 프리셋 `blank`는 루트 `package.json`, `pnpm-workspace.yaml`을 정상 생성했지만, `ddd-api`는 여전히 루트 매니페스트 없이 부분 구조만 생성됐다.
