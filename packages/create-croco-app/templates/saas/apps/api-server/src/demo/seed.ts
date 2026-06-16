import { runSaasDemoFlow } from "../saasDemo";

async function main(): Promise<void> {
  const snapshot = await runSaasDemoFlow();

  console.log(JSON.stringify(snapshot, null, 2));
}

void main();
