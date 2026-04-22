# Task 11: Final Integration & Execution Sequence

## Consolidated Execution Order

### Phase 1: Baselines (Immediate — All Parallel)

| # | Task | Output File | Owner |
|---|------|------------|-------|
| 1 | Circular dependency baseline + allowlist | `.madge-circular-allowlist.txt` | Architecture |
| 2 | Gitleaks false positive collection | `.gitleaksignore` | Security |

### Phase 2: CI Integration (Sequential after Phase 1)

| # | Task | Output File | Owner |
|---|------|------------|-------|
| 3 | Update `ci.yml` — circular staged enforcement | `.github/workflows/ci.yml` | Architecture |
| 4 | Update `ci.yml` — gitleaks conditional blocking | `.github/workflows/ci.yml` | Security |

### Phase 3: Expansion Plans (Can run in parallel with Phase 2)

| # | Task | Output File | Owner |
|---|------|------------|-------|
| 5 | Coverage expansion — modify `vitest.config.ts` coverage packages | `vitest.config.ts` | QA |
| 6 | Benchmark baseline measurement + conditional blocking | `.github/workflows/benchmark.yml` | Platform |
| 7 | Release checklist Issue template + CONTRIBUTING.md additions | `.github/ISSUE_TEMPLATE/release-checklist.md`, `CONTRIBUTING.md` | Docs |

### Phase 4: Verification & Merge

| # | Task | Outcome |
|---|------|---------|
| 8 | All evidence files present and validated | Proceed |
| 9 | F1-F4 pass | Proceed |
| 10 | Squash merge to trunk | Complete |

## Final File Change Summary

| File | Change | Risk |
|------|--------|------|
| `.github/workflows/ci.yml` | Circular check staged, gitleaks conditional blocking | Medium — core CI gate |
| `.github/workflows/benchmark.yml` | Conditional blocking logic | Low — already has warning infrastructure |
| `.madge-circular-allowlist.txt` | New file — 5 existing cycles | Low — allowlist only |
| `.gitleaksignore` | New file — false positive fingerprints | Low — exclusion only |
| `vitest.config.ts` | Expand coverage packages array | Low — additive only |
| `CONTRIBUTING.md` | Add Documentation Architecture section | Low — docs only |
| `.github/ISSUE_TEMPLATE/release-checklist.md` | New file | Low — docs only |

## Overlap Check with Previous Plans

### framework-tech-health-enforcement.md
| Previous Task | Status | This Plan Overlap |
|--------------|--------|-------------------|
| Architecture baseline measurement | Done (20260421) | Uses RESULT, does NOT re-measure |
| Core coverage CI gate | Done | Expands from 5 → 10 packages (delta) |
| gitleaks warning infrastructure | Done | Convert warning → blocking (next step) |
| Benchmark hard gate | Done | Convert hard gate → regression gate (policy refinement) |
| One-command setup | Done | Out of scope |

**Conclusion**: References previous plan results as baseline, NO duplication.

### framework-tech-health-remediation.md
| Previous Task | Status | This Plan Overlap |
|--------------|--------|-------------------|
| Self-cycle removal | Done | Out of scope |
| tenant-core drizzle leak fix | Done | Out of scope |
| Empty catch cleanup | Done | Out of scope |
| console.log cleanup | Done | Out of scope |
| CONTRIBUTING.md creation | Done | Additions only (Documentation Architecture section) |

**Conclusion**: NO code remediation overlap. Operations policy additions only.

## Final Scope Confirmation

**5 Action Streams Only**:
1. ✅ Circular dependency blocking enforcement
2. ✅ Gitleaks blocking transition
3. ✅ Coverage expansion (core-adjacent, risk-based)
4. ✅ Benchmark regression gate
5. ✅ README drift operations checklist

**Verified NOT Included**:
- ❌ Code remediation (refactoring, bug fixes)
- ❌ New security tools (CodeQL, Semgrep)
- ❌ Performance optimization
- ❌ README/full docs rewrite
- ❌ Generic recommendations
