import { defineCrocoModule, defineCrocoPlugin } from "@croco/framework-module";
import type { PluginFactory } from "@croco/framework-module";
import { TASK_DISPATCHER_TOKEN } from "@croco/tasks-core";
import { SqsTaskDispatcher } from "./SqsTaskDispatcher";
import type { SqsTaskDispatcherOptions } from "./SqsTaskDispatcher";

export const sqsTasks: PluginFactory<SqsTaskDispatcherOptions> = (options) => {
  const snapshot = Object.freeze({ ...options });
  return defineCrocoPlugin({
    metadata: {
      name: "sqs-tasks",
      packageName: "@croco/tasks-sqs",
      maturity: "alpha",
      providedContracts: ["@croco/tasks-core/TaskDispatcher"],
      capabilities: [{ id: "tasks.dispatcher", kind: "single" }],
      runtimeCompatibility: ["node", "lambda"],
      configuration: [
        { key: "queueUrl", required: true, description: "Trusted SQS destination URL." },
        {
          key: "tenantId",
          required: true,
          description: "Server-configured queue tenant authority.",
        },
        {
          key: "region",
          required: true,
          description: "AWS region used by the SDK credential chain.",
        },
      ],
      verification: [
        {
          command: "pnpm --filter @croco/tasks-sqs test",
          reference: "packages/tasks-sqs/src/tests/SqsTasks.spec.ts",
        },
      ],
      examples: ["packages/tasks-sqs/README.md"],
    },
    modules: [
      defineCrocoModule({
        name: "@croco/tasks-sqs/dispatcher",
        providers: [
          { provide: TASK_DISPATCHER_TOKEN, useFactory: () => new SqsTaskDispatcher(snapshot) },
        ],
        exports: [TASK_DISPATCHER_TOKEN],
        shutdown: (context) => {
          (context.get(TASK_DISPATCHER_TOKEN) as SqsTaskDispatcher).dispose();
        },
      }),
    ],
  });
};
