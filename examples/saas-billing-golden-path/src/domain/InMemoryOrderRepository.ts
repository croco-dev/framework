import type { Order, OrderRepository } from "./types";

export const ORDER_REPOSITORY_TOKEN = Symbol.for("@croco-example/golden-path/order-repository");

export class InMemoryOrderRepository implements OrderRepository {
  private readonly orders = new Map<string, Order>();
  private sequence = 0;

  nextOrderId(): string {
    this.sequence += 1;
    return `ord_${this.sequence.toString().padStart(4, "0")}`;
  }

  findById(orderId: string): Order | null {
    const order = this.orders.get(orderId);
    return order ? { ...order } : null;
  }

  list(): readonly Order[] {
    return Array.from(this.orders.values(), (order) => ({ ...order }));
  }

  save(order: Order): Order {
    const snapshot = { ...order };
    this.orders.set(snapshot.id, snapshot);
    return { ...snapshot };
  }
}
