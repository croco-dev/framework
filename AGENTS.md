# AGENTS.md

AI 코딩 에이전트용 프로젝트 가이드 - TypeScript 모노레포

## Commands

```bash
# Build
pnpm build              # 전체 패키지 빌드
pnpm build --filter=@croco/framework-context  # 단일 패키지 빌드

# Test
pnpm test               # 전체 테스트
pnpm test --filter=@croco/retry-core  # 단일 패키지 테스트
cd packages/retry-core && pnpm vitest run src/tests/Retryable.spec.ts  # 단일 테스트 파일
cd packages/retry-core && pnpm vitest run -t "should retry"  # 테스트 이름으로 실행

# Lint & Format
pnpm check              # Biome 검사
pnpm check --write      # Biome 자동 수정
biome check --write packages/retry-core  # 단일 패키지

# Type Check
pnpm typecheck          # 전체 패키지
pnpm typecheck --filter=@croco/events-core  # 단일 패키지
```

## Code Style

Biome 설정 기준:
- Indent: 2 spaces
- Line width: 120 characters
- Quote style: single quotes
- Trailing commas: ES5 style
- Type imports 필수 (`import type { X }` 사용)
- 미사용 imports/variables 금지 (error)
- `any` 명시적 사용 금지 (warning)
- Non-null assertion 금지 (error)

## Import Order

Biome 자동 정렬 순서:
1. 외부 패키지 (reflect-metadata, typedi 등)
2. 내부 @croco/* 패키지
3. 상대 경로 (./libs/*, ../types)
4. Type imports 별도 분리

## Naming Conventions

- Classes: PascalCase (RetryTemplate, CircuitBreaker)
- Interfaces: PascalCase, "I" 접두사 금지 (RetryPolicy, 아닌 IRetryPolicy)
- Types: PascalCase (BackoffOptions, ComponentMetadata)
- Constants: SCREAMING_SNAKE_CASE (REST_CONTROLLER_KEY)
- Functions/methods: camelCase
- Files: 클래스는 PascalCase (Component.ts), 유틸리티는 camelCase
- Test files: `src/tests/[ClassName].spec.ts` (필수 규칙)

## Decorator Pattern

```typescript
export function Retryable(options: RetryableOptions = {}): MethodDecorator {
  return (_target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor => {
    const originalMethod = descriptor.value;
    // ... 래핑 로직
    return descriptor;
  };
}

export function Component(options?: ComponentOptions): ClassDecorator {
  return (target: object) => {
    Container.register(target, options?.scope ?? 'singleton');
  };
}
```

## Error Handling

RFC 7807 Problem 기반:
```typescript
export class NotFoundProblem extends Problem {
  readonly code = 'NOT_FOUND';
  readonly category = ProblemCategory.NOT_FOUND;

  constructor(resource: string, id: string) {
    super(`${resource} with id '${id}' not found`);
  }
}

// Problem 하위클래스만 throw, 일반 Error 금지
throw new NotFoundProblem('User', userId);
```

## Test Patterns (Vitest)

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('ClassName', () => {
  let instance!: ClassName;  // definite assignment

  beforeEach(() => {
    Container.reset();  // 항상 DI 컨테이너 리셋
    instance = new ClassName();
  });

  it('should do something', async () => {
    const result = await instance.method();
    expect(result).toBe(expected);
  });

  it('should handle errors', async () => {
    await expect(instance.failingMethod()).rejects.toThrow(SomeError);
  });
});
```

## Type Patterns

```typescript
// 객체 형태는 type 우선
export type BackoffOptions = {
  delay?: number;
  maxDelay?: number;
  multiplier?: number;
};

// 계약/구현은 interface
export interface RetryPolicy {
  shouldRetry(error: Error, attempt: number, maxAttempts: number): boolean;
}

// 제네릭 제약조건
export type Constructor<T = unknown> = new (...args: unknown[]) => T;
```

## Barrel Exports (index.ts)

```typescript
// 카테고리별 그룹화, types 마지막
export { Container, Context } from './libs/Container';
export { Component } from './libs/decorators/Component';
export type { ComponentMetadata, Scope, Token } from './libs/types';
```

## Package Structure

```
packages/[name]/
├── src/
│   ├── index.ts          # Barrel exports
│   ├── libs/             # 구현
│   │   ├── ClassName.ts
│   │   └── decorators/   # 데코레이터가 있을 경우
│   └── tests/            # 테스트 파일 (*.spec.ts)
├── package.json
└── tsconfig.json
```

## Git Hooks (Lefthook)

- pre-commit: `biome check --write` (자동 포맷)
- pre-push: `pnpm test && pnpm typecheck`
- post-merge: `pnpm install`

## Architecture Notes

- 4-계층: Framework → Protocols → Transports → Integrations
- DI: typedi + 커스텀 Container 래퍼
- AsyncLocalStorage: request-scoped context
- 이벤트 기반 아키텍처 (events-core + events-inmemory)
