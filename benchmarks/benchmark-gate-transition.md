# Benchmark Gate Transition Guide

## Current State

- Gate mode: `warning-only` (BENCHMARK_GATE_MODE=warning-only in .github/workflows/benchmark.yml)
- Command: `pnpm bench:check --output-json=benchmark-result.json`
- Step configured with `continue-on-error: true`

## Enforce-Ready Checklist

Switch `BENCHMARK_GATE_MODE` from `warning-only` to `enforce` only when ALL items below are YES:

### Threshold Coverage
- [ ] 모든 벤치마크 케이스에 threshold 값이 정의되어 있는가?
  - 확인 방법: `benchmark-result.json`의 각 케이스에 `thresholdStatus: "skip"`이 없는가?
  - 미정의 케이스 처리 계획: threshold가 아직 정의되지 않은 케이스는 enforce 전환 전에 `benchmarks/thresholds.json`에 임계치 추가 필요

### Baseline Stability
- [ ] 안정된 baseline이 최근 5개 이상의 green run에서 캡처되었는가?
  - 확인 방법: CI artifact로 저장된 benchmark 결과에서 variance < 10%를 유지하는가?
  - Baseline 데이터 위치: `benchmarks/baseline.json` (현재 11개 케이스 캡처됨)

### Variance Tolerance
- [ ] 허용 가능한 variance 기준이 명시되었는가?
  - 권장: 단일 케이스 ±5%, 전체 평균 ±3%
  - CI 환경 변동(네트워크, 인스턴스 타입)을 고려한 multiplier 정의 여부
  - 현재 설정: `CI_THRESHOLD_MULTIPLIER = 2` (CI에서 threshold 2배 마진 자동 적용)

### Skip Policy
- [ ] 벤치마크 skip 허용 조건이 문서화되었는가?
  - 허용 조건: 문서-only 변경, 벤치마크 무관 코드 변경
  - skip 시 PR 코멘트에 명시적 사유 기록 필요

### False Positive Handling
- [ ] 환경 노이즈로 인한 일시적 실패 재실행 정책이 정의되었는가?
  - 권장: 3회 중 2회 통과 시 pass로 간주

## Threshold-TBD Benchmark Cases

아직 baseline이 캡처되지 않은 케이스 목록과 처리 계획:

| 케이스 | 현재 상태 | threshold (ms) | baseline 예정일 | 담당 |
|--------|----------|----------------|-----------------|------|
| `TelemetryRuntime.init (lambda preset)` | threshold 있음, baseline 없음 | 200 | TBD | - |
| `lambdaPreset config creation` | threshold 있음, baseline 없음 | 2 | TBD | - |

> baseline이 없는 케이스는 `pnpm bench:check --update-baseline` 실행 후 `benchmarks/baseline.json`에 자동 추가된다.

## CI Script Alignment

모든 관련 파일이 동일한 승격 용어를 사용해야 한다:

- `.github/workflows/benchmark.yml`: `BENCHMARK_GATE_MODE` env, `enforce` 조건부 fail step
- `scripts/bench-threshold-check.mts`: threshold/baseline 검증 로직 (`thresholdStatus: skip` 경고 출력)
- `benchmarks/thresholds.json`: 케이스별 p75 절대 임계값 (현재 13개 케이스 정의)
- `benchmarks/baseline.json`: 최근 green run 기준 p75 캡처값 (현재 11개 케이스)
- 본 문서: enforce 전환 체크리스트

## Workflow Reference

- `benchmark.yml` 라인 9-10: `BENCHMARK_GATE_MODE` env 정의
- `benchmark.yml` 라인 28-31: `continue-on-error: true` 설정
- `benchmark.yml` 라인 81-83: enforce 모드 조건부 fail
- `scripts/bench-threshold-check.mts` 라인 38-40: `BASELINE_TOLERANCE = 0.2`, `CI_THRESHOLD_MULTIPLIER = 2`
- `scripts/bench-threshold-check.mts` 라인 163-165: threshold 미정의 케이스 skip 처리
