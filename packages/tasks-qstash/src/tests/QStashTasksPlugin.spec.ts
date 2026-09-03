import { createApplicationRuntime, defineCrocoApplication } from "@croco/framework-module";
import { TASK_DISPATCHER_TOKEN } from "@croco/tasks-core";
import { describe, expect, it } from "vitest";
import { QSTASH_TASKS_MODULE_NAME, QStashTaskRunner, qstashTasks } from "../index";

describe("qstashTasks", () => {
  it("owns the external task dispatcher slot in the application graph", async () => {
    const plugin = qstashTasks({
      token: "qstash-secret-token",
      destinationUrl: "https://example.com/tasks/webhook",
      defaultDelay: 15,
    });
    const runtime = createApplicationRuntime(
      defineCrocoApplication({ name: "qstash-test", imports: [plugin] }),
    );

    await runtime.initialize();

    expect(runtime.get(TASK_DISPATCHER_TOKEN)).toBeInstanceOf(QStashTaskRunner);
    expect(runtime.createGraphManifest()).toMatchObject({
      applicationName: "qstash-test",
      plugins: [
        {
          name: "qstash-tasks",
          packageName: "@croco/tasks-qstash",
          maturity: "alpha",
          capabilities: [{ id: "tasks.dispatcher", kind: "single" }],
          runtimeCompatibility: ["node", "lambda"],
        },
      ],
      moduleGraph: {
        status: "ready",
        modules: [
          {
            name: QSTASH_TASKS_MODULE_NAME,
            providers: [{ token: "TaskDispatcher", provider: "factory" }],
            exports: ["TaskDispatcher"],
          },
        ],
      },
    });
    expect(JSON.stringify(runtime.createGraphManifest())).not.toContain("qstash-secret-token");
    expect(JSON.stringify(runtime.createGraphManifest())).not.toContain(
      "https://example.com/tasks/webhook",
    );

    await runtime.dispose();
  });

  it("publishes inspectable configuration and verification metadata", () => {
    const plugin = qstashTasks({
      token: "never-serialize-token",
      destinationUrl: "https://example.com/tasks/webhook",
    });

    expect(plugin.metadata).toMatchObject({
      name: "qstash-tasks",
      packageName: "@croco/tasks-qstash",
      maturity: "alpha",
      providedContracts: ["@croco/tasks-core/TaskDispatcher"],
      capabilities: [{ id: "tasks.dispatcher", kind: "single" }],
      configuration: [
        { key: "UPSTASH_QSTASH_TOKEN", required: true, sensitive: true },
        {
          key: "UPSTASH_QSTASH_DESTINATION_URL",
          required: true,
          description: "HTTPS endpoint that receives dispatched task messages.",
        },
        { key: "defaultDelay", required: false },
        { key: "defaultHeaders", required: false },
      ],
      verification: [
        {
          command: "pnpm --filter @croco/tasks-qstash test",
          reference: "packages/tasks-qstash/src/tests/QStashTasksPlugin.spec.ts",
        },
      ],
      examples: ["packages/tasks-qstash/README.md#canonical-module-plugin"],
    });
    expect(JSON.stringify(plugin.metadata)).not.toContain("never-serialize-token");
    expect(JSON.stringify(plugin.metadata)).not.toContain("https://example.com/tasks/webhook");
  });
});
