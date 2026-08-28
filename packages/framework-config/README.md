# @croco/framework-config

타입 안전한 환경 변수 설정 관리 패키지입니다. Zod 스키마 기반 검증과 `@t3-oss/env-core`를 사용하여 런타임에 환경 변수의 유효성을 보장합니다.

## 기능

- Zod 스키마 기반 환경 변수 검증
- 서버/클라이언트/공통 환경 변수 분리
- 타입 안전한 환경 변수 접근 (`ConfigService`)
- 스키마 출력 타입을 보존하는 설정 부트스트랩
- 명시적으로 합성하는 사전 정의 프리셋 (app, database, redis, storage)

## 설치

```bash
pnpm add @croco/framework-config
```

## 기본 사용법

### 1. ConfigService 사용

```typescript
import { ConfigService } from "@croco/framework-config";
import { Component } from "@croco/framework-context";

@Component()
class MyService {
  constructor(private readonly config: ConfigService) {}

  async execute() {
    const nodeEnv = this.config.get("NODE_ENV");
    const port = this.config.get("PORT");

    if (this.config.isProduction) {
      console.log("Production mode");
    }
  }
}
```

### 2. 타입 안전한 설정 부트스트랩

```typescript
import { bootstrapConfig, defineConfig } from "@croco/framework-config";
import { z } from "zod";

const appConfig = defineConfig(
  z.object({
    API_KEY: z.string().min(1),
    TIMEOUT: z.coerce.number().default(5000),
  }),
);

const config = bootstrapConfig(appConfig);
// config: { API_KEY: string; TIMEOUT: number }
```

`bootstrapConfig`의 반환 타입은 스키마의 출력 타입에서 자동으로 추론됩니다. `transform`, `coerce`,
`default`가 입력 타입을 바꾸더라도 별도의 인터페이스나 generic 인수를 동기화할 필요가 없습니다.

기존 `@ConfigSchema` 클래스 데코레이터는 런타임 호환을 위해 유지되지만 deprecated 상태이며,
`bootstrapConfig(DecoratedClass)`의 반환 타입은 `unknown`입니다. `defineConfig(schema)`로 옮기면 스키마와
정적 타입이 하나의 계약을 공유합니다.

### 3. 직접 validateConfig 사용

```typescript
import { validateConfig } from "@croco/framework-config";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
});

const env = validateConfig(schema);

env.DATABASE_URL;
env.REDIS_URL;
```

## 프리셋 사용

기본 `env`는 애플리케이션 공통 설정만 검증합니다. 사용하는 integration preset을
`defineRuntimeEnv`에 전달하면 선택한 환경 변수만 결과 타입과 런타임 검증에 포함됩니다.

```typescript
import { appConfig, databaseConfig, defineRuntimeEnv, env } from "@croco/framework-config";

env.NODE_ENV;
env.PORT;

const databaseEnv = defineRuntimeEnv({
  presets: [appConfig, databaseConfig],
});

databaseEnv.DATABASE_URL;
// databaseEnv.REDIS_URL; // 선택하지 않은 preset은 결과 타입에 존재하지 않습니다.
```

preset 순서는 같은 키가 중복될 때 적용되는 우선순위를 결정하므로 tuple로 보존해야 합니다.
별도 변수로 재사용할 때는 `as const` 또는 `satisfies`로 키와 순서를 유지합니다.

```typescript
import type { RuntimeEnvPreset } from "@croco/framework-config";

const presets = [appConfig, databaseConfig] as const;
const customPreset = {
  server: {},
  client: {},
  shared: {},
} satisfies RuntimeEnvPreset;
```

이전 `env`처럼 app, database, Redis, storage preset을 모두 검증해야 하는 애플리케이션은
명시적인 전체 구성 export를 사용할 수 있습니다.

```typescript
import { fullEnv, fullRuntimeEnvPresets } from "@croco/framework-config";

fullEnv.DATABASE_URL;

// 동일한 전체 preset 집합으로 별도 env를 구성할 수도 있습니다.
const presets = fullRuntimeEnvPresets;
```

`ConfigService`는 호환성을 위해 전체 preset 구성을 계속 사용합니다. 새 구성에서는
`defineRuntimeEnv`가 반환한 env를 애플리케이션 경계에서 직접 주입해 사용하는 방식을 권장합니다.

## 프리셋 목록

| 프리셋     | 환경 변수                       | 설명                   |
| ---------- | ------------------------------- | ---------------------- |
| `app`      | `NODE_ENV`, `PORT`, `LOG_LEVEL` | 애플리케이션 기본 설정 |
| `database` | `DATABASE_URL`                  | 데이터베이스 연결      |
| `redis`    | `REDIS_URL`, `REDIS_TOKEN`      | Redis 연결             |
| `storage`  | `R2_*`                          | Cloudflare R2 스토리지 |

## 환경 변수 검증 건너뛰기

테스트나 특수한 경우에 환경 변수 검증을 건너뛸 수 있습니다.

```bash
SKIP_ENV_VALIDATION=true
```

## 에러 처리

유효하지 않은 환경 변수가 감지되면 `ConfigValidationProblem`이 발생합니다.

```typescript
import { ConfigValidationProblem } from "@croco/framework-config";

try {
  validateConfig(schema);
} catch (error) {
  if (error instanceof ConfigValidationProblem) {
    console.error("환경 변수 검증 실패:", error.details);
  }
}
```

## 타입 안전성

모든 환경 변수 접근은 타입 안전하게 보장됩니다.

```typescript
const config = validateConfig(schema);

config.NODE_ENV; // string
config.PORT; // number
config.API_KEY; // string
config.MISSING_VAR; // TypeScript 에러
```
