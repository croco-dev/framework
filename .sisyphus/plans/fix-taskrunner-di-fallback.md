# Fix TaskRunner DI Fallback (#327)

## TL;DR
> **Summary**: TaskRunner.createInstance()가 DI 해석 실패 시 무인자 생성자로 폴백하여 깨진 인스턴스를 생성하는 문제를 수정. 즉시 `TaskDIResolutionProblem`을 throw하도록 변경.
> **Deliverables**: TaskDIResolutionProblem 클래스, createInstance() strict 모드, 업데이트된 테스트
> **Effort**: Quick
> **Parallel**: YES - 2 waves
> **Critical Path**: Task 1 → Task 2 → Task 3 → Task 4

## Context
### Original Request
GitHub 이슈 #327: TaskRunner가 DI 해석 실패 시 무인자 생성자로 폴백하여 의존성이 `undefined`인 깨진 인스턴스를 생성. 런타임에서 NullPointerError류 장애가 발생하지만, 원인이 DI 실패에 있다는 것을 추적하기 매우 어려움.

### Interview Summary
- **에러 전파 전략**: Strict 모드 — DI 실패 = 즉시 에러 throw, 폴백 없음
- **테스트 전략**: TDD (RED → GREEN → REFACTOR)
- **브랜치 전략**: 브랜치/PR

### Oracle Verdict
**CONDITIONAL** — fallback 제거 방향은 SAFE. 조건:
1. 테스트 클래스 `@Component()` 정리 + 기존 폴백 테스트를 에러 기대로 교체 → **Task 3, 4에서 처리**
2. 비테스트 코드에서 `@Task()` only 사용 0건 확인 → **explore 에이전트로 확인 완료** (프로덕션은 `SendNotificationTask` 1건, `@Component()` 있음)
3. README 예제가 구현 계약과 일치 → **기존 README가 이미 `@Component() + @Task()` 패턴 사용**. 변경 불필요.

추가 권고:
- `InternalServerError` 카테고리 사용 확정 (`DuplicateTaskRegistrationProblem`과 동일 계열)
- `logger.warn` + `recordError`는 createInstance 내부에 유지하지 않음 (상위 catch에서 한 번만 기록)
- non-Error throw 래핑 시 원본 보존: `new Error(String(error), { cause: error })`

### Metis Review (gaps addressed)
- **테스트 클래스 영향**: 21개 테스트 클래스가 `@Component()` 없이 `@Task()`만 사용 → fallback 제거 시 깨짐. `@Component()` 추가 필요.
- **에러 체이닝**: Problem 기반 클래스가 `options.cause`로 원본 에러 체이닝 지원. Pattern B 사용 (cause + detail message).
- **Non-Error throw 엣지 케이스**: Container.get()이 Error가 아닌 것을 throw할 수 있음 → `instanceof Error` 체크 후 래핑 필요.
- **Pre-constructed 인스턴스 경로**: `return target` 경로 (L76)는 변경하지 않음.
- **Extensions hint**: `extensions.hint`에 개발자 가이드 포함 (`@Component() 데코레이터를 태스크 클래스에 추가하세요`).

## Work Objectives
### Core Objective
`TaskRunner.createInstance()`에서 DI 해석 실패 시 무조건 `TaskDIResolutionProblem`을 throw하여, 깨진 인스턴스 생성을 완전히 방지한다.

### Deliverables
- `TaskDIResolutionProblem` Problem 하위 클래스
- `createInstance()` strict 모드 구현
- TDD 기반 테스트 (신규 + 기존 업데이트)
- `index.ts` export 추가

### Definition of Done (verifiable conditions with commands)
- `pnpm test --filter=@croco/tasks-core` — ALL PASS
- `pnpm typecheck --filter=@croco/tasks-core` — NO ERRORS
- `pnpm check` — NO ERRORS
- `grep -n "falling back to manual" packages/tasks-core/src/libs/TaskRunner.ts` — NO MATCHES
- `grep -n "TaskDIResolutionProblem" packages/tasks-core/src/index.ts` — MATCH EXISTS

