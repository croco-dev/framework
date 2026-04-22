# 설계 결정 메모

## ESLint Config 패키지
- ESLint v9 Flat Config + ESM 전용
- peerDeps로만 eslint, typescript-eslint 선언
- DDD custom rules 포함 (no-cross-domain-import, no-datasource-import, type-graphql-explicit-type)

## create-croco-app CLI
- commander + @clack/prompts
- Handlebars 템플릿 렌더링
- ESM + Node22 target
- shebang: #!/usr/bin/env node

## GeneratorOptions
- preset: 'ddd-fullstack' | 'ddd-api' | 'blank'
- webApps: string[] (여러 웹앱 이름)
- api: 'graphql' | 'trpc'
- apiHosting: 'standalone' | 'nextjs'
- 역방향 가드: webApps.length >= 2 → standalone 강제

## Agent Rules Templates Added
- Checked `.agent/rules/` and verified all 9 required `.mdc` files are present.
- Verified `.cursor/rules/` contains the same 9 files.
- Verified `templates/addons/agent-rules/AGENTS.md` is correctly implemented.
- Verified `src/installers/agent-rules.ts` and `src/installers/index.ts`.
- Changes are fully committed to the repository and `pnpm typecheck` successfully runs without issues.
