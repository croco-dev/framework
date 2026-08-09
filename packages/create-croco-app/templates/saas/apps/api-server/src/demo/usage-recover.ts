import { Problem } from "@croco/problems-core";
import { recoverPendingBillableUsage } from "../saasDemo";

void main();

async function main(): Promise<void> {
  try {
    const result = await recoverPendingBillableUsage();
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    const diagnostic =
      error instanceof Problem
        ? error.toJSON()
        : { code: "saas-demo/usage-recovery-failed", message: String(error) };
    process.stderr.write(`${JSON.stringify(diagnostic)}\n`);
    process.exitCode = 1;
  }
}
