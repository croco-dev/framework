import { runAiSaasDemoFlow } from "../aiSaas";
import { assertAiSaasSmokeContract } from "./aiSmokeContract";

async function main(): Promise<void> {
  const snapshot = await runAiSaasDemoFlow();
  assertAiSaasSmokeContract(snapshot);

  console.log(
    [
      "AI SaaS smoke passed",
      `tenant=${snapshot.tenant.id}`,
      `plan=${snapshot.tenant.planId}`,
      `model=${snapshot.generation.modelId}`,
      `tokens=${snapshot.usage.usage.totalTokens}`,
      `cost=${snapshot.usage.usage.costUsd}`,
      `remainingTokens=${snapshot.usage.quota.remainingTokens}`,
      `requestStatus=${snapshot.evalLog.last.status}`,
    ].join(" "),
  );
}

void main();
