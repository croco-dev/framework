# Task 8: Test/Benchmark Gate Integration Plan

## Integration of Task 4 + 5 Results

### Coverage Gate Expansion

**Current CI** (`ci.yml` line 149-150):
```yaml
- name: Core package coverage gate
  run: pnpm test:coverage:core
```

**Current vitest.config.ts**:
- CORE_COVERAGE_PACKAGES: 5 core packages only
- Threshold: 60% statements/branches/functions/lines

**Proposed Expansion Plan**:

| Phase | Action | Timeline |
|-------|--------|----------|
| Phase 1 | Add 5 core-adjacent packages to coverage gate with 50% threshold | Next quarter |
| Phase 2 | Raise all covered packages to 60% threshold | Quarter +2 |
| Phase 3 | Add framework-layer packages at 60% | Quarter +3 |

**Phase 1 Target Packages**:
- `@croco/framework-logger` — universal dependency
- `@croco/repository-core` — interface layer
- `@croco/framework-config` — env validation
- `@croco/problems-core` — error domain
- `@croco/ratelimit-core` — security/performance

**Implementation**:
- Modify `vitest.config.ts` — expand CORE_COVERAGE_PACKAGES array
- Add phase-based threshold config (per-package if needed)

### Benchmark Regression Gate

**Current CI** (`.github/workflows/benchmark.yml`):
- `BENCHMARK_GATE_MODE: warning-only`
- Uploads `benchmark-result.json` as artifact

**Proposed Enforcement Plan**:

| Phase | Action | Condition |
|-------|--------|-----------|
| Current | warning-only | PR comment + artifact upload |
| Phase 1 | Conditional blocking | trunk push fail, PR warning |
| Phase 2 | Full enforce | All PR/merge must pass |

**Implementation**:
- Update `benchmark.yml` with conditional fail logic
- Define per-benchmark regression thresholds (see Task 5)
- Add retry logic for flaky benchmark runs

### Stream Separation Rules

| Aspect | Coverage (Tests) | Benchmark (Performance) |
|--------|-----------------|------------------------|
| What it measures | Code execution coverage | Runtime performance metrics |
| Enforcement type | Threshold percentage | Regression percentage |
| Primary owner | Quality Engineering | Platform/Performance |
| Review cadence | Monthly | Per-release |
| Rollback trigger | < threshold % for any covered package | > allowed regression % for any benchmark |

### Rollback Conditions
- Coverage: 새로운 패키지 추가 후 1개월 내 threshold 달성 불가 시 제외
- Benchmark: CI 런타임 변동으로 flaky 결과 발생 시 재시도 정책 우선, 그 후 조건 완화
