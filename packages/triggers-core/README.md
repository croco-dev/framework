# @croco/triggers-core

스케줄링 및 이벤트 기반 실행을 위한 트리거 시스템입니다. Cron 표현식이나 외부 이벤트를 통해 작업을 예약하고 실행할 수 있게 해줍니다.

## 특징

- **데코레이터 기반**: 선언적인 방식으로 트리거 정의
- **Cron 지원**: 표준 Cron 표현식을 통한 주기적 작업 예약
- **확장성**: Webhook, EventBridge 등 다양한 트리거 소스로 확장 가능

## 설치

```bash
pnpm add @croco/triggers-core
```

## 사용 방법

### @Cron 데코레이터

메서드를 주기적으로 실행하도록 예약합니다.

```typescript
import { Cron } from '@croco/triggers-core';
import { Component } from '@croco/framework-context';

@Component()
export class ReportScheduler {
  
  // 매일 자정에 실행
  @Cron('0 0 * * *', { name: 'daily-report' })
  async generateDailyReport() {
    console.log('Generating daily report...');
    // ... 리포트 생성 로직
  }

  // 5분마다 실행
  @Cron('*/5 * * * *')
  async healthCheck() {
    console.log('System health check...');
  }
}
```

### 트리거 등록 확인

`triggerRegistry`를 통해 등록된 모든 트리거 정보를 조회할 수 있습니다. 이는 인프라(EventBridge Scheduler 등) 프로비저닝 시 유용합니다.

```typescript
import { triggerRegistry } from '@croco/triggers-core';

const triggers = triggerRegistry.getAll();
triggers.forEach(trigger => {
  console.log(`Registered trigger: ${trigger.methodName} (${trigger.expression})`);
});
```
