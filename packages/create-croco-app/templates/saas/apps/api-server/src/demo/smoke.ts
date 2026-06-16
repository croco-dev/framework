import { assertSaasDemoSnapshot, runSaasDemoFlow } from "../saasDemo";

async function main(): Promise<void> {
  const snapshot = await runSaasDemoFlow();
  assertSaasDemoSnapshot(snapshot);

  console.log("SaaS golden path smoke passed");
}

void main();
