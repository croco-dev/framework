import { startNodeApplication } from "./node-application";
export { startNodeApplication } from "./node-application";
export type { RunningNodeApplication } from "./node-application";

function reportFatal(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
}

async function main(): Promise<void> {
  const running = await startNodeApplication();
  const shutdown = () => {
    void running.close().catch(reportFatal);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

if (require.main === module) {
  void main().catch(reportFatal);
}
