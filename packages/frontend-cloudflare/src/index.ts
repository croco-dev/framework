import { createSsrHandler } from "./libs/CloudflareSsrHandler";

const fetch = createSsrHandler();

export default { fetch };
export { createSsrHandler };
export type { SsrHandlerOptions, SsrWorkerEnv } from "./libs/types";
