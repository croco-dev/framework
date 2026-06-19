import { Problem, ProblemCategory } from "@croco/problems-core";

export class CheckoutValidationProblem extends Problem {
  constructor(detail: string) {
    super("golden-path/checkout-validation", ProblemCategory.ValidationError, detail);
  }
}

export class OrderNotFoundProblem extends Problem {
  constructor(orderId: string) {
    super(
      "golden-path/order-not-found",
      ProblemCategory.NotFound,
      `Order '${orderId}' was not found.`,
    );
  }
}

export class PaymentDeclinedProblem extends Problem {
  constructor(reason: string) {
    super(
      "golden-path/payment-declined",
      ProblemCategory.BusinessRuleViolation,
      "Payment was declined by the gateway.",
      {
        extensions: { reason },
      },
    );
  }
}
