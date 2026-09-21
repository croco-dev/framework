import { polarBilling } from "@croco/billing-polar";
import { defineCrocoApplication } from "@croco/framework-module";
import { exampleLogger } from "./shared";

export function createBillingExample() {
  return defineCrocoApplication({
    name: "first-party-billing-example",
    imports: [
      polarBilling({
        accessToken: "zero-credential-polar-token",
        environment: "sandbox",
        webhookSecret: "zero-credential-polar-webhook",
        logger: exampleLogger,
      }),
    ],
  });
}
