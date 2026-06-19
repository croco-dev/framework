import { PaymentDeclinedProblem } from "../domain/Problems";
import type { PaymentGateway, PaymentRequest, PaymentResult } from "../domain/types";

export const PAYMENT_GATEWAY_TOKEN = Symbol.for("@croco-example/golden-path/payment-gateway");

export class ScriptedPaymentGateway implements PaymentGateway {
  private readonly attempts = new Map<string, number>();

  async charge(request: PaymentRequest): Promise<PaymentResult> {
    const attemptCount = this.incrementAttempt(request.orderId);

    if (request.paymentToken === "card_declined") {
      throw new PaymentDeclinedProblem("card_declined");
    }

    if (request.paymentToken === "retry_once" && attemptCount === 1) {
      throw new Error("Transient gateway timeout");
    }

    return {
      attemptCount,
      paymentId: `pay_${request.orderId}_${attemptCount}`,
    };
  }

  getAttemptCount(orderId: string): number {
    return this.attempts.get(orderId) ?? 0;
  }

  private incrementAttempt(orderId: string): number {
    const attemptCount = this.getAttemptCount(orderId) + 1;
    this.attempts.set(orderId, attemptCount);
    return attemptCount;
  }
}