### Must Have
- DI 해석 실패 시 `TaskDIResolutionProblem` throw
- 원본 에러를 `cause`로 체이닝
- 태스크 클래스명을 에러 메시지에 포함
- `extensions.hint`에 `@Component()` 가이드 포함
- 모든 기존 테스트 통과

### Must NOT Have (guardrails)
- 무인자 생성자 폴백 (완전 제거)
- `@Task` 데코레이터 자체 수정
- Container 클래스 수정
- README/문서 변경
- deprecation 경고 (즉시 제거, 단계적 폐기 아님)
- `return target` 경로 (pre-constructed 인스턴스) 변경

## Verification Strategy
> ZERO HUMAN INTERVENTION — all verification is agent-executed.
- Test decision: TDD (RED → GREEN → REFACTOR) + Vitest
- QA policy: Every task has agent-executed scenarios
- Evidence: .sisyphus/evidence/task-{N}-{slug}.{ext}

## Execution Strategy
### Parallel Execution Waves

Wave 1: [Foundation]
- Task 1: 브랜치 생성 (quick)
- Task 2: TaskDIResolutionProblem 생성 + export (quick)

Wave 2: [TDD Implementation — sequential]
- Task 3: TDD RED — 실패 테스트 작성 (quick)
- Task 4: TDD GREEN — createInstance() 수정 + 기존 테스트 수정 (quick)

### Dependency Matrix
| Task | Depends On | Blocks |
|------|-----------|--------|
| 1 | — | 2, 3, 4 |
| 2 | 1 | 3, 4 |
| 3 | 2 | 4 |
| 4 | 3 | F1-F4 |

### Agent Dispatch Summary
| Wave | Tasks | Categories |
|------|-------|-----------|
| 1 | 2 | quick × 2 |
| 2 | 2 | quick × 2 (sequential) |
| Final | 4 | verification × 4 |

## TODOs

- [x] 1. 브랜치 생성

  **What to do**: `fix-taskrunner-di-fallback` 브랜치를 trunk에서 생성.
  **Must NOT do**: trunk에 직접 커밋하지 않는다.

  **Recommended Agent Profile**:
  - Category: `quick` — 단일 git 명령
  - Skills: [] — 불필요

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: [2, 3, 4] | Blocked By: []

  **References**:
  - 현재 브랜치: trunk (clean working directory)

  **Acceptance Criteria**:
  - [ ] `git branch --show-current` → `fix-taskrunner-di-fallback`

  **QA Scenarios**:
  ```
  Scenario: 브랜치 생성 확인
    Tool: Bash
    Steps: git branch --show-current
    Expected: "fix-taskrunner-di-fallback" 출력
    Evidence: .sisyphus/evidence/task-1-branch.txt
  ```

  **Commit**: NO

- [x] 2. TaskDIResolutionProblem 생성 + export

  **What to do**:
  1. `packages/tasks-core/src/libs/problems/TasksProblems.ts`에 `TaskDIResolutionProblem` 클래스 추가:
     ```typescript
     export class TaskDIResolutionProblem extends Problem {
       constructor(taskClassName: string, cause: Error) {
         super(
           'tasks-core/di-resolution-failed',
           ProblemCategory.InternalServerError,
           `Failed to resolve dependencies for task '${taskClassName}'. Ensure the class is decorated with @Component().`,
           {
             cause,
             extensions: {
               taskClassName,
               hint: 'Add @Component() decorator to the task class',
               retryable: false,
             },
           },
         );
       }
     }
     ```
  2. `packages/tasks-core/src/index.ts`의 Problem export에 `TaskDIResolutionProblem` 추가:
     ```typescript
     export { DuplicateTaskRegistrationProblem, TaskDIResolutionProblem, TaskNotFoundProblem } from './libs/problems/TasksProblems';
     ```
  **Must NOT do**: createInstance()를 수정하지 않는다. Problem 클래스만 만든다.

  **Recommended Agent Profile**:
  - Category: `quick` — 2개 파일, 단순 추가
  - Skills: [] — 불필요

  **Parallelization**: Can Parallel: NO (Task 1 이후) | Wave 1 | Blocks: [3, 4] | Blocked By: [1]

  **References**:
  - Pattern: `packages/tasks-core/src/libs/problems/TasksProblems.ts:11-24` — DuplicateTaskRegistrationProblem 패턴 (cause + extensions)
  - Type: `packages/problems-core/src/libs/Problem.ts` — Problem base class (constructor signature)
  - Export: `packages/tasks-core/src/index.ts:9` — 기존 export 패턴

  **Acceptance Criteria**:
  - [ ] `grep -n "TaskDIResolutionProblem" packages/tasks-core/src/libs/problems/TasksProblems.ts` — 클래스 정의 존재
  - [ ] `grep -n "TaskDIResolutionProblem" packages/tasks-core/src/index.ts` — export 존재
  - [ ] `pnpm typecheck --filter=@croco/tasks-core` — NO ERRORS

  **QA Scenarios**:
  ```
  Scenario: Problem 클래스 정의 확인
    Tool: Bash
    Steps: grep -n "TaskDIResolutionProblem" packages/tasks-core/src/libs/problems/TasksProblems.ts
    Expected: class 정의 라인 출력
    Evidence: .sisyphus/evidence/task-2-problem-class.txt

  Scenario: TypeScript 컴파일 확인
    Tool: Bash
    Steps: pnpm typecheck --filter=@croco/tasks-core
    Expected: 에러 없음
    Evidence: .sisyphus/evidence/task-2-typecheck.txt
  ```

  **Commit**: YES | Message: `feat(tasks-core): add TaskDIResolutionProblem class for explicit DI failure reporting` | Files: [packages/tasks-core/src/libs/problems/TasksProblems.ts, packages/tasks-core/src/index.ts]

