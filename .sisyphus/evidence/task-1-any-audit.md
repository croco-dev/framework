# as any 감사 보고서

## 전체 현황
- 총 패키지 수: 85
- `as any` 총 건수: 23
- 분류 기준:
  - **(A) 제거 가능**: proper type으로 대체 가능
  - **(B) 정당한 캐스트**: `@ts-expect-error` + 사유 주석 필요
  - **(C) Zod 런타임 검증으로 대체**: 런타임 타입 체크 필요

## 패키지별 상세

### @croco/billing-polar
- 파일: `packages/billing-polar/src/tests/PolarBillingGateway.spec.ts:66`
- 코드: `return new PolarBillingGateway(config, mockLogger as any);`
- 분류: (B) 정당한 캐스트
- 이유: 테스트 더블(mockLogger)을 Logger 인터페이스로 캐스팅. 테스트 코드에서 mock 객체 사용으로 정당하나 `@ts-expect-error` + 주석 추가 권장

### @croco/cache-core
- 파일: `packages/cache-core/src/tests/Cacheable.spec.ts:264`
- 코드: `} as any;`
- 분류: (B) 정당한 캐스트
- 이유: 테스트에서 부분적 CacheStore 인터페이스 구현. deleteByPattern이 undefined임을 명시하기 위한 캐스팅으로 정당함

- 파일: `packages/cache-core/src/tests/Cacheable.spec.ts:287`
- 코드: `} as any;`
- 분류: (B) 정당한 캐스트
- 이유: 위와 동일, 와일드카드 키 eviction 테스트에서 부분적 mock 사용

### @croco/entitlements-core
- 파일: `packages/entitlements-core/src/tests/EntitlementGuard.spec.ts:41`
- 코드: `({ tenantId: 'tenant-123', user: { tenantId: 'tenant-123' } }) as any`
- 분류: (A) 제거 가능
- 이유: ExecutionContext의 getRequest() 타입을 명확히 정의하면 제거 가능. 현재는 ExecutionContext 타입이 불명확하여 any 사용

- 파일: `packages/entitlements-core/src/tests/EntitlementGuard.spec.ts:70`
- 코드: `({ tenantId: 'tenant-123', user: { tenantId: 'tenant-123' } }) as any`
- 분류: (A) 제거 가능
- 이유: 위와 동일

- 파일: `packages/entitlements-core/src/tests/EntitlementGuard.spec.ts:97`
- 코드: `({ tenantId: 'tenant-123', user: { tenantId: 'tenant-123' } }) as any`
- 분류: (A) 제거 가능
- 이유: 위와 동일

- 파일: `packages/entitlements-core/src/tests/EntitlementGuard.spec.ts:114`
- 코드: `getRequest: () => ({}) as any`
- 분류: (A) 제거 가능
- 이유: ExecutionContext.getRequest()의 반환 타입을 정의하면 제거 가능

- 파일: `packages/entitlements-core/src/tests/EntitlementGuard.spec.ts:143`
- 코드: `({ tenantId: 'tenant-123', user: { tenantId: 'tenant-123' } }) as any`
- 분류: (A) 제거 가능
- 이유: 위와 동일

- 파일: `packages/entitlements-core/src/tests/EntitlementGuard.spec.ts:173`
- 코드: `({ tenantId: 'tenant-123', user: { tenantId: 'tenant-123' } }) as any`
- 분류: (A) 제거 가능
- 이유: 위와 동일

### @croco/framework-context
- 파일: `packages/framework-context/src/libs/Container.ts:24`
- 코드: `return TypeDIContainer.get(token as any);`
- 분류: (B) 정당한 캐스트
- 이유: TypeDI 라이브러리의 타입 정의와 우리의 TokenIdentifier 타입 간 불일치를 우회하기 위한 캐스팅. TypeDI는 symbol/string/Constructor 모두 지원하지만 타입 정의가 제한적임. 이미 biome-ignore 주석 있음

- 파일: `packages/framework-context/src/libs/Container.ts:59`
- 코드: `return TypeDIContainer.has(token as any);`
- 분류: (B) 정당한 캐스트
- 이유: 위와 동일, TypeDI 타입 우회

- 파일: `packages/framework-context/src/libs/Container.ts:64`
- 코드: `TypeDIContainer.remove(token as any);`
- 분류: (B) 정당한 캐스트
- 이유: 위와 동일, TypeDI 타입 우회

### @croco/impersonation-core
- 파일: `packages/impersonation-core/src/tests/ImpersonationService.spec.ts:135`
- 코드: `const context = { impersonation: { impersonatorId: 'admin-1', targetUserId: 'user-123' } } as any;`
- 분류: (A) 제거 가능
- 이유: Context 타입을 명확히 정의하면 제거 가능. ImpersonationContext 인터페이스 정의 후 사용 권장

