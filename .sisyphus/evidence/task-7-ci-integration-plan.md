# Task 7: Architecture/Security CI Integration Plan

## Integration of Task 2 + 3 Results

### Architecture: Circular Dependency Check

**Current CI** (`ci.yml` line 121-123):
```yaml
- name: Architecture circular dependency warning
  run: pnpm architecture:check:circular
  continue-on-error: true
```

**Proposed Change** — Staged Enforcement:

```yaml
- name: Architecture circular dependency check
  run: |
    CIRCULAR_OUTPUT=$(npx madge --circular --extensions ts packages 2>&1) || true
    NEW_CIRCULAR=$(echo "$CIRCULAR_OUTPUT" | grep -v -f .madge-circular-allowlist.txt || true)
    if [ -n "$NEW_CIRCULAR" ]; then
      echo "::error::New circular dependency detected: $NEW_CIRCULAR"
      exit 1
    fi
    echo "Circular dependency check passed (existing allowlisted entries OK)"
```

**Implementation Steps**:
1. Create `.madge-circular-allowlist.txt` with 5 existing cycles (from Task 2 baseline)
2. Replace `continue-on-error` step with staged enforcement logic
3. Add documentation to CONTRIBUTING.md about exception request process

### Security: Gitleaks Blocking

**Current CI** (`ci.yml` line 56-76):
```yaml
- name: Secret scan warning report
  continue-on-error: true
  run: npx gitleaks@latest detect ...
```

**Proposed Change** — Conditional Blocking:

```yaml
- name: Secret scan (gitleaks)
  id: gitleaks
  run: npx gitleaks@latest detect ...
  # Phase 1: keep continue-on-error for transition period
  # Phase 2: remove continue-on-error for protected branches
  continue-on-error: ${{ github.event_name == 'pull_request' }}
```

**Implementation Steps**:
1. Review gitleaks SARIF reports to collect existing false positives
2. Create/update `.gitleaksignore` with fingerprints
3. Update CI step with conditional `continue-on-error`
4. Add false positive procedure to CONTRIBUTING.md

### CI Change Rollout Order

| Step | Action | Rationale |
|------|--------|-----------|
| 1 | Create `.madge-circular-allowlist.txt` | Prerequisite for architecture staged check |
| 2 | Create/update `.gitleaksignore` | Prerequisite for gitleaks blocking |
| 3 | Update `ci.yml` — circular check staged enforcement | First blocking change (clear baseline) |
| 4 | Update `ci.yml` — gitleaks conditional blocking | Second blocking change (after false positive cleanup) |

### Files to Modify
- `.github/workflows/ci.yml` — circular check + gitleaks enforcement
- `.madge-circular-allowlist.txt` — new file with existing 5 cycles
- `.gitleaksignore` — new/updated with false positive fingerprints
- `CONTRIBUTING.md` — exception request documentation
