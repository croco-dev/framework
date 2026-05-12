# @croco/framework-config

타입 안전한 환경 변수 설정 관리 패키지입니다. Zod 스키마 기반 검증과 `@t3-oss/env-core`를 사용하여 런타임에 환경 변수의 유효성을 보장합니다.

## 기능

- Zod 스키마 기반 환경 변수 검증
- 서버/클라이언트/공통 환경 변수 분리
- 타입 안전한 환경 변수 접근 (`ConfigService`)
- `@ConfigSchema` 데코레이터 기반 설정 부트스트랩
- 사전 정의된 프리셋 (app, database, redis, storage)

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

### 2. @ConfigSchema 데코레이터 사용

```typescript
import { ConfigSchema, bootstrapConfig } from "@croco/framework-config";
import { z } from "zod";

@ConfigSchema(
  z.object({
    API_KEY: z.string().min(1),
    TIMEOUT: z.coerce.number().default(5000),
  }),
)
class AppConfig {
  constructor(
    public readonly API_KEY: string,
    public readonly TIMEOUT: number,
  ) {}
}

const config = bootstrapConfig<AppConfig>(AppConfig);
```

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

사전 정의된 프리셋을 사용하여 환경 변수를 구성합니다.

```typescript
import { env } from "@croco/framework-config/core";

env.NODE_ENV;
env.PORT;
env.DATABASE_URL;
env.REDIS_URL;
env.R2_ACCOUNT_ID;
```

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
