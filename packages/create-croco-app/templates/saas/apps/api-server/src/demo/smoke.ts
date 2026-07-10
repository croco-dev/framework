import { seedDefaultSaasRuntime } from "../saasDemo";
import { assertSaasSmokeContract } from "./saasSmokeContract";

async function main(): Promise<void> {
  const snapshot = await seedDefaultSaasRuntime();
  assertSaasSmokeContract(snapshot);

  console.log("SaaS golden path smoke passed");
}

void main();
