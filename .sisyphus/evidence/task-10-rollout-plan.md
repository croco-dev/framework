# Task 10: Rollout Rollback Owner Milestone

## Complete Stream Rollout Plan

### Stream Summary Matrix

| Stream | Owner | Phase 1 | Phase 2 | Rollback Condition |
|--------|-------|---------|---------|-------------------|
| 1. Circular blocking | Architecture Lead | Create allowlist, staged CI check | Full remove on main | Revert to warning-only if CI blocked by critical path PR |
| 2. Gitleaks blocking | Security Lead | Collect false positives, create `.gitleaksignore` | Conditional blocking on trunk | Revert if false positive rate > 10% |
| 3. Coverage expansion | QA Lead | Add 5 core-adjacent at 50% | Raise to 60% for all covered | Exclude specific package if 1 month threshold failure |
| 4. Benchmark gate | Platform Lead | Baseline measurement, retry logic | Conditional trunk blocking | Increase variance buffer if flaky runs > 20% |
| 5. README drift | Docs/Release Lead | Issue template + CONTRIBUTING.md additions | Optional automation script | N/A (low risk, docs-only) |

### Protected Branch Strategy

| Branch | Gitleaks | Circular | Coverage | Benchmark |
|--------|----------|----------|----------|-----------|
| `trunk` (push) | Blocking | Blocking | Blocking | Blocking |
| `trunk` (PR) | Warning-only → Blocking (Phase 2) | Blocking | Blocking | Warning → Blocking (Phase 2) |
| Feature branches | No check | No check | No check | No check |

### CI Noise Handling

| Issue | Mitigation |
|-------|-----------|
| Benchmark flaky on CI runners | Max 2 retries, +10% variance buffer |
| False positive secrets scan | `.gitleaksignore` with fingerprint-only entries |
| Coverage variance between test runs | Use `v8` provider (deterministic), rerun on failure |
| Circular dependency false positives | Allowlist entries scoped to exact cycle paths |

### Exception Approval Flow

1. PR author files exception request in PR template
2. Stream owner reviews within 24h
3. Team lead approves/rejects
4. If approved: add to allowlist with timestamp + reason
5. Quarterly review: all exceptions re-evaluated

### Rollback Procedures

Each stream has explicit rollback trigger:
- **Circular**: New check breaks PR pipeline for critical path → revert to warning-only
- **Gitleaks**: False positive rate too high → revert to warning-only until `.gitleaksignore` cleanup
- **Coverage**: Specific package consistently below threshold → temporarily exclude, fix in separate ticket
- **Benchmark**: CI runner variance causes unreliable results → increase buffer or add manual approval step
- **README**: N/A — docs-only change, zero-risk rollback

### Milestone Schedule

| Milestone | Target Date | Deliverables |
|-----------|------------|--------------|
| M1: Baselines | Immediate | Allowlists, fingerprints, baseline measurements |
| M2: Staged Enforcement | Quarter +1 | Conditional blocking for trunk, PR warning-only |
| M3: Full Enforcement | Quarter +2 | All gates blocking on PR + merge |
| M4: Operations Review | Quarter +3 | Exception audit, threshold adjustment, full process review |