- [x] 3. TDD RED — DI 실패 시 에러 throw 테스트 작성

  **What to do**:
  `packages/tasks-core/src/tests/TaskRunner.spec.ts`에 새 테스트를 추가한다. 기존 DI 폴백 테스트(L228-266)를 **삭제**하고 아래 3개 테스트로 교체:

  1. **"should throw TaskDIResolutionProblem when DI resolution fails"**:
     ```typescript
     it('should throw TaskDIResolutionProblem when DI resolution fails', async () => {
       class DIFailTaskHandler {
         @Task({ name: 'di-fail-task' })
         async process(payload: { value: number }): Promise<number> {
           return payload.value * 2;
         }
       }
       new DIFailTaskHandler();
       registry.collectFromMetadata();

       vi.spyOn(Container, 'get').mockImplementation(() => {
         throw new Error('Service not found');
       });
       const runner = new TaskRunner(mockExecutionManager, registry);

       await expect(runner.execute('di-fail-task', { value: 5 })).rejects.toThrow(TaskDIResolutionProblem);
     });
     ```

  2. **"should include original error as cause in TaskDIResolutionProblem"**:
     ```typescript
     it('should include original error as cause in TaskDIResolutionProblem', async () => {
       class CauseTestHandler {
         @Task({ name: 'cause-test-task' })
         async run(): Promise<void> {}
       }
       new CauseTestHandler();
       registry.collectFromMetadata();

       const originalError = new Error('TypeDI: Service not found');
       vi.spyOn(Container, 'get').mockImplementation(() => { throw originalError; });
       const runner = new TaskRunner(mockExecutionManager, registry);

       try {
         await runner.execute('cause-test-task', {});
         expect.fail('should have thrown');
       } catch (error) {
         expect(error).toBeInstanceOf(TaskDIResolutionProblem);
         expect((error as TaskDIResolutionProblem).cause).toBe(originalError);
       }
     });
     ```

  3. **"should include task class name in error message"**:
     ```typescript
     it('should include task class name in TaskDIResolutionProblem message', async () => {
       class ImageProcessor {
         @Task({ name: 'process-image' })
         async resize(): Promise<void> {}
       }
       new ImageProcessor();
       registry.collectFromMetadata();

       vi.spyOn(Container, 'get').mockImplementation(() => { throw new Error('DI failed'); });
       const runner = new TaskRunner(mockExecutionManager, registry);

       await expect(runner.execute('process-image', {})).rejects.toThrow(/ImageProcessor/);
     });
     ```

  **Must NOT do**: `createInstance()` 메서드를 수정하지 않는다. 이 시점에서 테스트는 **반드시 실패**해야 한다 (RED 단계).

  **Recommended Agent Profile**:
  - Category: `quick` — 단일 파일 테스트 수정
  - Skills: [] — 불필요

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: [4] | Blocked By: [2]

  **References**:
  - Pattern: `packages/tasks-core/src/tests/TaskRunner.spec.ts:228-266` — 삭제할 기존 DI 폴백 테스트
  - Pattern: `packages/tasks-core/src/tests/TaskRunner.spec.ts:55-70` — 기존 테스트 구조 (mock 패턴)
  - Type: `packages/tasks-core/src/libs/problems/TasksProblems.ts` — TaskDIResolutionProblem import

  **Acceptance Criteria**:
  - [ ] 기존 "should log and record error when DI resolution fails" 테스트 삭제됨
  - [ ] 3개 신규 테스트가 `TaskRunner.spec.ts`에 존재
  - [ ] `cd packages/tasks-core && pnpm vitest run src/tests/TaskRunner.spec.ts` — 3개 신규 테스트 FAIL (RED 확인). 나머지 기존 테스트는 PASS.

  **QA Scenarios**:
  ```
  Scenario: RED 확인 — 신규 테스트 실패
    Tool: Bash
    Steps: cd packages/tasks-core && pnpm vitest run src/tests/TaskRunner.spec.ts
    Expected: 3개 신규 테스트 FAIL, 나머지 PASS. "TaskDIResolutionProblem" 관련 assertion error.
    Evidence: .sisyphus/evidence/task-3-red.txt

  Scenario: 기존 폴백 테스트 삭제 확인
    Tool: Bash
    Steps: grep -n "falling back to manual" packages/tasks-core/src/tests/TaskRunner.spec.ts
    Expected: NO MATCHES
    Evidence: .sisyphus/evidence/task-3-deleted.txt
  ```

  **Commit**: YES | Message: `test(tasks-core): add failing tests for TaskDIResolutionProblem (TDD RED)` | Files: [packages/tasks-core/src/tests/TaskRunner.spec.ts]

