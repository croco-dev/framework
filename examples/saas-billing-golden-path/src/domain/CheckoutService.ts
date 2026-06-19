import { EventBusConfig, EventPublisher } from "@croco/events-core";
import { Container } from "@croco/framework-context";
import { NoBackoff, RetryTemplate } from "@croco/retry-core";
import { recordEvent, withSpan } from "@croco/telemetry-api";
import { TxManagerRegistry } from "@croco/tx-core";
import { OrderPaidEvent } from "../events/OrderPaidEvent";
import { PAYMENT_GATEWAY_TOKEN } from "../integrations/ScriptedPaymentGateway";
import type { InMemoryTxClient } from "../integrations/InMemoryTxAdapter";
import { ORDER_REPOSITORY_TOKEN } from "./InMemoryOrderRepository";
import { calculateAmountCents, isPlanId } from "./Plans";
import { CheckoutValidationProblem, OrderNotFoundProblem } from "./Problems";
import type {
  CheckoutRequest,
  CheckoutResponse,
  Order,
  OrderRepository,
  PaymentGateway,
} from "./types";

export class CheckoutService {
  private readonly orders = Container.get<OrderRepository>(ORDER_REPOSITORY_TOKEN);
  private readonly payments = Container.get<PaymentGateway>(PAYMENT_GATEWAY_TOKEN);
  private readonly publisher = new EventPublisher(EventBusConfig.getInstance());
  private readonly retry = new RetryTemplate({
    backoffPolicy: new NoBackoff(),
    maxAttempts: 2,
  });
  private readonly txManager = TxManagerRegistry.get<InMemoryTxClient>();

  async checkout(rawInput: CheckoutRequest): Promise<CheckoutResponse> {
    const input = normalizeCheckoutRequest(rawInput);
    const orderId = this.orders.nextOrderId();
    const amountCents = calculateAmountCents(input.planId, input.seats);

    return await withSpan(
      async () => {
        const payment = await this.retry.execute(async (context) => {
          recordEvent("checkout.payment.attempt", {
            attempt: context.attempt,
            orderId,
            planId: input.planId,
          });

          return await this.payments.charge({
            amountCents,
            currency: "USD",
            customerId: input.customerId,
            orderId,
            paymentToken: input.paymentToken,
          });
        });

        const order = await this.txManager.run(async () => {
          const paidOrder = this.orders.save({
            amountCents,
            createdAt: new Date().toISOString(),
            currency: "USD",
            customerId: input.customerId,
            id: orderId,
            paymentId: payment.paymentId,
            planId: input.planId,
            seats: input.seats,
            status: "paid",
          });

          this.publisher.publishAfterCommit(
            new OrderPaidEvent({
              amountCents: paidOrder.amountCents,
              customerId: paidOrder.customerId,
              orderId: paidOrder.id,
              paymentId: paidOrder.paymentId,
            }),
          );

          recordEvent("checkout.order.paid", {
            amountCents: paidOrder.amountCents,
            orderId: paidOrder.id,
            planId: paidOrder.planId,
          });

          return paidOrder;
        });

        return {
          order,
          paymentAttempts: payment.attemptCount,
        };
      },
      {
        attributes: {
          "checkout.customer_id": input.customerId,
          "checkout.order_id": orderId,
          "checkout.plan_id": input.planId,
        },
        name: "golden-path.checkout",
      },
    );
  }

  getOrder(orderId: string): Order {
    const order = this.orders.findById(orderId);
    if (!order) {
      throw new OrderNotFoundProblem(orderId);
    }

    return order;
  }
}

function normalizeCheckoutRequest(rawInput: CheckoutRequest): CheckoutRequest {
  const input = rawInput as Partial<CheckoutRequest>;
  const customerId = input.customerId;
  const paymentToken = input.paymentToken;
  const planId = input.planId;
  const seats = input.seats;

  if (typeof customerId !== "string" || customerId.trim() === "") {
    throw new CheckoutValidationProblem("customerId is required.");
  }

  if (!isPlanId(planId)) {
    throw new CheckoutValidationProblem("planId must be 'starter' or 'growth'.");
  }

  if (typeof seats !== "number" || !Number.isInteger(seats) || seats < 1 || seats > 100) {
    throw new CheckoutValidationProblem("seats must be an integer between 1 and 100.");
  }

  if (typeof paymentToken !== "string" || paymentToken.trim() === "") {
    throw new CheckoutValidationProblem("paymentToken is required.");
  }

  return {
    customerId,
    paymentToken,
    planId,
    seats,
  };
}
