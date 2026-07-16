# 릴리즈 가이드 (Release Guide)

이 문서는 `@croco` 모노레포의 패키지 버전 관리 및 배포 프로세스를 설명합니다.
우리는 [Changesets](https://github.com/changesets/changesets)를 사용하여 버전 관리와 변경 로그 생성을 자동화하고 있습니다.

## 1. 릴리즈 워크플로우 개요

이 프로젝트는 **Trunk-based Development**를 따르며, 메인 브랜치는 `trunk`입니다.
패키지는 Changesets의 기본 독립 버전 관리 방식으로 운영합니다. `.changeset/config.json`의 `fixed`와 `linked` 배열은 비어 있으므로, 하나의 패키지 버전 상승이 모든 패키지 버전을 자동으로 함께 올리지는 않습니다.

- **Main Branch**: `trunk`
- **Mode**: Independent (Changesets fixed/linked group 없음)
- **Registry**: npm (public access)

Croco 1.0 spine 호환성은 현재 Changesets fixed/linked group이 아니라 검증 게이트로 관리합니다.
`pnpm package-manifests:check`는 내부 `@croco/*` workspace 의존성이 `workspace:*`를 쓰는지
검사하고, 의도된 peer semver 예외는 `scripts/internal-peer-dependency-range-exceptions.json`에
reason, owner, compatibility rationale을 포함한 metadata로 기록해야 합니다. `pnpm
package-quality:report`는 같은 정책을 compatibility train 섹션에 요약하고 generated app dependency
set의 실제 생성 range와 현재 workspace package version에서 기대되는 range, fixed/linked decision을
함께 보여줍니다. 검증만으로 published train 동기화가 부족해지는
시점에만 `.changeset/config.json`의 fixed 또는 linked group을 도입하고, 이 문서에 group 영향
범위와 패키지 선택 기준을 갱신합니다.

### npm provenance contract

Croco releases use token-based npm publishing with provenance enabled. The release workflow keeps
`NPM_TOKEN` for Changesets publishing, grants GitHub Actions `id-token: write`, and exports
`NPM_CONFIG_PROVENANCE=true` so the `pnpm exec changeset publish` path passes npm provenance
configuration to each underlying `pnpm publish` call.

Trusted Publishing is the preferred future credential model, but it requires npm-side trusted
publisher configuration for the package set before `NPM_TOKEN` can be removed. Until that migration is
completed, token publishing plus `NPM_CONFIG_PROVENANCE=true` is the supported route.

The release workflow validates provenance configuration before the dry-run publish gate:

```bash
npm config get provenance
pnpm config get provenance
```

Both commands must print `true`. If either command prints anything else, stop the release and fix the
workflow environment before rerunning publish.

After a package version is published, maintainers verify provenance in two ways:

1. On npmjs.com, open the package version and check the Version field for the green provenance check
   mark. Open the details to confirm the Build Environment, Build Summary, Source Commit, Build File,
   and Public Ledger entries point back to `croco-dev/framework`.
2. In a clean project that installs the released package version, run:

   ```bash
   npm audit signatures
   ```

Missing or invalid registry signatures or provenance attestations must be treated as a release
incident. Deprecate the affected version if consumers could install it before the provenance issue
is corrected, then publish a fixed patch version through the normal Changesets release flow.

### Immutable CI executable rotation

Blocking CI and release verification may execute tools only from the frozen pnpm lockfile, a full
OCI digest, a full commit SHA, or a directly downloaded artifact whose checksum or signature is
verified before execution. Run `pnpm ci-executables:check` after changing any workflow, root script,
or executable under `scripts/`; the policy reports the repository-relative file, line, rule, and
recovery action for mutable references.

Routine Gitleaks updates are proposed by Renovate from the metadata beside the image reference in
`.github/workflows/ci.yml`. Review both the readable version and `sha256` digest in the PR, confirm the
tag resolves to that digest with `docker buildx imagetools inspect`, then run the pinned scan and the
policy tests before merge. Madge updates must remain exact in `package.json` and `pnpm-lock.yaml` and
must execute through `pnpm exec` after `pnpm install --frozen-lockfile`.

If an artifact is compromised, revoked, or unexpectedly repointed:

1. Disable the affected verification or release path only by reverting to the last known-good
   immutable reference; never fall back to a mutable tag, branch, short SHA, or network-resolved
   package.
2. Verify the replacement against the upstream release record and registry digest, checksum, or
   signature. Record the old and new immutable identifiers in the emergency PR.
3. Run `pnpm ci-executables:check`, its focused fixture suite, the affected real executable, and the
   normal repository quality gates. The replacement must be visible as an explicit repository diff.
4. Revoke compromised credentials or allowlists separately when relevant, merge through normal
   branch protection, and retain the revert commit as the rollback path until the replacement has a
   green protected-branch run.

---

## 2. 일상 워크플로우 (Daily Workflow)

일반적인 기능 개발 및 배포 과정은 다음과 같습니다.

1. **작업 및 Changeset 추가**
   - 새로운 기능 개발이나 버그 수정을 위한 브랜치를 생성합니다.
   - 작업을 완료한 후, 변경 사항에 대한 설명을 담은 Changeset을 추가합니다.

   ```bash
   pnpm changeset
   ```

2. **PR 생성 및 머지**
   - GitHub에 Pull Request를 생성합니다.
   - 리뷰 승인 및 CI 통과 후 `trunk` 브랜치로 머지합니다.

3. **Version Packages (자동)**
   - `trunk` 브랜치에 Changeset이 쌓이면, GitHub Actions(Changesets bot)가 자동으로 **"Version Packages"** 라는 제목의 PR을 생성합니다.
   - 이 PR은 `CHANGELOG.md` 업데이트와 `package.json` 버전 올림 처리를 포함합니다.

4. **배포 (Publish)**
   - "Version Packages" PR을 `trunk`로 머지하면, 배포 파이프라인이 트리거되어 npm에 패키지를 배포합니다.
   - 배포 후 GitHub Release 태그가 자동으로 생성됩니다.

---

## 3. Changeset 작성 가이드

변경 사항이 있는 경우 반드시 Changeset을 작성해야 합니다.

1. **명령어 실행**

   ```bash
   pnpm changeset
   ```

2. **패키지 선택**
   - 릴리즈가 필요한 변경이 들어간 publishable package를 각각 스페이스바로 선택합니다.
   - 여러 패키지의 공개 동작이나 package manifest가 함께 바뀌었다면, 해당 패키지를 모두 선택합니다.
   - 문서, 테스트, private package, 또는 publishable package 동작에 영향을 주지 않는 루트 설정만 바뀐 경우에는 changeset이 필요하지 않을 수 있습니다. PR에서는 `pnpm changeset-required:check -- --base origin/trunk --head HEAD` 결과로 이 판단을 확인합니다.

3. **버전 타입 선택**
   - **Major**: 호환되지 않는 변경 (Breaking Changes)
   - **Minor**: 하위 호환되는 새로운 기능 추가
   - **Patch**: 하위 호환되는 버그 수정

4. **설명 작성**
   - 변경 사항에 대한 명확한 설명을 작성합니다. 이 내용은 `CHANGELOG.md`에 그대로 반영됩니다.

### Release review expectations

- `.changeset/config.json`과 이 가이드의 versioning mode 설명이 일치해야 합니다. 현재는 `fixed: []`, `linked: []`이므로 독립 버전 관리로 리뷰합니다.
- Fixed 또는 linked group을 도입하려면 `.changeset/config.json`에 실제 group을 먼저 표현하고, 이 가이드에 group 영향 범위와 패키지 선택 기준을 함께 갱신해야 합니다.
- Croco 1.0 spine compatibility train은 fixed/linked group 없이 `package-manifests:check`, `package-quality:report`, `create-croco-app` generated app range checks, smoke evidence로 검증합니다. 내부 peer semver 예외는 owner와 compatibility rationale이 있는 checked metadata 없이는 허용하지 않습니다.
- 리뷰어는 release-significant package 변경마다 적절한 changeset entry가 있는지 확인합니다. 하나의 패키지를 선택했다는 이유만으로 관련 없는 패키지까지 자동으로 함께 bump된다고 가정하지 않습니다.
- `pnpm public-api:check`는 publishable package의 `src/index.ts` export surface를 `public-api-surface.snapshot.json`과 비교합니다. 의도된 export 변경이면 `pnpm public-api:write`로 snapshot을 갱신하고, runtime/type export diff가 import surface, 타입, 또는 공개 동작을 바꾸는지 기준으로 changeset 필요 여부를 리뷰합니다.
- Breaking changes to `croco.doctor.v1` doctor JSON output must either intentionally version the report schema or include release notes that name the removed/renamed field, check id, diagnostic field, status, severity, or stable diagnostic code and provide the migration path for CI/generated-app consumers.

---

## 4. Prerelease 절차 (Alpha, Beta, RC)

정식 배포 전 테스트를 위해 prerelease 버전을 배포해야 할 경우 다음 절차를 따릅니다.

### Prerelease 모드 진입

`alpha` 태그로 배포하려는 경우:

```bash
pnpm changeset pre enter alpha
```

이 명령어를 실행하면 `.changeset/pre.json` 파일이 생성되며 prerelease 모드로 전환됩니다.

### 버전업 및 배포

Changeset을 추가하고 평소처럼 진행합니다. 버전은 자동으로 `1.0.0-alpha.0` 형식으로 생성됩니다.

### Prerelease 모드 종료

정식 버전을 배포할 준비가 되면 모드를 종료합니다.

```bash
pnpm changeset pre exit
```

이후 일반적인 절차대로 버전을 올리면 정식 버전(예: `1.0.0`)으로 변경됩니다.

### Dist-tag 매핑

| 단계        | Dist-tag | 버전 예시       | 용도                       |
| ----------- | -------- | --------------- | -------------------------- |
| 개발/테스트 | `alpha`  | `1.0.0-alpha.0` | 내부 테스트 및 얼리 액세스 |
| 베타        | `beta`   | `1.0.0-beta.0`  | 공개 베타 테스트           |
| 출시 후보   | `rc`     | `1.0.0-rc.0`    | 정식 출시 직전 최종 검증   |
| 정식 출시   | `latest` | `1.0.0`         | 일반 사용자용 안정 버전    |

### RC release notes

RC release notes must link the
[0.x-to-1.0 Migration Matrix](docs/release/croco-1.0-spine.md#0x-to-10-migration-matrix) from the
Croco 1.0 spine checklist. The notes must call out changed package entrypoints, generated app
templates, manifests, ContractGraph behavior, Problem codes, runtime capability changes, and any
renamed/deprecated/removed public APIs or artifacts that affect 0.x consumers.

When `croco doctor` or `croco upgrade --dry-run` covers a known old artifact, include the diagnostic
or upgrade command in the RC release notes so generated-app and CI consumers have a recovery path.
If no practical diagnostic exists for a compatibility change, the release notes must say so and name
the manual review path.

### First alpha release gate

The first alpha release must use the `alpha` dist-tag. Do not publish a `latest` tag until the alpha
package set has passed the release workflow and the release notes have been reviewed.

The alpha spine is the externally installable path that proves Croco can leave the monorepo checkout:

- tooling: `create-croco-app`, `@croco/cli`;
- runtime spine: `@croco/problems-core`, `@croco/framework-context`, `@croco/events-core`,
  `@croco/events-inmemory`, `@croco/protocols-rest`, `@croco/repository-core`,
  `@croco/retry-core`, `@croco/telemetry-api`, `@croco/telemetry-sdk-node`,
  `@croco/transports-http`.

Run the release smoke before publishing:

```bash
pnpm alpha-release:smoke
```

This packs the alpha spine and `create-croco-app`, installs them into clean temporary projects,
generates the `production-app` preset from the packed CLI artifact, rewrites Croco dependencies to
packed artifacts, then runs install, `contract:snapshot`, `contract:verify`, `typecheck`, `build`,
`test`, and `dev:smoke`. The script fails if `workspace:` ranges or repository checkout paths leak
into the clean install evidence.

The smoke report is written at `ci-reports/release/alpha-release-smoke.md`. Attach or link that
report from the alpha release notes, or upload it as the `alpha-release-smoke` CI artifact when the
release workflow has workflow-scoped credentials. Treat a missing or failed report as
publish-blocking.

### Alpha release notes

Alpha release notes must state alpha stability and compatibility expectations explicitly:

- packages are early-access and may change before `latest`;
- supported Node, package manager, and runtime expectations;
- the dist-tag used for install commands, for example `npm install @croco/problems-core@alpha`;
- the `alpha-release-smoke` artifact or equivalent release evidence;
- known compatibility gaps and the recovery path for failed clean installs or generated app smoke.

---

## 5. Rollback / Hotfix

### 패키지 Deprecate (Rollback 대용)

npm은 이미 배포된 버전을 삭제(unpublish)하는 것을 권장하지 않습니다. 심각한 문제가 있는 경우 해당 버전을 **deprecated** 처리해야 합니다.

```bash
npm deprecate @croco/package-name@1.0.1 "Critical bug discovered in v1.0.1. Please upgrade to v1.0.2"
```

### Hotfix 배포

이미 배포된 버전에서 긴급 수정이 필요한 경우:

1. `trunk` 브랜치에서 핫픽스 작업을 수행합니다.
2. `patch` 레벨의 Changeset을 추가합니다.
   ```bash
   pnpm changeset
   # patch 선택
   ```
3. 빠르게 머지하고 배포 프로세스를 태웁니다.

---

## 6. Troubleshooting

### Changeset Status 오류

가끔 로컬과 원격의 상태가 꼬일 수 있습니다. 다음 명령어로 현재 상태를 확인하세요.

```bash
pnpm changeset status
```

### Publish 실패 시 재시도

네트워크 오류 등으로 배포가 실패한 경우, CI 파이프라인을 재시작(Re-run jobs)하면 배포 단계가 다시 실행됩니다. Changeset은 이미 소비(삭제)되었을 수 있으므로 주의해야 합니다.

### Dry-run (사전 검증)

실제 배포 전에 버전이 어떻게 변경될지 미리 확인하고 싶다면:

```bash
pnpm version-packages --dry-run
```

(참고: `package.json` 스크립트에 따라 명령어가 다를 수 있습니다. 기본은 `changeset version --dry-run` 입니다.)

---

## 7. 필수 환경 변수

배포를 위해서는 GitHub Repository Secrets에 다음 환경 변수가 설정되어 있어야 합니다.

| 환경 변수명 | 설명                      | 비고                 |
| ----------- | ------------------------- | -------------------- |
| `NPM_TOKEN` | npm 배포 권한이 있는 토큰 | Automation 토큰 권장 |

이 토큰은 CI/CD 파이프라인에서 `.npmrc` 인증을 위해 사용됩니다. 릴리즈 워크플로우는 같은 값을
`NODE_AUTH_TOKEN`으로도 제공하여 `actions/setup-node`가 생성한 npm registry 설정과 Changesets
publish 단계가 같은 인증 정보를 사용하도록 합니다.
