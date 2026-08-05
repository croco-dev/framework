import { createSsrHandler } from "./libs/CloudflareSsrHandler";
export { SSR_FAILURE_CODES } from "./libs/types";

const fetch = createSsrHandler();

export default { fetch };
export { createSsrHandler };
export type {
  SsrFailureBoundary,
  SsrFailureCode,
  SsrFailureReport,
  SsrFailureReporter,
  SsrHandlerOptions,
  SsrWorkerEnv,
} from "./libs/types";
