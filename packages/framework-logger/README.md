# @croco/framework-logger

컨텍스트 기반 구조화 로거 - OpenTelemetry 호환 구조화 로깅, trace/span 자동 연동을 제공합니다.

## 설치

```bash
pnpm add @croco/framework-logger
```

## 사용법

### Logger 사용

```typescript
import { Logger } from "@croco/framework-logger";

@Service()
class UserService {
  constructor(private readonly logger: Logger) {}

  async createUser(dto: CreateUserDto) {
    this.logger.info("Creating user", { userId: dto.id, email: dto.email });

    try {
      const user = await this.repository.save(dto);
      this.logger.info("User created successfully", { userId: user.id });
      return user;
    } catch (error) {
      this.logger.error("Failed to create user", error);
      throw error;
    }
  }
}
```

### Child Logger

```typescript
const userLogger = logger.child({ userId: "123", service: "userService" });
userLogger.info("Processing request");
```

### Log Level

```typescript
import { LogLevel } from "@croco/framework-logger";

// LOG_LEVEL 환경변수로 설정 (기본: LogLevel.INFO)
// 예: LOG_LEVEL=debug pnpm start
```

## API

### Logger

| 메서드                    | 설명                                         |
| ------------------------- | -------------------------------------------- |
| `logger.debug(msg, ctx?)` | DEBUG 레벨 로그                              |
| `logger.info(msg, ctx?)`  | INFO 레벨 로그                               |
| `logger.warn(msg, ctx?)`  | WARN 레벨 로그                               |
| `logger.error(msg, ctx?)` | ERROR 레벨 로그 (Error 인스턴스 지원)        |
| `logger.fatal(msg, ctx?)` | FATAL 레벨 로그 (Error 인스턴스 지원)        |
| `logger.child(bindings)`  | 바인딩된 컨텍스트가 포함된 child logger 생성 |

### LogLevel

| 값               | 설명             |
| ---------------- | ---------------- |
| `LogLevel.DEBUG` | 디버깅 정보      |
| `LogLevel.INFO`  | 일반 정보 (기본) |
| `LogLevel.WARN`  | 경고             |
| `LogLevel.ERROR` | 에러             |
| `LogLevel.FATAL  | 치명적 에러      |

## LogContext

자동으로 추가되는 컨텍스트 필드:

| 필드        | 설명                                  |
| ----------- | ------------------------------------- |
| `requestId` | 요청 ID (Context에서 추출)            |
| `traceId`   | 추적 ID (OpenTelemetry Span에서 추출) |
| `spanId`    | 스팬 ID (OpenTelemetry Span에서 추출) |

## 민감 정보 필터링

자동으로 다음 필드가 제거됩니다:

- `password`, `token`, `secret`
- `*.password`, `*.token`, `*.secret`
- `authorization`, `cookie`

## OpenTelemetry 통합

Logger는 OpenTelemetry trace/span 컨텍스트를 자동으로 감지하고 로그에 포함합니다:

```typescript
import { Trace } from "@croco/telemetry-api";

@Service()
class OrderService {
  @Trace({ name: "order.create" })
  async createOrder(dto: CreateOrderDto) {
    // traceId, spanId가 자동으로 로그에 포함됨
    this.logger.info("Processing order", { orderId: dto.id });
  }
}
```

## 설정

| 환경변수    | 설명      | 기본값        |
| ----------- | --------- | ------------- |
| `LOG_LEVEL` | 로그 레벨 | `info`        |
| `NODE_ENV`  | 환경      | `development` |

개발 환경에서는 `pino-pretty` 포맷터가 자동으로 활성화되어 가독성 있는 로그를 출력합니다.

## 타입

```typescript
type LogContext = {
  requestId?: string;
  spanId?: string;
  traceId?: string;
  [key: string]: unknown;
};

type LogRecord = {
  timeUnixNano: number;
  severityNumber: SeverityNumber;
  severityText: string;
  body: string;
  attributes: Record<string, unknown>;
  resource?: Record<string, unknown>;
  instrumentationScope?: {
    name: string;
    version?: string;
  };
};

enum SeverityNumber {
  TRACE = 1,
  DEBUG = 5,
  INFO = 9,
  WARN = 13,
  ERROR = 17,
  FATAL = 21,
}
```
