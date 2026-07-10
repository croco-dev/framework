import { seedDefaultSaasRuntime } from "../saasDemo";

async function main(): Promise<void> {
  const snapshot = await seedDefaultSaasRuntime();

  console.log(JSON.stringify(snapshot, null, 2));
}

void main();
