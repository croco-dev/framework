import { defineCrocoModule, defineCrocoPlugin } from "@croco/framework-module";
import type { ModuleToken, PluginFactory } from "@croco/framework-module";
import { TASK_DISPATCHER_TOKEN } from "@croco/tasks-core";
import { SqsTaskDispatcher } from "./SqsTaskDispatcher";
import type { SqsTaskDispatcherOptions } from "./SqsTaskDispatcher";

type SqsDispatcherOwner = { dispatcher: SqsTaskDispatcher | undefined };

const SQS_DISPATCHER_OWNER_TOKEN = Symbol(
  "@croco/tasks-sqs/dispatcher-owner",
) as ModuleToken<SqsDispatcherOwner>;

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
          { provide: SQS_DISPATCHER_OWNER_TOKEN, useFactory: () => ({ dispatcher: undefined }) },
          {
            provide: TASK_DISPATCHER_TOKEN,
            useFactory: (context) => {
              const dispatcher = new SqsTaskDispatcher(snapshot);
              context.get(SQS_DISPATCHER_OWNER_TOKEN).dispatcher = dispatcher;
              return dispatcher;
            },
          },
        ],
        exports: [TASK_DISPATCHER_TOKEN],
        shutdown: (context) => {
          const owner = context.get(SQS_DISPATCHER_OWNER_TOKEN);
          owner.dispatcher?.dispose();
          owner.dispatcher = undefined;
        },
      }),
    ],
  });
};
