import { defineCrocoModule, defineCrocoPlugin } from "@croco/framework-module";
import type { PluginFactory } from "@croco/framework-module";
import { TASK_DISPATCHER_TOKEN } from "@croco/tasks-core";
import { QStashTaskRunner, type QStashTaskRunnerOptions } from "./QStashTaskRunner";

export const QSTASH_TASKS_MODULE_NAME = "@croco/tasks-qstash/dispatcher";

export type QStashTasksPluginOptions = QStashTaskRunnerOptions;

export const qstashTasks: PluginFactory<QStashTasksPluginOptions> = (options) => {
  const runnerOptions: QStashTaskRunnerOptions = Object.freeze({
    token: options.token,
    destinationUrl: options.destinationUrl,
    ...(options.defaultDelay !== undefined ? { defaultDelay: options.defaultDelay } : {}),
    ...(options.defaultHeaders ? { defaultHeaders: { ...options.defaultHeaders } } : {}),
  });

  return defineCrocoPlugin({
    metadata: {
      name: "qstash-tasks",
      packageName: "@croco/tasks-qstash",
      maturity: "alpha",
      providedContracts: ["@croco/tasks-core/TaskDispatcher"],
      capabilities: [{ id: "tasks.dispatcher", kind: "single" }],
      runtimeCompatibility: ["node", "lambda"],
      configuration: [
        {
          key: "UPSTASH_QSTASH_TOKEN",
          required: true,
          sensitive: true,
          description: "QStash token used to publish task messages.",
        },
        {
          key: "UPSTASH_QSTASH_DESTINATION_URL",
          required: true,
          description: "HTTPS endpoint that receives dispatched task messages.",
        },
        {
          key: "defaultDelay",
          required: false,
          description: "Optional default message delay in seconds.",
        },
        {
          key: "defaultHeaders",
          required: false,
          description: "Optional headers included with every task message.",
        },
      ],
      verification: [
        {
          command: "pnpm --filter @croco/tasks-qstash test",
          reference: "packages/tasks-qstash/src/tests/QStashTasksPlugin.spec.ts",
        },
      ],
      examples: ["packages/tasks-qstash/README.md#canonical-module-plugin"],
    },
    modules: [
      defineCrocoModule({
        name: QSTASH_TASKS_MODULE_NAME,
        providers: [
          {
            provide: TASK_DISPATCHER_TOKEN,
            useFactory: () => new QStashTaskRunner(runnerOptions),
          },
        ],
        exports: [TASK_DISPATCHER_TOKEN],
      }),
    ],
  });
};
