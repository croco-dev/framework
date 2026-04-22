# Deprecated 패키지 전략

## eslint-config

### 참조처 조사 결과

**의존성 패키지**: 없음 (자기 자신인 `packages/eslint-config/package.json`만 확인됨)

**소스 코드 참조**: 없음

**문서 참조**: 없음

**템플릿 참조**:
- `packages/create-croco-app/templates/` — 현재 참조 없음 (T2에서 Biome 마이그레이션 시 처리 예정)

### 제거 조건
- [x] 모든 패키지에서 의존성 제거 완료 (현재 없음)
- [ ] **T2**: create-croco-app 템플릿 Biome 마이그레이션 완료
- [ ] **T64**: 패키지 삭제 가능

---

## utils-node

### 참조처 조사 결과

**의존성 패키지**: 없음 (자기 자신인 `packages/utils-node/package.json`만 확인됨)

**소스 코드 참조**: 없음

**문서 참조**:
1. `packages/utils-node/README.md` — 자기 자신의 README
2. `packages/tx-drizzle/README.md` — 사용 예시 코드에서 참조
   ```typescript
   import { createServer } from '@croco/utils-node';
   ```

**템플릿 참조**: 없음

### 제거 조건
- [ ] `packages/tx-drizzle/README.md`에서 utils-node 참조 제거 또는 대체 예시 추가
- [ ] **T65**: 패키지 삭제 가능

---

## 요약

### eslint-config
- **현재 상태**: 프로젝트 내부에서 참조 없음
- **제거 장애물**: create-croco-app 템플릿이 아직 ESLint를 사용 중일 가능성
- **다음 단계**: T2(create-croco-app Biome 마이그레이션) 완료 후 삭제

### utils-node
- **현재 상태**: tx-drizzle README에 사용 예시로만 참조됨
- **제거 장애물**: 문서화된 사용 예시
- **다음 단계**: README 업데이트 후 즉시 삭제 가능
