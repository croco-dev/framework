import { Token } from "@croco/framework-context";
import type { BillingGateway } from "./BillingGateway";

/** Application composition token for the selected billing gateway. */
export const BILLING_GATEWAY_TOKEN = new Token<BillingGateway>("BillingGateway");
