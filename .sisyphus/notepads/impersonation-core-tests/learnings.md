# BlockDuringImpersonation 테스트 작성 학습 내용

## Context 사용 패턴

### Context.run 메서드
- Context에는 reset, set 메서드가 없음
- `Context.run(ctx, fn)`으로 컨텍스트를 설정하고 함수 실행
- fn은 동기/비동기 모두 가능하며, 리턴값을 받을 수 있음

### RequestContext 구조
```typescript
interface RequestContext {
  requestId: string;      // 필수
  user?: UserContext;
  tenantId?: string;
  traceId?: string;
}
```

## 데코레이터 테스트 패턴

### BlockDuringImpersonation 특성
- 데코레이터가 메서드를 async로 래핑함
- 원래 동기 메서드도 비동기로 변환됨
- Context.get()로 현재 컨텍스트 확인
- impersonation이 있으면 BlockedDuringImpersonationProblem throw

### 테스트 코드 패턴
```typescript
// 정상 실행 (impersonation 없음)
const result = await Context.run(
  { requestId: 'req-1', user: { id: 'user-1' } },
  async () => {
    return service.sensitiveOperation();
  }
);
expect(result).toBe('success');

// 에러 발생 (impersonation 있음)
await expect(
  Context.run(impersonationContext, async () => {
    return service.sensitiveOperation();
  })
).rejects.toThrow(BlockedDuringImpersonationProblem);
```

## 중요한 점

1. **메서드 리턴값 처리**: `service.sensitiveOperation()` 결과를 반드시 리턴해야 에러를 포착할 수 있음
2. **async/await 사용**: 데코레이터가 메서드를 async로 래핑하므로 테스트에서도 async/await 사용 필요
3. **rejects.toThrow**: 에러 검증을 위해 `toThrow` 대신 `rejects.toThrow` 사용
4. **requestId 필수**: RequestContext에 requestId는 필수 필드임

## 오류 해결 과정

1. Context.reset() 메서드가 없음 → 제거
2. Context.set() 메서드가 없음 → Context.run() 사용
3. RequestContext에 requestId 누락 → 추가
4. Promise 리턴값 처리 누락 → await 추가
5. 에러 검증 실패 → rejects.toThrow 사용 및 리턴값 처리

## Auditable 데코레이터 impersonation 지원

### 런타임 프로퍼티 체크 패턴
- 타입 import 없이 런타임 프로퍼티 체크로 impersonation 감지
- `'impersonation' in context`로 감지 (레포 내 표준 패턴)
- Type assertion: `(context as Record<string, unknown>).impersonation as { impersonatorId: string; targetUserId: string }`

### actorId 결정 로직
```typescript
const impersonation = context && 'impersonation' in context
  ? (context as Record<string, unknown>).impersonation as { impersonatorId: string; targetUserId: string }
  : undefined;

actorId: impersonation?.impersonatorId ?? context?.user?.id ?? 'unknown',
```

### metadata에 impersonation 정보 추가
```typescript
metadata: impersonation
  ? { impersonation: true, impersonatorId: impersonation.impersonatorId, targetUserId: impersonation.targetUserId }
  : {},
```

### 레포 내 사용 사례
- ImpersonationAuditHelper.ts
- BlockDuringImpersonation.ts
- ImpersonationService.ts

### 의존성 분리 원칙
- impersonation-core 타입 import 금지 (순환 의존성 방지)
- 런타임 체크만으로 충분
