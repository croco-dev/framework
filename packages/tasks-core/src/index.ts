/**
 * 태스크 메타데이터 키와 메서드 데코레이터를 제공합니다.
 */
export { TASK_METADATA_KEY, Task } from './libs/decorators/Task';

/**
 * 등록되지 않은 태스크 실행 시 발생하는 Problem 하위 타입입니다.
 */
export { DuplicateTaskRegistrationProblem, TaskNotFoundProblem } from './libs/problems/TasksProblems';

/**
 * 레지스트리에 등록된 태스크 엔트리 타입입니다.
 */
export type { RegisteredTask } from './libs/TaskRegistry';

/**
 * 태스크 메타데이터를 수집하고 조회하는 전역 레지스트리입니다.
 */
export { TaskRegistry } from './libs/TaskRegistry';

/**
 * 등록된 태스크를 실행 시스템과 연결해 실행하는 러너입니다.
 */
export { TaskRunner } from './libs/TaskRunner';

/**
 * 태스크 선언과 식별에 사용하는 공개 타입들입니다.
 */
export type { TaskMetadata, TaskOptions, TaskReference } from './libs/types';
