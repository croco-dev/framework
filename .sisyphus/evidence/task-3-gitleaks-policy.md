# Task 3: Gitleaks Blocking Conversion Baseline & False-Positive Policy

## Current Baseline

**File**: `.github/workflows/ci.yml` line 56-76
- **Step name**: `Secret scan warning report`
- **Command**: `npx gitleaks@latest detect --source . --redact --no-banner --report-format sarif --report-path ci-reports/security/gitleaks.sarif`
- **Current behavior**: `continue-on-error: true` — signal preserved but pipeline proceeds
- **Output**: SARIF report + text summary → `ci-reports/security/` → artifact upload
- **False positive process**: Already documented in CI summary (lines 98-102) — fingerprint addition to `.gitleaksignore` with PR documentation

## Blocking Conversion Plan

### Phased Rollout

1. **Phase 1 — Baseline Run (current state)**
   - `continue-on-error: true` 유지
   - SARIF/text report 수집
   - False positive fingerprint 수집

2. **Phase 2 — Protected Branch Blocking**
   - `continue-on-error: true` 제거 (`false`로 전환)
   - trunk push / PR merge 기준 blocking
   - `.gitleaksignore` 에 명시적 허용 fingerprint 관리

3. **Phase 3 — Pre-merge Gate**
   - PR merge 전 gitleaks 통과 필수
   - 신규 secret 발견 시 merge 자동 차단

### Scope Boundary
- **NEW commits only**: 신규 변경만 검사 (과거 히스토리 풀스캔 아님)
- **gitleaks only**: 추가 보안 도구(CodeQL/Semgrep/Dependabot) 도입 범위 제외

### False Positive Management Procedure

1. SARIF finding 분석 → 실제 secret 인지 확인
2. False positive 인 경우: `.gitleaksignore` 에 fingerprint 추가
   - 범위 최소화 (정확한 fingerprint 만 지정)
   - PR 에 사유 기술
3. Legacy secrets 인 경우: 개별 remediation ticket 으로 분리 (이 플랜 범위 아님)

## Files to Modify

1. `.github/workflows/ci.yml` — `continue-on-error: true` 제거 (or conditional: `${{ github.ref == 'refs/heads/trunk' }}`)
2. `.gitleaksignore` — false positive fingerprint 관리 (미존재 시 신규 생성)

## History Scan vs New-Change Scan

- Blocking 전환 시 **신규 커밋 대상 스캔**만 (PR diff 기준)
- 기존 레거시 커밋 풀스캔은 별도 remediation 프로젝트로 분리
