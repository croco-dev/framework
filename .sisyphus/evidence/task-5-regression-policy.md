# Task 5: Benchmark Regression Gate Baseline & Threshold Design

## Current Benchmark Infrastructure

### Workflow
**File**: `.github/workflows/benchmark.yml`
- **Trigger**: `pull_request` on `trunk`
- **Mode**: `BENCHMARK_GATE_MODE: warning-only` (configured in workflow)
- **Command**: `pnpm bench:check --output-json=benchmark-result.json`
- **Report**: uploads `benchmark-result.json` as artifact

### Baseline & Threshold Files
- `benchmarks/baseline.json` — 기준 성능 수치
- `benchmarks/thresholds.json` — 허용 임계값
- `benchmarks/benchmark-gate-transition.md` — warning-only → enforce 전환 조건 문서

### Transition Document Findings
The transition document requires:
1. Threshold coverage defined for all benchmarks
2. Stable baseline established with sufficient data points
3. Acceptable variance determined for CI runner fluctuations

## Regression Gate Policy

### Target Benchmarks for Gate Enforcement
| Package | Benchmark Scenario | Current Baseline | Threshold |
|---------|-------------------|-----------------|-----------|
| `transports-http` | Cold start | TBD (baseline measurement) | +20% regression allowed |
| `transports-http` | Auth header + query + body | TBD | +15% regression allowed |
| `transports-http` | Authorizer context | TBD | +15% regression allowed |
| `events-core` | EventBus publish/subscribe | TBD | +10% regression allowed |
| `telemetry-sdk-node` | TelemetryRuntime.init | TBD | +20% regression allowed |

### CI Runner Variance Handling
- **Flaky retry**: 최대 2회 재실행 허용 (same branch, no code changes)
- **Variance buffer**: 임계값의 +10% 추가 버퍼 (CI runner 성능 편차 흡수)
- **Baseline update schedule**: 월 1회 — 안정적인 baseline 재측정

### Phase Enforcement Plan

| Phase | Scope | Action | Timeline |
|-------|-------|--------|----------|
| Current | warning-only | PR comment + artifact upload | Now |
| Phase 1 | Conditional blocking | trunk push 에 대해서만 fail, PR 은 warning | Next quarter |
| Phase 2 | Full enforce | 모든 PR/merge 에 fail | Quarter +2 |

### Files to Modify
- `.github/workflows/benchmark.yml` — conditional blocking logic 추가
- `benchmarks/baseline.json` — 최신 수치 업데이트
- `benchmarks/thresholds.json` — regression 허용치 정비

## Policy Guardrails
- **NO** performance optimization work in this stream
- **NO** immediate full enforce for all benchmarks
- Regression gate = measurement enforcement, NOT performance improvement