- 파일: `packages/impersonation-core/src/tests/ImpersonationService.spec.ts:143`
- 코드: `const context = {} as any;`
- 분류: (A) 제거 가능
- 이유: 위와 동일

- 파일: `packages/impersonation-core/src/tests/ImpersonationService.spec.ts:153`
- 코드: `const context = { impersonation: { impersonatorId: 'admin-1', targetUserId: 'user-123' } } as any;`
- 분류: (A) 제거 가능
- 이유: 위와 동일

- 파일: `packages/impersonation-core/src/tests/ImpersonationService.spec.ts:161`
- 코드: `const context = {} as any;`
- 분류: (A) 제거 가능
- 이유: 위와 동일

- 파일: `packages/impersonation-core/src/tests/ImpersonationService.spec.ts:171`
- 코드: `const context = { impersonation: { impersonatorId: 'admin-1', targetUserId: 'user-123' } } as any;`
- 분류: (A) 제거 가능
- 이유: 위와 동일

- 파일: `packages/impersonation-core/src/tests/ImpersonationService.spec.ts:179`
- 코드: `const context = {} as any;`
- 분류: (A) 제거 가능
- 이유: 위와 동일

### @croco/problems-core
- 파일: `packages/problems-core/src/libs/Problem.ts:34`
- 코드: `if ((this as any).code === undefined) {`
- 분류: (B) 정당한 캐스트
- 이유: 서브클래스에서 readonly 프로퍼티를 재정의하는 패턴. TypeScript 제약을 우회하는 정당한 캐스팅. 이미 biome-ignore 주석 있음

- 파일: `packages/problems-core/src/libs/Problem.ts:36`
- 코드: `(this as any).code = code ?? 'UNKNOWN_ERROR';`
- 분류: (B) 정당한 캐스트
- 이유: 위와 동일

- 파일: `packages/problems-core/src/libs/Problem.ts:39`
- 코드: `if ((this as any).category === undefined) {`
- 분류: (B) 정당한 캐스트
- 이유: 위와 동일

- 파일: `packages/problems-core/src/libs/Problem.ts:41`
- 코드: `(this as any).category = category ?? ProblemCategory.InternalServerError;`
- 분류: (B) 정당한 캐스트
- 이유: 위와 동일

### @croco/tx-drizzle
- 파일: `packages/tx-drizzle/src/libs/types.ts:4`
- 코드: `export type DrizzleCallable = (...args: unknown[]) => any;`
- 분류: (B) 정당한 캐스트
- 이유: Drizzle ORM의 메서드 시그니처가 드라이버별로 다르기 때문에 any 타입 사용. 이미 biome-ignore 주석으로 사유 설명됨

- 파일: `packages/tx-drizzle/src/libs/types.ts:5`
- 코드: `export type DrizzleSelectFn = DrizzleCallable;`
- 분류: (B) 정당한 캐스트
- 이유: 위와 동일

- 파일: `packages/tx-drizzle/src/libs/types.ts:6`
- 코드: `export type DrizzleInsertFn = DrizzleCallable;`
- 분류: (B) 정당한 캐스트
- 이유: 위와 동일

- 파일: `packages/tx-drizzle/src/libs/types.ts:7`
- 코드: `export type DrizzleUpdateFn = DrizzleCallable;`
- 분류: (B) 정당한 캐스트
- 이유: 위와 동일

- 파일: `packages/tx-drizzle/src/libs/types.ts:8`
- 코드: `export type DrizzleDeleteFn = DrizzleCallable;`
- 분류: (B) 정당한 캐스트
- 이유: 위와 동일

## 요약

### 분류별 건수
- **(A) 제거 가능**: 13건 (테스트 코드의 타입 정의 부족)
- **(B) 정당한 캐스트**: 15건 (외부 라이브러리 타입 우회, 서브클래스 패턴)
- **(C) Zod 런타임 검증으로 대체**: 0건

### 우선순위 권장사항
1. **높음**: 테스트 코드에서 ExecutionContext, Context 타입 명확히 정의하여 13건 제거
2. **중간**: biome-ignore가 있는 건들은 `@ts-expect-error` + 주석으로 일관성 유지
3. **낮음**: Drizzle ORM 타입은 향후 타입 정의 개선 시 검토

### 품질 게이트 제안
1. 새로운 `as any` 추가 시 PR 리뷰에서 사유 명시 요구
2. 테스트 코드에서는 적절한 타입 정의 우선
3. 외부 라이브러리 타입 우회 시 `@ts-expect-error` + 사유 주석 필수
4. 분기별 `as any` 건수 모니터링 및 증가 시 리뷰