- [x] 4. TDD GREEN — createInstance() strict 모드 구현 + 기존 테스트 수정

  **What to do**:
  1. `packages/tasks-core/src/libs/TaskRunner.ts`의 `createInstance()` 메서드(L62-77) 교체:

     **Before (현재)**:
     ```typescript
     private createInstance(target: object): object {
       if (typeof target === 'function') {
         try {
           return Container.get(target as Constructor<object>);
         } catch (error) {
           const targetName = target.name || 'Unknown';
           this.logger.warn('DI resolution failed, falling back to manual instantiation', {
             target: targetName,
             error: error instanceof Error ? error.message : String(error),
           });
           recordError(error);
           return new (target as Constructor<object>)();
         }
       }
       return target;
     }
     ```

     **After (변경)**:
     ```typescript
     private createInstance(target: object): object {
       if (typeof target === 'function') {
         const targetName = target.name || 'Unknown';
         try {
           return Container.get(target as Constructor<object>);
         } catch (error) {
            const wrappedError = error instanceof Error ? error : new Error(String(error), { cause: error });
           throw new TaskDIResolutionProblem(targetName, wrappedError);
         }
       }
       return target;
     }
     ```

  2. `TaskRunner.ts` 상단에 `TaskDIResolutionProblem` import 추가:
     ```typescript
     import { TaskDIResolutionProblem, TaskNotFoundProblem } from './problems/TasksProblems';
     ```

  3. 불필요한 import 제거:
     - `recordError` import가 다른 곳에서 사용되지 않으면 제거 (주의: execute() 메서드의 catch 블록에서는 사용하지 않으므로 제거 가능)

  4. `packages/tasks-core/src/tests/TaskRunner.spec.ts`의 기존 테스트 클래스들에 `@Component()` 추가:
     - `beforeEach` 내 `TestTaskHandler` 클래스 (L39) → `@Component() class TestTaskHandler`
     - 개별 테스트 내 모든 태스크 핸들러 클래스: `StatelessTaskHandler` (L178), `RetryableTaskHandler` (L107), `TaskWithCodeError` (L143), `NonErrorTaskHandler` (L196)
     - `Component` import를 `@croco/framework-context`에서 추가: `import { Component, Container, MetadataStorage } from '@croco/framework-context';`

  **Must NOT do**:
  - `return target` 경로(pre-constructed 인스턴스)를 변경하지 않는다
  - `execute()` 메서드를 변경하지 않는다
  - `noopLogger` 변수를 제거하지 않는다 (다른 용도로 사용될 수 있음)

  **Recommended Agent Profile**:
  - Category: `quick` — 2개 파일, 명확한 변경
  - Skills: [] — 불필요

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: [F1-F4] | Blocked By: [3]

  **References**:
  - Pattern: `packages/tasks-core/src/libs/TaskRunner.ts:62-77` — 수정 대상 (createInstance 메서드)
  - Pattern: `packages/tasks-core/src/libs/TaskRunner.ts:1-6` — 기존 import 목록
  - Pattern: `packages/tasks-core/src/tests/TaskRunner.spec.ts:1-53` — 테스트 setup 구조 (beforeEach, imports)
  - Type: `packages/tasks-core/src/libs/problems/TasksProblems.ts` — TaskDIResolutionProblem 클래스

  **Acceptance Criteria**:
  - [ ] `cd packages/tasks-core && pnpm vitest run src/tests/TaskRunner.spec.ts` — ALL PASS (GREEN 확인)
  - [ ] `grep -n "falling back to manual" packages/tasks-core/src/libs/TaskRunner.ts` — NO MATCHES (폴백 제거됨)
  - [ ] `grep -n "new (target" packages/tasks-core/src/libs/TaskRunner.ts` — NO MATCHES (무인자 생성자 호출 제거됨)
  - [ ] `pnpm typecheck --filter=@croco/tasks-core` — NO ERRORS
  - [ ] `pnpm check` — NO ERRORS (lint 통과)

  **QA Scenarios**:
  ```
  Scenario: GREEN 확인 — 전체 테스트 통과
    Tool: Bash
    Steps: cd packages/tasks-core && pnpm vitest run src/tests/TaskRunner.spec.ts
    Expected: ALL PASS (기존 + 신규 모두)
    Evidence: .sisyphus/evidence/task-4-green.txt

  Scenario: 폴백 코드 완전 제거 확인
    Tool: Bash
    Steps: grep -rn "falling back\|new (target" packages/tasks-core/src/libs/TaskRunner.ts
    Expected: NO MATCHES
    Evidence: .sisyphus/evidence/task-4-no-fallback.txt

  Scenario: 타입체크 통과
    Tool: Bash
    Steps: pnpm typecheck --filter=@croco/tasks-core
    Expected: 에러 없음
    Evidence: .sisyphus/evidence/task-4-typecheck.txt
  ```

  **Commit**: YES | Message: `fix(tasks-core): throw TaskDIResolutionProblem on DI failure instead of silent fallback (#327)` | Files: [packages/tasks-core/src/libs/TaskRunner.ts, packages/tasks-core/src/tests/TaskRunner.spec.ts]

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [x] F1. Plan Compliance Audit — oracle

  **What to do**: 플랜의 모든 태스크가 올바르게 실행되었는지 검증.
  **Recommended Agent Profile**:
  - Category: `unspecified-high` — 종합 검증

  **QA Scenarios**:
  ```
  Scenario: 플랜 준수 확인
    Tool: Bash
    Steps:
      1. grep -n "TaskDIResolutionProblem" packages/tasks-core/src/libs/problems/TasksProblems.ts — 클래스 존재
      2. grep -n "TaskDIResolutionProblem" packages/tasks-core/src/index.ts — export 존재
      3. grep -n "falling back to manual" packages/tasks-core/src/libs/TaskRunner.ts — NO MATCHES
      4. grep -n "new (target" packages/tasks-core/src/libs/TaskRunner.ts — NO MATCHES
      5. grep -c "TaskDIResolutionProblem" packages/tasks-core/src/tests/TaskRunner.spec.ts — 3 이상
    Expected: 1-2 매치, 3-4 무결과, 5 최소 3건
    Evidence: .sisyphus/evidence/f1-compliance.txt
  ```

