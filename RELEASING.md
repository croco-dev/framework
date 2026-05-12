# 릴리즈 가이드 (Release Guide)

이 문서는 `@croco` 모노레포의 패키지 버전 관리 및 배포 프로세스를 설명합니다.
우리는 [Changesets](https://github.com/changesets/changesets)를 사용하여 버전 관리와 변경 로그 생성을 자동화하고 있습니다.

## 1. 릴리즈 워크플로우 개요

이 프로젝트는 **Trunk-based Development**를 따르며, 메인 브랜치는 `trunk`입니다.
모든 패키지는 **Fixed Mode**로 설정되어 있어, 하나의 패키지 버전이 올라가면 그룹 내 모든 패키지의 버전이 함께 올라갑니다. 이를 통해 패키지 간 버전 일관성을 유지합니다.

- **Main Branch**: `trunk`
- **Mode**: Fixed (모든 `@croco/*` 패키지가 동일 버전 유지)
- **Registry**: npm (public access)

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
   - 변경된 패키지를 스페이스바로 선택합니다.
   - **Fixed Mode**이므로, 하나의 패키지만 선택해도 그룹 내 다른 패키지들이 영향을 받을 수 있습니다.

3. **버전 타입 선택**
   - **Major**: 호환되지 않는 변경 (Breaking Changes)
   - **Minor**: 하위 호환되는 새로운 기능 추가
   - **Patch**: 하위 호환되는 버그 수정

4. **설명 작성**
   - 변경 사항에 대한 명확한 설명을 작성합니다. 이 내용은 `CHANGELOG.md`에 그대로 반영됩니다.

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

이 토큰은 CI/CD 파이프라인에서 `.npmrc` 인증을 위해 사용됩니다.
