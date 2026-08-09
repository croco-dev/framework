import { recoverPendingBillableUsage } from "../saasDemo";

void recoverPendingBillableUsage().then((result) => {
  process.stdout.write(`${JSON.stringify(result)}\n`);
});