- [x] F2. Code Quality Review — unspecified-high

  **What to do**: 변경된 코드의 품질 검증 (타입체크, 린트, 코드 패턴).
  **Recommended Agent Profile**:
  - Category: `unspecified-high` — 코드 품질 검증

  **QA Scenarios**:
  ```
  Scenario: 타입체크 + 린트 통과
    Tool: Bash
    Steps:
      1. pnpm typecheck --filter=@croco/tasks-core
      2. pnpm check
    Expected: 둘 다 에러 없음
    Evidence: .sisyphus/evidence/f2-quality.txt

  Scenario: Problem 클래스 패턴 준수
    Tool: Bash
    Steps:
      1. grep -n "extends Problem" packages/tasks-core/src/libs/problems/TasksProblems.ts — TaskDIResolutionProblem이 Problem 상속 확인
      2. grep -n "cause" packages/tasks-core/src/libs/problems/TasksProblems.ts — cause 체이닝 사용 확인
      3. grep -n "extensions" packages/tasks-core/src/libs/problems/TasksProblems.ts — extensions 포함 확인
      4. grep -n "InternalServerError" packages/tasks-core/src/libs/problems/TasksProblems.ts — 카테고리 확인
    Expected: 1에서 TaskDIResolutionProblem extends Problem 매치, 2-4 각각 매치
    Evidence: .sisyphus/evidence/f2-pattern.txt
  ```

