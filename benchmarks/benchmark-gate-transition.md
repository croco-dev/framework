# Benchmark gate transition plan

## 현재 상태

- workflow는 `pnpm bench:check --output-json=benchmark-result.json`를 실행한다.
- benchmark step은 `continue-on-error: true`라서 결과 파일과 PR comment를 남길 시간을 확보한다.
- 기존 구조는 후속 `if: steps.bench.outcome == 'failure'` + `exit 1`로 최종 hard fail을 복구하므로, warning-only가 아니라 enforce gate였다.

## 분리된 3단계 운영 기준

1. 현재 enforce
   - benchmark step: `continue-on-error: true`
   - reporting 단계: artifact upload + PR comment 유지
   - final gate: benchmark 실패 시 `exit 1`
2. warning-only
   - benchmark step: `continue-on-error: true`
   - reporting 단계: artifact upload + PR comment 유지
   - final gate: 제거 또는 mode 조건으로 비활성화
3. enforce 전환
   - warning-only 기간 동안 수집한 artifact/comment를 검토한다.
   - 누락 threshold를 채우고 baseline 변동성이 안정화되면 final gate를 다시 활성화한다.

## 이 작업의 적용안

- workflow 최상단에 `BENCHMARK_GATE_MODE`를 도입한다.
- 기본값은 `warning-only`로 두어 결과를 남기되 PR/branch를 hard fail하지 않는다.
- enforce 전환 시에는 같은 workflow에서 `BENCHMARK_GATE_MODE: enforce`만 변경하면 된다.

## enforce 전환 체크리스트

- `benchmark-result.json`에서 `skip` 상태로 남는 benchmark에 threshold가 정의되어 있다.
- 최근 green run 기준 baseline과 threshold가 팀이 수용 가능한 범위로 합의되었다.
- warning-only artifact/comment를 통해 false positive 없이 regression 시그널이 재현된다.
