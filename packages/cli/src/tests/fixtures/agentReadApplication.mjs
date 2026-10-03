import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { MetricReadService } from "@croco/metrics-core/runtime";
import application, {
  createExampleComponents,
  definition,
} from "../../../examples/agent-read/application.mjs";

console.log("agent fixture startup");
console.info("agent fixture info");
console.debug("agent fixture debug");
const root = process.env.CROCO_AGENT_EXAMPLE_ROOT;
if (!root) throw new TypeError("Missing fixture root");
if (process.env.CROCO_AGENT_TEST_DELAY === "true") {
  const components = createExampleComponents(root);
  const queries = components.queries.map((query) => ({
    ...query,
    readExecutor: async ({ signal }) => {
      return new Promise((_resolve, reject) => {
        const onAbort = () => {
          void writeFile(join(root, "executor-cancelled"), "cancelled").then(
            () => reject(signal.reason),
            reject,
          );
        };
        signal.addEventListener("abort", onAbort, { once: true });
        if (signal.aborted) onAbort();
        else void writeFile(join(root, "executor-started"), "started").catch(reject);
      });
    },
  }));
  application.service = new MetricReadService(
    [definition],
    queries,
    components.authority,
    components.reports,
  );
}
export default application;