- [x] F3. Real Manual QA — unspecified-high

  **What to do**: 전체 테스트 스위트 실행 및 회귀 검증.
  **Recommended Agent Profile**:
  - Category: `unspecified-high` — 테스트 실행

  **QA Scenarios**:
  ```
  Scenario: tasks-core 전체 테스트 통과
    Tool: Bash
    Steps: pnpm test --filter=@croco/tasks-core
    Expected: ALL PASS
    Evidence: .sisyphus/evidence/f3-tests.txt

  Scenario: DI 실패 시 TaskDIResolutionProblem throw 확인
    Tool: Bash
    Steps: cd packages/tasks-core && pnpm vitest run -t "TaskDIResolutionProblem"
    Expected: 3개 테스트 모두 PASS
    Evidence: .sisyphus/evidence/f3-di-failure.txt
  ```

- [x] F4. Scope Fidelity Check — deep

  **What to do**: 변경 범위가 플랜을 벗어나지 않았는지 검증.
  **Recommended Agent Profile**:
  - Category: `deep` — 심층 범위 분석

  **QA Scenarios**:
  ```
  Scenario: 변경 파일 범위 확인
    Tool: Bash
    Steps: git diff --name-only trunk
    Expected: 변경 파일이 아래 목록에만 포함:
      - packages/tasks-core/src/libs/TaskRunner.ts
      - packages/tasks-core/src/libs/problems/TasksProblems.ts
      - packages/tasks-core/src/tests/TaskRunner.spec.ts
      - packages/tasks-core/src/index.ts
    Evidence: .sisyphus/evidence/f4-scope.txt

  Scenario: 금지 변경 없음 확인
    Tool: Bash
    Steps:
      1. git diff trunk -- packages/tasks-core/src/libs/decorators/ — 빈 결과 (데코레이터 미변경)
      2. git diff trunk -- packages/tasks-core/README.md — 빈 결과 (README 미변경)
    Expected: 둘 다 빈 결과
    Evidence: .sisyphus/evidence/f4-no-forbidden.txt
  ```

## Commit Strategy
| Task | Commit | Message |
|------|--------|---------|
| 1 | NO | — |
| 2 | YES | `feat(tasks-core): add TaskDIResolutionProblem class for explicit DI failure reporting` |
| 3 | YES | `test(tasks-core): add failing tests for TaskDIResolutionProblem (TDD RED)` |
| 4 | YES | `fix(tasks-core): throw TaskDIResolutionProblem on DI failure instead of silent fallback (#327)` |

## Success Criteria
- DI 해석 실패 시 `TaskDIResolutionProblem`이 throw됨 (무인자 폴백 없음)
- 에러 메시지에 태스크 클래스명 + 해결 힌트 포함
- 원본 에러가 `cause`로 체이닝됨
- 모든 기존 테스트 통과 + 3개 신규 테스트 통과
- 타입체크, 린트 통과
