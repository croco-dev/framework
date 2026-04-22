# 결정 기록 (Full Codebase Refactoring)

## 2026-03-16: Registry 패턴 추출 SKIP

### 조사 결과
- **총 Registry 수**: 19개 (구체 15개 + 추상 4개)
- **공통 패턴**: Map<K, V> 저장소 + register/get/getAll/clear 메서드

### 결정: **BaseRegistry 추상화 도입하지 않음**

### 이유
1. **공통 패턴보다 차이점이 더 큼**
   - 싱글톤 여부不一致 (`static getInstance()` vs 전역 인스턴스 vs 일반 클래스)
   - 생성자 차이 (매개변수 없음 vs repository 필수 vs metadata 팩토리)
   - 특화 메서드 (`getRolePermissions`, `getOrThrow` 등)

2. **과도한 제네릭 복잡성**
   - `BaseRegistry<K, V>`로 통일하면 각 Registry의 특화 로직 표현 불가
   - 타입 안전성 저하 우려

3. **Rule of Three 전제 불충족**
   - 19개가 있어도 "진짜 같은 패턴"이 아님
   - MetadataStorage 기반 3개, 일반 Map 기반 2개로 분산

4. **기존 코드가 이미 잘 작동**
   - 각 Registry가 도메인 특화 기능 제공 중
   - 리팩토링 비용 > 이익

### 참조
- Task 4-5: Registry 패턴 추출

## 2026-03-16: membership/invitation core 추상화 경계 강화

- membership-core에 `MembershipStoreClient` 인터페이스를 추가해 drizzle store가 core 계약만 의존하도록 정리했다.
- invitation-core에 `InvitationStoreClient`, `DomainPolicyStoreClient` 인터페이스를 추가해 drizzle store의 TxManager 제네릭과 주입 타입에서 tx-drizzle 노출을 제거했다.
- audit-core `@Auditable`는 `Container.get(AuditLogRepository as unknown as Constructor)` 대신 데코레이트된 인스턴스의 constructor-injected repository를 해석하도록 변경했다.
- 검증 결과 `grep -rn "tx-drizzle" packages/*-core/ --include="*.ts"`는 0건이었다.
