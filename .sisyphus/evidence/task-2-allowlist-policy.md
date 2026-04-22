# Task 2: Circular Dependency Baseline & Allowlist Policy

## Baseline Measurement

```
pnpm architecture:check:circular
→ 5 circular dependencies found
```

### Existing Circular Dependencies (Allowlist Candidates)

| # | Cycle | Package | Severity |
|---|-------|---------|----------|
| 1 | `Problem.ts → ProblemExtensions.ts → InvalidExtensionsProblem.ts` | problems-core | Low — 도메인 클래스와 확장 클래스 간 순환 |
| 2 | `EventBus.ts → EventHandler.ts` | events-core | Medium — 핵심 이벤트 버스/핸들러 인터페이스 결합 |
| 3 | `EventBus.ts → interfaces/EventSubscribing.ts` | events-core | Medium — 동일 패키지의 인터페이스 순환 |
| 4 | `interfaces/AbstractRoleRegistry.ts → rbac/Role.ts` | auth-core | Medium — RBAC 인터페이스/구현 순환 |
| 5 | `types.ts → MigrationStore.ts` | migration-runner | Low — 타입/구현 순환 |

## Allowlist Policy

### File Location
- `.madge-circular-allowlist.json` (또는 `.madgerc` 의 `allowlist` 설정 활용)
- `.github/workflows/ci.yml` 에서 `madge --circular` 실행 시 allowlist 파일 적용

### Format
```json
{
  "allowlisted": [
    "problems-core/src/libs/Problem.ts > problems-core/src/libs/ProblemExtensions.ts > problems-core/src/libs/problems/InvalidExtensionsProblem.ts",
    "events-core/src/libs/EventBus.ts > events-core/src/libs/EventHandler.ts",
    "events-core/src/libs/EventBus.ts > events-core/src/libs/interfaces/EventSubscribing.ts",
    "auth-core/src/libs/interfaces/AbstractRoleRegistry.ts > auth-core/src/libs/rbac/Role.ts",
    "migration-runner/src/libs/types.ts > migration-runner/src/libs/MigrationStore.ts"
  ],
  "policy": "existing_only",
  "description": "기존 5건 순환 의존은 allowlist 로 고정. 신규 순환 의존은 0건 정책."
}
```

### New Circular Dependency Policy (Zero Violations)
- 신규 PR 에서 허용되지 않은 순환 의존이 발견되면 CI 즉시 실패
- 예외 추가는 PR 템플릿에 사유 기술 + 코어 팀 합의 후 allowlist 업데이트
- 순환 제거는 별도 리팩터링 과제로 진행 (이 플랜 범위 아님)

### Exception Request Process
1. PR 템플릿의 "Circular Dependency Exception" 섹션에 대상/사유/제거 계획 기술
2. 코어 팀 1인 이상 approve
3. allowlist 파일에 항목 추가 및 PR 병합

## Next Steps
- `ci.yml` 에서 `madge --circular` 실행 시 `continue-on-error: true` 제거 (또는 allowlist 기반 조건부 fail)
- allowlist 기반 검사: 신규 항목이 추가되면 CI 실패
