import { defineCrocoApplication } from "@croco/framework-module";
import { qstashTasks } from "@croco/tasks-qstash";
import { nodeTelemetry } from "@croco/telemetry-sdk-node";

export function createTasksTelemetryExample() {
  return defineCrocoApplication({
    name: "first-party-tasks-telemetry-example",
    imports: [
      qstashTasks({
        token: "zero-credential-qstash-token",
        destinationUrl: "https://example.test/tasks",
      }),
      nodeTelemetry({
        serviceName: "first-party-plugin-example",
        enabled: false,
        trace: { enabled: false },
      }),
    ],
  });
}
