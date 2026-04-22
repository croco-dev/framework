# create-croco-app 학습 메모

## 패키지 패턴
- type: commonjs (개발환경), publishConfig에서 ESM/CJS 이중 노출
- main/types: ./src/index.ts (개발) → publishConfig에서 ./dist/index.js (배포)
- tsconfig.json: extends @croco/utils-tsconfig/tsconfig.node.json
- build script: tsup src/index.ts --format esm,cjs --minify --clean --dts
- test: vitest run, typecheck: tsc --noEmit
- files: ["dist"]

## 모노레포
- pnpm-workspace.yaml: packages: [packages/**/*]
- turbo.json: build(dependsOn:^build,outputs:dist/**), test, typecheck, lint
- biome 2.3.12, tsup 8.5.1, vitest 4.0.16
- catalog: drizzle-orm:^0.44.2

## Git
- 현재 브랜치: trunk
- 새 작업 브랜치: create-croco-app

## 참조 레포
- /Users/owen/Projects/kang-heewon/monorepo-template/
- /Users/owen/Projects/croco/slackbase.org/
- `@croco/eslint-config` 패키지 스캐폴딩 완료
- tsup 설정 시 `format: ['esm', 'cjs']` 로 설정하고 `package.json`의 `publishConfig`를 활용해 ESM/CJS 호환성 보장
- tsconfig는 `@croco/utils-tsconfig/tsconfig.node.json`을 상속받아 통일성 유지

### ESLint Custom Rules Implementation
- Vitest handles `eslint`'s `RuleTester` natively, but the `describe` and `it` must be explicitly injected using `RuleTester.describe = describe` and `RuleTester.it = it`.
- In ESLint v9, rule logic for type-checking using `@typescript-eslint/parser` must explicitly include it in `languageOptions.parser` in the `RuleTester` initialization.
- TypeGraphQL decorators usually must supply the explicit return type callback to prevent GraphQL runtime type issues. Handled using an AST `Decorator` check on `CallExpression` argument count and type.
- ESLint v9 Flat Config 구현 시, `eslint-config-prettier` 플러그인 등 일부 서드파티 라이브러리의 타입 선언 누락으로 인해 빌드 시(`tsup`의 `dts` 옵션) 에러가 발생할 수 있습니다. 이를 해결하기 위해 `@types/eslint-config-prettier`를 devDependencies에 추가해야 합니다.
- Implemented interactive prompts via @clack/prompts matching GeneratorOptions
- Enforced standalone API hosting guard for multiple webapps scenario
- Setup Vitest tests for initial validation
- create-croco-app CLI Wave 5 Task 15~19 completed sequentially with individual commits and Biome formatting.

### E2E Testing of generator.ts
- `ddd-api` and `ddd-fullstack` templates do NOT generate a root `package.json` file inside the `base-ddd` template. The test should not assert `package.json` at root for these presets. Instead assert `libs/shared` or specific apps.
- When `apiHosting === 'nextjs'`, the Next.js app is generated under `apps/web`. To apply `frontendDeploy` to it, the `webApps` array MUST contain `'web'`, otherwise the `hasWebApps` check fails and the frontend deploy installer is skipped.
