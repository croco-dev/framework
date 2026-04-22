# Task 1 Delta Note: Previous Plans vs Operations Upgrade

## Plan Comparison

### 1. framework-tech-health-enforcement.md (20260421)
**TL;DR**: baseline 측정 → warning-only → enforce 흐름으로 아키텍처/테스트/보안/성능/DX 게이트를 승격
**Fingerprint 목표**: Architecture L3→L4, Code Quality L4 유지, Tests L3→L4, Performance L2→L3, Security L2→L3, DX L3→L4
**Deliverables**: 작업 브랜치 `framework-tech-health-enforcement`, architecture circular baseline, core coverage gate, security automation 1종(pnpm audit强化), benchmark hard fail gate, one-command setup 검증, 최종 trunk squash merge

### 2. framework-tech-health-remediation.md (20260421)
**TL;DR**: 20260421 진단의 P1/P2 권고 구체 보수작업 — self-cycle 제거, drizzle type 누수 제거, coverage gate 추가, dependency audit, empty catch 정리, console.log 정리, CONTRIBUTING.md 추가
**핵심 코드 변경**: `packages/frontend-cloudflare/src/libs/index.ts` self-cycle, `packages/tenant-core/src/libs/TenantIsolationStrategy.ts` drizzle-orm 타입 노출, 빈 catch 4개 파일, utils-node console.log 정리

### 3. framework-tech-health-operations-upgrade-20260422.md (현재)
**TL;DR**: 20260422 재진단 기반의 상위 운영 정책 연결 플랜. 이전 플랜 반복 금지. 기존 warning-only/부분적용 체계를 차단형·점진형·운영연결형으로 승격
**최신 Fingerprint**: Architecture L4 candidate (partial enforcement), Code Quality L4, Tests L3, Performance L3, Security L4 candidate (secret scanning not yet enforced), DX L4 candidate (documentation drift present)
**Deliverables**: 작업 브랜치 `framework-tech-health-operations-upgrade`, 5개 action stream (circular blocking, gitleaks blocking, coverage core-adjacent 확대, benchmark regression gate, README drift checklist)의 baseline→warning-only→enforce 정책 설계, 최종 trunk squash merge

## Key Differences

| Aspect | Enforcement (20260421) | Remediation (20260421) | Operations Upgrade (20260422) |
|--------|----------------------|----------------------|------------------------------|
| 진단 기준 | 20260421 | 20260421 | 20260422 재진단 |
| 성격 | 게이트 승격 실행 | 코드 수정/보수 | 운영 정책 설계 (플랜 수준) |
| Security | pnpm audit 强化 | dependency audit 1种 | gitleaks warning→blocking |
| Architecture | circular baseline 측정 | self-cycle 제거 | circular 검사 warning→blocking 승격 정책 |
| Tests | core coverage CI gate | 테스트 파일 수정 | coverage core-adjacent 확대 정책 |
| Performance | benchmark hard fail | - | benchmark regression gate 정책 |
| DX | one-command setup 검증 | CONTRIBUTING.md 신규 | README drift 운영 연결 정책 |

## Relationship

- **Enforcement**: 20260421 기준의 기존 warning-only 체계를 fail-on-error 로 승격하는 실행 플랜
- **Remediation**: 20260421 기준의 직접 코드 수정/보수 플랜 (self-cycle, drizzle leak, empty catch, console.log 등)
- **Operations Upgrade**: enforcement/remediation 의 실행 결과를 기준선으로, 20260422 재진단에서 드러난 **새로운 gap** 을 정책 수준에서 다루는 상위 플랜. 코드 수정 대신 운영 규칙 설계에 집중
