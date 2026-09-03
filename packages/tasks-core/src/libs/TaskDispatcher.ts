import { Token } from "@croco/framework-context";

export type TaskDispatchOptions = {
  readonly delay?: number;
  readonly headers?: Record<string, string>;
  readonly idempotencyKey?: string;
};

export type TaskDispatchResult = {
  readonly messageId: string;
};

/** Provider-neutral contract for dispatching a task to an external execution service. */
export interface TaskDispatcher {
  execute(
    taskId: string,
    payload: unknown,
    options?: TaskDispatchOptions,
  ): Promise<TaskDispatchResult>;
}

/** Application composition token for the selected external task dispatcher. */
export const TASK_DISPATCHER_TOKEN = new Token<TaskDispatcher>("TaskDispatcher");
