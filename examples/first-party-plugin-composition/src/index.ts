import { createAuthExample } from "./auth";
import { createBillingExample } from "./billing";
import { createDatastoreExample } from "./datastore";
import { createProductionGoldenPathApplication } from "./productionGoldenPath";
import { inspectApplication } from "./shared";
import { createTasksTelemetryExample } from "./tasksTelemetry";

const examples = {
  auth: createAuthExample(),
  billing: createBillingExample(),
  datastore: createDatastoreExample(),
  productionGoldenPath: createProductionGoldenPathApplication(),
  tasksTelemetry: createTasksTelemetryExample(),
};

console.log(
  JSON.stringify(
    Object.fromEntries(
      Object.entries(examples).map(([name, application]) => [
        name,
        inspectApplication(application),
      ]),
    ),
    null,
    2,
  ),
);
