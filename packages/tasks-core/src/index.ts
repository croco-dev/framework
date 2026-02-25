// @croco/tasks-core
// Task definition and runner for croco framework

// Decorator
export { TASK_METADATA_KEY, Task } from './libs/decorators/Task';
export { TaskNotFoundProblem } from './libs/problems/TasksProblems';
export type { RegisteredTask } from './libs/TaskRegistry';
// Registry
export { TaskRegistry } from './libs/TaskRegistry';
// Core
export { TaskRunner } from './libs/TaskRunner';
// Types
export type { TaskMetadata, TaskOptions, TaskReference } from './libs/types';
