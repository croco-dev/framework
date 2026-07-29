import type { TxRunOutcome } from "@croco/tx-core";

export type PlanId = "starter" | "growth";

export type CheckoutRequest = {
  readonly customerId: string;
  readonly paymentToken: string;
  readonly planId: PlanId;
  readonly seats: number;
};

export type OrderStatus = "paid";

export type Order = {
  readonly id: string;
  readonly amountCents: number;
  readonly createdAt: string;
  readonly currency: "USD";
  readonly customerId: string;
  readonly paymentId: string;
  readonly planId: PlanId;
  readonly seats: number;
  readonly status: OrderStatus;
};

export type CheckoutResponse = {
  readonly paymentAttempts: number;
  readonly transaction: TxRunOutcome<Order>;
};

export type AuditEntry = {
  readonly at: string;
  readonly eventName: string;
  readonly message: string;
  readonly orderId: string;
};

export type PaymentRequest = {
  readonly amountCents: number;
  readonly currency: "USD";
  readonly customerId: string;
  readonly orderId: string;
  readonly paymentToken: string;
};

export type PaymentResult = {
  readonly attemptCount: number;
  readonly paymentId: string;
};

export interface PaymentGateway {
  charge(request: PaymentRequest): Promise<PaymentResult>;
}

export interface OrderRepository {
  nextOrderId(): string;
  findById(orderId: string): Order | null;
  list(): readonly Order[];
  save(order: Order): Order;
}
