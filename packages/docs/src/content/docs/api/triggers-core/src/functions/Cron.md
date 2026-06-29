---
editUrl: false
next: false
prev: false
title: "Cron"
---

> **Cron**(`expression`, `options?`): `MethodDecorator`

Cron decorator for scheduling periodic execution.

## Parameters

### expression

`string`

### options?

[`CronOptions`](/api/triggers-core/src/type-aliases/cronoptions/) = `{}`

## Returns

`MethodDecorator`

## Example

```ts
class ReportService {
  &#64;Cron('0 0 * * *', { name: 'daily-report' })
  async generateDailyReport() {
    // 매일 자정에 실행
  }

  &#64;Cron('0/5 * * * *')  // 5분마다 실행
  async processQueue() {
    // 대기열 처리
  }
}
```
