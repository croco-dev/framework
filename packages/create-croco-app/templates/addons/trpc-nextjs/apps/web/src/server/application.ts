import "reflect-metadata";
import { createApplicationRuntime } from "@croco/framework-module";
import { generatedDiGraph } from "../../.croco/di.generated";

export const application = createApplicationRuntime({}, generatedDiGraph);
